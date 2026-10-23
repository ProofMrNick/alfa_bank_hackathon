import express from 'express'
import db from '../db.js'

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

    //for now, we will retun a random loan recommendation for the user, in the future we will implement a more complex recommendation system
    const getRecommendedloans = db.prepare(`SELECT * FROM loans ORDER BY RANDOM() LIMIT 3`)
    const recommendations = getRecommendedloans.all()

    res.json({ userInfo, applications, latestApplicationsLog, recommendations })
})

export default router
