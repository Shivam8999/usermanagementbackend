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
        const expiryAccessToken = new Date();
        expiryAccessToken.setMinutes(expiryAccessToken.getMinutes() + 15);//15 minutes from current time

        const expiryRefreshToken = new Date();
        expiryRefreshToken.setHours(expiryRefreshToken.getHours() + 720);//720 hours that is 30 days from right now
       
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
        res.status(200).json({ message: "user logged in successfully",name:user.Name,status:user.status,email:user.Email, accesstoken, refreshtoken,userid:user._id })
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
        const checkrefreshtoken = await sessionmodel.findOne({userId:payload.id,refreshtoken:refreshtoken,expiresAt:{$gt: Date.now()}})
        
        if(!checkrefreshtoken){
            return res.status(400).json({ message: "refreshtoken invalidated" })
        }

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

/*************  ✨ Codeium Command ⭐  *************/
/**
 * Logs out a user by removing the refresh token from the session database
 * and clearing the access and refresh tokens from the cookies.
 *
 * @param {Object} req - The request object containing headers and cookies.
 * @param {Object} res - The response object used to send the HTTP response.
 *
 * The function first attempts to retrieve the refresh token from the request
 * headers or cookies. If the refresh token is not found, it sends a response
 * indicating that the refresh token is required. It then verifies the refresh
 * token and checks if a user exists with the given token. If the user is not
 * found, it returns an error response. If the user is found, it deletes the
 * session associated with the refresh token, clears the tokens from cookies,
 * and sends a success response. Handles and logs errors related to token 
 * expiration and invalid tokens.
 */
const logoutuser= async (req, res) => {
   //fetch refreshtoken from header
   let refreshtoken= req.headers.refreshtoken

   //if header doesn't contain refreshtoken then fetch it from cookie
   if(!refreshtoken){
       refreshtoken= req.cookies.refreshtoken
   }

    //if refreshtoken is not present in cookie and header then return the error in response
    if(!refreshtoken) 
        return res.status(400).json({ message: "refreshtoken is required" })

    try {
        let payload= jwt.verify(refreshtoken, process.env.REFRESHTOKEN_SECRET)
        let user= await userModal.findOne({refreshtoken})
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

//will accept userid from header and then logout user from all the sessions by invalidating the refreshtokens
const logoutAllSessions= async (req, res) => {
    //fetch refreshtoken from header
    let userid= req.headers.userid
 
    //if header doesn't contain refreshtoken then fetch it from cookie
    if(!userid){
        userid= req.cookies.userid
    }
 
     //if refreshtoken is not present in cookie and header then return the error in response
     if(!userid) 
         return res.status(400).json({ message: "User id is required" })
 
     try {
        //  let payload= jwt.verify(refreshtoken, process.env.REFRESHTOKEN_SECRET)
         
        //  console.log(payload)
         let user= await userModal.findOne({_id:Object(userid)})
         if(!user)
             return res.status(400).json({ message: "user not found" })

        //  console.log(user)
         let resquery = await sessionmodel.deleteMany({ userId: user.id} )
         
         res.cookie("refreshtoken", "", { httpOnly: true, expires: new Date(0) })
         res.cookie("accesstoken", "", { httpOnly: true, expires: new Date(0) })
         res.status(200).json({ message: "Successfully logged out user from "+resquery.deletedCount+" sessions" })
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


const validateAccessToken = async (req, res, next) => {
    let accessToken = req.cookies.accesstoken;
    if (!accessToken) {
        accessToken = req.headers.accesstoken;
      }
    if (!accessToken) {
      return res.status(401).json({ message: "Access token not found" });
    }

    try {
        let tokendata = await jwt.verify(accessToken, process.env.ACCESSTOKEN_SECRET);
        console.log(tokendata)
        res.json({ message: "Access token is valid" });
        // next();
    } catch (error) {
        console.log(error.message);
        return res.status(401).json({ message: "Invalid access token" });
    }
}

const generateOTP = async (req, res) => {
    let email = req.body.email
    let baseotp =  Math.floor(3000 + Math.random() * 700000).toFixed(0)
    

    const otpExpiry = new Date();
    console.log(otpExpiry)
    otpExpiry.setMinutes(otpExpiry.getMinutes() + 1);//5 minutes

    console.log(otpExpiry)

    if(!email) 
        return res.status(400).json({ message: "email is required" })

    if(baseotp.length==5)
        baseotp=baseotp+ baseotp[3]
    else if(baseotp.length==4)
        baseotp=baseotp[3]+baseotp+baseotp[0]

    console.log(baseotp)

    try {
        const updateOTP= await userModal.updateOne({Email:email},{$set:{otp:baseotp,otpGeneratedAt:new Date(),otpExpiresAt:otpExpiry}})
        //here will come the logic for sending otp i.e email or phone number

        res.json({ message: "OTP sent successfully" });
    } catch (error) {
        res.json({ message: "unable to send otp" });
    }
}

//takes otp, email from body and validates the otp. If otp validated them remove the otp from database and return success
const validateotp = async (req, res) => {
    const {email, otp} = req.body

    if(!email || !otp){
        return res.status(400).json({ message: "email and otp are required" })
    }
    try {
        let userdata= await userModal.findOne({Email:email})
        if(!userdata)
            return res.status(400).json({ message: "user not found" })

        if(userdata.otpExpiresAt>=new Date()){
            return res.status(400).json({ message: "Expired OTP" })
        }

        console.log(new Date())

        if(userdata.otp!=otp){
            return res.status(400).json({ message: "Invalid OTP" })
        }

        //if the OTP is valid then update the database by removeing the OTP and return the success response
        const updateOTP= await userModal.updateOne({Email:email},{$set:{otp:"",otpGeneratedAt:null,otpExpiresAt:null}})
        
        res.json({ message: "OTP is valid" });

        
    } catch (error) {
        res.status(500).json({ message: "unable to validate otp" })
    }
}

//post request takes email, old password, new password and confirm new password and changes the password to the new one
const changepassword = async (req, res) => {
    const {email,oldpass,newpass,confirmnewpass} = req.body
    if(!oldpass || !newpass || !confirmnewpass){
        return res.status(400).json({ message: "old password, new password and confirm new password are required" })
    }

    if(newpass!=confirmnewpass){
        return res.status(400).json({ message: "new password and confirm new password does not match" })
    }

    try {
        let userdata= await userModal.findOne({Email:email})
        if(!userdata)
            return res.status(400).json({ message: "user not found" })

        let compareresult = await bcrypt.compare(oldpass, userdata.Password)
        if(!compareresult){
            return res.status(400).json({ message: "old password is incorrect" })
        }

        let hashednewpass= await bcrypt.hash(newpass, 8)

        const updatePassword= await userModal.updateOne({Email:email},{$set:{Password:hashednewpass}})

        res.json({ message: "Password changed successfully" });
    }catch(error){
        console.log("change password error :"+error.message)
        res.status(500).json({ message: "unable to change password" })
    }
}

const changepasswordwithotp = async (req, res) => {
    const {email,otp,newpass,confirmnewpass} = req.body
    if(!email ||!otp || !newpass || !confirmnewpass){
        return res.status(400).json({ message: "email, otp, new password and confirm new password are required" })
    }

    if(newpass!=confirmnewpass){
        return res.status(400).json({ message: "new password and confirm new password does not match" })
    }

    try {
        let userdata= await userModal.findOne({Email:email})
        if(!userdata)
            return res.status(400).json({ message: "user not found" })

        if(userdata.otpExpiresAt<Date.now()){
            return res.status(400).json({ message: "Expired OTP" })
        }

        if(userdata.otp!=otp){
            return res.status(400).json({ message: "Invalid OTP" })
        }

        let hashednewpass= await bcrypt.hash(newpass, 8)

        const updatePassword= await userModal.updateOne({Email:email},{$set:{Password:hashednewpass}})

        res.json({ message: "Password changed successfully" });
    }catch(error){
        console.log("change password error :"+error.message)
        res.status(500).json({ message: "unable to change password" })
    }
}


module.exports={register,loginuser, getaccesstoken,logoutuser,logoutAllSessions,validateAccessToken,generateOTP, validateotp,changepassword}