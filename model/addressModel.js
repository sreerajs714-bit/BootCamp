import mongoose from "mongoose";

const addressSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },

  fullName: {
    type: String,
    required: true,
    trim: true,
  },

  phoneNO: {
    type: String,
    required: true,
    trim: true,
  },

  addressLine1: {
    type: String,
    required: true,
    trim: true,
  },

  addressLine2: {
    type: String,
    trim: true,
    default: '',
  },

  city: {
    type: String,
    required: true,
    trim: true,
  },

  state: {
    type: String,
    required: true,
    trim: true,
  },

  pincode: {
    type: String,
    required: true,
    trim: true,
  },

  addressType: {
    type: String,
    enum: ['Home', 'Work'],
    default: 'Home',
  },

  isDefault: {
    type: Boolean,
    default: false,
  },

}, { timestamps: true });

export default mongoose.model('Address', addressSchema);