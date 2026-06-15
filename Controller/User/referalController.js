// controllers/user/referralController.js
import mongoose from "mongoose";
import User from "../../Model/userModel.js";
import Wallet from "../../Model/walletModel.js";



export const loadReferal = async (req, res) => {
    try {
        const userId = new mongoose.Types.ObjectId(req.session.user.id);

        res.locals.breadcrumbs = [
            { label: 'Home', url: '/' },
            { label: "Refer & Earn" },
        ];

        const user = await User.findById(userId).select('referralCode wallet name email');
        const wallet = await Wallet.findOne({ userId });

        if (!user) {
            return res.redirect('/users/login');
        }

        const totalReferrals = await User.countDocuments({ referredBy: userId });
        const totalEarned = totalReferrals * 100;

        res.render('users/referal', {
            user: {
                referralCode: user.referralCode,
                walletBalance: wallet?.balance || 0,
            },
            stats: {
                totalReferrals,
                totalEarned,
            }
        });

    } catch (error) {
        console.error('Referral page load error:', error);
        res.status(500).render('error', { message: 'Something went wrong.' });
    }
};