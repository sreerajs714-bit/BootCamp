import User from "../../model/userModel.js";
import Wallet from "../../model/walletModel.js";

export const getReferralDetails = async (userId) => {
    const user = await User.findById(userId).select('referralCode wallet name email');
    if (!user) {
        throw new Error("User not found");
    }

    const wallet = await Wallet.findOne({ userId });
    const totalReferrals = await User.countDocuments({ referredBy: userId });
    const totalEarned = totalReferrals * 100;

    return {
        user: {
            referralCode: user.referralCode,
            walletBalance: wallet?.balance || 0,
        },
        stats: {
            totalReferrals,
            totalEarned,
        }
    };
};
