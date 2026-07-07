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
         variant: {                              // ← ADD THIS
        type: mongoose.Schema.Types.ObjectId
        },
        quantity: Number,
        price: Number,
        size: String,
        status: {
            type: String,
            default: "Active"  
        },
        cancelReason: { type: String, default: "" },
        cancelNote:   { type: String, default: "" },

        
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

   
    returnStatus: {
        type: String,
        enum: ['None', 'Requested', 'Approved', 'Rejected', 'Picked Up', 'Refunded'],
        default: 'None'
    },
    returnRequestedAt: Date,
    returnApprovedAt:  Date,
    pickupDate:        Date,
    refundedAt:        Date,

   
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
    subtotal:       { type: Number, default: 0 },
    offerSavings:   { type: Number, default: 0 },
    couponCode:     { type: String, default: null },
    couponDiscount: { type: Number, default: 0 },

}, { timestamps: true });

export default mongoose.model("Order", orderSchema);