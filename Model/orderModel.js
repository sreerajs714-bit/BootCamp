import  mongoose  from "mongoose";

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
            default: "Active"  // Active | Cancelled
        },
        cancelReason: {
            type: String,
            default: ""
        },
        cancelNote: {
            type: String,
            default: ""
        }
    }],
    address: Object,
    paymentMethod: String,
    totalAmount: Number,
    orderStatus: {
        type: String,
        default: "Pending"
    },
    paymentStatus: {
        type: String,
        default: "Pending"
    },
    cancelReason: {
        type: String,
        default: ""
    },
    cancelNote: {
        type: String,
        default: ""
    }
}, {
    timestamps: true
});

export default mongoose.model("Order", orderSchema);