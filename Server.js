import express from "express";
import session from "express-session";
import dotenv from "dotenv";
dotenv.config();

import passport from "./config/passport.js";
import { connectDB } from "./MongoDb/ConnectDB.js";
import UserRoute from "./Routes/User.js";
import path from "path";
import AdminRoute from "./Routes/Admin.js";
import nocache from "nocache";
import { registerHbsHelpers } from "./config/hbsHelpers.js";

const app = express();
app.set('trust proxy', 1);


app.use(nocache());


const userSession = session({
    secret: process.env.USER_SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    name: "user.sid",
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000  // 1 day
    }
});


const adminSession = session({
    secret: process.env.ADMIN_SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    name: "admin.sid",
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 60 * 60 * 4 * 1000   // 4 hours
    }
});


app.use("/users", userSession);
app.use("/admin", adminSession);


app.use("/users", passport.initialize());
app.use("/users", passport.session());

registerHbsHelpers();

app.use((req, res, next) => {
    res.locals.user = req.session?.user || null;
    next();
});

app.set("view engine", "hbs");
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(process.cwd(), "public")));

app.use("/admin", AdminRoute);
app.use("/users", UserRoute);

app.get("/", (req, res) => {
    res.redirect("/users/home");
});

await connectDB();
const PORT = process.env.PORT;
app.listen(PORT, () => {
    console.log("server created..");
});