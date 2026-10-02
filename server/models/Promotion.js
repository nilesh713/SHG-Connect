const mongoose = require('mongoose');
const { PROMOTION_TYPES } = require('../config/constants');

// Internal promotion system for the prototype – no real paid advertising.
const promotionSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: PROMOTION_TYPES, required: true },
    discountPercent: { type: Number, min: 0, max: 90, default: 0 },
    previousDiscount: { type: Number, default: 0 }, // restored when a discount promotion ends
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date, required: true },
    active: { type: Boolean, default: true },
    views: { type: Number, default: 0 }, // product page views while the promotion ran
    clicks: { type: Number, default: 0 }, // clicks from the "Promoted Products" area
    orders: { type: Number, default: 0 } // orders containing the product while the promotion ran
  },
  { timestamps: true }
);

promotionSchema.index({ sellerId: 1, createdAt: -1 });
promotionSchema.index({ productId: 1, active: 1 });
promotionSchema.index({ active: 1, endDate: 1 });

module.exports = mongoose.model('Promotion', promotionSchema);
