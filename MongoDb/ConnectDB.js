import mongoose from 'mongoose'
import dotenv from "dotenv"
dotenv.config();

export const connectDB = async () => {
    try{
        const conn = await mongoose.connect(process.env.MONGO_URL)
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    }catch(err){
        console.log(err)
        process.exit(1);
    }
};