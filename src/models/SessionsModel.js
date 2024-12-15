const {Schema, model}= require("mongoose")

const sessionSchema= new Schema({
    userId: {
        type: String,
        required: true
    },
    refreshtoken: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        required: true
    },
    expiresAt: {
        type: Date,
        required: true
    }
})

const sessionmodel = model("usersessions", sessionSchema)

module.exports= sessionmodel