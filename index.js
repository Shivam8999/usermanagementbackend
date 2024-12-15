const express= require('express')
const dbsetup= require("./src/db/index")
const manageuserrouter= require("./src/routes/ManageUserRoutes.js")
const cookieParser = require('cookie-parser')
require('dotenv').config()

const app = express()

app.use(express.json())
app.use(cookieParser())

app.get("/api",(req,res) => {
    console.log(req.headers.authorization)
    res.send("hello world")
})

app.use("/api",manageuserrouter)

app.listen(3000,"0.0.0.0",() => {
    try {
        dbsetup()
        console.log("server is running on port 3000")
    } catch (error) {
        console.log(error)
    }
})