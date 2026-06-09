import OTP from "../Model/otpModel.js";
import { generateOTP } from "./service/mail.js";
import { sendOTPEmail } from "./service/mail.js";
import userSchema from "../Model/userModel.js"
import bcrypt from "bcrypt"

export const verifyOTP = async (req, res) => {
    try {
        let { email, otp, purpose } = req.body;

        // Fallback to session if body values are missing
        if (!email || email.trim() === '') {
            email = req.session.otpEmail;
        }
        if (!purpose) {
            purpose = req.session.otpPurpose;
        }

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Session expired. Please try again."
            });
        }

        if (!purpose) {
            return res.status(400).json({
                success: false,
                message: "OTP session expired"
            });
        }

        email = email.trim().toLowerCase();
        otp = otp.trim();

        const otpRecord = await OTP.findOne({ email, purpose });

        // OTP NOT FOUND
        if (!otpRecord) {
            return res.status(400).json({
                success: false,
                message: "OTP expired or not found"
            });
        }

        // CHECK EXPIRY
        if (otpRecord.expiresAt < Date.now()) {
            await OTP.deleteOne({ _id: otpRecord._id });
            return res.status(400).json({
                success: false,
                message: "OTP has expired. Please request a new one."
            });
        }

        // VERIFY OTP
        const isMatch = await bcrypt.compare(otp, otpRecord.otp);

        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: "Incorrect OTP"
            });
        }

        // DELETE USED OTP
        await OTP.deleteOne({ _id: otpRecord._id });

        // ================= REGISTER =================
        if (purpose === "register") {

            if (!req.session.pendingUser) {
                return res.status(400).json({
                    success: false,
                    message: "Registration session expired"
                });
            }

            const { username, password } = req.session.pendingUser;

            const newUser = new userSchema({
                username,
                email,
                password
            });

            await newUser.save();

            req.session.user = {
                id: newUser._id,
                username: newUser.username,
                email: newUser.email
            };

            delete req.session.pendingUser;
            delete req.session.otpEmail;
            delete req.session.otpPurpose;

            await req.session.save();

            return res.json({
                success: true,
                redirectUrl: "/users/home"
            });
        }

        // ================= RESET PASSWORD =================
        if (purpose === "reset") {
            req.session.resetVerified = true;
            req.session.otpEmail = email;

            req.session.save((err) => {
                if (err) {
                    console.log("Session save error:", err);
                    return res.status(500).json({
                        success: false,
                        message: "Session error"
                    });
                }
                return res.json({
                    success: true,
                    redirectUrl: "/users/setNew"
                });
            });
            return;
        }

        // ================= CHANGE EMAIL =================
        if (purpose === "changeEmail") {

            const userId = req.session.user.id;

            await userSchema.findByIdAndUpdate(userId, {
                email: req.session.newEmail
            });

            delete req.session.newEmail;
            delete req.session.otpPurpose;

            return res.json({
                success: true,
                message: "Email updated successfully",
                redirectUrl: "/users/profile"
            });
        }

        return res.status(400).json({
            success: false,
            message: "Invalid OTP purpose"
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: "Something went wrong"
        });
    }
};

export const resendOTP = async (req, res) => {

  try {

    const email = req.session.otpEmail;
    const purpose = req.session.otpPurpose;

    if (!email || !purpose) {

      return res.status(400).json({
        success: false,
        message: "Session expired"
      });
    }
    const otp = generateOTP();

    const hashedOTP = await bcrypt.hash(otp, 10);

    // Delete old OTPs
    await OTP.deleteMany({ email, purpose });

    // Save new OTP
    await OTP.create({
      email,
      otp: hashedOTP,
      purpose,
      expiresAt: Date.now() + 60 * 100
    });

    await sendOTPEmail(email, otp);

    return res.json({
      success: true,
      message: "OTP resent successfully"
    });

  } catch (err) {

    return res.status(500).json({
      success: false,
      message: "Failed to resend OTP"
    });
  }
};