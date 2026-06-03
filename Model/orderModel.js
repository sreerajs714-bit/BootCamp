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
        price: Number
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
    }
}, {
    timestamps: true
});

export default mongoose.model("Order", orderSchema);