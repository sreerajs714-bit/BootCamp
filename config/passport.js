import dotenv from "dotenv";
dotenv.config();

import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import userSchema from "../model/userModel.js";
import { generateReferralCode } from "./referalCode.js";

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/users/auth/google/callback"
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await userSchema.findOne({
          email: profile.emails[0].value
        });

         if (!user) {
      user = await userSchema.create({
        username: profile.displayName,  
        email: profile.emails[0].value,
        googleId: profile.id,
        password: "",                   
        phoneNO: "",
        profilePhoto: "",
        profileImage: "",
        isBlocked: false,
        referralCode: generateReferralCode(),
      });
    }
        return done(null, user);
      } catch (error) {
        return done(error, null);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  const user = await userSchema.findById(id);
  done(null, user);
});

export default passport;