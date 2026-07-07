import nodemailer from "nodemailer"
import dotenv from "dotenv"
dotenv.config();


export const generateOTP =()=>{
    return Math.floor(100000 + Math.random() * 900000).toString();
};
    
     const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.APP_MAIL,
        pass: process.env.APP_PASSWORD,
      },
    });

export const sendOTPEmail = async (email, otp) => {
  try {
    await transporter.sendMail({
      from: process.env.APP_MAIL,
      to: email,
      subject: "OTP Verification",
      text: `Welcome to BOOT CAMP!

Your One-Time Password (OTP) is: ${otp}

This OTP is valid for 60 seconds. Please do not share it with anyone.`,
    });
  } catch (error) {
    console.log("EMAIL ERROR:", error.message);
    throw error;
  }
};