const express= require('express')
const {register,loginuser,getaccesstoken,logoutuser,logoutAllSessions,validateAccessToken, generateOTP, validateotp,changepassword} =require("../controllers/userController")

router= express.Router()

router.post("/user/register", register)
router.post("/user/login", loginuser)
router.get("/user/getaccesstoken", getaccesstoken)
router.delete("/user/logout", logoutuser)
router.delete("/user/logoutallsessions", logoutAllSessions)
router.post("/user/validateaccesstoken", validateAccessToken)
router.post("/user/generateotp", generateOTP)
router.post("/user/validateotp", validateotp)
router.post("/user/changepassword", changepassword)

module.exports= router