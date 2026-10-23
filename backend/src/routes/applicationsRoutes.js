import express from 'express'
import db from '../db.js'

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
router.get('/:id', (req, res) => {
    const { id } = req.params
    const userId = req.userId
    const getApplication = db.prepare(`SELECT * FROM applications WHERE local_id = ? AND user_id = ?`)
    const application = getApplication.get(id, userId)

    res.json(application)

})

router.get('/:local_id/history', (req, res) => {
    const { local_id } = req.params
    const userId = req.userId

    const getGlobalId = db.prepare(`SELECT global_id FROM applications WHERE local_id = ? AND user_id = ?`)
    const globalId = getGlobalId.get(local_id, userId).global_id

    const getApplicationLogs = db.prepare(`SELECT * FROM applications_logs WHERE application_global_id = ?`)
    const applicationLogs = getApplicationLogs.all(globalId)

    res.json(applicationLogs)

})

//submit an application
router.post('/:applId/submit', (req, res) => {
    const { applId } = req.params
    const userId = req.userId
    const {loan_id, loan_sum, loan_interest, loan_duration} = req.body
    console.log(`submitting application with id: ${applId} for user: ${userId}, ${loan_id}, ${loan_duration}, ${loan_interest}, ${loan_sum}`)
    
    const createApplication = db.prepare(`INSERT INTO applications (user_id, local_id, loan_id, loan_sum, loan_interest, loan_duration) VALUES (?, ?, ?, ?, ?, ?)`)
    createApplication.run(userId, applId, loan_id, loan_sum, loan_interest, loan_duration)

    res.status(201).send({message: "Application created"})

})

// Delete an application
router.delete('/:id', (req, res) => {
    const { id } = req.params
    const userId = req.userId
    const deleteApplication = db.prepare(`DELETE FROM applications WHERE local_id = ? AND user_id = ?`)
    deleteApplication.run(id, userId)

    res.send({ message: "Application deleted" })
})

export default router