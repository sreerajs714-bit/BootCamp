// controllers/user/referralController.js
import mongoose from "mongoose";
import { getReferralDetails } from "../../services/user/referalService.js";
import { statuscodes } from "../../utils/status_codes.js";



export const loadReferal = async (req, res) => {
    try {
        const userId = new mongoose.Types.ObjectId(req.session.user.id);

        res.locals.breadcrumbs = [
            { label: 'Home', url: '/' },
            { label: "Refer & Earn" },
        ];

        const details = await getReferralDetails(userId);

        res.render('users/referal', details);

    } catch (error) {
        console.error('Referral page load error:', error);
        if (error.message === "User not found") {
            return res.redirect('/users/login');
        }
        res.status(statuscodes.SERVER_ERROR).render('error', { message: 'Something went wrong.' });
    }
};