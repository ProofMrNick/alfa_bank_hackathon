import db from './db.js'
import bkiDb from '../mockDatabase/bki_db.js'
import fnsDb from '../mockDatabase/fns_db.js'
import { APPLICATION_STATUS, DECISION_STATUS, isDecisionType } from './applicationContract.js'

const PURPOSES = ['WORKING_CAPITAL', 'EQUIPMENT', 'CURRENT_ACTIVITY']

export function setApplicationStatus(applicationId, status, { comment = null, metadata = null } = {}) {
    const result = db.prepare('UPDATE applications SET status = ? WHERE global_id = ?').run(status, applicationId)
    if (result.changes === 0) throw new Error(`Application ${applicationId} not found`)
    if (comment !== null || metadata !== null) {
        db.prepare(`
            UPDATE applications_logs SET comment = COALESCE(?, comment), metadata = COALESCE(?, metadata)
            WHERE id = (SELECT id FROM applications_logs WHERE application_global_id = ? ORDER BY id DESC LIMIT 1)
        `).run(comment, metadata === null ? null : JSON.stringify(metadata), applicationId)
    }
}

export function buildScoringPayload(applicationId, trigger = 'SUBMIT') {
    const application = db.prepare('SELECT * FROM applications WHERE global_id = ?').get(applicationId)
    if (!application) throw new Error(`Application ${applicationId} not found`)
    const fns = fnsDb.prepare('SELECT * FROM fns WHERE inn = ?').get(application.inn)
    if (!fns) throw new Error(`FNS data for INN ${application.inn} not found`)
    const bki = bkiDb.prepare('SELECT * FROM bki WHERE inn = ?').get(application.inn) || null
    const internal = db.prepare('SELECT * FROM registry_internal WHERE inn = ?').get(application.inn) || null
    const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(application.loan_id)
    if (!loan) throw new Error(`Product ${application.loan_id} not found`)

    return {
        application_id: application.global_id,
        trigger,
        fns,
        bki,
        internal,
        application: {
            requested_amount: application.loan_sum,
            requested_term_months: application.loan_duration,
            purpose: PURPOSES.includes(application.purpose) ? application.purpose : 'CURRENT_ACTIVITY',
            declared_annual_revenue: internal?.avg_monthly_inflow == null ? null : internal.avg_monthly_inflow * 12,
            product_id: application.loan_id,
        },
        products: [{
            id: loan.id,
            name: loan.name,
            min_amount: loan.min_amount,
            max_amount: loan.max_amount,
            min_term_months: 1,
            max_term_months: loan.duration,
            base_rate: loan.interest_rate,
            allowed_purposes: PURPOSES,
        }],
    }
}

export function applyDecision(applicationId, decision, { source = 'EMPLOYEE' } = {}) {
    if (!decision || !isDecisionType(decision.type)) {
        const error = new Error('Invalid decision type')
        error.statusCode = 400
        throw error
    }
    const application = db.prepare('SELECT * FROM applications WHERE global_id = ?').get(applicationId)
    if (!application) {
        const error = new Error('Application not found')
        error.statusCode = 404
        throw error
    }

    const status = DECISION_STATUS[decision.type]
    const missingFields = Array.isArray(decision.missingFields)
        ? decision.missingFields
        : (decision.missing_fields || [])
    const approvedAmount = decision.approvedAmount ?? decision.approved_amount ?? null
    const approvedTerm = decision.approvedTermMonths ?? decision.approved_term_months ?? null
    const approvedRate = decision.approvedRate ?? decision.approved_rate ?? null
    const reason = decision.reason || null
    const comment = decision.comment || null

    db.prepare(`
        UPDATE applications
        SET status = ?, approved_amount = ?, approved_term_months = ?, approved_rate = ?,
            missing_fields = ?, decision_reason = ?, decision_comment = ?
        WHERE global_id = ?
    `).run(status, approvedAmount, approvedTerm, approvedRate, JSON.stringify(missingFields), reason, comment, applicationId)

    db.prepare(`
        UPDATE applications_logs SET comment = ?, metadata = ?
        WHERE id = (SELECT id FROM applications_logs WHERE application_global_id = ? ORDER BY id DESC LIMIT 1)
    `).run(comment, JSON.stringify({ source, decisionType: decision.type, reason, missingFields }), applicationId)

    return db.prepare('SELECT * FROM applications WHERE global_id = ?').get(applicationId)
}

function saveScoringResult(applicationId, evaluation, trigger) {
    const risk = evaluation.risk || {}
    const decision = evaluation.decision || {}
    const nextVersion = db.prepare(
        'SELECT COALESCE(MAX(version), 0) + 1 AS value FROM scoring_results WHERE application_id = ?'
    ).get(applicationId).value
    db.prepare(`
        INSERT INTO scoring_results
            (application_id, score, risk_level, default_probability, model_version,
             factors, reason_codes, trigger, version)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        applicationId,
        risk.risk_score ?? null,
        risk.risk_level ?? null,
        risk.default_probability ?? null,
        risk.model_version ?? null,
        JSON.stringify(risk.factors || []),
        JSON.stringify(risk.stop_factors || [decision.reason].filter(Boolean)),
        trigger,
        nextVersion,
    )
    if (risk.risk_score != null) {
        const inn = db.prepare('SELECT inn FROM applications WHERE global_id = ?').get(applicationId)?.inn
        db.prepare('UPDATE user_info SET risk_score = ?, risk_score_timestamp = CURRENT_TIMESTAMP WHERE inn = ?')
            .run(risk.risk_score, inn)
    }
}

export async function runApplicationWorkflow(applicationId, trigger = 'SUBMIT', submission = {}) {
    setApplicationStatus(applicationId, APPLICATION_STATUS.SUBMITTED, {
        comment: submission.comment || 'Заявка передана в обработку',
        metadata: submission.metadata || null,
    })
    setApplicationStatus(applicationId, APPLICATION_STATUS.ENRICHMENT, { comment: 'Получены данные ФНС, БКИ и внутренних систем' })
    const payload = buildScoringPayload(applicationId, trigger)
    setApplicationStatus(applicationId, APPLICATION_STATUS.SCORING, { comment: 'Запущена скоринговая модель' })

    const scoringUrl = process.env.SCORING_URL || 'http://127.0.0.1:8000'
    try {
        const response = await fetch(`${scoringUrl}/v1/evaluate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        })
        const evaluation = await response.json()
        if (!response.ok) throw new Error(`Scoring returned ${response.status}: ${JSON.stringify(evaluation)}`)
        saveScoringResult(applicationId, evaluation, trigger)
        if (evaluation.decision) {
            const application = applyDecision(applicationId, evaluation.decision, { source: 'SCORING' })
            return { application, evaluation }
        }
        setApplicationStatus(applicationId, APPLICATION_STATUS.UNDER_REVIEW, { comment: 'Требуется решение сотрудника' })
        return { application: db.prepare('SELECT * FROM applications WHERE global_id = ?').get(applicationId), evaluation }
    } catch (error) {
        console.error(`Application ${applicationId} scoring failed:`, error.message)
        setApplicationStatus(applicationId, APPLICATION_STATUS.UNDER_REVIEW, {
            comment: 'Автоматический scoring недоступен, заявка передана сотруднику',
            metadata: { scoringError: error.message },
        })
        return {
            application: db.prepare('SELECT * FROM applications WHERE global_id = ?').get(applicationId),
            evaluation: null,
            warning: 'SCORING_UNAVAILABLE',
        }
    }
}
