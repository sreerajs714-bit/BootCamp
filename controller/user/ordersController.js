import {
    loadMyOrdersService,
    loadOrderDetailService,
    cancelOrderService,
    loadReturnPageService,
    returnRequestService,
    downloadInvoiceService
} from "../../services/user/ordersService.js";
import { statuscodes } from "../../utils/status_codes.js";

export const loadMyOrders = async (req, res) => {
    try {
        const userId =
            req.session?.user?.id ||
            req.session?.user?._id ||
            req.user?._id;

        const formattedOrders = await loadMyOrdersService(userId);

        res.locals.breadcrumbs = [
            { label: "Home", url: "/" },
            { label: "My Orders" }
        ];

        return res.render("users/myOrders", {
            orders: formattedOrders,
            user: req.session.user
        });

    } catch (error) {
        console.error("loadMyOrders error:", error);
        return res.redirect("/users/home");
    }
};

export const loadOrderDetail = async (req, res) => {
    try {
        const { id } = req.params;
        const userId =
            req.session?.user?.id ||
            req.session?.user?._id ||
            req.user?._id;

        const orderInfo = await loadOrderDetailService({ id, userId });

        res.locals.breadcrumbs = [
            { label: "Home", url: "/" },
            { label: "my orders", url: "/users/myOrders" },
            { label: `#${orderInfo._id.toString().slice(-8).toUpperCase()}` }
        ];

        return res.render("users/orderDetail", {
            order: orderInfo,
            user: req.session.user
        });

    } catch (error) {
        console.error("loadOrderDetail error:", error);
        return res.redirect("/users/orders");
    }
};

export const cancelOrder = async (req, res) => {
    try {
        const { id, orderId, reason, note } = req.body;
        const userId =
            req.session?.user?.id ||
            req.session?.user?._id ||
            req.user?._id;

        const result = await cancelOrderService({ id, orderId, reason, note, userId });

        return res.json(result);

    } catch (error) {
        console.error("cancelOrder error:", error);
        return res.status(error.statusCode || statuscodes.SERVER_ERROR).json({ success: false, message: error.message || "Something went wrong" });
    }
};

export const loadReturnPage = async (req, res) => {
    try {
        const { id, itemId } = req.params;

        const payload = await loadReturnPageService({ id, itemId });

        return res.render('users/return', payload);

    } catch (error) {
        console.error('loadReturnPage error:', error);
        if (error.statusCode === 302 && error.redirectUrl) {
            return res.redirect(error.redirectUrl);
        }
        return res.redirect('/users/orders');
    }
};

export const returnRequest = async (req, res) => {
    try {
        const { itemId, orderId, reason, condition, comments } = req.body;
        const result = await returnRequestService({
            itemId,
            orderId,
            reason,
            condition,
            comments,
            files: req.files
        });

        return res.json(result);

    } catch (error) {
        console.error('submitReturnRequest error:', error);
        return res.json({ success: false, message: 'Something went wrong' });
    }
};

export const downloadInvoice = async (req, res) => {
    try {
        const { id } = req.params;
        const userId =
            req.session?.user?.id ||
            req.session?.user?._id ||
            req.user?._id;

        await downloadInvoiceService({ id, userId, res });

    } catch (error) {
        console.error("downloadInvoice error:", error);
        if (!res.headersSent) {
            return res.status(error.statusCode || statuscodes.SERVER_ERROR).send(error.message || "Failed to generate invoice");
        }
    }
};
