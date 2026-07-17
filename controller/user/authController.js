import {
    registerUserService,
    loginUserService,
    loadHomeService,
    resetPasswordService,
    setNewPasswordService
} from "../../services/user/authService.js";
import { statuscodes } from "../../utils/status_codes.js";

export const loadRegister = (req, res) => {
    res.render("users/signup")
}

export const loadLogin = (req, res) => {
  const message = req.query.message === "blocked"
    ? "Your account has been blocked by the admin."
    : null;

  res.render("users/login", { message });
};

export const registerUser = async (req, res) => {
  try {
    const { username, email, password, cfmpassword, referralCode } = req.body;

    const result = await registerUserService({
        username,
        email,
        password,
        cfmpassword,
        referralCode: referralCode || req.session.referralCode || null
    });

    req.session.pendingUser = result.pendingUser;
    req.session.otpEmail = result.cleanEmail;
    req.session.otpPurpose = "register";

    req.session.save((err) => {
      if (err) {
        return res.status(statuscodes.SERVER_ERROR).json({ success: false, message: "Session error. Please try again." });
      }

      return res.status(statuscodes.OK).json({
        success: true,
        redirectUrl: "/users/otpVerify",
        message: "OTP sent successfully to your email."
      });
    });

  } catch (error) {
    console.error(error);
    return res.status(error.statusCode || statuscodes.BAD_REQUEST).json({
      success: false,
      message: error.message || "Something went wrong. Please try again."
    });
  }
};

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const userData = await loginUserService({ email, password });

    req.session.user = userData;

    req.session.save(() => {
      return res.status(200).json({ redirect: "/users/home" });
    });

  } catch (error) {
    console.error(error);
    return res.status(error.statusCode || statuscodes.SERVER_ERROR).json({ message: error.message || "Something went wrong" });
  }
};

export const loadHome = async (req, res) => {
  try {
    const userId = req.session.user?._id || req.session.user?.id;

    const homeData = await loadHomeService(userId);

    return res.render("users/home", {
      user: req.session.user || null,
      ...homeData
    });

  } catch (error) {
    console.error("Home load error:", error);
    return res.status(statuscodes.SERVER_ERROR).send("Server Error");
  }
};

export const loadResetPassword = (req, res) => {
  res.render("users/resetPassword")
}

export const resetPassword = async (req, res) => {
  try {
    let { email } = req.body;

    const savedEmail = await resetPasswordService(email);
   
    req.session.otpEmail = savedEmail;
    req.session.otpPurpose = "reset";

    req.session.save((err) => {
      if (err) return res.status(statuscodes.SERVER_ERROR).json({ success: false, message: "Session error" });
      
      return res.json({ 
        success: true, 
        message: "OTP sent",
        redirect: "/users/otpVerify"   
      });
    });

  } catch (error) {
    console.error(error);
    res.status(error.statusCode || statuscodes.SERVER_ERROR).json({ success: false, message: error.message || "Something went wrong" });
  }
};

export const loadVerifyOtp = (req, res) => {
  const email = req.session.otpEmail;
  const purpose = req.session.otpPurpose;
  if (!email) return res.redirect('/users/signup');
  res.render("users/otpVerify", { email, purpose }); 
};

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

export const setNew = async (req, res) => {
  try {
    if (!req.session.resetVerified) {
      return res.status(statuscodes.FORBIDDEN).json({ success: false, message: "Unauthorized" });
    }

    const email = req.session.otpEmail;
    let { password } = req.body;

    if (!email) {
      return res.status(statuscodes.BAD_REQUEST).json({ success: false, message: "Session expired" });
    }

    await setNewPasswordService({ email, password });
    
    req.session.resetVerified = null;
    req.session.otpEmail = null;
    req.session.otpPurpose = null;

    return res.json({ 
      success: true, 
      message: "Password reset successful",
      redirect: "/users/login"
    });

  } catch (error) {
    console.error(error);
    return res.status(error.statusCode || statuscodes.SERVER_ERROR).json({ success: false, message: error.message || "Something went wrong" });
  }
};

export const logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.log(err);
      return res.redirect("/users/home");
    }

    res.clearCookie("user.sid");
    return res.redirect("/users/home");
  });
};
