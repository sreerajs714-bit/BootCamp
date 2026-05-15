import express from "express";
import session from "express-session"
import dotenv from "dotenv";
dotenv.config();

import passport from "./config/passport.js";
import hbs from "hbs"
import {connectDB} from "./MongoDb/ConnectDB.js";
import UserRoute from "./Routes/User.js";
import AdminRoute from "./Routes/Admin.js";
import { checkUserBlocked } from "./Middleware/userAuth.js";
import nocache from "nocache";
const app = express();



hbs.registerHelper("slice", function (text, start, end) {
    if (!text) return "";
    return text.toString().slice(start, end);
});

app.use(nocache());
app.use(session({
    secret:process.env.SESSION_SECRET,
     resave:false,
     saveUninitialized:true,
     cookie: {
  secure: false,
  httpOnly: true,
  maxAge: 24 * 60 * 60 * 1000
}            
}));
hbs.registerHelper("add", (a, b) => a + b);
hbs.registerHelper("eq", function (a, b) {
    return a === b;
});

app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

app.set("view engine", "hbs");
app.use(express.urlencoded({extended:true}));
app.use(express.json());
app.use(express.static("public"));

app.use("/admin",AdminRoute)
app.use("/users",checkUserBlocked,UserRoute)
app.get("/", (req, res) => {
  res.redirect("/users/home");
});

await connectDB();
const PORT=process.env.PORT
app.listen(PORT, () => {
  console.log("server created..");
});
