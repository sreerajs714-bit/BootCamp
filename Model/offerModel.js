import mongoose from "mongoose";

const offerSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: true,
      trim: true,
    },
    applicableTo: {
      type: String,
      enum: ["product", "category"],
      required: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "applicableTo", // dynamic ref based on applicableTo
    },
    targetName: {
      type: String, // stored for display without populate
    },
    discountType: {
      type: String,
      enum: ["percentage", "flat"],
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },
    maxCap: {
      type: Number,
      default: null, // max discount cap for percentage offers
    },
    minOrder: {
      type: Number,
      default: 0,
    },
    startDate: {
      type: Date,
      required: true,
    },
    expiryDate: {
      type: Date,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Offer", offerSchema);