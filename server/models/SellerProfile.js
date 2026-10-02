const mongoose = require('mongoose');
const { SELLER_ROLES, DELIVERY_OPTIONS } = require('../config/constants');

const sellerProfileSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    sellerType: { type: String, enum: SELLER_ROLES, required: true },
    businessName: { type: String, trim: true, maxlength: 100, default: '' },
    description: { type: String, trim: true, maxlength: 1000, default: '' },
    location: { type: String, trim: true, maxlength: 100, default: '' },
    categories: [{ type: String, trim: true }],
    // UPI ID is only shown to a customer on their own order's payment screen
    upiId: {
      type: String,
      trim: true,
      default: '',
      match: [/^$|^[\w.-]{2,256}@[a-zA-Z]{2,64}$/, 'Please enter a valid UPI ID (example: name@upi)']
    },
    deliveryOptions: [{ type: String, enum: DELIVERY_OPTIONS }],
    whatsappEnabled: { type: Boolean, default: true },
    featured: { type: Boolean, default: false }, // "Featured Artisans" on the marketplace
    rating: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 }
  },
  { timestamps: true }
);

sellerProfileSchema.index({ businessName: 1 });
sellerProfileSchema.index({ featured: 1 });

sellerProfileSchema.set('toJSON', {
  transform(doc, ret) {
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('SellerProfile', sellerProfileSchema);
