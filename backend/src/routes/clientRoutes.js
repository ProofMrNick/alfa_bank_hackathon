import express, { json } from 'express'
import db from '../db.js'
import bki_db from '../../mockDatabase/bki_db.js'
import fns_db from '../../mockDatabase/fns_db.js'
const router = express.Router()

// Get the dashboard data for the authenticated user: user_info, applications, latestApplicationsLog, recommended_loans
router.get('/dashboard', (req, res) => {
    
    const userId = req.userId
    console.log(`Getting dashboard data for user with id: ${userId}`)
    const getUserInfo = db.prepare(`SELECT * FROM user_info WHERE user_id = ?`)
    const userInfo = getUserInfo.get(userId)

    const getApplications = db.prepare(`SELECT * FROM applications WHERE user_id = ?`)
    const applications = getApplications.all(userId)    

    let latestApplicationsLog = []
    for (const application of applications) {
        const getApplicationLog = db.prepare(`SELECT * FROM applications_logs WHERE application_global_id = ? ORDER BY timestamp DESC LIMIT 1`)
        const applicationLog = getApplicationLog.get(application.global_id)
        latestApplicationsLog.push(applicationLog)
    }

    const getRecommendedloans = db.prepare(`SELECT * FROM recommended_loans ORDER BY approval_probability DESC LIMIT 3`)
    const recommendations = getRecommendedloans.all()

    res.json({ userInfo, applications, latestApplicationsLog, recommendations })
})

router.get('/recommendations', (req, res) => {
    const userId = req.userId
    const {loan_sum, loan_interest, loan_duration} = req.body

    const userInfo = db.prepare(`SELECT * FROM user_info WHERE user_id = ?`).get(userId)
    const user_risk_score = userInfo.risk_score
    
    
    const {recommendedLoans} =  askML(json.stringify({loan_sum, loan_interest, loan_duration, user_risk_score}))

    //remember first 4 recommended_loans for later use
    let i = 1
    for(const recommended_loan of recommendedLoans){
        const preliminaryLimit = recommended_loan.preliminaryLimit
        const preliminaryRate = recommended_loan.preliminaryRate
        const termMonths = recommended_loan.termMonths
        const approvalProbability = recommended_loan.approvalProbability
        if(i>4) break
        db.prepare(`INSERT INTO recommended_loans (user_id, loan_sum, loan_interest, loan_duration, approval_probability) VALUES (?, ?, ?, ?, ?)`).run(userId, preliminaryLimit, preliminaryRate, termMonths, approvalProbability)
        i++
    }
    res.json(recommendedLoans)
})


export default router
