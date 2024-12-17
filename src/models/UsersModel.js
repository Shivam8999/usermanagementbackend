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
    Password: {
        type: String,
        required: true
    },
    Role: {
        type: String,
        required: true
    },
    status: { //1 for active, 2 for inactive, 3 for blocked
        type: Number,
        required: true,
        enum: [1,2,3],
        default: 1
    },
    otp:{
        type: String
    },
    otpGeneratedAt: {
        type: Date | null
    },
    otpExpiresAt:{
        type: Date | null
    }
})


const Users= model("users", userSchema)
module.exports= Users