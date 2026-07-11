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

export const loadMyOrders = async (req, res) => {
    try {
         const userId =
            req.session?.user?.id ||
            req.session?.user?._id ||
            req.user?._id;

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

            // Status styles resolved in controller — avoids #eq in class attributes
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

        const order = await Order.findOne({ _id: id, user: userId })
            .populate({
                path: "items.product",
                select: "productName variants"
            })
            .lean();

        if (!order) {
            return res.redirect("/users/myOrders");
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

    // Update the local object too so the page renders correctly
    order.paymentStatus = 'Failed';
    order.orderStatus = 'Cancelled';
    order.paymentExpiresAt = null;
    }

        const items = order.items.map(item => {
            const product = item.product;
        const variant = product.variants.find(v => v._id.toString() === item.variant?.toString())
        || product.variants.find(pv => pv.sizes?.some(s => s.toString() === item.size?.toString()));                                                        

            const rawImages = variant?.images || [];
            const images = rawImages.map(img => {
                if (typeof img === "string") return img;
                return img.url || img.path || img.src || "";
            }).filter(Boolean);

            return {
                ...item,                              // ← carries item.returnStatus
                returnStatus: item.returnStatus || null,   // ← explicit, never lost
                status: item.status || "Active",
                cancelReason: item.cancelReason || "",
                size: item.size || variant?.sizes?.[0] || "N/A",
                product: {
                    ...product,
                    // FIX: template uses product.variants[0].images[0]
                    // so we must keep the variants structure intact
                    variants: [
                        {
                            ...(variant || {}),
                            images
                        }
                    ]
                }
            };
        });

        res.locals.breadcrumbs = [
            { label: "Home", url: "/" },
            { label: "my orders", url: "/users/myOrders" },
            { label: `#${order._id.toString().slice(-8).toUpperCase()}` }
        ];

        return res.render("users/orderDetail", {
            order: {
                ...order,
                orderId: order._id.toString().slice(-8).toUpperCase(),
                items,
                orderStatus: order.orderStatus,
                // FIX: explicitly forward all return-related fields
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
            },
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

        const order = await Order.findOne({ _id: orderId, user: userId });

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        if (['Delivered', 'Cancelled'].includes(order.orderStatus)) {
            return res.status(400).json({
                success: false,
                message: `Order cannot be cancelled as it is already ${order.orderStatus}`
            });
        }

      // ── Cancel Entire Order ──────────────────────────────
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

    return res.json({
        success: true,
        message: ['wallet', 'razorpay'].includes(order.paymentMethod)
            ? `Order cancelled. ₹${refundAmount} refunded to your wallet.`
            : "Order cancelled successfully"
    });
}

        // ── Cancel Single Item ───────────────────────────────
        const item = order.items.id(id);

        if (!item) {
            return res.status(404).json({ success: false, message: "Item not found" });
        }

        if (item.status === 'Cancelled') {
            return res.status(400).json({ success: false, message: "Item already cancelled" });
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

        return res.json({
            success: true,
            message: ['wallet', 'razorpay'].includes(order.paymentMethod)
                ? `Item cancelled. ₹${itemRefund} refunded to your wallet.`
                : "Item cancelled successfully"
        });

    } catch (error) {
        console.error("cancelOrder error:", error);
        return res.status(500).json({ success: false, message: "Something went wrong" });
    }
};

export const loadReturnPage = async (req, res) => {
    try {
        const { id, itemId } = req.params;

        const order = await Order.findById(id)
            .populate('items.product')
            .lean();

        if (!order) return res.redirect('/users/orders');

        if (order.orderStatus !== 'Delivered') {
            return res.redirect(`/users/orderDetail/${id}`);
        }

        // ── Reshape items so the template's hardcoded variants[0] resolves correctly ──
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
                return res.redirect(`/users/orderDetail/${id}`);
            }

            const itemsWithRefund = returnableItems.map(i => ({
                ...i,
                refundValue: getRefundValue([i])
            }));

            const totalRefund = getRefundValue(returnableItems);

            return res.render('users/return', {
                order: shapedOrder,
                item: itemsWithRefund[0],
                allItems: itemsWithRefund,
                isFullReturn: true,
                totalRefund,
            });
        }

        const item = shapedOrder.items.find(i => i._id.toString() === itemId);
        if (!item) return res.redirect(`/users/orderDetail/${id}`);

        if (item.returnRequest?.status && item.returnRequest.status !== 'None') {
            return res.redirect(`/users/orderDetail/${id}`);
        }

        const refundValue = getRefundValue([item]);

        res.render('users/return', {
            order: shapedOrder,
            item: { ...item, refundValue },
            isFullReturn: false,
            totalRefund: refundValue,
        });

    } catch (error) {
        console.error('loadReturnPage error:', error);
        res.redirect('/users/orders');
    }
};

export const returnRequest = async (req, res) => {
    try {
        const { itemId, orderId, reason, condition, comments } = req.body;
        const imageUrls = req.files?.map(file => file.path) ?? [];

        const order = await Order.findById(orderId);
        if (!order) return res.json({ success: false, message: 'Order not found' });

        if (order.orderStatus !== 'Delivered') {
            return res.json({ success: false, message: 'Only delivered orders can be returned' });
        }

        if (itemId === 'ALL') {
            let deductedAmount = 0;  // ← add this

            order.items.forEach(item => {
                if (item.status === 'Cancelled') return;  // ← skip cancelled items

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
                deductedAmount += item.price * item.quantity;  // ← add this
            });
            order.isFullReturn = true;

        } else {
            const item = order.items.find(i => i._id.toString() === itemId);
            if (!item)
                return res.json({ success: false, message: 'Item not found' });

            if (item.returnStatus && item.returnStatus !== 'None')
                return res.json({ success: false, message: 'Return already requested' });

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
        return res.json({ success: true, message: 'Return request submitted successfully' });

    } catch (error) {
        console.error('submitReturnRequest error:', error);
        return res.json({ success: false, message: 'Something went wrong' });
    }
};

// ── Helper: fetch remote image as buffer
async function fetchImageBuffer(url) {
    try {
        const response = await axios.get(url, { responseType: "arraybuffer", timeout: 5000 });
        return Buffer.from(response.data);
    } catch {
        return null;
    }
}

// ── Helper: draw a filled rounded rect 
function badge(doc, x, y, w, h, r, fillColor) {
    doc.save().roundedRect(x, y, w, h, r).fill(fillColor).restore();
}

// ── Helper: horizontal rule 
function rule(doc, x1, x2, y, color = "#E5E7EB", lw = 0.5) {
    doc.save().moveTo(x1, y).lineTo(x2, y).strokeColor(color).lineWidth(lw).stroke().restore();
}

// ── Helper: label + value pair stacked vertically
function labelValue(doc, label, value, x, y, valueColor = "#111827") {
    doc.fontSize(7).font("Helvetica").fillColor("#9CA3AF").text(label, x, y);
    doc.fontSize(9).font("Helvetica-Bold").fillColor(valueColor).text(value, x, y + 11);
}

export const downloadInvoice = async (req, res) => {
    try {
        const { id } = req.params;
        const userId =
            req.session?.user?.id ||
            req.session?.user?._id ||
            req.user?._id;

        const order = await Order.findOne({ _id: id, user: userId })
            .populate({ path: "items.product", select: "productName variants" })
            .lean();

        if (!order) return res.status(404).send("Order not found");

        // ── Document setup ────────────────────────────────────────────────────
        const doc = new PDFDocument({ margin: 0, size: "A4", compress: true });

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename=Invoice-${order._id.toString().slice(-8).toUpperCase()}.pdf`
        );
        doc.pipe(res);

        // ── Constants ─────────────────────────────────────────────────────────
        const W = 595, H = 842;
        const PAD = 40;              // left/right padding
        const CONTENT_W = W - PAD * 2;
        const orderId = order._id.toString().slice(-8).toUpperCase();
        const orderDate = new Date(order.createdAt).toLocaleDateString("en-IN", {
            day: "2-digit", month: "short", year: "numeric",
        });

        // ── Currency helper ───────────────────────────────────────────────────
        // Helvetica (WinAnsiEncoding) does not include the ₹ glyph, so we use
        // the "Rs." prefix which renders correctly in all built-in PDF fonts.
        const INR = (amount) => `Rs. ${amount.toLocaleString("en-IN")}`;

        // ── Palette ───────────────────────────────────────────────────────────
        const C = {
            black: "#111827",
            white: "#FFFFFF",
            accent: "#4F46E5",         // indigo
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

        // ══════════════════════════════════════════════════════════════════════
        // SECTION 1 — HEADER
        // ══════════════════════════════════════════════════════════════════════
        // Black top strip
        doc.rect(0, 0, W, 80).fill(C.black);

        // Brand name (left)
        doc.fontSize(24).font("Helvetica-Bold").fillColor(C.white)
            .text("BOOT CAMP", PAD, 16);
        doc.fontSize(8).font("Helvetica").fillColor("rgba(255,255,255,0.65)")
            .text("PREMIUM FOOTBALL BOOTS", PAD, 44);

        // ── FIX: INVOICE label at top-right, invoice number below it, status
        //         pill at the very bottom of the strip — no overlap ──────────
        // "INVOICE" label — top right
        doc.fontSize(22).font("Helvetica-Bold").fillColor(C.white)
            .text("INVOICE", 0, 10, { align: "right", width: W - PAD });

        // Invoice number — directly below the label
        doc.fontSize(9).font("Helvetica").fillColor("rgba(255,255,255,0.7)")
            .text(`#INV-${orderId}`, 0, 36, { align: "right", width: W - PAD });

        // Status pill — sits at the very bottom of the header strip, right-aligned
        const statusText = order.orderStatus.toUpperCase();
        const pillW = 90, pillH = 22;
        const pillX = W - PAD - pillW;
        const pillY = 52;                    // 52 + 22 = 74, well within the 80px strip
        badge(doc, pillX, pillY, pillW, pillH, 11, C.white);
        doc.fontSize(8).font("Helvetica-Bold").fillColor(statusStyle.bg)
            .text(statusText, pillX, pillY + 7, { width: pillW, align: "center" });

        // ══════════════════════════════════════════════════════════════════════
        // SECTION 2 — META ROW (4 columns)
        // ══════════════════════════════════════════════════════════════════════
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

        // ══════════════════════════════════════════════════════════════════════
        // SECTION 3 — BILLING & TRANSACTION
        // ══════════════════════════════════════════════════════════════════════
        let y = metaY + 60;

        // Two columns: left = billing, right = transaction
        const COL1 = PAD;
        const COL2 = W / 2 + 10;

        // — Left: Billing —
        doc.fontSize(7).font("Helvetica-Bold").fillColor(C.gray400)
            .text("BILLING & SHIPPING", COL1, y);
        y += 14;

        doc.fontSize(14).font("Helvetica-Bold").fillColor(C.black)
            .text(order.address.fullName, COL1, y);
        y += 18;

        const addrLine2 = order.address.addressLine2 ? `, ${order.address.addressLine2}` : "";
        doc.fontSize(9).font("Helvetica").fillColor(C.gray600)
            .text(order.address.addressLine1 + addrLine2, COL1, y, { width: 220 });
        y += 14;
        doc.text(`${order.address.city}, ${order.address.state} – ${order.address.pincode}`, COL1, y);
        y += 14;
        doc.text(`Phone: ${order.address.phoneNO}`, COL1, y);

        // — Right: Transaction (4 sub-cells in 2×2 grid) —
        const txY = metaY + 60;
        doc.fontSize(7).font("Helvetica-Bold").fillColor(C.gray400)
            .text("TRANSACTION DETAILS", COL2, txY);

        const txItems = [
            { label: "ORDER ID",   value: `#${orderId}`,                                col: COL2,       row: 0 },
            { label: "PAYMENT",    value: (order.paymentMethod || "COD").toUpperCase(), col: COL2 + 110, row: 0 },
            { label: "ORDER DATE", value: orderDate,                                     col: COL2,       row: 1 },
            { label: "SHIPMENT",   value: "STANDARD",                                   col: COL2 + 110, row: 1 },
        ];
        txItems.forEach(({ label, value, col, row }) => {
            labelValue(doc, label, value, col, txY + 14 + row * 32);
        });

        // Thin vertical divider between columns
        const divX = W / 2 - 5;
        doc.save()
            .moveTo(divX, metaY + 56)
            .lineTo(divX, txY + 78)
            .strokeColor(C.gray200).lineWidth(1).stroke()
            .restore();

        y = metaY + 148;
        rule(doc, PAD, W - PAD, y, C.gray200, 1);

        // ══════════════════════════════════════════════════════════════════════
        // SECTION 4 — ITEMS TABLE
        // ══════════════════════════════════════════════════════════════════════
        y += 16;

        // Column x-positions & widths
        const IMG_SIZE = 48;
        const COLS = {
            img:   PAD,
            name:  PAD + IMG_SIZE + 12,
            qty:   PAD + 300,
            price: PAD + 370,
            total: PAD + 450,
        };

        // Table header row
        doc.rect(PAD, y, CONTENT_W, 24).fill(C.gray100);
        doc.fontSize(7).font("Helvetica-Bold").fillColor(C.gray400)
            .text("PRODUCT",    COLS.name,  y + 8)
            .text("QTY",        COLS.qty,   y + 8, { width: 40, align: "center" })
            .text("UNIT PRICE", COLS.price, y + 8, { width: 70, align: "right" })
            .text("AMOUNT",     COLS.total, y + 8, { width: 70, align: "right" });

        y += 32;

        // Item status helpers
        const itemStatusStyle = {
            Active:    { color: C.green,  bg: C.greenLight },
            Cancelled: { color: C.red,    bg: C.redLight   },
            Returned:  { color: C.blue,   bg: C.accentLight },
        };

        for (const item of order.items) {
            const product  = item.product;
           const variant = product.variants.find(v => v._id.toString() === item.variant?.toString())
            || product.variants.find(pv => pv.sizes?.some(s => s.toString() === item.size?.toString()));                                                         

            const size     = item.size || variant?.sizes?.[0] || "N/A";
            const isCancelled = item.status === "Cancelled";
            const itemStatus  = item.status || "Active";
            const istyle      = itemStatusStyle[itemStatus] || { color: C.gray400, bg: C.gray100 };

            // ── FIX: use INR() helper instead of bare ₹ ──────────────────────
            const unitPrice = INR(item.price);
            const itemTotal = INR(item.price * item.quantity);

            const rowH = IMG_SIZE + 20;

            // Row background
            doc.rect(PAD, y, CONTENT_W, rowH).fill(C.white);

            // — Product image box —
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

            // Dim overlay for cancelled
            if (isCancelled) {
                doc.save().rect(COLS.img, y + 6, IMG_SIZE, IMG_SIZE)
                    .fillOpacity(0.45).fill("#000000").restore();
            }

            // — Product name —
            const textMidY = y + 14;
            const nameColor = isCancelled ? C.gray400 : C.black;
            doc.fontSize(10).font("Helvetica-Bold").fillColor(nameColor)
                .text(product?.productName || "Product", COLS.name, textMidY, { width: 230 });

            // — Size badge —
            const sizeText = `SZ: ${size}`;
            const szX = COLS.name;
            doc.fontSize(8).font("Helvetica").fillColor(C.gray600)
                .text(sizeText, szX, textMidY + 15);

            // — Status pill —
            const pillLabel = itemStatus.toUpperCase();
            const plW = pillLabel.length * 5.5 + 12;
            badge(doc, szX + 55, textMidY + 12, plW, 14, 7, istyle.bg);
            doc.fontSize(7).font("Helvetica-Bold").fillColor(istyle.color)
                .text(pillLabel, szX + 55, textMidY + 15, { width: plW, align: "center" });

            // — Qty, unit price, total —
            const numY = y + rowH / 2 - 5;
            const numColor = isCancelled ? C.gray400 : C.gray800;

            doc.fontSize(10).font("Helvetica").fillColor(numColor)
                .text(String(item.quantity), COLS.qty,   numY, { width: 40,  align: "center" })
                .text(unitPrice,              COLS.price, numY, { width: 80,  align: "right" })
                .text(itemTotal,              COLS.total, numY, { width: 80,  align: "right" });

            // Strikethrough for cancelled
            if (isCancelled) {
                const strikeY = numY + 7;
                doc.save()
                    .moveTo(COLS.qty, strikeY)
                    .lineTo(COLS.total + 70, strikeY)
                    .strokeColor(C.gray400).lineWidth(0.6).stroke()
                    .restore();
            }

            y += rowH;
            rule(doc, PAD, W - PAD, y, C.gray200);
        }

        // ══════════════════════════════════════════════════════════════════════
        // SECTION 5 — TIMELINE  +  TOTALS  (two-column)
        // ══════════════════════════════════════════════════════════════════════
        y += 20;

        const TL_X    = PAD;          // timeline left x
        const TOT_X   = W / 2 + 20;  // totals left x
        const TOT_LBL = TOT_X;
        const TOT_VAL = W - PAD;

        // — Timeline —
        doc.fontSize(7).font("Helvetica-Bold").fillColor(C.gray400)
            .text("ORDER TIMELINE", TL_X, y);

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

            // connector line above dot
            if (i > 0) {
                const lineColor = i <= currentIdx ? C.accent : C.gray200;
                doc.save()
                    .moveTo(TL_X + 5, ty - STEP_H + 10)
                    .lineTo(TL_X + 5, ty)
                    .strokeColor(lineColor).lineWidth(2).stroke()
                    .restore();
            }

            // dot
            doc.circle(TL_X + 5, ty + 5, 5).fill(dotColor);
            if (passed) doc.circle(TL_X + 5, ty + 5, 2.5).fill(C.white);

            doc.fontSize(9).font(font).fillColor(textColor)
                .text(s.toUpperCase(), TL_X + 18, ty);
        });

        // — Totals —
        const totY = y + 12;

// Subtotal row
doc.fontSize(9).font("Helvetica").fillColor(C.gray600)
    .text("Subtotal", TOT_LBL, totY);
doc.fontSize(9).font("Helvetica-Bold").fillColor(C.black)
    .text(INR(order.subtotal || order.totalAmount), 0, totY, { align: "right", width: TOT_VAL });

let totalsOffset = 0;

// ── Offer savings row ─────────────────────────────────────────────────
if (order.offerSavings && order.offerSavings > 0) {
    doc.fontSize(9).font("Helvetica").fillColor("#EA580C")
        .text("Offer Discount", TOT_LBL, totY + 20);
    doc.fontSize(9).font("Helvetica-Bold").fillColor("#EA580C")
        .text(`- ${INR(order.offerSavings)}`, 0, totY + 20, { align: "right", width: TOT_VAL });
    totalsOffset += 20;
}

// ── Coupon discount row ───────────────────────────────────────────────
if (order.couponCode && order.couponDiscount > 0) {
    doc.fontSize(9).font("Helvetica").fillColor(C.green)
        .text(`Coupon (${order.couponCode})`, TOT_LBL, totY + 20 + totalsOffset);
    doc.fontSize(9).font("Helvetica-Bold").fillColor(C.green)
        .text(`- ${INR(order.couponDiscount)}`, 0, totY + 20 + totalsOffset, { align: "right", width: TOT_VAL });
    totalsOffset += 20;
}

// Shipping row
doc.fontSize(9).font("Helvetica").fillColor(C.gray600)
    .text("Shipping fee", TOT_LBL, totY + 20 + totalsOffset);
doc.fontSize(9).font("Helvetica-Bold").fillColor(C.green)
    .text("FREE", 0, totY + 20 + totalsOffset, { align: "right", width: TOT_VAL });

// Divider
rule(doc, TOT_X, W - PAD, totY + 38 + totalsOffset, C.gray200, 1);

// Total settlement box
doc.rect(TOT_X, totY + 46 + totalsOffset, W - PAD - TOT_X, 52).fill(C.accentLight);
doc.fontSize(10).font("Helvetica-Bold").fillColor(C.accent)
    .text("TOTAL SETTLEMENT", TOT_LBL + 10, totY + 56 + totalsOffset);
doc.fontSize(8).font("Helvetica").fillColor(C.gray400)
    .text("Incl. GST & all taxes", TOT_LBL + 10, totY + 70 + totalsOffset);
doc.fontSize(22).font("Helvetica-Bold").fillColor(C.accent)
    .text(INR(order.totalAmount), 0, totY + 54 + totalsOffset, {
        align: "right", width: TOT_VAL - 10,
    });

        // ══════════════════════════════════════════════════════════════════════
        // SECTION 6 — IMPORTANT INFORMATION
        // ══════════════════════════════════════════════════════════════════════
        const infoY = Math.max(
    TL_Y_START + timelineStatuses.length * STEP_H + 20,
    totY + 110 + totalsOffset   // ✅ adds space when coupon row exists
);

        rule(doc, PAD, W - PAD, infoY, C.gray200, 1);

        doc.fontSize(7).font("Helvetica-Bold").fillColor(C.gray400)
            .text("IMPORTANT INFORMATION", PAD, infoY + 12);

        const notes = [
            "This invoice is digitally generated and validated. No physical signature is required.",
            "Returns must be initiated within 7 days of delivery.",
            "For billing enquiries, email support@bootcamp.com",
        ];
        notes.forEach((n, i) => {
            doc.fontSize(8).font("Helvetica").fillColor(C.gray600)
                .text(`${i + 1}.  ${n}`, PAD, infoY + 24 + i * 13, { width: 330 });
        });

        // Authorized signatory (right side)
        const sigX = W - PAD - 160;
        doc.fontSize(13).font("Helvetica-Bold").fillColor(C.gray200)
            .text("BOOT CAMP Official", sigX, infoY + 20, { width: 160, align: "right" });
        doc.fontSize(7).font("Helvetica-Bold").fillColor(C.gray400)
            .text("AUTHORIZED SIGNATORY", sigX, infoY + 36, { width: 160, align: "right" });

        // ══════════════════════════════════════════════════════════════════════
        // SECTION 7 — FOOTER
        // ══════════════════════════════════════════════════════════════════════
        doc.rect(0, H - 44, W, 44).fill(C.black);

        // Left: brand
        doc.fontSize(12).font("Helvetica-Bold").fillColor(C.white)
            .text("BOOT CAMP", PAD, H - 28);

        // Center: thank-you
        doc.fontSize(8).font("Helvetica").fillColor("rgba(255,255,255,0.75)")
            .text("Thank you for shopping with us. We hope to see you again!", 0, H - 26, {
                align: "center", width: W,
            });

        doc.end();
    } catch (error) {
        console.error("downloadInvoice error:", error);
        return res.status(500).send("Failed to generate invoice");
    }
};
