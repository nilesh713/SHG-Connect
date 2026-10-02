const mongoose = require('mongoose');
const { REVIEW_STATUSES } = require('../config/constants');

const reviewSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 1000, default: '' },
    status: { type: String, enum: REVIEW_STATUSES, default: 'approved' },
    reportReason: { type: String, trim: true, default: '' }
  },
  { timestamps: true }
);

// One review per customer per product
reviewSchema.index({ productId: 1, customerId: 1 }, { unique: true });
reviewSchema.index({ sellerId: 1, createdAt: -1 });
reviewSchema.index({ status: 1 });

module.exports = mongoose.model('Review', reviewSchema);
