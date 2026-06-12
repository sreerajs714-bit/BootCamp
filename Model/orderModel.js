import mongoose from "mongoose";

const orderSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    items: [{
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product"
        },
        quantity: Number,
        price: Number,
        size: String,
        status: {
            type: String,
            default: "Active"  // Active | Cancelled | Return Requested | Returned
        },
        cancelReason: { type: String, default: "" },
        cancelNote:   { type: String, default: "" },

        // FIX: item-level return fields (template reads item.returnStatus)
        returnStatus: {
            type: String,
            enum: ['None', 'Requested', 'Approved', 'Rejected', 'Picked Up', 'Refunded'],
            default: 'None'
        },
        returnRequest: {
            status:      { type: String, default: 'None' },
            reason:      String,
            condition:   String,
            comments:    String,
            images:      [String],
            requestedAt: Date,
            resolvedAt:  Date
        }
    }],

    address:       Object,
    paymentMethod: String,
    totalAmount:   Number,

    orderStatus: {
        type: String,
        default: "Pending"
        // Pending | Confirmed | Processing | Shipped | Delivered
        // Cancelled | Return Requested | Returned
    },
    paymentStatus: {
        type: String,
        default: "Pending"
    },

    cancelReason: { type: String, default: "" },
    cancelNote:   { type: String, default: "" },

    trackingHistory: [{
        status: { type: String },
        time:   { type: Date, default: Date.now }
    }],

    // FIX: order-level returnStatus (template reads order.returnStatus)
    returnStatus: {
        type: String,
        enum: ['None', 'Requested', 'Approved', 'Rejected', 'Picked Up', 'Refunded'],
        default: 'None'
    },
    returnRequestedAt: Date,
    returnApprovedAt:  Date,
    pickupDate:        Date,
    refundedAt:        Date,

    // keep existing returnRequest for backward compat
    returnRequest: {
        status: {
            type: String,
            enum: ['None', 'Requested', 'Approved', 'Rejected', 'Picked', 'Refunded'],
            default: 'None'
        },
        reason:      String,
        note:        String,
        requestedAt: Date,
        resolvedAt:  Date
    },
    
     isFullReturn: { 
        type: Boolean,
        default: false 
    },
    paymentExpiresAt: {
        type: Date,
        default: null 
    },


}, { timestamps: true });

export default mongoose.model("Order", orderSchema);