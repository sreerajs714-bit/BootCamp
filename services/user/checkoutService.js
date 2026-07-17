import User from "../../model/userModel.js";
import Product from "../../model/productModel.js";
import Cart from "../../model/cartModel.js";
import Address from "../../model/addressModel.js";
import Order from "../../model/orderModel.js";
import Wallet from "../../model/walletModel.js";
import Coupon from "../../model/couponModel.js";
import { getActiveOffers, calculateOfferPrice } from "../../utils/offer.js";
import crypto from "crypto";
import Razorpay from "razorpay";

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

export const getCheckoutDetailsService = async ({ userId, appliedCouponCode }) => {
    const user = await User.findById(userId).lean();
    if (!user) {
        const err = new Error("User not found");
        err.statusCode = 404;
        throw err;
    }

    const [cart, activeOffers] = await Promise.all([
        Cart.findOne({ userId })
            .populate({
                path: 'items.productId',
                populate: { path: 'category', model: 'Category' }
            })
            .lean(),
        getActiveOffers(),
    ]);

    if (!cart || cart.items.length === 0) {
        const err = new Error("Cart is empty");
        err.statusCode = 400;
        throw err;
    }

    const cartItems = cart.items.filter(item => item.productId && !item.productId.isDeleted);
    if (cartItems.length === 0) {
        const err = new Error("Cart contains no valid items");
        err.statusCode = 400;
        throw err;
    }

    const stockIssues = [];
    const validItems = [];

    for (const item of cartItems) {
        const product = item.productId;
        const variant = product.variants.find(
            (v) => v._id.toString() === item.variantId?.toString()
        );

        if (!variant || !variant.isActive || variant.stock <= 0) {
            stockIssues.push(`${product.productName} is out of stock and was removed from your cart.`);
            await Cart.updateOne(
                { userId },
                { $pull: { items: { _id: item._id } } }
            );
            continue;
        }

        if (item.quantity > variant.stock) {
            stockIssues.push(
                `Only ${variant.stock} unit(s) of ${product.productName} (${variant.color || 'default'}) are available — your quantity has been updated.`
            );
            await Cart.updateOne(
                { userId, 'items._id': item._id },
                { $set: { 'items.$.quantity': variant.stock } }
            );
            item.quantity = variant.stock;
        }

        validItems.push(item);
    }

    if (stockIssues.length > 0) {
        const err = new Error("Stock issues detected");
        err.statusCode = 302; 
        err.stockIssues = stockIssues;
        throw err;
    }

    let subtotal = 0;
    let offerSavings = 0;

    const enrichedItems = validItems.map((item) => {
        const product = item.productId;
        const variant = product.variants.find(
            (v) => v._id.toString() === item.variantId?.toString()
        );

        const originalPrice = variant?.price ?? item.price ?? 0;
        const pricing = calculateOfferPrice(originalPrice, product, activeOffers);
        const finalPrice = pricing.hasOffer ? pricing.discountedPrice : originalPrice;

        subtotal += originalPrice * item.quantity;
        offerSavings += (originalPrice - finalPrice) * item.quantity;

        return {
            ...item,
            price: finalPrice,
            originalPrice,
            hasOffer: pricing.hasOffer,
            offerPercentage: pricing.offer
                ? pricing.offer.discountType === 'percentage'
                    ? pricing.offer.discountValue
                    : Math.round((pricing.discount / originalPrice) * 100)
                : 0,
            images: variant?.images
                   || product.variants?.find(v => v.isDefault && v.isActive)?.images
                   || product.variants?.[0]?.images
                   || [],
        };
    });

    const effectiveSubtotal = subtotal - offerSavings;

    let couponDiscount = 0;
    let appliedCoupon = null;
    let couponRemovedReason = null;

    if (appliedCouponCode) {
        const coupon = await Coupon.findOne({
            code: appliedCouponCode,
            isActive: true,
            expiryDate: { $gte: new Date() },
        }).lean();

        if (!coupon) {
            couponRemovedReason = "Applied coupon is no longer valid and was removed.";
        } else if (coupon.minOrder && effectiveSubtotal < coupon.minOrder) {
            couponRemovedReason = `Coupon "${coupon.code}" requires a minimum order of ₹${coupon.minOrder}. It was removed since your cart total dropped below this.`;
        } else {
            couponDiscount = coupon.discountType === 'percentage'
                ? Math.round((effectiveSubtotal * coupon.discountValue) / 100)
                : coupon.discountValue;

            appliedCoupon = coupon.code;
        }
    }

    const total = Math.max(0, effectiveSubtotal - couponDiscount);
    const addresses = await Address.find({ user: userId }).lean();
    const defaultAddress = addresses.find((a) => a.isDefault) || addresses[0] || null;

    const wallet = await Wallet.findOne({ userId });
    const walletBalance = wallet?.balance || 0;

    return {
        user: {
            username: user.username,
            email: user.email,
        },
        cartItems: enrichedItems,
        addresses,
        defaultAddress,
        subtotal,
        savings: offerSavings || null,
        couponDiscount: couponDiscount || null,
        appliedCoupon,
        couponRemovedReason,
        walletBalance,
        walletInsufficient: walletBalance < total,
        total,
        codUnavailable: total > 10000,
    };
};

export const placeOrderService = async ({ userId, addressId, paymentMethod, couponCode, appliedCouponSession }) => {
    if (!addressId) {
        throw new Error("Please select an address");
    }

    const user = await User.findById(userId);
    if (!user) {
        const err = new Error("User not found");
        err.statusCode = 404;
        throw err;
    }

    const [cart, activeOffers] = await Promise.all([
        Cart.findOne({ userId })
            .populate({
                path: 'items.productId',
                populate: { path: 'category', model: 'Category' }
            }),
        getActiveOffers(),
    ]);

    if (!cart || cart.items.length === 0) {
        throw new Error("Cart is empty");
    }

    const address = await Address.findById(addressId);
    if (!address) {
        throw new Error("Address not found");
    }

    let subtotal = 0;
    let offerSavings = 0;
    const orderItems = [];

    for (const item of cart.items) {
        const product = item.productId;
        if (!product || product.isDeleted) continue;

        const variant = product.variants.find(
            v => v._id.toString() === item.variantId?.toString()
        );

        if (!variant) {
            throw new Error(`${product.productName || 'Product'} variant not found`);
        }

        if (variant.stock < item.quantity) {
            throw new Error(`${product.productName} is out of stock`);
        }

        const originalPrice = variant.price;
        const pricing = calculateOfferPrice(originalPrice, product, activeOffers);
        const finalPrice = pricing.hasOffer ? pricing.discountedPrice : originalPrice;

        subtotal += originalPrice * item.quantity;
        offerSavings += (originalPrice - finalPrice) * item.quantity;

        orderItems.push({
            product: product._id,
            variant: variant._id,
            quantity: item.quantity,
            price: finalPrice,
            originalPrice,
            size: item.size
        });
    }

    const effectiveSubtotal = subtotal - offerSavings;

    let couponDiscount = 0;
    let appliedCoupon = null;
    const couponToApply = appliedCouponSession || couponCode;

    if (couponToApply) {
        const coupon = await Coupon.findOne({
            code: couponToApply.toUpperCase().trim(),
            isActive: true,
            expiryDate: { $gte: new Date() },
        });

        if (coupon) {
            if (coupon.minOrder && effectiveSubtotal < coupon.minOrder) {
                throw new Error(`Minimum order of ₹${coupon.minOrder} required`);
            }

            if (coupon.discountType === 'percentage') {
                couponDiscount = Math.round((effectiveSubtotal * coupon.discountValue) / 100);
                if (coupon.maxDiscount && couponDiscount > coupon.maxDiscount) {
                    couponDiscount = coupon.maxDiscount;
                }
            } else {
                couponDiscount = coupon.discountValue;
            }

            couponDiscount = Math.min(couponDiscount, effectiveSubtotal);
            appliedCoupon = coupon.code;

            await Coupon.findByIdAndUpdate(coupon._id, {
                $inc: { usedCount: 1 },
                $addToSet: { usedBy: userId },
            });
        }
    }

    const totalAmount = Math.max(0, effectiveSubtotal - couponDiscount);

    if (paymentMethod === 'cod' && totalAmount > 10000) {
        throw new Error('Cash on Delivery is not available for orders above ₹10,000');
    }

    let wallet = null;
    if (paymentMethod === 'wallet') {
        wallet = await Wallet.findOne({ userId });
        if (!wallet || wallet.balance < totalAmount) {
            throw new Error('Insufficient wallet balance');
        }
    }

    const order = await Order.create({
        user: userId,
        items: orderItems,
        address: {
            fullName: address.fullName,
            phoneNO: address.phoneNO,
            addressLine1: address.addressLine1,
            addressLine2: address.addressLine2,
            city: address.city,
            state: address.state,
            pincode: address.pincode,
            addressType: address.addressType
        },
        paymentMethod,
        subtotal,
        offerSavings,
        couponCode: appliedCoupon,
        couponDiscount,
        totalAmount,
        orderStatus: "Confirmed",
        paymentStatus: paymentMethod === "cod" ? "Pending" : "Paid",
        trackingHistory: [{ status: "Confirmed", time: new Date() }]
    });

    if (paymentMethod === 'wallet') {
        wallet.balance -= totalAmount;
        wallet.transactions.push({
            transactionId: `ORD-${order._id}`,
            type: 'debit',
            amount: totalAmount,
            description: 'Order Payment',
            orderId: order._id,
            date: new Date()
        });
        await wallet.save();
    }

    for (const item of cart.items) {
        const product = await Product.findById(item.productId);
        const variant = product.variants.id(item.variantId);
        if (variant) {
            variant.stock -= item.quantity;
            await product.save();
        }
    }

    cart.items = [];
    await cart.save();

    if (user.referredBy && !user.referralRewardGiven) {
        const referrer = await User.findById(user.referredBy);
        if (referrer) {
            user.wallet += 50;
            referrer.wallet += 100;
            await referrer.save();
        }
        user.referralRewardGiven = true;
        await user.save();
    }

    return order;
};

export const loadOrderSuccessService = async (id) => {
    const order = await Order.findById(id)
        .populate('items.product')
        .lean();

    if (!order) {
        throw new Error("Order not found");
    }

    const deliveryStart = new Date();
    const deliveryEnd = new Date();
    deliveryStart.setDate(deliveryStart.getDate() + 3);
    deliveryEnd.setDate(deliveryEnd.getDate() + 7);

    const statusStepMap = {
        'pending':    0,
        'processing': 1,
        'shipped':    2,
        'delivered':  3,
    };

    const currentStep = statusStepMap[order.orderStatus?.toLowerCase()] ?? 0;

    const getVariant = (item) => {
        const product = item.product;
        return (
            product?.variants?.find(v => v._id.toString() === item.variant?.toString()) ||
            product?.variants?.find(v => v.isDefault && v.isActive) ||
            product?.variants?.find(v => v.isActive) ||
            product?.variants?.[0]
        );
    };

    const offerDiscount = order.items.reduce((acc, item) => {
        const variant = getVariant(item);
        const mrp = variant?.price ?? 0;
        const sellingPrice = item.price ?? 0;
        const discountPerUnit = Math.max(0, mrp - sellingPrice);
        return acc + discountPerUnit * item.quantity;
    }, 0);

    const couponDiscount = order.couponDiscount ?? 0;
    const totalDiscount = offerDiscount + couponDiscount;

    const formattedOrder = {
        orderNumber: order._id.toString().slice(-8).toUpperCase(),
        deliveryStart: deliveryStart.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        deliveryEnd: deliveryEnd.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        tracking: {
            currentStep,
            progressPercent: (currentStep / 3) * 100
        },
        items: order.items.map(item => {
            const variant = getVariant(item);
            return {
                name: item.product?.productName || item.product?.name || 'Product',
                variant: `Qty: ${item.quantity}`,
                price: `₹${item.price}`,
                imageUrl: variant?.images?.[0] || '/images/product-placeholder.jpg'
            };
        }),
        subtotal: `₹${order.subtotal || order.totalAmount}`,
        shippingCost: 'Free',
        offerDiscount: offerDiscount > 0 ? `₹${offerDiscount}` : null,
        couponCode: order.couponCode || null,
        couponDiscount: couponDiscount > 0 ? `₹${couponDiscount}` : null,
        totalDiscount: totalDiscount > 0 ? `₹${totalDiscount}` : null,
        total: `₹${order.totalAmount}`,
        paymentMethod: order.paymentMethod?.toUpperCase()
    };

    return formattedOrder;
};

export const createRazorpayOrderService = async ({ userId, addressId, couponCode }) => {
    const [cart, activeOffers] = await Promise.all([
        Cart.findOne({ userId }).populate('items.productId'),
        getActiveOffers(),
    ]);

    if (!cart || cart.items.length === 0) {
        throw new Error('Cart is empty');
    }

    const address = await Address.findById(addressId);
    if (!address) {
        throw new Error('Address not found');
    }

    let subtotal = 0;
    let offerSavings = 0;
    const orderItems = [];

    for (const item of cart.items) {
        const product = item.productId;
        if (!product || product.isDeleted) continue;

        const variant = product.variants.find(
            v => v._id.toString() === item.variantId?.toString()
        );
        if (!variant) continue;

        const originalPrice = variant.price;
        const pricing = calculateOfferPrice(originalPrice, product, activeOffers);
        const finalPrice = pricing.hasOffer ? pricing.discountedPrice : originalPrice;

        subtotal += originalPrice * item.quantity;
        offerSavings += (originalPrice - finalPrice) * item.quantity;

        orderItems.push({
            product: product._id,
            variant: variant._id,
            quantity: item.quantity,
            price: finalPrice,
            originalPrice,
            size: item.size
        });
    }

    const effectiveSubtotal = subtotal - offerSavings;

    let couponDiscount = 0;
    let appliedCoupon = null;

    if (couponCode) {
        const coupon = await Coupon.findOne({
            code: couponCode.toUpperCase().trim(),
            isActive: true,
            expiryDate: { $gte: new Date() }
        });
        if (coupon) {
            if (coupon.minOrder && effectiveSubtotal < coupon.minOrder) {
                throw new Error(`Minimum order of ₹${coupon.minOrder} required`);
            }

            couponDiscount = coupon.discountType === 'percentage'
                ? Math.round((effectiveSubtotal * coupon.discountValue) / 100)
                : coupon.discountValue;

            if (coupon.maxDiscount && couponDiscount > coupon.maxDiscount) {
                couponDiscount = coupon.maxDiscount;
            }
            couponDiscount = Math.min(couponDiscount, effectiveSubtotal);
            appliedCoupon = coupon.code;
        }
    }

    const totalAmount = Math.max(0, effectiveSubtotal - couponDiscount);

    const razorpayOrder = await razorpay.orders.create({
        amount: Math.round(totalAmount * 100),
        currency: 'INR',
        receipt: `wlt_${String(userId).slice(-8)}_${Date.now().toString().slice(-8)}`,
    });

    const order = await Order.create({
        user: userId,
        items: orderItems,
        address: {
            fullName: address.fullName,
            phoneNO: address.phoneNO,
            addressLine1: address.addressLine1,
            addressLine2: address.addressLine2,
            city: address.city,
            state: address.state,
            pincode: address.pincode,
            addressType: address.addressType
        },
        paymentMethod: 'razorpay',
        razorpayOrderId: razorpayOrder.id,
        subtotal,
        offerSavings,
        couponCode: appliedCoupon,
        couponDiscount,
        totalAmount,
        orderStatus: 'Pending',
        paymentStatus: 'Pending',
        paymentExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
        trackingHistory: [{ status: 'Pending', time: new Date() }]
    });

    return {
        razorpayOrderId: razorpayOrder.id,
        orderId: order._id,
        amount: razorpayOrder.amount,
        razorpayKey: process.env.RAZORPAY_KEY_ID,
    };
};

export const verifyRazorpayPaymentService = async ({ razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId }) => {
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(body)
        .digest('hex');

    if (expectedSignature !== razorpay_signature) {
        throw new Error('Payment verification failed');
    }

    const order = await Order.findByIdAndUpdate(orderId, {
        orderStatus: 'Confirmed',
        paymentStatus: 'Paid',
        paymentId: razorpay_payment_id,
        $push: { trackingHistory: { status: 'Confirmed', time: new Date() } }
    }, { returnDocument: 'after' });

    if (!order) {
        throw new Error('Order not found');
    }

    try {
        for (const item of order.items) {
            const product = await Product.findById(item.product);
            if (!product) continue;

            const variant = product.variants.find(v => v._id.toString() === item.variant?.toString())
             || product.variants.find(pv => pv.sizes?.some(s => s.toString() === item.size?.toString()));

            if (variant) {
                variant.stock = Math.max(0, (variant.stock || 0) - item.quantity);
                await product.save();
            }
        }

        const cart = await Cart.findOne({ userId: order.user });
        if (cart) {
            cart.items = [];
            await cart.save();
        }
    } catch (stockErr) {
        console.error('Stock/cart update error (non-fatal):', stockErr.message);
    }

    return order._id;
};

export const loadPaymentFailedService = async (orderId) => {
    const order = await Order.findById(orderId).lean();
    if (!order) {
        throw new Error('Order not found');
    }
    return order;
};

export const retryRazorpayPaymentService = async (orderId) => {
    const order = await Order.findById(orderId);
    if (!order) {
        throw new Error('Order not found');
    }

    if (order.paymentStatus === 'Paid') {
        throw new Error('Order already paid');
    }

    if (order.paymentExpiresAt && new Date() > order.paymentExpiresAt) {
        order.paymentStatus = 'Failed';
        order.orderStatus = 'Cancelled';
        order.paymentExpiresAt = null;
        await order.save();
        throw new Error('Payment window has expired');
    }

    const razorpayOrder = await razorpay.orders.create({
        amount: Math.round(order.totalAmount * 100),
        currency: 'INR',
        receipt: `wlt_${String(order._id).slice(-8)}_${Date.now().toString().slice(-8)}`,
    });

    order.razorpayOrderId = razorpayOrder.id;
    order.orderStatus = 'Pending';
    order.paymentStatus = 'Pending';
    await order.save();

    return {
        razorpayOrderId: razorpayOrder.id,
        orderId: order._id,
        amount: razorpayOrder.amount,
        razorpayKey: process.env.RAZORPAY_KEY_ID,
    };
};

export const getAvailableCouponsService = async ({ userId }) => {
    const cart = await Cart.findOne({ userId })
        .populate('items.productId')
        .lean();

    if (!cart || cart.items.length === 0) {
        return [];
    }

    let cartSubtotal = 0;
    cart.items.forEach(item => {
        if (!item.productId || item.productId.isDeleted) return;
        const variant = item.productId.variants?.find(
            v => v._id.toString() === item.variantId?.toString()
        );
        const price = variant?.price ?? item.price ?? 0;
        cartSubtotal += price * item.quantity;
    });

    const now = new Date();
    const coupons = await Coupon.find({
        isActive: true,
        expiryDate: { $gte: now },
        startDate: { $lte: now },
        $or: [
            { minOrder: { $exists: false } },
            { minOrder: null },
            { minOrder: 0 },
            { minOrder: { $lte: cartSubtotal } },
        ]
    }).lean();

    const available = coupons.filter(coupon => {
        if (coupon.usageLimit && (coupon.usedCount || 0) >= coupon.usageLimit) {
            return false;
        }
        if (coupon.usedBy?.some(id => id.toString() === userId.toString())) {
            return false;
        }
        return true;
    });

    return available.map(c => ({
        code: c.code,
        discountType: c.discountType,
        discountValue: c.discountValue,
        minOrder: c.minOrder || 0,
        maxDiscount: c.maxDiscount || null,
        expiryDate: c.expiryDate,
        description: c.description || null,
    }));
};

export const applyCouponService = async ({ userId, couponCode }) => {
    if (!couponCode) {
        throw new Error('Please enter a coupon code');
    }

    const now = new Date();
    const coupon = await Coupon.findOne({
        code: couponCode.toUpperCase().trim(),
        isActive: true,
        expiryDate: { $gte: now },
    }).lean();

    if (!coupon) {
         throw new Error('Invalid or expired coupon');
    }

    if (coupon.usedBy?.some(id => id.toString() === userId.toString())) {
        throw new Error('You have already used this coupon');
    }

    if (coupon.usageLimit && (coupon.usedCount || 0) >= coupon.usageLimit) {
        throw new Error('Coupon usage limit reached');
    }

    const [cart, activeOffers] = await Promise.all([
        Cart.findOne({ userId })
            .populate({ path: 'items.productId', populate: { path: 'category', model: 'Category' } })
            .lean(),
        getActiveOffers(),
    ]);

    if (!cart || cart.items.length === 0) {
        throw new Error('Your cart is empty');
    }

    let cartSubtotal = 0;
    let offerSavings = 0;

    cart.items.forEach(item => {
        if (!item.productId || item.productId.isDeleted) return;
        const variant = item.productId.variants?.find(
            v => v._id.toString() === item.variantId?.toString()
        );
        const originalPrice = variant?.price ?? item.price ?? 0;

        const pricing = calculateOfferPrice(originalPrice, item.productId, activeOffers);
        const finalPrice = pricing.hasOffer ? pricing.discountedPrice : originalPrice;

        cartSubtotal += originalPrice * item.quantity;
        offerSavings += (originalPrice - finalPrice) * item.quantity;
    });

    const effectiveSubtotal = cartSubtotal - offerSavings;

    if (coupon.minOrder && effectiveSubtotal < coupon.minOrder) {
        throw new Error(`Minimum order of ₹${coupon.minOrder} required for this coupon`);
    }

    let discount = 0;
    if (coupon.discountType === 'percentage') {
        discount = Math.round((effectiveSubtotal * coupon.discountValue) / 100);
        if (coupon.maxDiscount && discount > coupon.maxDiscount) {
            discount = coupon.maxDiscount;
        }
    } else if (coupon.discountType === 'flat') {
        discount = coupon.discountValue;
    }

    discount = Math.min(discount, effectiveSubtotal);

    return {
        discount,
        newTotal: effectiveSubtotal - discount,
        couponCode: coupon.code,
    };
};

export const removeCouponService = async ({ userId }) => {
    const [cart, activeOffers] = await Promise.all([
        Cart.findOne({ userId })
            .populate({ path: 'items.productId', populate: { path: 'category', model: 'Category' } })
            .lean(),
        getActiveOffers(),
    ]);

    if (!cart || cart.items.length === 0) {
        throw new Error('Cart is empty');
    }

    let cartSubtotal = 0;
    let offerSavings = 0;

    cart.items.forEach(item => {
        if (!item.productId || item.productId.isDeleted) return;
        const variant = item.productId.variants?.find(
            v => v._id.toString() === item.variantId?.toString()
        );
        const originalPrice = variant?.price ?? item.price ?? 0;

        const pricing = calculateOfferPrice(originalPrice, item.productId, activeOffers);
        const finalPrice = pricing.hasOffer ? pricing.discountedPrice : originalPrice;

        cartSubtotal += originalPrice * item.quantity;
        offerSavings += (originalPrice - finalPrice) * item.quantity;
    });

    return {
        newTotal: cartSubtotal - offerSavings
    };
};
