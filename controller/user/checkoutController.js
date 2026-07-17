import {
    getCheckoutDetailsService,
    placeOrderService,
    loadOrderSuccessService,
    createRazorpayOrderService,
    verifyRazorpayPaymentService,
    loadPaymentFailedService,
    retryRazorpayPaymentService,
    getAvailableCouponsService,
    applyCouponService,
    removeCouponService
} from "../../services/user/checkoutService.js";
import { statuscodes } from "../../utils/status_codes.js";

export const loadCheckout = async (req, res) => {
    try {
        const userId =
            req.session?.user?.id ||
            req.session?.user?._id ||
            req.user?._id;

        const payload = await getCheckoutDetailsService({
            userId,
            appliedCouponCode: req.session.appliedCoupon
        });

        return res.render('users/checkout', payload);

    } catch (err) {
        console.error('getCheckout error:', err);
        if (err.statusCode === 302 && err.stockIssues) {
            req.session.cartNotice = err.stockIssues;
            return res.redirect('/users/cart');
        }
        if (err.message === "User not found") {
            return res.redirect('/users/login');
        }
        return res.redirect('/users/cart');
    }
};

export const placeOrder = async (req, res) => {
    try {
        const userId =
            req.session?.user?.id ||
            req.session?.user?._id ||
            req.user?._id;

        const { addressId, paymentMethod, couponCode } = req.body;

        const order = await placeOrderService({
            userId,
            addressId,
            paymentMethod,
            couponCode,
            appliedCouponSession: req.session.appliedCoupon
        });

        delete req.session.appliedCoupon;
        delete req.session.couponDiscount;

        return res.status(statuscodes.OK).json({
            success: true,
            message: "Order placed successfully",
            orderId: order._id,
            redirectUrl: `/users/orderSuccess/${order._id}`
        });

    } catch (error) {
        console.error("placeOrder error:", error);
        return res.status(error.statusCode || statuscodes.BAD_REQUEST).json({ success: false, message: error.message || "Something went wrong" });
    }
};

export const loadOrderSuccess = async (req, res) => {
    try {
        const { id } = req.params;

        const formattedOrder = await loadOrderSuccessService(id);

        res.render('users/orderSuccess', {
            storeName: 'BOOT CAMP',
            order: formattedOrder,
            continueShoppingUrl: '/users/home',
            myOrdersUrl: '/users/myOrders'
        });

    } catch (error) {
        console.error('loadOrderSuccess error:', error);
        return res.redirect('/users/orders');
    }
};

export const createRazorpayOrder = async (req, res) => {
    try {
        const userId =
            req.session?.user?.id ||
            req.session?.user?._id ||
            req.user?._id;

        const { addressId, couponCode } = req.body;

        const orderData = await createRazorpayOrderService({
            userId,
            addressId,
            couponCode
        });

        return res.json({
            success: true,
            ...orderData
        });

    } catch (error) {
        console.error('createRazorpayOrder error:', error);
        return res.status(statuscodes.BAD_REQUEST).json({ success: false, message: error.message || 'Failed to initiate payment' });
    }
};

export const verifyRazorpayPayment = async (req, res) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            orderId
        } = req.body;

        const verifiedOrderId = await verifyRazorpayPaymentService({
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            orderId
        });

        return res.json({
            success: true,
            message: 'Payment successful!',
            redirectUrl: `/users/orderSuccess/${verifiedOrderId}`
        });

    } catch (error) {
        console.error('verifyRazorpayPayment error:', error.message);
        return res.status(statuscodes.BAD_REQUEST).json({ success: false, message: error.message || 'Something went wrong' });
    }
};

export const loadPaymentFailed = async (req, res) => {
    try {
        const { orderId } = req.query;
        const order = await loadPaymentFailedService(orderId);

        if (order.paymentStatus === 'Paid') return res.redirect(`/users/orderSuccess/${orderId}`);

        return res.render('users/paymentFailed', { order });
    } catch (error) {
        console.error('loadPaymentFailed error:', error);
        return res.redirect('/users/myOrders');
    }
};

export const retryRazorpayPayment = async (req, res) => {
    try {
        const { orderId } = req.body;

        const orderData = await retryRazorpayPaymentService(orderId);

        return res.json({
            success: true,
            ...orderData
        });

    } catch (error) {
        console.error('retryRazorpayPayment error:', error);
        return res.status(statuscodes.SERVER_ERROR).json({ success: false, message: error.message || 'Failed to retry payment' });
    }
};

export const getAvailableCoupons = async (req, res) => {
    try {
        const userId = req.session?.user?.id || req.session?.user?._id || req.user?._id;

        const available = await getAvailableCouponsService({ userId });

        return res.json({
            success: true,
            coupons: available
        });

    } catch (err) {
        console.error('getAvailableCoupons error:', err);
        return res.status(statuscodes.SERVER_ERROR).json({ success: false, message: 'Failed to fetch coupons' });
    }
};

export const applyCoupon = async (req, res) => {
    try {
        const userId = req.session?.user?.id || req.session?.user?._id || req.user?._id;
        const { couponCode } = req.body;

        const result = await applyCouponService({ userId, couponCode });

        req.session.appliedCoupon = result.couponCode;
        req.session.couponDiscount = result.discount;

        return res.json({
            success: true,
            message: `Coupon applied! You saved ₹${result.discount}`,
            discount: result.discount,
            newTotal: result.newTotal,
            couponCode: result.couponCode,
        });

    } catch (err) {
        console.error('applyCoupon error:', err);
        return res.status(statuscodes.BAD_REQUEST).json({ success: false, message: err.message || 'Something went wrong' });
    }
};

export const removeCoupon = async (req, res) => {
    try {
        const userId = req.session?.user?.id || req.session?.user?._id || req.user?._id;

        if (!req.session.appliedCoupon) {
            return res.status(statuscodes.BAD_REQUEST).json({ success: false, message: 'No coupon applied' });
        }

        const result = await removeCouponService({ userId });

        req.session.appliedCoupon = null;
        req.session.couponDiscount = 0;

        return res.status(statuscodes.OK).json({
            success: true,
            message: 'Coupon removed successfully',
            newTotal: result.newTotal,
        });

    } catch (err) {
        console.error('removeCoupon error:', err);
        return res.status(statuscodes.SERVER_ERROR).json({ success: false, message: 'Something went wrong' });
    }
};
