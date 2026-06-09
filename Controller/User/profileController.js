import bcrypt from "bcrypt";
const saltround=10;
import fs from "fs";
import userSchema from "../../Model/userModel.js"
import OTP from "../../Model/otpModel.js"
import { generateOTP } from "../service/mail.js";
import { sendOTPEmail } from "../service/mail.js";

export const loadProfile = async (req, res) => {
  try {
    const userId = req.session.user.id;
      res.locals.breadcrumbs = [
       { label: 'Home', url: '/' },
       { label: "Profile" },
       ];
    const user = await userSchema.findById(userId);

    return res.render("users/profile", { 
      user,
      isGoogleUser: user.googleId ? true : false 
    });

  } catch (error) {
    console.log("LOAD PROFILE ERROR:", error.message);
    res.redirect("/users/home");
  }
};

export const loadEditProfile=async (req,res)=>{
  try {
    const userId = req.session.user.id;
      res.locals.breadcrumbs = [
       { label: 'Home', url: '/' },
        { label: 'Profile', url: '/users/profile' },
       { label: "editProfile" },
       ];

    // ✅ Fetch full user from DB
    const user = await userSchema.findById(userId);

    return res.render("users/editProfile", { user });

  } catch (error) {
    console.log("LOAD EDIT PROFILE ERROR:", error.message);
    res.redirect("/users/home");
  }
}

export const changePassword = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    const user = await userSchema.findById(userId);
    if (!user) return res.json({ success: false, message: "User not found" });

    if (user.googleId) {
      // ✅ Google user — no current password needed
      if (!newPassword || !confirmPassword) {
        return res.json({ success: false, message: "All fields are required" });
      }
      if (newPassword !== confirmPassword) {
        return res.json({ success: false, message: "Passwords do not match" });
      }
      if (currentPassword === newPassword) {
        return res.json({ success: false, message: "New password cannot be the same as the current password" });
      }
      if (newPassword.length < 4) {
        return res.json({ success: false, message: "Password must be at least 4 characters" });
      }
      const hashed = await bcrypt.hash(newPassword, saltround);
      user.password = hashed;
      await user.save();
      return res.json({ success: true, message: "Password set successfully" });
    }

    // ✅ Normal user — verify current password
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.json({ success: false, message: "All fields are required" });
    }
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.json({ success: false, message: "Current password is incorrect" });
    }
    if (newPassword !== confirmPassword) {
      return res.json({ success: false, message: "Passwords do not match" });
    }
    if (currentPassword === newPassword) {
        return res.json({ success: false, message: "New password cannot be the same as the current password" });
      }
    if (newPassword.length < 4) {
      return res.json({ success: false, message: "Password must be at least 4 characters" });
    }
    const hashed = await bcrypt.hash(newPassword, saltround);
    user.password = hashed;
    await user.save();
    return res.json({ success: true, message: "Password changed successfully" });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

export const changeEmail=async (req,res)=>{

    try{

     const userId = req.session?.user?.id;

      const { newEmail } = req.body;

    // EMAIL EXISTS CHECK
    const existingUser = await userSchema.findOne({
      email: newEmail
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email already exists"
      });
    }

    req.session.changeEmailUserId = userId;

    const otp=generateOTP();

    const hashedOTP = await bcrypt.hash(otp, 10);

    await OTP.deleteMany({
  email: newEmail,
  purpose: "changeEmail"
});

    // SAVE OTP
    await OTP.create({
      email: newEmail,
      otp: hashedOTP,
      purpose:"changeEmail",
    });

    req.session.otpPurpose = "changeEmail";
    req.session.newEmail = newEmail;

    req.session.save(async () => {

  await sendOTPEmail(newEmail, otp);

  return res.json({
    success: true,
    message: "OTP sent successfully"
  });

});
}catch(error){
    console.log(error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong"
    });
}

}

export const editProfile = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { username, phoneNO } = req.body;

    // Basic validation on server side too
    if (!username || username.trim().length < 3) {
      return res.status(400).json({ success: false, message: 'Name must be at least 3 characters' });
    }
    if (!phoneNO || !/^\d{10}$/.test(phoneNO.trim())) {
      return res.status(400).json({ success: false, message: 'Phone number must be exactly 10 digits' });
    }

    await userSchema.findByIdAndUpdate(userId, {
      username: username.trim(),
      phoneNO: phoneNO.trim()
    });

    // Update session
    req.session.user.username = username.trim();
    req.session.user.phoneNO = phoneNO.trim();

    return res.json({ success: true, message: 'Profile updated successfully' });

  } catch (err) {
    console.error('editProfile error:', err);
    return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};

export const uploadProfilePhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const userId = req.session.user.id;
    const profilePhoto = `/uploads/profiles/${req.file.filename}`;

    await userSchema.findByIdAndUpdate(userId, { profilePhoto });

    return res.json({ success: true, profilePhoto });

  } catch (error) {
    console.log("UPLOAD ERROR:", error.message);
    return res.status(500).json({ success: false, message: "Upload failed" });
  }
};

export const removeProfilePhoto = async (req, res) => {
  try {
    const userId = req.session.user.id;

    // Get current user to find the file path
    const user = await userSchema.findById(userId);

    // ✅ Delete file from disk if it exists
    if (user.profilePhoto) {
      const filePath = `public${user.profilePhoto}`;
      fs.unlink(filePath, (err) => {
        if (err) console.log("File delete error:", err.message);
      });
    }

    // ✅ Remove from DB
    await userSchema.findByIdAndUpdate(userId, { profilePhoto: null });

    return res.json({ success: true });

  } catch (error) {
    console.log("REMOVE PHOTO ERROR:", error.message);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};