import db from '../db.js'
import bki_db from '../../mockDatabase/bki_db.js'
import fns_db from '../../mockDatabase/fns_db.js'

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000'

<<<<<<< HEAD
// Rule-based fallback (если ML недоступен)
function computeRiskScore(fns, bki, internal) {
    let score = 0
    const reasons = []

    if (bki?.has_default) { score += 40; reasons.push('default_history') }
    if ((bki?.delinquencies_12m_count || 0) > 0) { score += 20; reasons.push('recent_delinquencies') }
    if ((bki?.total_debt || 0) > 1000000) { score += 15; reasons.push('high_debt') }
    if (fns?.status !== 'ACTIVE') { score += 30; reasons.push('inactive_company') }
    if (internal?.blocked_115fz) { score += 50; reasons.push('blocked_115fz') }
    if (!internal?.has_account) { score += 20; reasons.push('no_bank_history') }
=======
export function rescoreApplication(applicationGlobalId, trigger) {
  const app     = db.prepare('SELECT * FROM applications WHERE global_id = ?').get(applicationGlobalId);
  const inn     = app.inn

  const bki     = bki_db.prepare('SELECT * FROM registry_bki WHERE inn = ?').get(inn);
  const fns     = fns_db.prepare('SELECT * FROM registry_bki WHERE inn = ?').get(inn);
  const internal = db.prepare('SELECT * FROM registry_internal WHERE inn = ?').get(inn);

  const risk = computeRiskScore(fns, bki, internal);

  const nextVersion = db.prepare(
    'SELECT COALESCE(MAX(version), 0) + 1 AS v FROM scoring_results WHERE application_id = ?'
    ).get(applicationGlobalId).v;

  db.prepare(`
    INSERT INTO scoring_results
      (application_id, score, risk_level, model_version, factors, reason_codes, trigger, version)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    UPDATE user_id SET risk_score = ? WHERE inn = ?
  `).run(
    applicationGlobalId, risk.score, risk.riskLevel, 'scoring_v1',
    JSON.stringify(risk.reasons), JSON.stringify(risk.reasonCodes || []),
    trigger, nextVersion, score, inn
  );
>>>>>>> ea4400473953e81f9a9d63a8d3a5afe00a5ae2d2

    const riskScore = Math.min(100, Math.max(0, score))
    const riskLevel = riskScore < 30 ? 'LOW' : riskScore < 60 ? 'MEDIUM' : 'HIGH'
    const defaultProbability = riskScore / 100

    return {
        score: riskScore,
        riskLevel,
        default_probability: defaultProbability,
        reasons,
        reasonCodes: reasons
    }
}

// Асинхронная интеграция с Python ML (опционально)
async function computeRiskScoreML(fns, bki, internal, application = null) {
    try {
        const response = await fetch(`${ML_SERVICE_URL}/v1/evaluate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fns, bki, internal, application })
        })

        if (!response.ok) throw new Error(`ML service error: ${response.status}`)

        const result = await response.json()
        return {
            score: result.risk?.score || 0,
            riskLevel: result.risk?.level || 'UNKNOWN',
            default_probability: result.risk?.default_probability || 0,
            reasons: result.risk?.reasons || [],
            reasonCodes: result.risk?.reason_codes || []
        }
    } catch (error) {
        console.warn('ML недоступен, используется rule-based:', error.message)
        return computeRiskScore(fns, bki, internal) // fallback
    }
}

export async function rescoreUser(userId, applicationGlobalId, trigger) {
    // 1. Получаем данные пользователя
    const userInfo = db.prepare(`SELECT inn FROM user_info WHERE user_id = ?`).get(userId)
    if (!userInfo) {
        throw new Error(`Пользователь ${userId} не найден`)
    }
    const { inn } = userInfo

    const bki = bki_db.prepare('SELECT * FROM bki WHERE inn = ?').get(inn) || {}
    const fns = fns_db.prepare('SELECT * FROM fns WHERE inn = ?').get(inn) || {}
    const internal = db.prepare('SELECT * FROM registry_internal WHERE inn = ?').get(inn) || {}

    // 2. Вычисляем риск (ML с fallback на rule-based)
    const risk = await computeRiskScoreML(fns, bki, internal)

    // 3. Получаем следующую версию скоринга
    const nextVersion = db.prepare(
        'SELECT COALESCE(MAX(version), 0) + 1 AS v FROM scoring_results WHERE inn = ?'
    ).get(inn).v

    // 4. ВАЖНО: два отдельных запроса (prepared statements не поддерживают пакетные SQL)
    db.prepare(`
        INSERT INTO scoring_results
        (application_id, score, risk_level, inn, default_probability, model_version, factors, trigger, version)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        applicationGlobalId,
        risk.score,
        risk.riskLevel,
        inn,
        risk.default_probability,
        'scoring_v1',
        JSON.stringify(risk.reasons),
        trigger,
        nextVersion
    )

    // 5. ИСПРАВЛЕНО: user_id -> user_info (опечатка в UPDATE)
    db.prepare(`UPDATE user_info SET risk_score = ?, risk_score_timestamp = CURRENT_TIMESTAMP WHERE inn = ?`)
        .run(risk.score, inn)

    return risk
}