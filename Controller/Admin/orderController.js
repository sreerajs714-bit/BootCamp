import Order from "../../Model/orderModel.js";
import User from "../../Model/userModel.js";
import Product from "../../Model/productModel.js";

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

        const pages = Array.from({ length: totalPages }, (_, i) => ({
            number:    i + 1,
            isCurrent: i + 1 === safePage
        }));

        // FIX: return JSON for AJAX requests
        if (isAjax) {
            return res.json({
                success: true,
                orders: orders.map(o => ({
                    _id:         o._id,
                    idSuffix:    o._id.toString().slice(16, 24).toUpperCase(),
                    username:    o.user?.username || '—',
                    productName: o.items?.[0]?.product?.productName || '—',
                    productImage: o.items?.[0]?.product?.variants?.[0]?.images?.[0] || '',
                    extraItems:  o.items.length - 1,
                    createdAt:   o.createdAt,
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
            orders,
            totalOrdersCount,
            pendingOrdersCount,
            completedOrdersCount,
            totalFiltered,
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
        console.log("ORDER STATUS:", order.orderStatus);

        res.render("admin/orderDetail", { order });

    } catch (error) {
        console.error("loadOrderDetail error:", error);
        res.status(500).send("Failed to load order detail.");
    }
};

export const updateOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const validStatuses = ["Confirmed", "Processing", "Shipped","Out for Delivery","Delivered", "Cancelled"];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: "Invalid status" });
        }

        await Order.findByIdAndUpdate(id, {
            orderStatus: status,
            $push: {
                trackingHistory: {
                    $each: [{ status, time: new Date() }],
                    $position: 0  
                }
            }
        });

        res.json({ success: true });

    } catch (error) {
        console.error("updateOrderStatus error:", error);
        res.status(500).json({ success: false, message: "Failed to update status" });
    }
};