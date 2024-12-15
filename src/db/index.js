const mongose= require("mongoose")
require('dotenv').config()

console.log(process.env.DB_URL)
const setupDB= () => {
    try {
        const setup=mongose.connect(`${process.env.DB_URL}`)
        return setup
    } catch (error) {
        console.log(error)
        throw new Error("unable to connect to db")
    }
}

module.exports= setupDB