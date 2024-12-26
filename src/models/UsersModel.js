const mongoose= require("mongoose")

const {Schema, model}= mongoose

const userSchema= new Schema({
    Name: {
        type: String,
        required: true
    },
    Email: {
        type: String,
        required: true,
        unique: true
    },
    Phone: {
        type: String,
    },
    Address: {
        type: String 
    },
    Password: {
        type: String,
        required: true
    },
    Role: {
        type: String,
        required: true,
        enum: ["user", "admin"],
        default: "user"
    },
    status: { //1 for unblocked, 2 for blocked
        type: Number,
        required: true,
        enum: [1,2],
        default: 1
    },
    otp:{
        type: String,
        default: " "
    },
    otpGeneratedAt: {
        type: Date 
    },
    otpExpiresAt:{
        type: Date
    }
})


const Users= model("users", userSchema)
Users.syncIndexes()
module.exports= Users
