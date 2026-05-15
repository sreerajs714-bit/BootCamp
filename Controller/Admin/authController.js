import Admin from "../../Model/adminModel.js"
import bcrypt from "bcrypt";
import { generateOTP } from "../service/mail.js";
import { sendOTPEmail } from "../service/mail.js";

export const loadLogin = async (req, res) => {
  try {
    if (req.session.admin) {
      return res.redirect('/admin/dashboard');
    }
    res.render('admin/login'); // renders your login.ejs / login.html
  } catch (error) {
    console.error('loadLogin error:', error);
    res.status(500).send('Server Error');
  }
};

export const Adminlogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const admin = await Admin.findOne({ email });
   
    if (!admin) {
      return res.render('admin/login', { message: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.render('admin/login', { message: 'Invalid email or password' });
    }

    req.session.admin = { id: admin._id, email: admin.email };
    return res.redirect('/admin/dashboard');

  } catch (error) {
    console.error('login error:', error);
    res.status(500).send('Server Error');
  }
};

export const loadDashboard = async (req, res) => {
  try {
    res.render('admin/dashboard');
  } catch (error) {
    console.error(error);
    res.status(500).send('Server Error');
  }
};

export const adminLogout = async (req, res) => {

    try {

        req.session.destroy((err) => {

            if (err) {

                console.log("ADMIN LOGOUT ERROR:", err);

                return res.redirect('/admin/dashboard');
            }

            // CLEAR COOKIE
            res.clearCookie('connect.sid');

            return res.redirect('/admin/');
        });

    } catch (error) {

        console.log("ADMIN LOGOUT ERROR:", error);

        return res.redirect('/admin/dashboard');
    }
};