import db from '../db.js'
import bki_db from '../../mockDatabase/bki_db.js'
import fns_db from '../../mockDatabase/fns_db.js'


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

  return risk;
}