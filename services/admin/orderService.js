import Order from "../../model/orderModel.js";
import User from "../../model/userModel.js";
import Product from "../../model/productModel.js";
import Wallet from "../../model/walletModel.js";
import { calculateItemRefund } from "../user/ordersService.js";
import { statuscodes } from "../../utils/status_codes.js";

const ORDERS_PER_PAGE = 5;

export const loadOrdersService = async ({ page = 1, status = 'all', search = '' }) => {
    const currentPage = Math.max(1, parseInt(page));
    const filter = {};
    if (status !== 'all') filter.orderStatus = status;

    if (search.trim()) {
        const queryStr = search.trim();
        const isValidId = /^[a-f\d]{24}$/i.test(queryStr);

        if (isValidId) {
            filter._id = queryStr;
        } else {
            const matchingUsers = await User.find({
                username: { $regex: queryStr, $options: 'i' }
            }).select('_id').lean();

            const matchingProducts = await Product.find({
                productName: { $regex: queryStr, $options: 'i' }
            }).select('_id').lean();

            const ordersWithProduct = await Order.find({
                'items.product': { $in: matchingProducts.map(p => p._id) }
            }).select('_id').lean();

            filter.$or = [
                { user: { $in: matchingUsers.map(u => u._id) } },
                { _id: { $in: ordersWithProduct.map(o => o._id) } },
            ];
        }
    }

    const [totalOrdersCount, pendingOrdersCount, completedOrdersCount] = await Promise.all([
        Order.countDocuments({}),
        Order.countDocuments({ orderStatus: { $in: ['Pending', 'Confirmed', 'Processing', 'Shipped'] } }),
        Order.countDocuments({ orderStatus: { $in: ['Returned', 'Delivered'] } })
    ]);

    const totalFiltered = await Order.countDocuments(filter);
    const totalPages    = Math.max(1, Math.ceil(totalFiltered / ORDERS_PER_PAGE));
    const safePage      = Math.min(currentPage, totalPages);
    const safeSkip      = (safePage - 1) * ORDERS_PER_PAGE;

    const orders = await Order.find(filter)
        .populate('user', 'username email')
        .populate('items.product', 'productName variants')
        .sort({ createdAt: -1 })
        .skip(safeSkip)
        .limit(ORDERS_PER_PAGE)
        .lean();

    const shapedOrders = orders.map(o => ({
        ...o,
        items: o.items.map(item => {
            const product = item.product;
            if (!product) return item;
            const variant = product.variants.find(v => v._id.toString() === item.variant?.toString())
            || product.variants.find(pv => pv.sizes?.some(s => s.toString() === item.size?.toString()));

            return {
                ...item,
                product: {
                    ...product,
                    variants: [variant || { images: [] }]
                }
            };
        })
    }));

    const pages = Array.from({ length: totalPages }, (_, i) => ({
        number:    i + 1,
        isCurrent: i + 1 === safePage
    }));

    return {
        orders: shapedOrders,
        totalOrdersCount,
        pendingOrdersCount,
        completedOrdersCount,
        totalFiltered,
        totalPages,
        currentPage: safePage,
        pages,
        hasPrev: safePage > 1,
        hasNext: safePage < totalPages,
        prevPage: safePage - 1,
        nextPage: safePage + 1
    };
};

export const loadOrderDetailService = async (id) => {
    const order = await Order.findById(id)
        .populate("user", "username email phoneNO")
        .populate("items.product", "productName variants")
        .lean();

    if (!order) {
        const err = new Error("Order not found");
        err.statusCode = statuscodes.NOT_FOUND;
        throw err;
    }

    const shapedOrder = {
        ...order,
        items: order.items.map(item => {
            const product = item.product;
            if (!product) return item;
            const variant = product.variants.find(v => v._id.toString() === item.variant?.toString())
            || product.variants.find(pv => pv.sizes?.some(s => s.toString() === item.size?.toString()));

            return {
                ...item,
                product: {
                    ...product,
                    variants: [variant || { images: [] }]
                }
            };
        })
    };

    return shapedOrder;
};

export const updateOrderStatusService = async ({ id, status }) => {
    const validStatuses = ["Confirmed", "Processing", "Shipped", "Out for Delivery", "Delivered", "Cancelled"];
    if (!validStatuses.includes(status)) {
        const err = new Error("Invalid status");
        err.statusCode = statuscodes.BAD_REQUEST;
        throw err;
    }

    const order = await Order.findById(id);
    if (!order) {
        const err = new Error("Order not found");
        err.statusCode = statuscodes.NOT_FOUND;
        throw err;
    }

    if (order.orderStatus === "Cancelled") {
        const err = new Error("Order is already cancelled");
        err.statusCode = statuscodes.BAD_REQUEST;
        throw err;
    }

    if (status === "Cancelled") {
        const itemsToCancel = order.items.filter(i => i.status === 'Active');
        const refundAmount = calculateItemRefund(order, itemsToCancel);

        for (const item of itemsToCancel) {
            const product = await Product.findById(item.product);
            if (product) {
                const variant = product.variants.find(v =>
                    v.sizes && v.sizes.map(s => s.toString()).includes(item.size.toString())
                );
                if (variant) {
                    variant.stock += item.quantity;
                    await product.save();
                }
            }
            item.status = 'Cancelled';
            item.cancelReason = 'Cancelled by admin';
            item.cancelNote = '';
        }

        order.cancelReason = 'Cancelled by admin';
        order.totalAmount = Math.max(0, order.totalAmount - refundAmount);

        if (['wallet', 'razorpay'].includes(order.paymentMethod) && refundAmount > 0) {
            let wallet = await Wallet.findOne({ userId: order.user });
            if (!wallet) wallet = await Wallet.create({ userId: order.user, balance: 0, transactions: [] });

            wallet.balance += refundAmount;
            wallet.transactions.push({
                transactionId: `REFUND-${order._id}`,
                type: 'credit',
                amount: refundAmount,
                description: 'Order Cancelled by Admin - Refund',
                orderId: order._id,
                date: new Date()
            });
            await wallet.save();
        }
    }

    order.orderStatus = status;
    order.trackingHistory.unshift({ status, time: new Date() });

    await order.save();
    return { success: true };
};
