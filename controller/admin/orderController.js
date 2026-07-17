import {
    loadOrdersService,
    loadOrderDetailService,
    updateOrderStatusService
} from "../../services/admin/orderService.js";
import { statuscodes } from "../../utils/status_codes.js";

export const loadOrders = async (req, res) => {
    try {
        const page   = Math.max(1, parseInt(req.query.page) || 1);
        const status = req.query.status?.trim() || 'all';
        const search = req.query.search?.trim() || '';
        const isAjax = req.headers['x-requested-with'] === 'XMLHttpRequest';

        const payload = await loadOrdersService({ page, status, search });

        if (isAjax) {
            return res.json({
                success: true,
                orders: payload.orders.map(o => ({
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
                totalFiltered: payload.totalFiltered,
                totalPages: payload.totalPages,
                currentPage: payload.currentPage,
                hasPrev: payload.hasPrev,
                hasNext: payload.hasNext,
                prevPage: payload.prevPage,
                nextPage: payload.nextPage
            });
        }

        return res.render('admin/orderManagement', {
            orders: payload.orders,
            totalOrdersCount: payload.totalOrdersCount,
            pendingOrdersCount: payload.pendingOrdersCount,
            completedOrdersCount: payload.completedOrdersCount,
            totalFiltered: payload.totalFiltered,
            status: req.query.status || 'all',
            currentPage: payload.currentPage,
            totalPages: payload.totalPages,
            pages: payload.pages,
            hasPrev: payload.hasPrev,
            hasNext: payload.hasNext,
            prevPage: payload.prevPage,
            nextPage: payload.nextPage,
            selectedStatus: status,
            searchQuery: search
        });

    } catch (error) {
        console.error('loadOrders error:', error);
        return res.status(statuscodes.SERVER_ERROR).render('admin/error', { message: 'Failed to load orders.' });
    }
};

export const loadOrderDetail = async (req, res) => {
    try {
        const { id } = req.params;

        const shapedOrder = await loadOrderDetailService(id);

        res.render("admin/orderDetail", { order: shapedOrder });

    } catch (error) {
        console.error("loadOrderDetail error:", error);
        res.status(statuscodes.SERVER_ERROR).send("Failed to load order detail.");
    }
};

export const updateOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const result = await updateOrderStatusService({ id, status });

        res.json(result);

    } catch (error) {
        console.error("updateOrderStatus error:", error);
        res.status(error.statusCode || statuscodes.SERVER_ERROR).json({
            success: false,
            message: error.message || "Failed to update status"
        });
    }
};