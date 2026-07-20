import OTP from "../model/otpModel.js";
import { generateOTP, sendOTPEmail } from "../utils/mail.js";
import { generateReferralCode } from "../config/referalCode.js";
import User from "../model/userModel.js";
import Wallet from "../model/walletModel.js";
import bcrypt from "bcrypt";

export const verifyOTPService = async ({ email, otp, purpose, pendingUser, userSessionId, newEmail }) => {
    email = email.trim().toLowerCase();
    otp = otp.trim();

    const otpRecord = await OTP.findOne({ email, purpose });

    if (!otpRecord) {
        throw new Error("OTP expired or not found");
    }

    if (otpRecord.expiresAt < Date.now()) {
        await OTP.deleteOne({ _id: otpRecord._id });
        throw new Error("OTP has expired. Please request a new one.");
    }

    const isMatch = await bcrypt.compare(otp, otpRecord.otp);

    if (!isMatch) {
        throw new Error("Incorrect OTP");
    }

    await OTP.deleteOne({ _id: otpRecord._id });

    if (purpose === "register") {
        if (!pendingUser) {
            throw new Error("Registration session expired");
        }

        const { username, password, referralCode: enteredReferralCode } = pendingUser;

        let referredBy = null;
        let referrer = null;

        if (enteredReferralCode) {
            referrer = await User.findOne({ referralCode: enteredReferralCode });
            if (referrer) {
                referredBy = referrer._id;
            }
        }

        let myReferralCode;
        let exists = true;
        while (exists) {
            myReferralCode = generateReferralCode();
            exists = await User.findOne({ referralCode: myReferralCode });
        }

        const newUser = new User({
            username,
            email,
            password,
            referralCode: myReferralCode,
            referredBy
        });

        await newUser.save();

        if (referrer) {
            let referrerWallet = await Wallet.findOne({ userId: referrer._id });
            if (!referrerWallet) {
                referrerWallet = new Wallet({ userId: referrer._id, balance: 0, transactions: [] });
            }
            referrerWallet.balance += 100;
            referrerWallet.transactions.push({
                type: 'credit',
                amount: 100,
                description: 'Referral Bonus - Friend joined',
                date: new Date()
            });
            await referrerWallet.save();
            await User.findByIdAndUpdate(newUser._id, { referralRewardGiven: true });

            let userWallet = await Wallet.findOne({ userId: newUser._id });
            if (!userWallet) {
                userWallet = new Wallet({ userId: newUser._id, balance: 0, transactions: [] });
            }
            userWallet.balance += 50;
            userWallet.transactions.push({
                type: 'credit',
                amount: 50,
                description: 'Referral Signup Bonus',
                date: new Date()
            });
            await userWallet.save();

            newUser.referralRewardGiven = true;
            await newUser.save();
        }

        return {
            success: true,
            user: {
                id: newUser._id,
                username: newUser.username,
                email: newUser.email
            },
            redirectUrl: "/users/home"
        };
    }

    if (purpose === "reset") {
        return {
            success: true,
            resetVerified: true,
            otpEmail: email,
            redirectUrl: "/users/setNew"
        };
    }

    if (purpose === "changeEmail") {
        if (!userSessionId) {
            throw new Error("User session expired");
        }

        await User.findByIdAndUpdate(userSessionId, {
            email: newEmail
        });

        return {
            success: true,
            changeEmailVerified: true,
            redirectUrl: "/users/profile"
        };
    }

    throw new Error("Invalid OTP purpose");
};

export const resendOTPService = async (email, purpose) => {
    if (!email || !purpose) {
        throw new Error("Session expired");
    }

    const otp = generateOTP();
    const hashedOTP = await bcrypt.hash(otp, 10);

    await OTP.deleteMany({ email, purpose });

    await OTP.create({
        email,
        otp: hashedOTP,
        purpose,
        expiresAt: Date.now() + 60 * 1000
    });

    await sendOTPEmail(email, otp);
    return { success: true, message: "OTP resent successfully" };
};
