import mongoose from 'mongoose';



const transactionSchema = new mongoose.Schema({
    transactionId: {
        type: String,
        default: () => new mongoose.Types.ObjectId().toString(),
    },
    type: {
        type: String,
        enum: ['credit', 'debit'],
        required: true,
    },
    amount: {
        type: Number,
        required: true,
    },
    description: {
        type: String,
        default: '',
    },
    orderId: {                                              // 👈 add this
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        default: null,
    },
    date: {
        type: Date,
        default: Date.now,
    },
});

const walletSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
    },
    balance: {
        type: Number,
        default: 0,
    },
    transactions: [transactionSchema],
}, { timestamps: true });

export default  mongoose.model('Wallet', walletSchema);