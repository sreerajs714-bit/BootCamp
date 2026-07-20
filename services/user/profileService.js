import bcrypt from "bcrypt";
import fs from "fs";
import User from "../../model/userModel.js";
import OTP from "../../model/otpModel.js";
import { generateOTP, sendOTPEmail } from "../../utils/mail.js";

const saltround = 10;

export const getUserProfileService = async (userId) => {
    const user = await User.findById(userId);
    if (!user) {
        throw new Error("User not found");
    }
    return user;
};

export const changeUserPasswordService = async (userId, { currentPassword, newPassword, confirmPassword }) => {
    const user = await User.findById(userId);
    if (!user) {
        throw new Error("User not found");
    }

    if (user.googleId) {
        if (!newPassword || !confirmPassword) {
            throw new Error("All fields are required");
        }
        if (newPassword !== confirmPassword) {
            throw new Error("Passwords do not match");
        }
        if (currentPassword === newPassword) {
            throw new Error("New password cannot be the same as the current password");
        }
        if (newPassword.length < 4) {
            throw new Error("Password must be at least 4 characters");
        }
        const hashed = await bcrypt.hash(newPassword, saltround);
        user.password = hashed;
        await user.save();
        return "Password set successfully";
    }

    if (!currentPassword || !newPassword || !confirmPassword) {
        throw new Error("All fields are required");
    }
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
        throw new Error("Current password is incorrect");
    }
    if (newPassword !== confirmPassword) {
        throw new Error("Passwords do not match");
    }
    if (currentPassword === newPassword) {
        throw new Error("New password cannot be the same as the current password");
    }
    if (newPassword.length < 4) {
        throw new Error("Password must be at least 4 characters");
    }
    const hashed = await bcrypt.hash(newPassword, saltround);
    user.password = hashed;
    await user.save();
    return "Password changed successfully";
};

export const changeUserEmailService = async (userId, newEmail) => {
    const existingUser = await User.findOne({ email: newEmail });

    if (existingUser) {
        throw new Error("Email already exists");
    }

    const otp = generateOTP();
    const hashedOTP = await bcrypt.hash(otp, 10);

    await OTP.deleteMany({
        email: newEmail,
        purpose: "changeEmail"
    });

    await OTP.create({
        email: newEmail,
        otp: hashedOTP,
        purpose: "changeEmail",
    });

    await sendOTPEmail(newEmail, otp);

    return {
        otp,
        newEmail
    };
};

export const updateUserProfileService = async (userId, username, phoneNO) => {
    if (!username || username.trim().length < 3) {
        throw new Error('Name must be at least 3 characters');
    }
    if (!phoneNO || !/^\d{10}$/.test(phoneNO.trim())) {
        throw new Error('Phone number must be exactly 10 digits');
    }

    await User.findByIdAndUpdate(userId, {
        username: username.trim(),
        phoneNO: phoneNO.trim()
    });

    return {
        username: username.trim(),
        phoneNO: phoneNO.trim()
    };
};

export const updateProfilePhotoService = async (userId, filename) => {
    const profilePhoto = `/uploads/profiles/${filename}`;
    await User.findByIdAndUpdate(userId, { profilePhoto });
    return profilePhoto;
};

export const deleteProfilePhotoService = async (userId) => {
    const user = await User.findById(userId);
    if (!user) {
        throw new Error("User not found");
    }

    if (user.profilePhoto) {
        const filePath = `public${user.profilePhoto}`;
        fs.unlink(filePath, (err) => {
            if (err) console.log("File delete error:", err.message);
        });
    }

    await User.findByIdAndUpdate(userId, { profilePhoto: null });
};
