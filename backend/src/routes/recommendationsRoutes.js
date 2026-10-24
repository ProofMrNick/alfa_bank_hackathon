import express from 'express'
import db from '../db.js'

const router = express.Router()

router.get('/products', (req, res) => {
    consle.log("Getting recommendations for user: ", req.userId)
    const reccomendations = getReccomendationsFor(userId)
    // todo: implement recommendation logic based on user data and preferences
    res.json(reccomendations)
})

export default router