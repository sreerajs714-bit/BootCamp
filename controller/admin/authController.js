import {
    adminLoginService,
    loadDashboardService
} from "../../services/admin/authService.js";
import { statuscodes } from "../../utils/status_codes.js";

export const loadLogin = async (req, res) => {
  try {
    if (req.session.admin) {
      return res.redirect('/admin/dashboard');
    }
    res.render('admin/login'); 
  } catch (error) {
    console.error('loadLogin error:', error);
    res.status(statuscodes.SERVER_ERROR).send('Server Error');
  }
};

export const adminlogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const adminSession = await adminLoginService({ email, password });

    req.session.admin = adminSession;

    return res.json({
      success: true,
      message: "Login successful"
    });

  } catch (error) {
    console.error("login error:", error);
    return res.status(error.statusCode || statuscodes.SERVER_ERROR).json({
      success: false,
      message: error.message || "Server error"
    });
  }
};

export const loadDasboard = async (req, res) => {
    try {
        const period = req.query.period || 'month';

        const data = await loadDashboardService({ period });

        if (req.xhr || req.headers.accept?.includes('application/json')) {
            return res.json({
                success: true,
                data
            });
        }

        return res.render('admin/dashboard', data);

    } catch (error) {
        console.error('getDashboardData error:', error);
        return res.status(statuscodes.SERVER_ERROR).json({ success: false, message: 'Server error' });
    }
};

export const adminLogout = async (req, res) => {
    try {
        req.session.destroy((err) => {
            if (err) {
                console.log("ADMIN LOGOUT ERROR:", err);
                return res.redirect('/admin/dashboard');
            }
            res.clearCookie('admin.sid');
            return res.redirect('/admin/');
        });
    } catch (error) {
        console.log("ADMIN LOGOUT ERROR:", error);
        return res.redirect('/admin/dashboard');
    }
};
