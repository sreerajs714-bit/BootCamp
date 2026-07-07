import Wallet from "../../model/walletModel.js";
import crypto from "crypto";
import Razorpay from "razorpay";

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ── Load Wallet Page 
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

        // Find or create wallet for user
        let wallet = await Wallet.findOne({ userId });

        if (!wallet) {
            wallet = await Wallet.create({ userId, balance: 0, transactions: [] });
        }

        // Sort transactions newest first
        const sortedTransactions = [...wallet.transactions].sort(
            (a, b) => new Date(b.date) - new Date(a.date)
        );

        return res.render('users/wallet', {
            user: req.session.user,
            wallet: {
                balance: wallet.balance.toFixed(2),
                transactions: sortedTransactions,
            },
        });

    } catch (error) {
        console.error('loadWallet error:', error);
        return res.status(500).send('Server Error');
    }
};

export const createWalletOrder = async (req, res) => {
    try {
        const userId = req.session.user?._id || req.session.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'login_required' });
        }

        const amount = parseFloat(req.body.amount);

        if (!amount || amount <= 0) {
            return res.status(400).json({ success: false, message: 'Invalid amount' });
        }
        if (amount > 50000) {
            return res.status(400).json({ success: false, message: 'Maximum ₹50,000 per transaction' });
        }

        // Razorpay amount is in paise (multiply by 100)
        const order = await razorpay.orders.create({
            amount: Math.round(amount * 100),
            currency: 'INR',
            receipt: `wlt_${String(userId).slice(-8)}_${Date.now().toString().slice(-8)}`, 
        });

        return res.json({
            success: true,
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            keyId: process.env.RAZORPAY_KEY_ID,
        });

  } catch (error) {
    console.error('createWalletOrder error:', error?.error || error);
    return res.status(500).json({ 
        success: false, 
        message: error?.error?.description || error.message || 'Failed to create order'
    });
  }
}

// ── Step 2: Verify Payment & Add Funds ────────────────
export const verifyWalletPayment = async (req, res) => {
    try {
        const userId = req.session.user?._id || req.session.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'login_required' });
        }

        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = req.body;

        // Verify signature
        const body = razorpay_order_id + '|' + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body)
            .digest('hex');

        if (expectedSignature !== razorpay_signature) {
            return res.status(400).json({ success: false, message: 'Payment verification failed' });
        }

        // Add funds to wallet
        const amountInRupees = amount / 100;

        let wallet = await Wallet.findOne({ userId });
        if (!wallet) {
            wallet = await Wallet.create({ userId, balance: 0, transactions: [] });
        }

        wallet.balance += amountInRupees;
        wallet.transactions.push({
            transactionId: razorpay_payment_id,
            type: 'credit',
            amount: amountInRupees,
            description: 'Added via Razorpay',
            date: new Date(),
        });

        await wallet.save();

        return res.json({
            success: true,
            message: 'Funds added successfully',
            newBalance: wallet.balance.toFixed(2),
        });

    } catch (error) {
        console.error('verifyWalletPayment error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};