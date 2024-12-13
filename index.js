const express= require('express')

const app = express()

app.get("/api",(req,res) => {
    res.send("hello world")
})

app.listen(3000,"0.0.0.0",() => {
    console.log("server is running on port 3000")
})