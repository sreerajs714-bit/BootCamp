import {
    getUsersService,
    blockUserService,
    unblockUserService
} from "../../services/admin/userManagementService.js";
import { statuscodes } from "../../utils/status_codes.js";

export const loadUsers = async (req, res) => {
    try {
        const page   = parseInt(req.query.page) || 1;
        const limit  = parseInt(req.query.limit) || 5;
        const search = req.query.search || '';
        const filter = req.query.filter || 'all';
        const sort   = req.query.sort || 'default';

        const payload = await getUsersService({ page, limit, search, filter, sort });

        if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
            return res.json({ success: true, ...payload });
        }

        res.render('admin/userManagement', payload);

    } catch (error) {
        console.error('loadUsers error:', error);
        if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
            return res.status(statuscodes.SERVER_ERROR).json({ success: false, message: 'Server error' });
        }
    }
};

export const blockUser = async (req, res) => {
    try {
        const user = await blockUserService(req.params.id);

        res.json({
            success: true,
            message: `${user.username} has been blocked`
        });

    } catch (error) {
        console.log(error);
        res.status(error.message === "User not found" ? statuscodes.NOT_FOUND : statuscodes.SERVER_ERROR).json({
            success: false,
            message: error.message || "Failed to block user"
        });
    }
};

export const unblockUser = async (req, res) => {
    try {
        const user = await unblockUserService(req.params.id);

        res.json({
            success: true,
            message: `${user.username} has been unblocked`
        });

    } catch (error) {
        console.log(error);
        res.status(error.message === "User not found" ? statuscodes.NOT_FOUND : statuscodes.SERVER_ERROR).json({
            success: false,
            message: error.message || "Failed to unblock user"
        });
    }
};

export const adminLogout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.log("Admin logout error:", err);
      return res.redirect("/admin/dashboard");
    }
    res.clearCookie("connect.sid");
    return res.redirect("/admin/login");
  });
};
