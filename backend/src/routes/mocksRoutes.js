import express from 'express'
import bki_db from '../../mockDatabase/bki_db.js'
import fns_db from '../../mockDatabase/fns_db.js'

const router = express.Router()

router.get('/bki/:inn', (req, res) => {
    const { inn } = req.params

    try {
        const getInfo = bki_db.prepare('SELECT * FROM bki WHERE inn = ?')
        const resultGetInfo = getInfo.get(inn)
        if(!resultGetInfo) {return res.status(404).send({ message: "User info not found" })}
        res.sendStatus(200)
    } catch (err) {
        console.log(err.message)
        res.sendStatus(503)
    }
    
})


export default router