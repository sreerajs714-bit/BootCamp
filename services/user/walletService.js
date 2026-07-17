import Wallet from "../../model/walletModel.js";
import crypto from "crypto";
import Razorpay from "razorpay";

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

export const getWalletService = async (userId) => {
    let wallet = await Wallet.findOne({ userId });

    if (!wallet) {
        wallet = await Wallet.create({ userId, balance: 0, transactions: [] });
    }

    const sortedTransactions = [...wallet.transactions].sort(
        (a, b) => new Date(b.date) - new Date(a.date)
    );

    return {
        balance: wallet.balance.toFixed(2),
        transactions: sortedTransactions,
    };
};

export const createWalletOrderService = async (userId, amount) => {
    if (!amount || amount <= 0) {
        throw new Error('Invalid amount');
    }
    if (amount > 50000) {
        throw new Error('Maximum ₹50,000 per transaction');
    }

    const order = await razorpay.orders.create({
        amount: Math.round(amount * 100),
        currency: 'INR',
        receipt: `wlt_${String(userId).slice(-8)}_${Date.now().toString().slice(-8)}`, 
    });

    return {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
    };
};

export const verifyWalletPaymentService = async ({ userId, razorpay_order_id, razorpay_payment_id, razorpay_signature, amount }) => {
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(body)
        .digest('hex');

    if (expectedSignature !== razorpay_signature) {
        throw new Error('Payment verification failed');
    }

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

    return {
        newBalance: wallet.balance.toFixed(2),
    };
};
