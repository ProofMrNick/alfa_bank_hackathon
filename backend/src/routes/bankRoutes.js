import express from "express";
import db from '../db.js'

const router = express.Router()

router.get("/applications", (req, res) => {

    const getApplication = db.prepare("SELECT * FROM applications")
    const application = getApplication.all()

    res.json(application)
})

router.get("/applications/:applId", (req, res) => {
    const { applId } = req.params


    const getApplication = db.prepare("SELECT * FROM applications WHERE global_id = ? ")
    const application = getApplication.all(applId)

    res.json(application)
})

router.post("/applications/:applId/decision", (req, res) => {
    const {applId} = req.params
    const {type, approvedAmount = null, approvedTermMonths = null, approvedRate = null, missingFields = null, reason = null, comment = null} = req.body || -1

    console.log(`Decision for application ${req.params.applId}: ${type}, ${approvedAmount}, ${approvedTermMonths}, ${approvedRate}, ${missingFields}, ${reason}, ${comment}`)
    
    if (type == "APPROVE"){
        const updateStatus = db.prepare("UPDATE applications SET status = ?, loan_sum = ?, loan_interest = ?, loan_duration = ? WHERE global_id == ?")
        const resulteUpdateStatus = updateStatus.run(type, approvedAmount, approvedRate, approvedTermMonths, applId)

        const addComment = db.prepare(`UPDATE applications_logs
                    SET comment = ?
                    WHERE id = (
                        SELECT id FROM applications_logs 
                        WHERE application_global_id = ? 
                        ORDER BY timestamp DESC 
                        LIMIT 1
                    )`)
        addComment.run(comment, applId)
        res.json(resulteUpdateStatus)
    }
    //todo: add another statuses

    res.status(200)
})
export default router