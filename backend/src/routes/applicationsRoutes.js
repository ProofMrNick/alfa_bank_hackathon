import express from 'express'
import db from '../db.js'
import bki_db from '../../mockDatabase/bki_db.js'
import fns_db from '../../mockDatabase/fns_db.js'

const router = express.Router()

// Get all applications for the authenticated user
router.get('/', (req, res) => {
    const getApplications = db.prepare('SELECT * FROM applications WHERE user_id = ?')
    const applications = getApplications.all(req.userId)
    res.json(applications)
})

/// Create a new application v 1.0
/*router.post('/', (req, res) => {
    
    const { loan_id } = req.body
    const application_id = db.prepare('SELECT MAX(application_id) as max_id FROM applications WHERE user_id = ?').get(req.userId).max_id || 0 // get the max application_id for this user, or 0 if none exist
    const insertApplication = db.prepare(`INSERT INTO applications (user_id, loan_id, application_id) VALUES (?, ?, ?)`)
    insertApplication.run(req.userId, loan_id, application_id + 1)
    res.status(201).send({ message: "Application created" })

    })
*/

// View an application
router.get('/:local_id', (req, res) => {
    const { local_id } = req.params
    const userId = req.userId
    const getApplication = db.prepare(`SELECT * FROM applications WHERE local_id = ? AND user_id = ?`)
    const application = getApplication.get(local_id, userId)

     if (!application) { return res.status(404).send({ message: "Application not found" }) }
    res.json(application)

})

router.get('/:local_id/history', (req, res) => {
    const { local_id } = req.params
    const userId = req.userId

    
    const getGlobalId = db.prepare(`SELECT global_id FROM applications WHERE local_id = ? AND user_id = ?`)
    const globalId = getGlobalId.get(local_id, userId)
    if(!globalId) { return res.status(404).send({ message: "Application not found" }) }

    const getApplicationLogs = db.prepare(`SELECT * FROM applications_logs WHERE application_global_id = ?`)
    const applicationLogs = getApplicationLogs.all(globalId.global_id)
    if(!applicationLogs) { return res.status(404).send({ message: "Application history not found" }) }

    res.json(applicationLogs)

})

//submit an application
router.post('/:applId/submit', (req, res) => {
    const { applId } = req.params
    const userId = req.userId
    const inn = req.inn

    if (!inn) { return res.status(404).send({ message: "INN not found" }) }
    const {loan_sum, loan_interest, loan_duration} = req.body
    console.log(`submitting application with id: ${applId} for user: ${userId}, ${loan_duration}, ${loan_interest}, ${loan_sum}`)
    
    const findApplication = db.prepare(`SELECT * FROM applications WHERE user_id = ? AND status != ? AND status != ?`).get(userId, 'APPROVE', 'DECLINE')
    if(findApplication) {return res.status(403).send({message: "Application already submitted"})}

    const createApplication = db.prepare(`INSERT INTO applications (user_id, inn, local_id, loan_sum, loan_interest, loan_duration) VALUES (?, ?, ?, ?, ?, ?)`)
    createApplication.run(userId, inn, applId, loan_sum, loan_interest, loan_duration)

    res.status(201).send({message: "Application created"})

    const application = db.prepare(`SELECT * FROM applications WHERE user_id = ? AND local_id = ?`).get(userId, applId)

    const bki     = bki_db.prepare('SELECT * FROM bki WHERE inn = ?').get(inn);
    const fns     = fns_db.prepare('SELECT * FROM fns WHERE inn = ?').get(inn);
    const internal_registry = db.prepare('SELECT * FROM registry_internal WHERE inn = ?').get(inn);
    const risk_score = db.prepare('SELECT * FROM user_info WHERE user_id = ?').get(userId).risk_score
    //do smting
    //run_initial_ML_assertion(application, bki, fns, internal_registry, risk_score)
    const deleteFromRecommendations = db.prepare(`DELETE FROM recommended_loans WHERE user_id = ? AND loan_sum = ? AND loan_interest = ? AND loan_duration = ?`)
    deleteFromRecommendations.run(userId, loan_sum, loan_duration, loan_interest)


})

router.post('/:applId/clarify', (req, res) => {
    const userId = req.userId
    const inn = req.inn
    const { applId } = req.params
    const { bki_data = {}, fns_data = {}, internal_data = {} } = req.body

    const appRow = db.prepare(`SELECT global_id FROM applications WHERE local_id = ? AND user_id = ?`).get(applId, userId)
    if (!appRow) {
        return res.status(404).json({ error: "Заявка не найдена" })
    }
    if (appRow.status != 'REQUEST_INFO'){
        return res.status(403).json({ error: "Заявка не нуждается в дополнительной информации" })
    }
    const globalId = appRow.global_id

    // 3. Белые списки полей
    const allowedBkiFields = [
        'report_status', 'active_loans_count', 'total_debt',
        'monthly_payment', 'delinquencies_12m_count',
        'max_delinquency_days', 'has_default', 'report_date'
    ]
    const allowedFnsFields = [
        'ogrn', 'name', 'legal_form', 'registration_date', 'status',
        'okved_main', 'okved_additional', 'tax_regime', 'msp_category',
        'msp_registry_date', 'edo_participant', 'head_name', 'head_position'
    ]
    const allowedInternalFields = [
        'has_account', 'account_opened_date', 'avg_monthly_inflow',
        'avg_monthly_outflow', 'acquiring_monthly_volume',
        'blocked_115fz', 'previous_products_closed_well', 'snapshot_date'
    ]

    const result = { updated: {}, rejected: {} }

    function updateIfNull(dbInstance, tableName, allowedFields, data, sourceName) {
        result.updated[sourceName] = []
        result.rejected[sourceName] = []

        for (const [field, value] of Object.entries(data)) {
            if (!allowedFields.includes(field)) continue

            // КЛЮЧЕВОЕ ИЗМЕНЕНИЕ: добавили AND ${field} IS NULL
            const stmt = dbInstance.prepare(
                `UPDATE ${tableName} SET ${field} = ? WHERE inn = ? AND ${field} IS NULL`
            )
            const info = stmt.run(value, inn)

            if (info.changes > 0) {
                result.updated[sourceName].push(field)
            } else {
                result.rejected[sourceName].push(field)
            }
        }
    }

    updateIfNull(bki_db, 'bki', allowedBkiFields, bki_data, 'bki')
    updateIfNull(fns_db, 'fns', allowedFnsFields, fns_data, 'fns')
    updateIfNull(db, 'registry_internal', allowedInternalFields, internal_data, 'internal')

    const comment = JSON.stringify({ bki_data, fns_data, internal_data, result })


    const addComment = db.prepare(`UPDATE applications_logs
                    SET comment = ?
                    WHERE id = (
                        SELECT id FROM applications_logs 
                        WHERE application_global_id = ? 
                        ORDER BY timestamp DESC 
                        LIMIT 1
                    )`)
        addComment.run(comment, applId)

    res.status(200).json({
        message: "Данные успешно обновлены",
        data: { application_id: globalId, status: 'PENDING' }
    })
})

router.post('/quick', () => {

})
export default router