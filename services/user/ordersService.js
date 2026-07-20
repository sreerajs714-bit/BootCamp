import PDFDocument from "pdfkit";
import Order from "../../model/orderModel.js";
import Product from "../../model/productModel.js";
import Wallet from "../../model/walletModel.js";
import axios from "axios";

export function calculateItemRefund(order, itemsToRefund) {
    const refundRawTotal = itemsToRefund.reduce((sum, item) =>
        sum + ((item.price || 0) * (item.quantity || 1)), 0
    );

    const orderActiveTotal = order.items
        .filter(i => i.status !== 'Cancelled')
        .reduce((sum, i) => sum + ((i.price || 0) * (i.quantity || 1)), 0);

    if (orderActiveTotal === 0) return refundRawTotal;

    const couponDiscount = order.couponDiscount || 0;
    const proportionalCoupon = couponDiscount > 0
        ? (refundRawTotal / orderActiveTotal) * couponDiscount
        : 0;

    return Math.round(refundRawTotal - proportionalCoupon);
}

export const loadMyOrdersService = async (userId) => {
    const orders = await Order.find({ user: userId })
        .populate({
            path: "items.product",
            select: "productName variants"
        })
        .sort({ createdAt: -1 })
        .lean();

    const formattedOrders = orders.map(order => {
        const items = order.items.map(item => {
            const product = item.product;
            if (!product) return item;
            const variant = product.variants.find(v => v._id.toString() === item.variant?.toString())
                || product.variants.find(pv => pv.sizes?.some(s => s.toString() === item.size?.toString()));

            const rawImages = variant?.images || [];
            const images = rawImages.map(img => {
                if (typeof img === "string") return img;
                return img.url || img.path || img.src || "";
            }).filter(Boolean);

            return {
                ...item,
                size: item.size || variant?.sizes?.[0] || "N/A",
                product: { ...product, images }
            };
        });

        const statusStyles = {
            Pending:    { tagClass: "status-placed",      dotClass: "bg-amber-500" },
            Confirmed:  { tagClass: "status-placed",      dotClass: "bg-amber-500" },
            Processing: { tagClass: "status-processing",  dotClass: "bg-blue-500"  },
            Shipped:    { tagClass: "status-processing",  dotClass: "bg-blue-500"  },
            Delivered:  { tagClass: "status-delivered",   dotClass: "bg-green-500" },
            Cancelled:  { tagClass: "bg-red-50 text-red-600", dotClass: "bg-red-500" },
        };

        const style = statusStyles[order.orderStatus] || statusStyles.Pending;

        return {
            ...order,
            orderId: order._id.toString().slice(-8).toUpperCase(),
            totalPrice: order.totalAmount.toLocaleString("en-IN"),
            status: order.orderStatus,
            statusTagClass: style.tagClass,
            statusDotClass: style.dotClass,
            isDelivered: order.orderStatus === "Delivered",
            items
        };
    });

    return formattedOrders;
};

export const loadOrderDetailService = async ({ id, userId }) => {
    let order = await Order.findOne({ _id: id, user: userId })
        .populate({
            path: "items.product",
            select: "productName variants"
        })
        .lean();

    if (!order) {
        throw new Error("Order not found");
    }

    if (
        order.paymentMethod === 'razorpay' &&
        order.paymentStatus === 'Pending' &&
        order.paymentExpiresAt &&
        new Date() > order.paymentExpiresAt
    ) {
        await Order.findByIdAndUpdate(order._id, {
            paymentStatus: 'Failed',
            orderStatus: 'Cancelled',
            paymentExpiresAt: null,
            $push: { trackingHistory: { status: 'Cancelled', time: new Date() } }
        });

        order.paymentStatus = 'Failed';
        order.orderStatus = 'Cancelled';
        order.paymentExpiresAt = null;
    }

    const items = order.items.map(item => {
        const product = item.product;
        if (!product) return item;
        const variant = product.variants.find(v => v._id.toString() === item.variant?.toString())
            || product.variants.find(pv => pv.sizes?.some(s => s.toString() === item.size?.toString()));

        const rawImages = variant?.images || [];
        const images = rawImages.map(img => {
            if (typeof img === "string") return img;
            return img.url || img.path || img.src || "";
        }).filter(Boolean);

        return {
            ...item,
            returnStatus: item.returnStatus || null,
            status: item.status || "Active",
            cancelReason: item.cancelReason || "",
            size: item.size || variant?.sizes?.[0] || "N/A",
            product: {
                ...product,
                variants: [
                    {
                        ...(variant || {}),
                        images
                    }
                ]
            }
        };
    });

    return {
        ...order,
        orderId: order._id.toString().slice(-8).toUpperCase(),
        items,
        orderStatus: order.orderStatus,
        returnStatus: order.returnStatus || null,
        returnRequestedAt: order.returnRequestedAt || null,
        returnApprovedAt: order.returnApprovedAt || null,
        pickupDate: order.pickupDate || null,
        refundedAt: order.refundedAt || null,
        trackingHistory: order.trackingHistory || [],
        totalPrice: order.totalAmount.toLocaleString("en-IN"),
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        subtotal: order.subtotal || order.totalAmount,
        offerSavings: order.offerSavings || 0,
        couponCode: order.couponCode || null,
        couponDiscount: order.couponDiscount || 0,
        address: {
            name: order.address.fullName,
            phone: order.address.phoneNO,
            address: [order.address.addressLine1, order.address.addressLine2].filter(Boolean).join(', '),
            city: order.address.city,
            state: order.address.state,
            pincode: order.address.pincode,
            country: "India"
        },
        createdAt: order.createdAt
    };
};

export const cancelOrderService = async ({ id, orderId, reason, note, userId }) => {
    const order = await Order.findOne({ _id: orderId, user: userId });
    if (!order) {
        const err = new Error("Order not found");
        err.statusCode = 404;
        throw err;
    }

    if (['Delivered', 'Cancelled'].includes(order.orderStatus)) {
        const err = new Error(`Order cannot be cancelled as it is already ${order.orderStatus}`);
        err.statusCode = 400;
        throw err;
    }

    if (id === 'ALL') {
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
            item.cancelReason = reason;
            item.cancelNote = note || '';
        }

        order.orderStatus = 'Cancelled';
        order.cancelReason = reason;
        order.cancelNote = note || '';
        order.totalAmount = Math.max(0, order.totalAmount - refundAmount);
        await order.save();

        if (['wallet', 'razorpay'].includes(order.paymentMethod) && refundAmount > 0) {
            let wallet = await Wallet.findOne({ userId });
            if (!wallet) wallet = await Wallet.create({ userId, balance: 0, transactions: [] });

            wallet.balance += refundAmount;
            wallet.transactions.push({
                transactionId: `REFUND-${order._id}`,
                type: 'credit',
                amount: refundAmount,
                description: 'Order Cancellation Refund',
                orderId: order._id,
                date: new Date()
            });
            await wallet.save();
        }

        return {
            success: true,
            message: ['wallet', 'razorpay'].includes(order.paymentMethod)
                ? `Order cancelled. ₹${refundAmount} refunded to your wallet.`
                : "Order cancelled successfully"
        };
    }

    const item = order.items.id(id);
    if (!item) {
        const err = new Error("Item not found");
        err.statusCode = 404;
        throw err;
    }

    if (item.status === 'Cancelled') {
        const err = new Error("Item already cancelled");
        err.statusCode = 400;
        throw err;
    }

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

    const itemRefund = calculateItemRefund(order, [item]);

    item.status = 'Cancelled';
    item.cancelReason = reason;
    item.cancelNote = note || '';
    order.totalAmount = Math.max(0, order.totalAmount - itemRefund);

    const allCancelled = order.items.every(i => i.status === 'Cancelled');
    if (allCancelled) {
        order.orderStatus = 'Cancelled';
        order.cancelReason = 'All items cancelled';
    }

    await order.save();

    if (['wallet', 'razorpay'].includes(order.paymentMethod) && itemRefund > 0) {
        let wallet = await Wallet.findOne({ userId });
        if (!wallet) wallet = await Wallet.create({ userId, balance: 0, transactions: [] });

        wallet.balance += itemRefund;
        wallet.transactions.push({
            transactionId: `REFUND-${order._id}-${id}`,
            type: 'credit',
            amount: itemRefund,
            description: 'Item Cancellation Refund',
            orderId: order._id,
            date: new Date()
        });
        await wallet.save();
    }

    return {
        success: true,
        message: ['wallet', 'razorpay'].includes(order.paymentMethod)
            ? `Item cancelled. ₹${itemRefund} refunded to your wallet.`
            : "Item cancelled successfully"
    };
};

export const loadReturnPageService = async ({ id, itemId }) => {
    const order = await Order.findById(id)
        .populate('items.product')
        .lean();

    if (!order) {
        throw new Error("Order not found");
    }

    if (order.orderStatus !== 'Delivered') {
        const err = new Error("Only delivered orders can be returned");
        err.statusCode = 302;
        err.redirectUrl = `/users/orderDetail/${id}`;
        throw err;
    }

    const shapedOrder = {
        ...order,
        items: order.items.map(item => {
            const product = item.product;
            const variant =
                product?.variants?.find(v => v._id.toString() === item.variant?.toString()) ||
                product?.variants?.find(v => v.isDefault && v.isActive) ||
                product?.variants?.find(v => v.isActive) ||
                product?.variants?.[0];

            return {
                ...item,
                product: {
                    ...product,
                    variants: [variant || { images: [] }]
                }
            };
        })
    };

    function getRefundValue(items) {
        const refundRaw = items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
        const activeTotal = shapedOrder.items
            .filter(i => i.status !== 'Cancelled')
            .reduce((sum, i) => sum + (i.price * i.quantity), 0);

        if (activeTotal === 0) return refundRaw;

        const couponDiscount = shapedOrder.couponDiscount || 0;
        const proportional = couponDiscount > 0
            ? (refundRaw / activeTotal) * couponDiscount
            : 0;

        return Math.round(refundRaw - proportional);
    }

    if (itemId === 'ALL') {
        const returnableItems = shapedOrder.items.filter(i =>
            i.status !== 'Cancelled' &&
            (!i.returnRequest?.status || i.returnRequest.status === 'None')
        );

        if (returnableItems.length === 0) {
            const err = new Error("No returnable items");
            err.statusCode = 302;
            err.redirectUrl = `/users/orderDetail/${id}`;
            throw err;
        }

        const itemsWithRefund = returnableItems.map(i => ({
            ...i,
            refundValue: getRefundValue([i])
        }));

        const totalRefund = getRefundValue(returnableItems);

        return {
            order: shapedOrder,
            item: itemsWithRefund[0],
            allItems: itemsWithRefund,
            isFullReturn: true,
            totalRefund,
        };
    }

    const item = shapedOrder.items.find(i => i._id.toString() === itemId);
    if (!item) {
        const err = new Error("Item not found");
        err.statusCode = 302;
        err.redirectUrl = `/users/orderDetail/${id}`;
        throw err;
    }

    if (item.returnRequest?.status && item.returnRequest.status !== 'None') {
        const err = new Error("Return already requested");
        err.statusCode = 302;
        err.redirectUrl = `/users/orderDetail/${id}`;
        throw err;
    }

    const refundValue = getRefundValue([item]);

    return {
        order: shapedOrder,
        item: { ...item, refundValue },
        isFullReturn: false,
        totalRefund: refundValue,
    };
};

export const returnRequestService = async ({ itemId, orderId, reason, condition, comments, files = [] }) => {
    const imageUrls = files.map(file => file.path) ?? [];

    const order = await Order.findById(orderId);
    if (!order) return { success: false, message: 'Order not found' };

    if (order.orderStatus !== 'Delivered') {
        return { success: false, message: 'Only delivered orders can be returned' };
    }

    if (itemId === 'ALL') {
        let deductedAmount = 0;

        order.items.forEach(item => {
            if (item.status === 'Cancelled') return;

            item.returnStatus = 'Requested';
            item.status       = 'Return Requested';
            item.returnRequest = {
                status:      'Requested',
                reason,
                condition,
                comments,
                images:      imageUrls,
                requestedAt: new Date()
            };
            deductedAmount += item.price * item.quantity;
        });
        order.deductedAmount = deductedAmount;
        order.isFullReturn = true;

    } else {
        const item = order.items.find(i => i._id.toString() === itemId);
        if (!item) return { success: false, message: 'Item not found' };

        if (item.returnStatus && item.returnStatus !== 'None') {
            return { success: false, message: 'Return already requested' };
        }

        item.returnStatus  = 'Requested';
        item.status        = 'Return Requested';
        item.returnRequest = {
            status:      'Requested',
            reason,
            condition,
            comments,
            images:      imageUrls,
            requestedAt: new Date()
        };
        order.isFullReturn = false;
    }

    order.returnStatus      = 'Requested';
    order.returnRequestedAt = new Date();
    order.orderStatus       = 'Return Requested';

    await order.save();
    return { success: true, message: 'Return request submitted successfully' };
};

async function fetchImageBuffer(url) {
    try {
        const response = await axios.get(url, { responseType: "arraybuffer", timeout: 5000 });
        return Buffer.from(response.data);
    } catch {
        return null;
    }
}

function badge(doc, x, y, w, h, r, fillColor) {
    doc.save().roundedRect(x, y, w, h, r).fill(fillColor).restore();
}

function rule(doc, x1, x2, y, color = "#E5E7EB", lw = 0.5) {
    doc.save().moveTo(x1, y).lineTo(x2, y).strokeColor(color).lineWidth(lw).stroke().restore();
}

function labelValue(doc, label, value, x, y, valueColor = "#111827") {
    doc.fontSize(7).font("Helvetica").fillColor("#9CA3AF").text(label, x, y);
    doc.fontSize(9).font("Helvetica-Bold").fillColor(valueColor).text(value, x, y + 11);
}

export const downloadInvoiceService = async ({ id, userId, res }) => {
    const order = await Order.findOne({ _id: id, user: userId })
        .populate({ path: "items.product", select: "productName variants" })
        .lean();

    if (!order) {
        const err = new Error("Order not found");
        err.statusCode = 404;
        throw err;
    }

    const doc = new PDFDocument({ margin: 0, size: "A4", compress: true });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
        "Content-Disposition",
        `attachment; filename=Invoice-${order._id.toString().slice(-8).toUpperCase()}.pdf`
    );
    doc.pipe(res);

    const W = 595, H = 842;
    const PAD = 40;
    const CONTENT_W = W - PAD * 2;
    const orderId = order._id.toString().slice(-8).toUpperCase();
    const orderDate = new Date(order.createdAt).toLocaleDateString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
    });

    const INR = (amount) => `Rs. ${amount.toLocaleString("en-IN")}`;

    const C = {
        black: "#111827",
        white: "#FFFFFF",
        accent: "#4F46E5",
        accentLight: "#EEF2FF",
        green: "#059669",
        greenLight: "#ECFDF5",
        red: "#DC2626",
        redLight: "#FEF2F2",
        blue: "#2563EB",
        gray100: "#F3F4F6",
        gray200: "#E5E7EB",
        gray400: "#9CA3AF",
        gray600: "#4B5563",
        gray800: "#1F2937",
    };

    const statusMap = {
        Confirmed: { bg: C.accent,  text: C.white },
        Pending:   { bg: "#D97706", text: C.white },
        Delivered: { bg: C.green,   text: C.white },
        Cancelled: { bg: C.red,     text: C.white },
        Shipped:   { bg: C.blue,    text: C.white },
        'Out for Delivery': { bg: "#0891b2", text: C.white },
    };
    const statusStyle = statusMap[order.orderStatus] || { bg: C.gray400, text: C.white };

    doc.rect(0, 0, W, 80).fill(C.black);
    doc.fontSize(24).font("Helvetica-Bold").fillColor(C.white).text("BOOT CAMP", PAD, 16);
    doc.fontSize(8).font("Helvetica").fillColor("rgba(255,255,255,0.65)").text("PREMIUM FOOTBALL BOOTS", PAD, 44);
    doc.fontSize(22).font("Helvetica-Bold").fillColor(C.white).text("INVOICE", 0, 10, { align: "right", width: W - PAD });
    doc.fontSize(9).font("Helvetica").fillColor("rgba(255,255,255,0.7)").text(`#INV-${orderId}`, 0, 36, { align: "right", width: W - PAD });

    const statusText = order.orderStatus.toUpperCase();
    const pillW = 90, pillH = 22;
    const pillX = W - PAD - pillW;
    const pillY = 52;
    badge(doc, pillX, pillY, pillW, pillH, 11, C.white);
    doc.fontSize(8).font("Helvetica-Bold").fillColor(statusStyle.bg).text(statusText, pillX, pillY + 7, { width: pillW, align: "center" });

    const metaY = 80;
    doc.rect(0, metaY, W, 48).fill(C.gray100);

    const metaItems = [
        { label: "INVOICE NO.",  value: `#INV-${orderId}` },
        { label: "ISSUE DATE",   value: orderDate },
        { label: "ORDER DATE",   value: orderDate },
        { label: "PAYMENT",      value: (order.paymentMethod || "COD").toUpperCase() },
    ];

    const colW = CONTENT_W / 4;
    metaItems.forEach((m, i) => {
        labelValue(doc, m.label, m.value, PAD + i * colW, metaY + 10);
    });

    rule(doc, 0, W, metaY + 47, C.gray200, 1);

    let y = metaY + 60;
    const COL1 = PAD;
    const COL2 = W / 2 + 10;

    doc.fontSize(7).font("Helvetica-Bold").fillColor(C.gray400).text("BILLING & SHIPPING", COL1, y);
    y += 14;

    doc.fontSize(14).font("Helvetica-Bold").fillColor(C.black).text(order.address.fullName, COL1, y);
    y += 18;

    const addrLine2 = order.address.addressLine2 ? `, ${order.address.addressLine2}` : "";
    doc.fontSize(9).font("Helvetica").fillColor(C.gray600).text(order.address.addressLine1 + addrLine2, COL1, y, { width: 220 });
    y += 14;
    doc.text(`${order.address.city}, ${order.address.state} – ${order.address.pincode}`, COL1, y);
    y += 14;
    doc.text(`Phone: ${order.address.phoneNO}`, COL1, y);

    const txY = metaY + 60;
    doc.fontSize(7).font("Helvetica-Bold").fillColor(C.gray400).text("TRANSACTION DETAILS", COL2, txY);

    const txItems = [
        { label: "ORDER ID",   value: `#${orderId}`,                                col: COL2,       row: 0 },
        { label: "PAYMENT",    value: (order.paymentMethod || "COD").toUpperCase(), col: COL2 + 110, row: 0 },
        { label: "ORDER DATE", value: orderDate,                                     col: COL2,       row: 1 },
        { label: "SHIPMENT",   value: "STANDARD",                                   col: COL2 + 110, row: 1 },
    ];
    txItems.forEach(({ label, value, col, row }) => {
        labelValue(doc, label, value, col, txY + 14 + row * 32);
    });

    const divX = W / 2 - 5;
    doc.save().moveTo(divX, metaY + 56).lineTo(divX, txY + 78).strokeColor(C.gray200).lineWidth(1).stroke().restore();

    y = metaY + 148;
    rule(doc, PAD, W - PAD, y, C.gray200, 1);

    y += 16;
    const IMG_SIZE = 48;
    const SL_W = 24; 
    const COLS = {
        sl:    PAD,
        img:   PAD + SL_W,
        name:  PAD + SL_W + IMG_SIZE + 12,
        qty:   PAD + 300,
        price: PAD + 370,
        total: PAD + 450,
    };
    const NAME_W = 230 - SL_W; 

    doc.rect(PAD, y, CONTENT_W, 24).fill(C.gray100);
    doc.fontSize(7).font("Helvetica-Bold").fillColor(C.gray400)
        .text("SL NO.",     COLS.sl,    y + 8, { width: SL_W, align: "center" })
        .text("PRODUCT",    COLS.name,  y + 8)
        .text("QTY",        COLS.qty,   y + 8, { width: 40, align: "center" })
        .text("UNIT PRICE", COLS.price, y + 8, { width: 70, align: "right" })
        .text("AMOUNT",     COLS.total, y + 8, { width: 70, align: "right" });

    y += 32;

    const itemStatusStyle = {
        Active:    { color: C.green,  bg: C.greenLight },
        Cancelled: { color: C.red,    bg: C.redLight   },
        Returned:  { color: C.blue,   bg: C.accentLight },
    };

    let slIndex = 0; 

    for (const item of order.items) {
        const product  = item.product;
        if (!product) continue;
        slIndex += 1;

        const variant = product.variants.find(v => v._id.toString() === item.variant?.toString())
            || product.variants.find(pv => pv.sizes?.some(s => s.toString() === item.size?.toString()));

        const size     = item.size || variant?.sizes?.[0] || "N/A";
        const isCancelled = item.status === "Cancelled";
        const itemStatus  = item.status || "Active";
        const istyle      = itemStatusStyle[itemStatus] || { color: C.gray400, bg: C.gray100 };

        const unitPrice = INR(item.price);
        const itemTotal = INR(item.price * item.quantity);

        const rowH = IMG_SIZE + 20;

        doc.rect(PAD, y, CONTENT_W, rowH).fill(C.white);
        doc.rect(COLS.img, y + 6, IMG_SIZE, IMG_SIZE).fill(C.gray100);

        const imgUrl = (() => {
            const raw = variant?.images?.[0];
            if (!raw) return null;
            return typeof raw === "string" ? raw : (raw.url || raw.path || raw.src || null);
        })();

        if (imgUrl) {
            const buf = await fetchImageBuffer(imgUrl);
            if (buf) {
                try {
                    doc.image(buf, COLS.img, y + 6, {
                        width: IMG_SIZE, height: IMG_SIZE,
                        cover: [IMG_SIZE, IMG_SIZE],
                    });
                } catch { /* skip */ }
            }
        }

        if (isCancelled) {
            doc.save().rect(COLS.img, y + 6, IMG_SIZE, IMG_SIZE).fillOpacity(0.45).fill("#000000").restore();
        }

        const numColorSl = isCancelled ? C.gray400 : C.gray800;
        doc.fontSize(10).font("Helvetica").fillColor(numColorSl)
            .text(String(slIndex), COLS.sl, y + rowH / 2 - 5, { width: SL_W, align: "center" });

        const textMidY = y + 14;
        const nameColor = isCancelled ? C.gray400 : C.black;
        doc.fontSize(10).font("Helvetica-Bold").fillColor(nameColor).text(product?.productName || "Product", COLS.name, textMidY, { width: NAME_W });

        const sizeText = `SZ: ${size}`;
        const szX = COLS.name;
        doc.fontSize(8).font("Helvetica").fillColor(C.gray600).text(sizeText, szX, textMidY + 15);

        const pillLabel = itemStatus.toUpperCase();
        const plW = pillLabel.length * 5.5 + 12;
        badge(doc, szX + 55, textMidY + 12, plW, 14, 7, istyle.bg);
        doc.fontSize(7).font("Helvetica-Bold").fillColor(istyle.color).text(pillLabel, szX + 55, textMidY + 15, { width: plW, align: "center" });

        const numY = y + rowH / 2 - 5;
        const numColor = isCancelled ? C.gray400 : C.gray800;

        doc.fontSize(10).font("Helvetica").fillColor(numColor)
            .text(String(item.quantity), COLS.qty,   numY, { width: 40,  align: "center" })
            .text(unitPrice,              COLS.price, numY, { width: 80,  align: "right" })
            .text(itemTotal,              COLS.total, numY, { width: 80,  align: "right" });

        if (isCancelled) {
            const strikeY = numY + 7;
            doc.save().moveTo(COLS.qty, strikeY).lineTo(COLS.total + 70, strikeY).strikeColor(C.gray400).lineWidth(0.6).stroke().restore();
        }

        y += rowH;
        rule(doc, PAD, W - PAD, y, C.gray200);
    }

    y += 20;
    const TL_X    = PAD;
    const TOT_X   = W / 2 + 20;
    const TOT_LBL = TOT_X;
    const TOT_VAL = W - PAD;

    doc.fontSize(7).font("Helvetica-Bold").fillColor(C.gray400).text("ORDER TIMELINE", TL_X, y);

    const timelineStatuses = ["Pending", "Confirmed", "Processing", "Shipped", "Out for Delivery", "Delivered"];
    const currentIdx = timelineStatuses.indexOf(order.orderStatus);
    const TL_Y_START = y + 16;
    const STEP_H = 22;

    timelineStatuses.forEach((s, i) => {
        const ty     = TL_Y_START + i * STEP_H;
        const passed = i <= currentIdx;
        const dotColor  = passed ? C.accent : C.gray200;
        const textColor = passed ? C.black  : C.gray400;
        const font      = passed ? "Helvetica-Bold" : "Helvetica";

        if (i > 0) {
            const lineColor = i <= currentIdx ? C.accent : C.gray200;
            doc.save().moveTo(TL_X + 5, ty - STEP_H + 10).lineTo(TL_X + 5, ty).strokeColor(lineColor).lineWidth(2).stroke().restore();
        }

        doc.circle(TL_X + 5, ty + 5, 5).fill(dotColor);
        if (passed) doc.circle(TL_X + 5, ty + 5, 2.5).fill(C.white);

        doc.fontSize(9).font(font).fillColor(textColor).text(s.toUpperCase(), TL_X + 18, ty);
    });

    const totY = y + 12;
    doc.fontSize(9).font("Helvetica").fillColor(C.gray600).text("Subtotal", TOT_LBL, totY);
    doc.fontSize(9).font("Helvetica-Bold").fillColor(C.black).text(INR(order.subtotal || order.totalAmount), 0, totY, { align: "right", width: TOT_VAL });

    let totalsOffset = 0;
    if (order.offerSavings && order.offerSavings > 0) {
        doc.fontSize(9).font("Helvetica").fillColor("#EA580C").text("Offer Discount", TOT_LBL, totY + 20);
        doc.fontSize(9).font("Helvetica-Bold").fillColor("#EA580C").text(`- ${INR(order.offerSavings)}`, 0, totY + 20, { align: "right", width: TOT_VAL });
        totalsOffset += 20;
    }

    if (order.couponCode && order.couponDiscount > 0) {
        doc.fontSize(9).font("Helvetica").fillColor(C.green).text(`Coupon (${order.couponCode})`, TOT_LBL, totY + 20 + totalsOffset);
        doc.fontSize(9).font("Helvetica-Bold").fillColor(C.green).text(`- ${INR(order.couponDiscount)}`, 0, totY + 20 + totalsOffset, { align: "right", width: TOT_VAL });
        totalsOffset += 20;
    }

    doc.fontSize(9).font("Helvetica").fillColor(C.gray600).text("Shipping fee", TOT_LBL, totY + 20 + totalsOffset);
    doc.fontSize(9).font("Helvetica-Bold").fillColor(C.green).text("FREE", 0, totY + 20 + totalsOffset, { align: "right", width: TOT_VAL });

    rule(doc, TOT_X, W - PAD, totY + 38 + totalsOffset, C.gray200, 1);

    doc.rect(TOT_X, totY + 46 + totalsOffset, W - PAD - TOT_X, 52).fill(C.accentLight);
    doc.fontSize(10).font("Helvetica-Bold").fillColor(C.accent).text("TOTAL SETTLEMENT", TOT_LBL + 10, totY + 56 + totalsOffset);
    doc.fontSize(8).font("Helvetica").fillColor(C.gray400).text("Incl. GST & all taxes", TOT_LBL + 10, totY + 70 + totalsOffset);
    doc.fontSize(22).font("Helvetica-Bold").fillColor(C.accent).text(INR(order.totalAmount), 0, totY + 54 + totalsOffset, { align: "right", width: TOT_VAL - 10 });

    const infoY = Math.max(
        TL_Y_START + timelineStatuses.length * STEP_H + 20,
        totY + 110 + totalsOffset
    );

    rule(doc, PAD, W - PAD, infoY, C.gray200, 1);

    doc.fontSize(7).font("Helvetica-Bold").fillColor(C.gray400).text("IMPORTANT INFORMATION", PAD, infoY + 12);

    const notes = [
        "This invoice is digitally generated and validated. No physical signature is required.",
        "Returns must be initiated within 7 days of delivery.",
        "For billing enquiries, email support@bootcamp.com",
    ];
    notes.forEach((n, i) => {
        doc.fontSize(8).font("Helvetica").fillColor(C.gray600).text(`${i + 1}.  ${n}`, PAD, infoY + 24 + i * 13, { width: 330 });
    });

    const sigX = W - PAD - 160;
    doc.fontSize(13).font("Helvetica-Bold").fillColor(C.gray200).text("BOOT CAMP Official", sigX, infoY + 20, { width: 160, align: "right" });
    doc.fontSize(7).font("Helvetica-Bold").fillColor(C.gray400).text("AUTHORIZED SIGNATORY", sigX, infoY + 36, { width: 160, align: "right" });

    doc.rect(0, H - 44, W, 44).fill(C.black);
    doc.fontSize(12).font("Helvetica-Bold").fillColor(C.white).text("BOOT CAMP", PAD, H - 28);
    doc.fontSize(8).font("Helvetica").fillColor("rgba(255,255,255,0.75)").text("Thank you for shopping with us. We hope to see you again!", 0, H - 26, { align: "center", width: W });

    doc.end();
};
