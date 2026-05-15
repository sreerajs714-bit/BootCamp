import dotenv from "dotenv";
dotenv.config();

import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import userSchema from "../Model/userModel.js";

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
        username: profile.displayName,  // ✅ was `name`, must be `username`
        email: profile.emails[0].value,
        googleId: profile.id,
        password: "",                   // ✅ matches your schema default
        phoneNO: "",
        profilePhoto: "",
        profileImage: "",
        isBlocked: false
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