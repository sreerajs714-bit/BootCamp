import {
    getWalletService,
    createWalletOrderService,
    verifyWalletPaymentService
} from "../../services/user/walletService.js";
import { statuscodes } from "../../utils/status_codes.js";

export const loadWallet = async (req, res) => {
    try {
        const userId = req.session.user?._id || req.session.user?.id;
        res.locals.breadcrumbs = [
            { label: 'Home', url: '/' },
            { label: "Wallet" },
        ];

        if (!userId) {
            return res.redirect('/users/login');
        }

        const walletData = await getWalletService(userId);

        return res.render('users/wallet', {
            user: req.session.user,
            wallet: walletData,
        });

    } catch (error) {
        console.error('loadWallet error:', error);
        return res.status(statuscodes.SERVER_ERROR).send('Server Error');
    }
};

export const createWalletOrder = async (req, res) => {
    try {
        const userId = req.session.user?._id || req.session.user?.id;
        if (!userId) {
            return res.status(statuscodes.UNAUTHORIZED).json({ success: false, message: 'login_required' });
        }

        const amount = parseFloat(req.body.amount);

        const orderData = await createWalletOrderService(userId, amount);

        return res.json({
            success: true,
            ...orderData
        });

    } catch (error) {
        console.error('createWalletOrder error:', error);
        return res.status(statuscodes.BAD_REQUEST).json({ 
            success: false, 
            message: error.message || 'Failed to create order'
        });
    }
};

export const verifyWalletPayment = async (req, res) => {
    try {
        const userId = req.session.user?._id || req.session.user?.id;
        if (!userId) {
            return res.status(statuscodes.UNAUTHORIZED).json({ success: false, message: 'login_required' });
        }

        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = req.body;

        const result = await verifyWalletPaymentService({
            userId,
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            amount
        });

        return res.json({
            success: true,
            message: 'Funds added successfully',
            newBalance: result.newBalance,
        });

    } catch (error) {
        console.error('verifyWalletPayment error:', error);
        return res.status(statuscodes.BAD_REQUEST).json({ success: false, message: error.message || 'Server error' });
    }
};
