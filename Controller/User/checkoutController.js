import User from "../../Model/userModel.js";
import Product from "../../Model/productModel.js";
import Cart from "../../Model/cartModel.js";
import Address from "../../Model/addressModel.js";
import Order from "../../Model/orderModel.js";

export const loadCheckout = async (req, res) => {
    try {

     const userId =
      req.session?.user?.id ||
      req.session?.user?._id ||
      req.user?._id;

        const user = await User.findById(userId).lean();
        if (!user) return res.redirect('/users/login');

        const cart = await Cart.findOne({ userId })
            .populate('items.productId')
            .lean();

        if (!cart || cart.items.length === 0) {
            return res.redirect('/users/cart');
        }

        // Filter invalid/deleted items
        const cartItems = cart.items.filter(
            (item) => item.productId && !item.productId.isDeleted
        );

        if (cartItems.length === 0) return res.redirect('/users/cart');

        // ── Price breakdown ───────────────────────────────────────────────
        let subtotal = 0;
        let offerSavings = 0;

        const enrichedItems = cartItems.map((item) => {
            const product = item.productId;

            // Find the matching variant using variantId from cart
            const variant = product.variants.find(
                (v) => v._id.toString() === item.variantId.toString()
            );

            const variantPrice = variant?.price ?? item.price ?? 0;

            subtotal += variantPrice * item.quantity;

            return {
                ...item,
                price: variantPrice,
                // Use variant images if available, fallback to first variant
                images: variant?.images || product.variants[0]?.images || [],
            };
        });

        const effectiveSubtotal = subtotal - offerSavings;

        // ── Coupon ────────────────────────────────────────────────────────
        let couponDiscount = 0;
        let appliedCoupon = null;

        if (req.session.appliedCoupon) {
            const coupon = await Coupon.findOne({
                code: req.session.appliedCoupon,
                isActive: true,
                expiresAt: { $gte: new Date() },
            }).lean();

            if (coupon) {
                couponDiscount = coupon.discountType === 'percentage'
                    ? Math.round((effectiveSubtotal * coupon.discountValue) / 100)
                    : coupon.discountValue;

                if (coupon.maxDiscount && couponDiscount > coupon.maxDiscount) {
                    couponDiscount = coupon.maxDiscount;
                }
                appliedCoupon = coupon.code;
            } else {
                delete req.session.appliedCoupon;
            }
        }

        const total = Math.max(0, effectiveSubtotal - couponDiscount);

       // ── Addresses ─────────────────────────────────────────────────────
       const addresses = await Address.find({ user: userId }).lean();
       const defaultAddress = addresses.find((a) => a.isDefault) || addresses[0] || null;

        // ── Wallet ────────────────────────────────────────────────────────
        const walletBalance = user.walletBalance ?? 0;
        const walletInsufficient = walletBalance < total;

        return res.render('users/checkout', {
            user: {
                username: user.username,
                email: user.email,
            },
            cartItems: enrichedItems,
            addresses,
            defaultAddress,
            walletBalance,
            walletInsufficient,
            subtotal,
            savings: offerSavings || null,
            couponDiscount: couponDiscount || null,
            appliedCoupon,
            total,
        });

    } catch (err) {
        console.error('getCheckout error:', err);
        return res.redirect('/');
    }
};

export const placeOrder = async (req, res) => {
    try {
        const userId =
        req.session?.user?.id ||
        req.session?.user?._id ||
        req.user?._id;

        const { addressId, paymentMethod, couponCode } = req.body;

        if (!addressId) {
            return res.status(400).json({
                success: false,
                message: "Please select an address"
            });
        }

        const user = await User.findById(userId);

        const cart = await Cart.findOne({ userId })
            .populate("items.productId");

        if (!cart || cart.items.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Cart is empty"
            });
        }

        const address = await Address.findById(addressId);

        if (!address) {
            return res.status(400).json({
                success: false,
                message: "Address not found"
            });
        }

        let subtotal = 0;

        const orderItems = [];

        for (const item of cart.items) {

            const product = item.productId;

            if (!product || product.isDeleted) {
                continue;
            }

            const variant = product.variants.find(
                v => v._id.toString() === item.variantId.toString()
            );

            if (!variant) {
                return res.status(400).json({
                    success: false,
                    message: `${product.name} variant not found`
                });
            }

            if (variant.stock < item.quantity) {
                return res.status(400).json({
                    success: false,
                    message: `${product.name} is out of stock`
                });
            }

            const price = variant.price;

            subtotal += price * item.quantity;

            orderItems.push({
                product: product._id,
                quantity: item.quantity,
                price: price,
                size: item.size 
            });
        }

        let couponDiscount = 0;

        if (couponCode) {

            const coupon = await Coupon.findOne({
                code: couponCode,
                isActive: true,
                expiresAt: { $gte: new Date() }
            });

            if (coupon) {

                couponDiscount =
                    coupon.discountType === "percentage"
                        ? Math.round(
                            (subtotal * coupon.discountValue) / 100
                        )
                        : coupon.discountValue;

                if (
                    coupon.maxDiscount &&
                    couponDiscount > coupon.maxDiscount
                ) {
                    couponDiscount = coupon.maxDiscount;
                }
            }
        }

        const totalAmount = Math.max(
            0,
            subtotal - couponDiscount
        );

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
            totalAmount,
            orderStatus: "Confirmed",
            paymentStatus:
                paymentMethod === "cod" ? "Pending" : "Paid",
             trackingHistory: [{ status: "Confirmed", time: new Date() }]
        });

        // Reduce stock
        for (const item of cart.items) {

            const product = await Product.findById(item.productId);

            const variant = product.variants.id(item.variantId);

            if (variant) {
                variant.stock -= item.quantity;
                await product.save();
            }
        }

        // Clear cart
        cart.items = [];
        await cart.save();

        // Remove coupon session
        delete req.session.appliedCoupon;

        return res.status(200).json({
            success: true,
            message: "Order placed successfully",
            orderId: order._id,
            redirectUrl: `/users/orderSuccess/${order._id}`
        });

    } catch (error) {
        console.error("placeOrder error:", error);

        return res.status(500).json({
            success: false,
            message: "Something went wrong"
        });
    }
};

export const loadOrderSuccess = async (req, res) => {
    try {
        const { id } = req.params;

        const order = await Order.findById(id)
            .populate('items.product')
            .lean();

        if (!order) {
            return res.redirect('/users/home');
        }

        const deliveryStart = new Date();
        const deliveryEnd = new Date();
        deliveryStart.setDate(deliveryStart.getDate() + 3);
        deliveryEnd.setDate(deliveryEnd.getDate() + 7);

        // Map orderStatus from DB to tracker step
        const statusStepMap = {
            'pending':    0,
            'processing': 1,
            'shipped':    2,
            'delivered':  3,
        };

        const currentStep = statusStepMap[order.orderStatus?.toLowerCase()] ?? 0;

        const formattedOrder = {
            orderNumber: order._id.toString().slice(-8).toUpperCase(),

            deliveryStart: deliveryStart.toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short'
            }),

            deliveryEnd: deliveryEnd.toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short'
            }),

            tracking: {
                currentStep,
                progressPercent: (currentStep / 3) * 100
            },

            items: order.items.map(item => ({
                name: item.product?.productName || item.product?.name || 'Product',
                variant: `Qty: ${item.quantity}`,
                price: `₹${item.price}`,
                imageUrl:
                    item.product?.variants?.[0]?.images?.[0] ||
                    '/images/product-placeholder.jpg'
            })),

            subtotal: `₹${order.totalAmount}`,
            shippingCost: 'Free',
            discount: null,
            total: `₹${order.totalAmount}`,
            paymentMethod: order.paymentMethod?.toUpperCase()
        };

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