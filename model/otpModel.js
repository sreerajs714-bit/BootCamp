import mongoose from "mongoose";

const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
  },

  otp: {
    type: String,
    required: true,
  },

  createdAt: {
    type: Date,
    default: Date.now,
    expires: 60, // OTP expires in 60 seconds
  },
  purpose:{
    type:String,
    enum:[
        "reset","register","changeEmail"
    ],
    required:true,
  }
});

export  default  mongoose.model("OTP",otpSchema);