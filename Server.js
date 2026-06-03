import express from "express";
import session from "express-session"
import dotenv from "dotenv";
dotenv.config();

import passport from "./config/passport.js";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import path from "path";
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

hbs.registerHelper("addIndex", (index, currentPage, limit) => {
    return (currentPage - 1) * limit + index + 1;
});

hbs.registerHelper('substring', (str, start, end) => {
    if (!str) return '';
    return str.toString().substring(start, end);
});

hbs.registerPartials(path.join(__dirname, "views/partials"));


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
hbs.registerHelper('gt', (a, b) => a > b);
hbs.registerHelper('gte', (a, b) => a >= b); 
hbs.registerHelper("add", (a, b) => a + b);
hbs.registerHelper('and', (a, b) => a && b);
hbs.registerHelper('or', (a, b) => a || b);
hbs.registerHelper('not', (a) => !a);
hbs.registerHelper('includes', (arr, val) => Array.isArray(arr) && arr.map(String).includes(String(val)));
hbs.registerHelper('eq', (a, b) => String(a) === String(b));
hbs.registerHelper('ne', (a, b) => a !== b);
hbs.registerHelper("lte", (a, b) => a <= b);
hbs.registerHelper('json', (context) => JSON.stringify(context));
hbs.registerHelper('selected', (a, b) => a && b && a.toString() === b.toString() ? 'selected' : '');

hbs.registerHelper("formatDate", function (date) {
    if (!date) return "";

    return new Date(date).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
});

hbs.registerHelper("formatTime", function (date) {
    if (!date) return "";

    return new Date(date).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
    });
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
app.use(express.static(path.join(process.cwd(), "public")));

app.use("/admin",AdminRoute)
app.use("/users",UserRoute)
app.get("/", (req, res) => {
  res.redirect("/users/home");
});

await connectDB();
const PORT=process.env.PORT
app.listen(PORT, () => {
  console.log("server created..");
});
