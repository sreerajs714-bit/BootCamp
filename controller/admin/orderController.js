import Order from "../../model/orderModel.js";
import User from "../../model/userModel.js";
import Product from "../../model/productModel.js";
import Wallet from "../../model/walletModel.js";

import { calculateItemRefund } from "../User/ordersController.js";

const ORDERS_PER_PAGE = 5;

export const loadOrders = async (req, res) => {
    try {
        const page   = Math.max(1, parseInt(req.query.page) || 1);
        const status = req.query.status?.trim() || 'all';
        const search = req.query.search?.trim() || '';
        const isAjax = req.headers['x-requested-with'] === 'XMLHttpRequest';

        const filter = {};
        if (status !== 'all') filter.orderStatus = status;

       if (search) {
       const isValidId = /^[a-f\d]{24}$/i.test(search);

    if (isValidId) {
        filter._id = search;
    } else {
        // Search users by username
        const matchingUsers = await User.find({
            username: { $regex: search, $options: 'i' }
        }).select('_id').lean();

        // FIX: Search products by name
        const matchingProducts = await Product.find({
            productName: { $regex: search, $options: 'i' }
        }).select('_id').lean();

        // Find orders that contain matching products
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
            Order.countDocuments({ orderStatus: ['Returned','Delivered']})
        ]);

        const totalFiltered = await Order.countDocuments(filter);
        const totalPages    = Math.max(1, Math.ceil(totalFiltered / ORDERS_PER_PAGE));
        const safePage      = Math.min(page, totalPages);
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

        if (isAjax) {
            return res.json({
                success: true,
                orders: shapedOrders.map(o => ({
                    _id: o._id,
                    user: { username: o.user?.username || '—' },
                    items: o.items.map(i => ({
                        product: {
                            productName: i.product?.productName || '—',
                            variants: i.product?.variants || [{ images: [] }]
                        }
                    })),
                    createdAt: o.createdAt,
                    totalAmount: o.totalAmount,
                    paymentMethod: o.paymentMethod,
                    orderStatus: o.orderStatus
                })),
                totalFiltered,
                totalPages,
                currentPage: safePage,
                hasPrev:  safePage > 1,
                hasNext:  safePage < totalPages,
                prevPage: safePage - 1,
                nextPage: safePage + 1
            });
        }

        return res.render('admin/orderManagement', {
            orders: shapedOrders,
            totalOrdersCount,
            pendingOrdersCount,
            completedOrdersCount,
            totalFiltered,
            status: req.query.status || 'all',
            currentPage:    safePage,
            totalPages,
            pages,
            hasPrev:        safePage > 1,
            hasNext:        safePage < totalPages,
            prevPage:       safePage - 1,
            nextPage:       safePage + 1,
            selectedStatus: status,
            searchQuery:    search
        });

    } catch (error) {
        console.error('loadOrders error:', error);
        return res.status(500).render('admin/error', { message: 'Failed to load orders.' });
    }
};

export const loadOrderDetail = async (req, res) => {
    try {
        const { id } = req.params;

        const order = await Order.findById(id)
            .populate("user", "username email phoneNO")
            .populate("items.product", "productName variants")
            .lean();

        if (!order) {
            return res.status(404).redirect("/admin/orders");
        }

        const shapedOrder = {
            ...order,
            items: order.items.map(item => {
                const product = item.product;
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

        res.render("admin/orderDetail", { order: shapedOrder });

    } catch (error) {
        console.error("loadOrderDetail error:", error);
        res.status(500).send("Failed to load order detail.");
    }
};

export const updateOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const validStatuses = ["Confirmed", "Processing", "Shipped", "Out for Delivery", "Delivered", "Cancelled"];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: "Invalid status" });
        }

        const order = await Order.findById(id);
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        if (order.orderStatus === "Cancelled") {
            return res.status(400).json({ success: false, message: "Order is already cancelled" });
        }

        // ── Admin Cancelling the Order ──────────────────────────
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

        res.json({ success: true });

    } catch (error) {
        console.error("updateOrderStatus error:", error);
        res.status(500).json({ success: false, message: "Failed to update status" });
    }
};