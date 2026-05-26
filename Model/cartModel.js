import mongoose from "mongoose";

const cartItemSchema = new mongoose.Schema(
    {
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true
        },

        variantId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true
        },

        quantity: {
            type: Number,
            default: 1,
            min: 1
        },

        price: {
            type: Number,
            required: true
        },
        size: { 
            type: String, 
            default: "" 
        }
    },
    { _id: false }
);

const cartSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true // one cart per user
        },

        items: [cartItemSchema]
    },
    { timestamps: true }
);

export default  mongoose.model("Cart", cartSchema);

