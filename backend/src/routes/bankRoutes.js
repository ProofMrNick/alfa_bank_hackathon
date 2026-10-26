import express from 'express'
import db from '../db.js'
import bkiDb from '../../mockDatabase/bki_db.js'
import fnsDb from '../../mockDatabase/fns_db.js'
import { applyDecision, runApplicationWorkflow } from '../applicationWorkflow.js'

const router = express.Router()

function parseJson(value, fallback) {
    if (value == null) return fallback
    try { return JSON.parse(value) } catch { return fallback }
}

function presentQueueRow(row) {
    return {
        ...row,
        factors: parseJson(row.factors, []),
        reason_codes: parseJson(row.reason_codes, []),
        missing_fields: parseJson(row.missing_fields, []),
    }
}

router.get('/applications', (req, res) => {
    const conditions = []
    const parameters = []
    if (req.query.status && req.query.status !== 'ALL') {
        conditions.push('a.status = ?')
        parameters.push(req.query.status)
    }
    if (req.query.risk && req.query.risk !== 'ALL') {
        conditions.push('sr.risk_level = ?')
        parameters.push(req.query.risk)
    }
    if (req.query.search) {
        conditions.push('(LOWER(ui.name) LIKE ? OR LOWER(ui.company_name) LIKE ? OR a.inn LIKE ? OR CAST(a.global_id AS TEXT) LIKE ?)')
        const term = `%${String(req.query.search).toLowerCase()}%`
        parameters.push(term, term, term, term)
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const applications = db.prepare(`
        SELECT a.*, ui.name AS client_name, ui.company_name, l.name AS loan_name,
               sr.score AS risk_score, sr.risk_level, sr.default_probability,
               sr.factors, sr.reason_codes, sr.model_version, sr.created_at AS scored_at
        FROM applications a
        LEFT JOIN user_info ui ON ui.user_id = a.user_id
        LEFT JOIN loans l ON l.id = a.loan_id
        LEFT JOIN scoring_results sr ON sr.id = (
            SELECT id FROM scoring_results WHERE application_id = a.global_id ORDER BY version DESC LIMIT 1
        )
        ${where}
        ORDER BY CASE a.status
            WHEN 'UNDER_REVIEW' THEN 0 WHEN 'NEED_MORE_INFO' THEN 1
            WHEN 'SCORING' THEN 2 WHEN 'ENRICHMENT' THEN 3 ELSE 4 END,
            a.time_of_application DESC
    `).all(...parameters).map(presentQueueRow)
    res.json({ items: applications, total: applications.length })
})

router.get('/applications/:applicationId', (req, res) => {
    const application = db.prepare(`
        SELECT a.*, ui.name AS client_name, ui.email, ui.company_name, l.name AS loan_name,
               sr.score AS risk_score, sr.risk_level, sr.default_probability,
               sr.factors, sr.reason_codes, sr.model_version, sr.version AS scoring_version,
               sr.trigger AS scoring_trigger, sr.created_at AS scored_at
        FROM applications a
        LEFT JOIN user_info ui ON ui.user_id = a.user_id
        LEFT JOIN loans l ON l.id = a.loan_id
        LEFT JOIN scoring_results sr ON sr.id = (
            SELECT id FROM scoring_results WHERE application_id = a.global_id ORDER BY version DESC LIMIT 1
        )
        WHERE a.global_id = ?
    `).get(req.params.applicationId)
    if (!application) return res.status(404).json({ message: 'Application not found' })

    const history = db.prepare(`
        SELECT * FROM applications_logs WHERE application_global_id = ? ORDER BY id
    `).all(application.global_id).map((item) => ({ ...item, metadata: parseJson(item.metadata, {}) }))
    const scoreHistory = db.prepare(`
        SELECT * FROM scoring_results WHERE application_id = ? ORDER BY version DESC
    `).all(application.global_id).map((item) => ({
        ...item,
        factors: parseJson(item.factors, []),
        reason_codes: parseJson(item.reason_codes, []),
    }))
    res.json({
        application: presentQueueRow(application),
        client: {
            name: application.client_name,
            email: application.email,
            inn: application.inn,
            company_name: application.company_name,
        },
        enrichment: {
            fns: fnsDb.prepare('SELECT * FROM fns WHERE inn = ?').get(application.inn) || null,
            bki: bkiDb.prepare('SELECT * FROM bki WHERE inn = ?').get(application.inn) || null,
            internal: db.prepare('SELECT * FROM registry_internal WHERE inn = ?').get(application.inn) || null,
        },
        scoring: scoreHistory[0] || null,
        scoring_history: scoreHistory,
        history,
    })
})

router.post('/applications/:applicationId/decision', (req, res) => {
    try {
        const application = applyDecision(Number(req.params.applicationId), req.body, { source: 'EMPLOYEE' })
        res.json({ application_id: application.global_id, status: application.status })
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message })
    }
})

router.post('/applications/:applicationId/rescore', async (req, res) => {
    const application = db.prepare('SELECT global_id FROM applications WHERE global_id = ?').get(req.params.applicationId)
    if (!application) return res.status(404).json({ message: 'Application not found' })
    const workflow = await runApplicationWorkflow(application.global_id, 'MANUAL_REVIEW')
    res.json({ application_id: application.global_id, status: workflow.application.status, warning: workflow.warning || null })
})

router.get('/applications/:applicationId/history', (req, res) => {
    const application = db.prepare('SELECT global_id FROM applications WHERE global_id = ?').get(req.params.applicationId)
    if (!application) return res.status(404).json({ message: 'Application not found' })
    res.json(db.prepare(`
        SELECT * FROM applications_logs WHERE application_global_id = ? ORDER BY id
    `).all(application.global_id).map((item) => ({ ...item, metadata: parseJson(item.metadata, {}) })))
})

router.get('/clients/:inn', (req, res) => {
    const userInfo = db.prepare('SELECT * FROM user_info WHERE inn = ?').get(req.params.inn)
    if (!userInfo) return res.status(404).json({ message: 'Client not found' })
    res.json({
        user_info: userInfo,
        bki: bkiDb.prepare('SELECT * FROM bki WHERE inn = ?').get(req.params.inn) || null,
        fns: fnsDb.prepare('SELECT * FROM fns WHERE inn = ?').get(req.params.inn) || null,
        internal_registry: db.prepare('SELECT * FROM registry_internal WHERE inn = ?').get(req.params.inn) || null,
        risk_score_history: db.prepare(`
            SELECT sr.* FROM scoring_results sr
            JOIN applications a ON a.global_id = sr.application_id
            WHERE a.inn = ? ORDER BY sr.created_at DESC
        `).all(req.params.inn).map((item) => ({
            ...item, factors: parseJson(item.factors, []), reason_codes: parseJson(item.reason_codes, []),
        })),
    })
})

export default router
