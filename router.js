const express = require('express')
const router = express.Router()
const rateLimit = require('express-rate-limit')


const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => { return req.session.user ? req.session.user._id : req.ip },
    handler: (req, res) => {
        res.status(429).json({
            message: "You have exceeded the maximum number of requests."
        })
    }
})

router.get('/', (req, res) => {
    res.render('index')
})


module.exports = router;