import userSchema from "../../Model/userModel.js"
import session from "express-session";
import { generateOTP }  from "../service/mail.js";
import { sendOTPEmail } from "../service/mail.js";
import OTP from "../../Model/otpModel.js"
import bcrypt from "bcrypt";
const saltround=10;


export const loadRegister=(req,res)=>{
    res.render("users/signup")
}

export const loadLogin = (req, res) => {
  const message = req.query.message === "blocked"
    ? "Your account has been blocked by the admin."
    : null;

  res.render("users/login", { message });
};

export const RegisterUser = async (req, res) => {

  try {

    const { username, email, password } = req.body;

    const cleanEmail = email.trim().toLowerCase();

    // Check existing user
    const existingUser = await userSchema.findOne({
      email: cleanEmail
    });

    if (existingUser) {

      return res.render("users/signup", {
        message: "User already exists",
        username,
        email
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, saltround);

    // Save session data
    req.session.pendingUser = {
      username,
      email: cleanEmail,
      password: hashedPassword
    };

    req.session.otpEmail = cleanEmail;

    req.session.otpPurpose = "register";

    // Generate OTP
    const otp = generateOTP();

    const hashedOTP = await bcrypt.hash(otp, 10);

    // Remove old OTPs
    await OTP.deleteMany({
      email: cleanEmail,
      purpose: "register"
    });

    // Save OTP
    await OTP.create({
      email: cleanEmail,
      otp: hashedOTP,
      purpose: "register",
       expiresAt: Date.now() + 1 * 60 * 1000 
    });

    // Send email
    await sendOTPEmail(cleanEmail, otp);

    // SAVE SESSION BEFORE RENDER
    req.session.save((err) => {

      if (err) {

        console.log("SESSION SAVE ERROR:", err);

        return res.send("Session error");
      }

      return res.render("users/otpVerify", {
        message: "OTP sent successfully",
        email: cleanEmail,
        purpose: "register"
      });
    });

  } catch (error) {

    console.log("REGISTER ERROR:", error.message);

    res.send("Something went wrong");
  }
};

export const LoginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const existingUser = await userSchema.findOne({ email });

    if (!existingUser) {
      return res.status(404).json({ message: "User does not exist" });
    }

    if (existingUser.isBlocked) {
      return res.status(403).json({ message: "Your Account Is Blocked By Admin" });
    }

    const isMatch = await bcrypt.compare(password, existingUser.password);

    if (!isMatch) {
      return res.status(401).json({ message: "Incorrect password" });
    }

    req.session.user = {
      id: existingUser._id,
      username: existingUser.username,
      email: existingUser.email,
      phoneNo: existingUser.phoneNO,
      profilePhoto: existingUser.profilePhoto || null
    };

    req.session.save(() => {
      return res.status(200).json({ redirect: "/users/home" });
    });

  } catch (error) {
    console.log(error.message);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const loadHome = (req, res) => {
  return res.render("users/home", {
    user: req.session.user || null
  });
};

export const loadResetPassword=(req,res)=>{
  res.render("users/resetPassword")
}

export const resetPassword = async (req, res) => {
  try {
    let { email } = req.body;

    email = email.trim().toLowerCase();

    const existingUser = await userSchema.findOne({ email });

    if (!existingUser) {
      return res.status(404).json({ 
        success: false, 
        message: "User does not exist" 
      });
    }

    const otp = generateOTP();
    const hashedOTP = await bcrypt.hash(otp, 10);
   
    req.session.otpEmail = email;
    req.session.otpPurpose = "reset";

    await OTP.deleteMany({ email, purpose: "reset" });

    await OTP.create({
      email,
      otp: hashedOTP,
      purpose: "reset",
      expiresAt: Date.now() + 60 * 1000
    });

    await sendOTPEmail(email, otp);

    req.session.save((err) => {
      if (err) return res.status(500).json({ success: false, message: "Session error" });
      
      return res.json({ 
        success: true, 
        message: "OTP sent",
        redirect: "/users/otpVerify"   // frontend will use this to navigate
      });
    });

  } catch (error) {
    console.log(error.message);
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

export const loadVerifyOtp=(req,res)=>{
  res.render("users/otpVerify");
}

export const loadSetNew = (req, res) => {
  const email = req.session.otpEmail;

  if (!req.session.resetVerified) {
    return res.redirect("/users/login"); 
  }

  if (!email) {
    return res.redirect("/users/login");
  }

  res.render("users/SetNewPassword", { email });
};

export const SetNew = async (req, res) => {
  try {

    if (!req.session.resetVerified) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    const email = req.session.otpEmail;
    let { password } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: "Session expired" });
    }

    const user = await userSchema.findOne({ email });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const isSame = await bcrypt.compare(password, user.password);

    if (isSame) {
      return res.status(400).json({ 
        success: false, 
        message: "New password cannot be same as old password" 
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    user.password = hashedPassword;
    await user.save();

    // Clear session
    req.session.resetVerified = null;
    req.session.otpEmail = null;
    req.session.otpPurpose = null;

    return res.json({ 
      success: true, 
      message: "Password reset successful",
      redirect: "/users/login"
    });

  } catch (error) {
    console.log(error.message);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

export const Logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.log(err);
      return res.redirect("/users/home");
    }

    res.clearCookie("connect.sid"); // important
    return res.redirect("/users/home");
  });
};