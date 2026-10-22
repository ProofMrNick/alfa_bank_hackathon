import express from 'express'
import db from '../db.js'

const router = express.Router()

// Get all applications for the authenticated user
router.get('/', (req, res) => {
    const getApplications = db.prepare('SELECT * FROM applications WHERE user_id = ?')
    const applications = getApplications.all(req.userId)
    res.json(applications)
})

// Create a new application
router.post('/', (req, res) => {
    
    const { loan_id } = req.body
    const insertApplication = db.prepare(`INSERT INTO applications (user_id, loan_id) VALUES (?, ?)`)
    insertApplication.run(req.userId, loan_id)
    res.status(201).send({ message: "Application created" })

    })

// View an application
router.get('/:id', (req, res) => {
    const { id } = req.params
    const userId = req.userId
    const getApplication = db.prepare(`SELECT * FROM applications WHERE id = ? AND user_id = ?`)
    const application = getApplication.get(id, userId)
    res.json(application)

})

// Delete an application
router.delete('/:id', (req, res) => {
    const { id } = req.params
    const userId = req.userId
    const deleteApplication = db.prepare(`DELETE FROM applications WHERE id = ? AND user_id = ?`)
    deleteApplication.run(id, userId)

    res.send({ message: "Application deleted" })
})

export default router