const express= require('express')
const {register,loginuser,getaccesstoken} =require("../controllers/userController")

router= express.Router()

router.post("/user/register", register)
router.post("/user/login", loginuser)
router.get("/user/getaccesstoken", getaccesstoken)
module.exports= router