const session = require('express-session')
const flash = require('connect-flash')
const express = require('express')
const router = require('./router')

const app = express()

let sessionOptions = session({
    name: "T3_session",
    secret: "seven sisters big",
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
        secure: process.env.NODE_ENV === "PRODUCTION" ? true : false,
        sameSite: process.env.NODE_ENV === "PRODUCTION" ? "strict" : "lax",
        httpOnly: true,
        maxAge: 3600000
    }

})

app.use(sessionOptions)
app.use(flash())

if (process.env.NODE_ENV === "PRODUCTION") {
    app.set('trust proxy', 1);
}

app.use(express.static('public'))

app.use(express.urlencoded({ extended: false }))
app.use(express.json())

app.set('views', 'views')
app.set('view engine', 'ejs')

app.use('/', router)

app.use((req, res) => {
    res.status(404).render('404');
});

app.use('/', (err, req, res, next) => {
    if (err) {
        res.status(500).send("Something went wrong")
    } else {
        next()
    }
})

const PORT = process.env.PORT || 8080

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});


module.exports = app