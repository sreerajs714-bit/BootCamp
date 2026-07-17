import { verifyOTPService, resendOTPService } from "../services/otpService.js";
import { statuscodes } from "../utils/status_codes.js";

export const verifyOTP = async (req, res) => {
    try {
        let { email, otp, purpose } = req.body;

        if (!email || email.trim() === '') {
            email = req.session.otpEmail;
        }
        if (!purpose) {
            purpose = req.session.otpPurpose;
        }

        if (!email) {
            return res.status(statuscodes.BAD_REQUEST).json({
                success: false,
                message: "Session expired. Please try again."
            });
        }

        if (!purpose) {
            return res.status(statuscodes.BAD_REQUEST).json({
                success: false,
                message: "OTP session expired"
            });
        }

        const result = await verifyOTPService({
            email,
            otp,
            purpose,
            pendingUser: req.session.pendingUser,
            userSessionId: req.session.user?.id,
            newEmail: req.session.newEmail
        });

        if (purpose === "register") {
            req.session.user = result.user;
            delete req.session.pendingUser;
            delete req.session.otpEmail;
            delete req.session.otpPurpose;
            await req.session.save();

            return res.json({
                success: true,
                redirectUrl: result.redirectUrl
            });
        }
        
        if (purpose === "reset") {
            req.session.resetVerified = result.resetVerified;
            req.session.otpEmail = result.otpEmail;

            req.session.save((err) => {
                if (err) {
                    console.log("Session save error:", err);
                    return res.status(statuscodes.SERVER_ERROR).json({
                        success: false,
                        message: "Session error"
                    });
                }
                return res.json({
                    success: true,
                    redirectUrl: result.redirectUrl
                });
            });
            return;
        }

        if (purpose === "changeEmail") {
            delete req.session.newEmail;
            delete req.session.otpPurpose;

            return res.json({
                success: true,
                message: "Email updated successfully",
                redirectUrl: result.redirectUrl
            });
        }

        return res.status(statuscodes.BAD_REQUEST).json({
            success: false,
            message: "Invalid OTP purpose"
        });

    } catch (error) {
        console.log(error);
        return res.status(statuscodes.BAD_REQUEST).json({
            success: false,
            message: error.message || "Something went wrong"
        });
    }
};

export const resendOTP = async (req, res) => {
  try {
    const email = req.session.otpEmail;
    const purpose = req.session.otpPurpose;

    const result = await resendOTPService(email, purpose);

    return res.json({
      success: true,
      message: result.message
    });

  } catch (err) {
    console.log(err);
    return res.status(statuscodes.BAD_REQUEST).json({
      success: false,
      message: err.message || "Failed to resend OTP"
    });
  }
};
