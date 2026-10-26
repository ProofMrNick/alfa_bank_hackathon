import db from './db.js'
import bki_db from './../mockDatabase/bki_db.js'
import fns_db from './../mockDatabase/fns_db.js'


export function rescoreUser(userId, applicationGlobalId, trigger) {

  const inn     = db.prepare(`SELECT * FROM user_info WHERE user_id = ?`).get(userId).inn
  
  const bki     = bki_db.prepare('SELECT * FROM bki WHERE inn = ?').get(inn);
  const fns     = fns_db.prepare('SELECT * FROM fns WHERE inn = ?').get(inn);
  const internal = db.prepare('SELECT * FROM registry_internal WHERE inn = ?').get(inn);
  
  const risk = computeRiskScore(fns, bki, internal);
  
  const nextVersion = db.prepare(
    'SELECT COALESCE(MAX(version), 0) + 1 AS v FROM scoring_results WHERE inn = ?'
  ).get(inn).v;
  
  db.prepare(`
    INSERT INTO scoring_results
      (application_id, score, risk_level, inn, default_probability, model_version, factors, trigger, version)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    UPDATE user_id SET risk_score = ? WHERE inn = ?
  `).run(
    applicationGlobalId, risk.score, risk.riskLevel, inn, risk.default_probability, 'scoring_v1',
    JSON.stringify(risk.reasons), JSON.stringify(risk.reasonCodes || []),
    trigger, nextVersion, score, inn
  );

  return risk;
}