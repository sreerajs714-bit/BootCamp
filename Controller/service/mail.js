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
    const info= await transporter.sendMail({
      from: process.env.APP_MAIL,
      to: email,
      subject: "OTP Verification",
      text: `Where style meets performance — welcome to BOOT CAMP.Your OTP is ${otp}`,
    });
  } catch (error) {
    console.log("EMAIL ERROR:", error.message);
    throw error;
  }
};