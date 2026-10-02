const mongoose = require('mongoose');
const { PRODUCT_STATUSES, DELIVERY_OPTIONS } = require('../config/constants');

const productSchema = new mongoose.Schema(
  {
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: [true, 'Product name is required'], trim: true, minlength: 2, maxlength: 100 },
    category: { type: String, required: [true, 'Category is required'], trim: true },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    price: { type: Number, required: [true, 'Price is required'], min: [1, 'Price must be at least ₹1'], max: 1000000 },
    discountPercent: { type: Number, min: 0, max: 90, default: 0 },
    quantity: { type: Number, required: true, min: [0, 'Quantity cannot be negative'], default: 0 },
    images: [{ type: String }],
    location: { type: String, trim: true, maxlength: 100, default: '' },
    deliveryOption: { type: String, enum: DELIVERY_OPTIONS, default: 'local' },
    deliveryCharge: { type: Number, min: 0, max: 10000, default: 0 },
    tags: [{ type: String, trim: true, lowercase: true, maxlength: 30 }],
    status: { type: String, enum: PRODUCT_STATUSES, default: 'draft' },
    rejectionReason: { type: String, default: '' },
    promoted: { type: Boolean, default: false },
    featured: { type: Boolean, default: false }, // true when admin-featured OR an active 'featured' promotion
    adminFeatured: { type: Boolean, default: false },
    sellerActive: { type: Boolean, default: true }, // false while the seller account is suspended
    views: { type: Number, default: 0 },
    soldCount: { type: Number, default: 0 },
    rating: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 }
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

productSchema.index({ status: 1, sellerActive: 1, category: 1, createdAt: -1 });
productSchema.index({ status: 1, price: 1 });
productSchema.index({ status: 1, promoted: 1 });
productSchema.index({ status: 1, featured: 1 });
productSchema.index({ sellerId: 1, createdAt: -1 });
productSchema.index({ name: 'text', description: 'text', tags: 'text' });

productSchema.virtual('finalPrice').get(function () {
  if (!this.discountPercent) return this.price;
  return Math.round(this.price * (1 - this.discountPercent / 100));
});

productSchema.virtual('inStock').get(function () {
  return this.quantity > 0;
});

productSchema.set('toJSON', {
  virtuals: true,
  transform(doc, ret) {
    delete ret.__v;
    delete ret.id;
    return ret;
  }
});

module.exports = mongoose.model('Product', productSchema);
