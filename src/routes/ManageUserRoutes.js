const express= require('express')
const {loginuser,updateAccInfo,getaccesstoken,logoutuser,logoutAllSessions,validateAccessToken,uploadsetup,uploadfile, generateOTP, validateotp,changepassword,resetpasswordwithotp} =require("../controllers/userController")
const {register,changeRole,blockuser, deleteUser}= require("../controllers/adminController")

router= express.Router()
//User routes start from here
router.post("/user/register", register)
router.post("/user/login", loginuser)
router.get("/user/getaccesstoken", getaccesstoken)
router.delete("/user/logout", logoutuser)
router.delete("/user/logoutallsessions", logoutAllSessions)
router.post("/user/validateaccesstoken", validateAccessToken,(req,res)=>{res.json({message:"access token is valid"})})
router.post("/user/generateotp", generateOTP)
router.post("/user/validateotp", validateotp)
router.post("/user/changepassword", changepassword)
router.post("/user/resetpasswordwithotp", resetpasswordwithotp)
router.put("/user/updateinfo",validateAccessToken, updateAccInfo)
router.post("/user/fileupload",uploadsetup.fields([
    { name: 'test', maxCount: 1 },
  ]), uploadfile)

//Admin routes starts from here
router.put("/admin/updateaccrole",validateAccessToken, changeRole)
router.post("/admin/blockunblockuser",validateAccessToken, blockuser)
router.delete("/admin/deleteuser",validateAccessToken,deleteUser)

module.exports= router