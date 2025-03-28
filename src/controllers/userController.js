const userModal= require("../models/UsersModel.js")
const bcrypt = require("bcrypt")
const jwt= require("jsonwebtoken")
const sessionmodel= require("../models/SessionsModel.js")
const path = require("path")
const multer= require("multer")
const fs = require('fs')
const uploadpath = path.join(__dirname,"..","..","public","uploads","documents")

require("dotenv").config()

/** 
 * takes email, password from body
 * login the user then return access token and refresh token
 * send them in cookies as well and update the sessions collection
*/
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
        //if user is blocked return the error
        if(user.status==2){
            return res.status(400).json({ message: "user is blocked and cannot login" })
        }
        //check password
        let isMatch= await bcrypt.compare(password, user.Password)
        if(!isMatch)
            return res.status(400).json({ message: "invalid email or password" })

        //generate accessToken and refreshToken
        let accesstoken= jwt.sign({ id: user._id,name:user.Name,type:"accessToken",role:user.Role }, process.env.ACCESSTOKEN_SECRET,{expiresIn: "15m"})
        let refreshtoken= jwt.sign({ id: user._id,name:user.Name,type:"refreshToken" }, process.env.REFRESHTOKEN_SECRET, { expiresIn: "30d" })

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
/** 
 * logged in users can update all of their personal information i.e  name,email, phone, address
*/
const updateAccInfo = async (req, res) => {
    try {
        const { name,email, phone, address } = req.body;
        const {id} = req.body.tokendata;

        let user = await userModal.findById(id);
        if (!user) {
            return res.status(400).json({ message: "user not found" });
        }
        user.Name = name || user.Name;
        user.Email = email || user.Email;
        user.Phone = phone || user.Phone;
        user.Address = address || user.Address;
        await user.save();

        res.status(200).json({ message: "user information updated successfully", user });
    }catch{
        console.log(error.message)
        res.status(500).json({ message: "unable to update information" })
    }
}


/** 
 * get access token from refresh token
 * refreshtoken is stored in sessions collection and refreshtoken is received from header or cookie
*/
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

        //if user is blocked return the error
        if(user.status==2){
            return res.status(400).json({ message: "user is blocked and access token cannot be generated further" })
        }

        let accesstoken= jwt.sign({ id: user._id,name:user.Name,type:"accessToken",role:user.Role}, process.env.ACCESSTOKEN_SECRET,{expiresIn: "15m"})
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

/**
 * logout user by taking refreshtoken from header or cookie
 * refreshtoken is received from header or cookie
 * finds and deletes the refreshtoken from sessions collection to make sure that the session has been deleted successfully
 * Response will be sent with refreshtoken deleted and cookies will be send with empty values
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
        // let payload= jwt.verify(refreshtoken, process.env.REFRESHTOKEN_SECRET)
        let user= await sessionmodel.deleteOne({ refreshtoken })
        if(!user.deletedCount)
            return res.status(400).json({ message: "session not found" })

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

/**
 *  will accept access token from header and then validate it
 * it adds the tokendata to the request body
 * {  id: 'mongodb object id',  name: 'name in token', type: 'accessToken|refreshToken',  role: 'admin|user' }
*/
const validateAccessToken = async (req, res, next) => {
    let accessToken = req.cookies.accesstoken;
    if (!accessToken) {
        try {
            accessToken = req.headers.authorization.split(" ")[1];
        } catch (error) {
            console.log(error.message);
            res.status(401).json({ message: "Authorization token not found" });
            return
        }
        
      }
    if (!accessToken) {
      return res.status(401).json({ message: "Access token not found" });
    }

    try {
        let tokendata = await jwt.verify(accessToken, process.env.ACCESSTOKEN_SECRET);
        // console.log(tokendata) //uncomment this if needed to see the tokendata for understanding
        req.body.tokendata= tokendata
        next();
    } catch (error) {
        console.log(error.message);
        return res.status(401).json({ message: "Invalid access token" });
    }
}

//takes email and then generates the otp from body, its valid for 10 minutes for now
const generateOTP = async (req, res) => {
    const otpvalidity = 10 //set validity of otp in minutes
    let email = req.body.email
    let baseotp =  Math.floor(3000 + Math.random() * 700000).toFixed(0)
    
    const otpExpiry = new Date();   
    otpExpiry.setMinutes(otpExpiry.getMinutes() + otpvalidity);//1 minutes from current time

    if(!email) 
        return res.status(400).json({ message: "email is required" })

    if(baseotp.length==5)
        baseotp=baseotp+ baseotp[3]
    else if(baseotp.length==4)
        baseotp=baseotp[3]+baseotp+baseotp[0]

    // console.log(baseotp)
    //check OTP in mongoDB database

    try {
        const updateOTP= await userModal.updateOne({Email:email},{$set:{otp:baseotp,otpGeneratedAt:new Date(),otpExpiresAt:otpExpiry}})
        //here will come the logic for sending otp i.e email or phone number

        res.json({ message: "OTP sent successfully", validity:`${otpvalidity} minutes`  });
    } catch (error) {
        res.json({ message: "unable to send otp" });
    }
}

//takes otp, email from body and validates the otp. If otp validated them remove the otp from database and return success
const validateotp = async (req, res) => {
    const {email, otp} = req.body
    const todaynow=new Date()
    if(!email || !otp){
        return res.status(400).json({ message: "email and otp are required" })
    }
    try {
        let userdata= await userModal.findOne({Email:email})
        if(!userdata)
            return res.status(400).json({ message: "user not found" })

        const expiresAt= new Date(userdata.otpExpiresAt)
        if(expiresAt<todaynow){
            return res.status(400).json({ message: "Expired OTP" })
        }


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


/**
 * post request takes email, old password, new password and confirm new password
 * changes the password to the new one
*/
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

/**
 * takes email,otp,newpass,confirmnewpass from body
 * changes the password to the new one, when a valid OTP has been validated
*/
const resetpasswordwithotp = async (req, res) => {
    const {email,otp,newpass,confirmnewpass} = req.body
    const todaynow=new Date()
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
        const expiresAt= new Date(userdata.otpExpiresAt)
      
        if(userdata.otpExpiresAt==null){
            return res.status(400).json({ message: "OTP not generated" })
        }
        if(expiresAt<todaynow){
            return res.status(400).json({ message: "Expired OTP" })
        }

        if(userdata.otp=="")
            return res.status(400).json({ message: "OTP not generated" })

        if(userdata.otp!=otp){
            return res.status(400).json({ message: "Invalid OTP" })
        }

        let hashednewpass= await bcrypt.hash(newpass, 8)

        const updateUserData= await userModal.updateOne({Email:email},{$set:{Password:hashednewpass,otp:"",otpGeneratedAt:null,otpExpiresAt:null}})

        res.json({ message: "Password changed successfully" });
    }catch(error){
        console.log("change password error :"+error.message)
        res.status(500).json({ message: "unable to change password" })
    }
}

/**
 * Diskstorage allows you to write a custom login before saving the file on disk
 * else const uploadsetup = multer({dist:"upload dir"})--is more than enough to save the files
 */
const diskstorage = multer.diskStorage({
    destination: function (req, file, cb) {
        if(!fs.existsSync(uploadpath)){ //check if the directory exists and if not then create it
            fs.mkdirSync(uploadpath,{ recursive: true })//this will create all the parent dir as well if they don't exist
        }
        cb(null, uploadpath)
    },
    filename: function (req, file, cb) {
        let newfilename = Date.now() + "." + file.originalname.split(".").at(-1); //file name is unique by renaming it to a timestamp
        cb(null, newfilename)
    },
    fileFilter: (req, file, cb) => { // Only allow certain file types 
        const allowedTypes = ['image/jpeg', 'image/png','image/*']; //tyes of file allowed for uploading, currently its jpg and jpeg.
                                                        // docs : https://developer.mozilla.org/en-US/docs/Web/HTTP/MIME_types/Common_types
        if (!allowedTypes.includes(file.mimetype)) {
            return cb(new Error('Invalid file type')); 
        } 
        cb(null, true);
    }


})

/**
 * This function accepts dest or storage as storage paths. 
 * if dest then directly the path on the disk can be given: multer({dist:"upload dir"})
 * if storage custom logic for either diskstorage or MemoryStorage needs to be defined
 */
const uploadsetup = multer({ storage: diskstorage })

const uploadfile = async (req, res) => {
    const file=req.files.test //test is the name of the field in the form and accepts in the controller
    const filenamelist=file.map(file=>file.filename) //returns a new array of filenames
    if(file){
        res.json({message:"file uploaded successfully", filenames:filenamelist})
    }else{
        res.status(500).json({message:"unable to upload file"})
    }
}


const userData=async (req,res)=>{
    try {
        let userData= await userModal.findById(req.body.tokendata.id)
        res.json({userName:userData.Name,userEmail:userData.Email, userRole:userData.Role,userId:req.body.tokendata.id})
    } catch (error) {
        res.status(500).json({msg:"Error Occured", error:error.message})
    }
    
}
module.exports={loginuser,updateAccInfo, getaccesstoken,logoutuser,logoutAllSessions,
    validateAccessToken,generateOTP, uploadsetup, uploadfile,userData,
    validateotp,changepassword,resetpasswordwithotp}