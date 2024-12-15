const userModal= require("../models/UsersModel.js")
const bcrypt = require("bcrypt")
const jwt= require("jsonwebtoken")
const sessionmodel= require("../models/SessionsModel.js")

require("dotenv").config()
const register= async (req, res) => {
    const { name, email, password }= req.body
    if(!name || !email || !password) 
        return res.status(400).json({ message: "name, email and password are required" })

    try {
        const encpassword= await  bcrypt.hash(password, 10)
        let user= new userModal({ Name:name, Email:email, Password: encpassword,Role: "user" })
        await user.save()
        res.json({ message: "user registered successfully", user })
    } catch (error) {
        let errorMessage=error.message
        console.log(errorMessage)
        if(errorMessage.includes("E11000 duplicate key error collection")){
            let newkeys = Object.keys(error.keyValue)
            return res.status(400).json({ message: "Alredy Exist user ", fields: newkeys })
        }

        res.status(500).json({ message: "unable to register user" })
    }
}

const loginuser = async (req, res) => {
    const { email, password }= req.body
    if(!email || !password) 
        return res.status(400).json({ message: "email and password are required" })

    try {
        //setting expiry time for access token and refresh token
        const currentDate = new Date();
    
        const expiryAccessToken = new Date(currentDate);
        expiryAccessToken.setHours(currentDate.getMinutes() + 15);//15minutes 

        const expiryRefreshToken = new Date(currentDate);
        expiryRefreshToken.setHours(currentDate.getHours() + 720);//720 hours that is 30 days
       
        //find the user with email
        let user= await userModal.findOne({ Email: email })
        if(!user)
            return res.status(400).json({ message: "invalid email or password" })
        
        //check password
        let isMatch= await bcrypt.compare(password, user.Password)
        if(!isMatch)
            return res.status(400).json({ message: "invalid email or password" })

        //generate accessToken and refreshToken
        let accesstoken= jwt.sign({ id: user._id,name:user.Name }, process.env.ACCESSTOKEN_SECRET,{expiresIn: "15m"})
        let refreshtoken= jwt.sign({ id: user._id,name:user.Name }, process.env.REFRESHTOKEN_SECRET, { expiresIn: "30d" })

        //set the refreshtoken in sessions collection for fetching accesstoken
        let session= new sessionmodel({ userId: user._id, refreshtoken: refreshtoken,createdAt: new Date(), expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) })
        await session.save()

        //send the accesstoken and refreshtoken in cookies for browser
        res.cookie("accesstoken", accesstoken, { httpOnly: true, expires: expiryAccessToken });
        res.cookie("refreshtoken", refreshtoken, { httpOnly: true, expires: expiryRefreshToken });

        //send the response for successfull login
        res.status(200).json({ message: "user logged in successfully",name:user.Name,status:user.status,email:user.Email, accesstoken, refreshtoken })
    } catch (error) {
        console.log(error.message)
        res.status(500).json({ message: "unable to login user" })
        }
}

//get access token from refresh token
//refreshtoken is stored in sessions collection and refreshtoken is received from header or cookie
const getaccesstoken= async (req, res) => {
    //fetch refreshtoken from header
    let refreshtoken= req.headers.refreshtoken

    //if header doesn't contain refreshtoken then fetch it from cookie
    if(!refreshtoken){
        refreshtoken= req.cookies.refreshtoken
    }

    //if refreshtoken is not present in cookie and header then return the error in response
    if(!refreshtoken) 
        return res.status(400).json({ message: "refreshtoken is required" })

    const currentDate = new Date();
    const expiryAccessToken = new Date(currentDate);
    expiryAccessToken.setHours(currentDate.getMinutes() + 15);//15minutes 

    try {
        let payload= jwt.verify(refreshtoken, process.env.REFRESHTOKEN_SECRET)
        let user= await userModal.findById(payload.id)
        if(!user)
            return res.status(400).json({ message: "user not found" })
        let accesstoken= jwt.sign({ id: user._id,name:user.Name }, process.env.ACCESSTOKEN_SECRET,{expiresIn: "15m"})
        res.cookie("accesstoken", accesstoken, { httpOnly: true, expires: expiryAccessToken }); //send the new access token in cookie

        res.status(200).json({ message: "accessToken generated successfully",name:user.Name,status:user.status,email:user.Email, accesstoken })
    } catch (error) {
        console.log(error.message)
        if(error.message.includes("jwt expired")){
            return res.status(400).json({ message: "refreshtoken expired" })
        }else if(error.message.includes("jwt malformed")){
            return res.status(400).json({ message: "refreshtoken invalid" })
        }
        res.status(500).json({ message: "unable to login user" })
    }
}

const logoutuser= async (req, res) => {
    const { refreshtoken }= req.headers
    if(!refreshtoken) 
        return res.status(400).json({ message: "refreshtoken is required" })

    try {
        let payload= jwt.verify(refreshtoken, process.env.REFRESHTOKEN_SECRET)
        let user= await userModal.findOne(refreshtoken)
        if(!user)
            return res.status(400).json({ message: "user not found" })
        await sessionmodel.deleteOne({ refreshtoken })
        res.cookie("refreshtoken", "", { httpOnly: true, expires: new Date(0) })
        res.cookie("accesstoken", "", { httpOnly: true, expires: new Date(0) })
        res.status(200).json({ message: "user logged out successfully" })
    } catch (error) {
        console.log(error.message)
        if(error.message.includes("jwt expired")){
            return res.status(400).json({ message: "refreshtoken expired" })
        }else if(error.message.includes("jwt malformed")){
            return res.status(400).json({ message: "refreshtoken invalid" })
        }
        res.status(500).json({ message: "unable to logout user" })
    }
}
module.exports={register,loginuser, getaccesstoken}