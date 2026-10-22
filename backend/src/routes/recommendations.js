import express from 'express'
import db from '../db.js'

const router = express.Router()

router.get('/', (req, res) => {
    consle.log("Getting recommendations for user: ", req.userId)
    // todo: implement recommendation logic based on user data and preferences
})

export default router