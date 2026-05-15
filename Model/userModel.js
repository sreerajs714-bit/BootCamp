import mongoose from "mongoose";


const userSchema= new mongoose.Schema({
 username:{
   type:String,
   required:true
  },
    email: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    default:""
  },
  phoneNO:{
    type:String,
    default:"",
  },
  profilePhoto: {
  type: String,
  default: ""
},
googleId: {
  type: String,
  default: null
},
  profileImage:{
  type:String,
  default:"",
  },
  isBlocked: {
    type: Boolean,
    default: false,
  }
},{ timestamps: true });

  export  default  mongoose.model("user", userSchema);