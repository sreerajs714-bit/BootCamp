import mongoose from "mongoose";

//varient schema

const variantSchema = new mongoose.Schema({

    color: {
        type: String,
        required: true,
        trim: true
    },

    sku: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },

    price: {
        type: Number,
        required: true
    },

    stock: {
        type: Number,
        required: true,
        default: 0
    },

    sizes: [{
        type: Number
    }],

    images: [{
        type: String
    }],
    isActive: { 
        type: Boolean, 
        default: true 
    },
    isDefault: {
          type: Boolean,
         default: false 
    }

}, { _id: true });


//product schema 

const productSchema = new mongoose.Schema({

    productName: {
        type: String,
        required: true,
        trim: true
    },

    description: {
        type: String,
        required: true,
        trim: true
    },

    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
        required: true
    },

    brand: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Brand",
        required: true
    },

    variants: [variantSchema],

    isLimitedEdition: {
        type: Boolean,
        default: false
    },

    status: {
        type: String,
        enum: ["active", "inactive"],
        default: "active"
    },

    isDeleted: {
        type: Boolean,
        default: false
    },

    totalSales: {
        type: Number,
        default: 0
    }

}, {
    timestamps: true
});


export default mongoose.model("Product", productSchema);