import Order from "../../Model/orderModel.js";
import Product from "../../Model/productModel.js";
import User from "../../Model/userModel.js";
import Wallet from "../../Model/walletModel.js";


export const loadReturnManagement = async (req, res) => {
    try {
        const isAjax = req.headers['x-requested-with'] === 'XMLHttpRequest';
        const { status = 'all', search = '', page = 1 } = req.query;
        const ITEMS_PER_PAGE = 5;
        const currentPage = Math.max(1, parseInt(page));

        const query = { returnStatus: { $nin: ['None'] } };
        if (status !== 'all') {
            query.returnStatus = status;
        }

        const allReturnOrders = await Order.find(query)
            .populate('user', 'username name email')
            .populate('items.product', 'productName variants')
            .lean();

        let returns = allReturnOrders.map(order => {
            const returnedItem = order.items.find(i =>
                i.returnStatus && i.returnStatus !== 'None'
            ) || order.items[0];

            const product = returnedItem?.product;
            const variant = product?.variants?.[0];
            const rawImage = variant?.images?.[0];
            const image = typeof rawImage === 'string'
                ? rawImage : rawImage?.url || rawImage?.path || '';

            return {
                _id:       order._id,
                requestId: order._id.toString().slice(-8).toUpperCase(),
                user: {
                    name:  order.user?.username || order.user?.name || 'Unknown',
                    email: order.user?.email || ''
                },
                product: { name: product?.productName || 'Unknown Product', image },
                reason:    returnedItem?.returnRequest?.reason || '—',
                status:    order.returnStatus,
                createdAt: order.returnRequestedAt || order.updatedAt
            };
        });

        if (search) {
            const q = search.toLowerCase();
            returns = returns.filter(r =>
                r.user.name.toLowerCase().includes(q) ||
                r.product.name.toLowerCase().includes(q) ||
                r.requestId.toLowerCase().includes(q) ||
                r.reason.toLowerCase().includes(q)
            );
        }

        returns.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        const totalFiltered = returns.length;
        const totalPages = Math.max(1, Math.ceil(totalFiltered / ITEMS_PER_PAGE));
        const safePage = Math.min(currentPage, totalPages);
        const paginated = returns.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

        const today = new Date(); today.setHours(0, 0, 0, 0);
        const allForStats = await Order.find({ returnStatus: { $nin: ['None'] } }).lean();
       const stats = {
                 pendingCount: allForStats.filter(o => o.returnStatus === 'Requested').length,
    
                 approvedToday: allForStats.filter(o =>
                   o.returnApprovedAt &&
                   new Date(o.returnApprovedAt) >= today
                   ).length,
    
    rejectedToday: allForStats.filter(o =>
        o.returnStatus === 'Rejected' &&
        o.updatedAt &&
        new Date(o.updatedAt) >= today
    ).length,
    
    totalCount: allForStats.length
    };

        const pages = Array.from({ length: totalPages }, (_, i) => ({
            number: i + 1,
            isCurrent: i + 1 === safePage
        }));

        if (isAjax) {
    return res.json({
        success: true,
        returns: paginated,
        totalFiltered,
        totalPages,
        currentPage: safePage,
        hasPrev: safePage > 1,
        hasNext: safePage < totalPages,
        prevPage: safePage - 1,
        nextPage: safePage + 1
    });
    }

        return res.render('admin/returnManagement', {
            returns: paginated,
            stats,
            
            currentStatus: status,
            currentSearch: search,
            totalFiltered,
            currentPage: safePage,
            totalPages,
            pages,
            hasPrev: safePage > 1,
            hasNext: safePage < totalPages,
            prevPage: safePage - 1,
            nextPage: safePage + 1
        });

    } catch (error) {
        console.error('loadReturnManagement error:', error);
        return res.redirect('/admin/dashboard');
    }
};

export const loadReturnDetail = async (req, res) => {
    try {
        const { id } = req.params;

        const order = await Order.findById(id)
            .populate('user', 'username name email')
            .populate('items.product', 'productName variants')
            .lean();

        if (!order) return res.redirect('/admin/returns');

        // FIX: use isFullReturn flag — never use orderStatus for this check
        const itemsToShow = (order.isFullReturn === true)
            ? order.items
            : order.items.filter(i =>
                (i.returnStatus && i.returnStatus !== 'None') ||
                i.status === 'Return Requested'               ||
                (i.returnRequest?.status && i.returnRequest.status !== 'None')
              );

        const products = itemsToShow.map(item => {
            const product  = item.product;
            const variant  = product?.variants?.[0];
            const rawImage = variant?.images?.[0];
            const image    = typeof rawImage === 'string'
                ? rawImage
                : rawImage?.url || rawImage?.path || '';

            return {
                name:      product?.productName || 'Unknown Product',
                image,
                quantity:  item.quantity  || 1,
                price:     item.price     || 0,
                size:      item.size      || '—',
                status:    item.returnStatus || item.status || '—',
                reason:    item.returnRequest?.reason    || order.returnRequest?.reason    || '—',
                condition: item.returnRequest?.condition || '—',
                comments:  item.returnRequest?.comments  || order.returnRequest?.note     || '—',
                images:    item.returnRequest?.images    || []
            };
        });

        const totalRefund = itemsToShow.reduce((sum, item) =>
            sum + ((item.price || 0) * (item.quantity || 1)), 0
        );

        const allImages = itemsToShow.flatMap(i => i.returnRequest?.images || []);

        const returnRequest = {
            _id:       order._id,
            orderId:   order._id.toString().slice(-8).toUpperCase(),
            status:    order.returnStatus || 'Requested',
            createdAt: order.returnRequestedAt || order.updatedAt,

           user: {
                 name:  order.user?.username || order.user?.name || 'Unknown',
                 email: order.user?.email || ''
            },

            address: {
                city:  order.address?.city  || '',
                state: order.address?.state || ''
            },

            products,
            product: products[0],

            reason:      products[0]?.reason    || '—',
            condition:   products[0]?.condition || '—',
            description: products[0]?.comments  || '—',

            images:       allImages,
            refundAmount: totalRefund.toLocaleString('en-IN')
        };

        return res.render('admin/returnDetail', { returnRequest });

    } catch (error) {
        console.error('loadReturnDetail error:', error);
        return res.redirect('/admin/returns');
    }
};

// 1. APPROVE
export const approveReturn = async (req, res) => {
    try {
        const { id } = req.params;
        const order = await Order.findById(id);
        if (!order) return res.json({ success: false, message: 'Order not found' });

        let refundAmount = 0;

        order.items.forEach(item => {
            if (item.returnStatus === 'Requested') {
                item.returnStatus         = 'Approved';
                item.returnRequest.status = 'Approved';
                item.status               = 'Returned';
                refundAmount += item.price * item.quantity;  // ← accumulate refund
            }
        });

        order.totalAmount     = Math.max(0, order.totalAmount - refundAmount);  // ← deduct
        order.returnStatus     = 'Approved';
        order.returnApprovedAt = new Date();
        order.orderStatus      = 'Returned';

        await order.save();
        return res.json({ success: true, message: 'Return approved and refund processed' });

    } catch (error) {
        console.error('approveReturn error:', error);
        return res.json({ success: false, message: 'Something went wrong' });
    }
};

// 2. REJECT
export const rejectReturn = async (req, res) => {
    try {
        const { id } = req.params;
        const { rejectionReason } = req.body;

        const order = await Order.findById(id);
        if (!order) return res.json({ success: false, message: 'Order not found' });

        order.returnStatus             = 'Rejected';
        order.orderStatus              = 'Delivered';
        order.returnRequest.status     = 'Rejected';
        order.returnRequest.resolvedAt = new Date();
        if (rejectionReason) order.returnRequest.note = rejectionReason;

        order.items.forEach(item => {
            if (item.returnStatus === 'Requested' || item.returnStatus === 'Approved') {
                item.returnStatus         = 'Rejected';
                item.returnRequest.status = 'Rejected';
                item.status               = 'Active';  // restore item to active
            }
        });

        // totalAmount stays untouched on rejection
        await order.save();
        return res.json({ success: true, message: 'Return rejected' });

    } catch (error) {
        console.error('rejectReturn error:', error);
        return res.json({ success: false, message: 'Something went wrong' });
    }
};

// 3. SCHEDULE PICKUP
export const schedulePickup = async (req, res) => {
    try {
        const { id } = req.params;
        const { pickupDate, pickupTime } = req.body;

        if (!pickupDate || !pickupTime)
            return res.json({ success: false, message: 'Pickup date and time are required' });

        const order = await Order.findById(id);
        if (!order) return res.json({ success: false, message: 'Order not found' });

        order.returnStatus = 'Picked Up';
        order.pickupDate   = new Date(`${pickupDate} ${pickupTime}`);

        order.items.forEach(item => {
            if (item.returnStatus === 'Approved') {
                item.returnStatus         = 'Picked Up';
                item.returnRequest.status = 'Picked Up';
            }
        });

        await order.save();
        return res.json({ success: true, message: 'Pickup scheduled' });

    } catch (error) {
        console.error('schedulePickup error:', error);
        return res.json({ success: false, message: 'Something went wrong' });
    }
};

// 4. MARK PICKED UP & PROCESS REFUND
export const processRefund = async (req, res) => {
    try {
        const { id } = req.params;

        const order = await Order.findById(id).populate('items.product');
        if (!order) return res.json({ success: false, message: 'Order not found' });

        const stockUpdates = order.items
            .filter(item => item.returnStatus === 'Picked Up')
            .map(async item => {
                const product = await Product.findById(item.product._id || item.product);
                if (!product) return;
                const variant = product.variants?.[0];
                if (!variant) return;
                variant.stock = (variant.stock || 0) + (item.quantity || 1);
                await product.save();
            });

        await Promise.all(stockUpdates);

        // Step 2: Update item statuses
        order.items.forEach(item => {
            if (item.returnStatus === 'Picked Up') {
                item.returnStatus         = 'Refunded';
                item.returnRequest.status = 'Refunded';
                item.status               = 'Returned';
            }
        });

        // Step 3: Update order status
        order.returnStatus = 'Refunded';
        order.orderStatus  = 'Returned';
        order.refundedAt   = new Date();

        // Step 4: Calculate refund amount
        const refundAmount = order.items
            .filter(item => item.returnStatus === 'Refunded')
            .reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 1)), 0);

        await order.save();

        // Step 5: Credit wallet  ← now BEFORE return
        if (refundAmount > 0) {
            let wallet = await Wallet.findOne({ userId: order.user });
            if (!wallet) {
                wallet = await Wallet.create({ userId: order.user, balance: 0, transactions: [] });
            }

            wallet.balance += refundAmount;
            wallet.transactions.push({
                transactionId: `REFUND-${order._id}-${Date.now()}`,
                type: 'credit',
                amount: refundAmount,
                description: 'Order Return Refund',
                orderId: order._id,
                date: new Date()
            });
            await wallet.save();
        }

        return res.json({ success: true, message: 'Refund processed and stock restored' }); // ← moved here

    } catch (error) {
        console.error('processRefund error:', error);
        return res.json({ success: false, message: 'Something went wrong' });
    }
};
