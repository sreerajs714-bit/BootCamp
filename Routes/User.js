import express from "express";
const route=express.Router();
import { loadHome, loadRegister, loadResetPassword, loadSetNew, loadVerifyOtp, LoginUser, Logout, resetPassword, SetNew} from "../Controller/User/authController.js";
import { loadLogin } from "../Controller/User/authController.js";
import { RegisterUser } from "../Controller/User/authController.js";
import { resendOTP, verifyOTP } from "../Controller/otpcontroller.js";
import { checkSession, islogin, noCache } from "../Middleware/userAuth.js";
import { changeEmail, changePassword, editProfile, loadEditProfile, loadProfile, removeProfilePhoto, uploadProfilePhoto } from "../Controller/User/profileController.js";
import { uploadProfile } from "../Middleware/multer.js";
import passport from "../Config/passport.js";
import { addAddress, deleteAddress, editAddress, loadAddress } from "../Controller/User/addressController.js";


route.get("/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

route.get("/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/users/login" }),
  async (req, res) => {
    req.session.user = {
      id: req.user._id,
      username: req.user.username,
      email: req.user.email,
      profilePhoto: req.user.profilePhoto || null
    };
    req.session.save(() => {
      res.redirect("/users/home");
    });
  }
);


route.get("/",loadHome)
route.get("/signup",islogin,loadRegister)
route.get("/login",noCache,islogin,loadLogin)
route.post("/signup",RegisterUser)
route.get("/home",noCache,loadHome)
route.get("/profile",noCache,checkSession,loadProfile)
route.post("/login",LoginUser)
route.post("/logout",noCache,Logout)
route.get("/resetPassword",islogin,loadResetPassword)
route.post("/resetPassword",resetPassword)
route.get("/otpVerify",loadVerifyOtp)
route.post("/otpVerify",verifyOTP)
route.post("/resendOtp",resendOTP)
route.get("/setNew",noCache,loadSetNew)
route.post("/setNew",SetNew)
route.get("/editProfile",noCache,checkSession,loadEditProfile)
route.post("/editProfile", noCache, checkSession, uploadProfile.single("profilePhoto"), editProfile)
route.post("/uploadProfilePhoto", noCache, checkSession, uploadProfile.single("profilePhoto"),uploadProfilePhoto);
route.post("/removeProfilePhoto", noCache, checkSession,removeProfilePhoto);
route.post("/changePassword",noCache,checkSession,changePassword)
route.post("/changeEmail",changeEmail)
route.post("/verifyChangeEmailotp",noCache,checkSession,verifyOTP)
route.get("/address",checkSession,loadAddress);
route.post("/address",checkSession,addAddress)
route.put("/address/:id", checkSession,editAddress);
route.delete("/address/:id", checkSession,deleteAddress);


export default route;