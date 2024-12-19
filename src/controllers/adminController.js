const userModal= require("../models/UsersModel.js")
const sessionmodel= require("../models/SessionsModel.js")
const bcrypt = require("bcrypt")
const jwt= require("jsonwebtoken")

/** 
 * takes name, email, password from body
 * register the user then return access token and refresh token
 * send them in cookies as well and update the sessions collection
 * if email already exists return error
*/
const register= async (req, res) => {
    const { name, email, password,conpassword,address,phone,role }= req.body
    if(!name || !email || !password || !conpassword) 
        return res.status(400).json({ message: "name, email, password and confirm password are required" })

    if(password!=conpassword)
        return res.status(400).json({ message: "password and confirm password does not match" })
     
    try {
        const encpassword= await  bcrypt.hash(password, 10)
        let user= new userModal({ Name:name, Email:email, Password: encpassword,Role: role || "user",Address:address,Phone:phone })
        await user.save()
        res.json({ message: "user registered successfully", user })
    } catch (error) {
        let errorMessage=error.message
        console.log(errorMessage) //logs as the error as errors can be long and db specific
        if(errorMessage.includes("E11000 duplicate key error collection")){
            let newkeys = Object.keys(error.keyValue)
            return res.status(400).json({ message: "Alredy Exist user ", fields: newkeys })
        }
        res.status(500).json({ message: "unable to register user",error:errorMessage })
    }
}

const blockuser= async (req, res) => {
    const {userid,blocked,tokendata} = req.body
    if(tokendata.role!="admin")
        return res.status(401).json({ message: "Unauthorized access for this operation" })
    if(!userid || !blocked) 
        return res.status(400).json({ message: "userid and block status is required" })

    try {
        const user= await userModal.findById(userid)
        if(!user){
            return res.status(400).json({ message: "user not found" })
        }

        if(blocked=="true")
            user.status= 2
        else
            user.status= 1
        await user.save()
        res.json({ message: `user ${blocked=="true"?"blocked":"unblocked"} successfully`, user })
    } catch (error) {
        console.log(error.message);
        res.status(500).json({ message: "unable to block user",error:error.message })
    }
    
}

const changeRole= async (req, res) => {
    const {userid,role,tokendata} = req.body
    if(tokendata.role!="admin")
        return res.status(401).json({ message: "Unauthorized access for this operation" })
    if(!userid || !role) 
        return res.status(400).json({ message: "userid and role is required" })

    try {
        const user= await userModal.findById(userid)
        if(!user){
            return res.status(400).json({ message: "user not found" })
        }
        user.Role= role
        await user.save()
        res.json({ message: "user role changed successfully", user })
    } catch (error) {
        console.log(error.message);
        res.status(500).json({ message: "unable to change role",error:error.message })
    }

}

const deleteUser= async (req, res) => {
    const {userid,tokendata}=req.body
    if(tokendata.role!="admin")
        return res.status(401).json({ message: "Unauthorized access for this operation" })
    if(!userid) 
        return res.status(400).json({ message: "userid is required" })

    try {
        const user= await userModal.findByIdAndDelete(userid)
        if(!user){
            return res.status(400).json({ message: "user not found" })
        }
        res.json({ message: "user deleted successfully", user })
    } catch (error) {
        console.log(error.message);
        res.status(500).json({ message: "unable to delete user",error:error.message })
    }
}


module.exports={register,blockuser,changeRole,deleteUser}