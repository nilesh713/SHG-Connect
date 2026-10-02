const mongoose = require('mongoose');
const { ORDER_STATUSES, PAYMENT_METHODS, PAYMENT_STATUSES } = require('../config/constants');

const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    image: { type: String, default: '' },
    price: { type: Number, required: true }, // unit price actually charged (after discount)
    quantity: { type: Number, required: true, min: 1 },
    subtotal: { type: Number, required: true }
  },
  { _id: false }
);

const statusEventSchema = new mongoose.Schema(
  {
    status: { type: String, enum: ORDER_STATUSES, required: true },
    note: { type: String, default: '' },
    at: { type: Date, default: Date.now },
    by: { type: String, enum: ['customer', 'seller', 'admin', 'system'], default: 'system' }
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: { type: [orderItemSchema], validate: [(v) => v.length > 0, 'Order must contain at least one item'] },
    itemsTotal: { type: Number, required: true },
    deliveryCharge: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, required: true },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: 'pending' },
    // UPI transaction reference (UTR) typed by the customer – never card/bank credentials
    paymentReference: { type: String, trim: true, default: '' },
    paidAt: Date,
    orderStatus: { type: String, enum: ORDER_STATUSES, default: 'new' },
    deliveryStatus: {
      type: String,
      enum: ['not_shipped', 'in_transit', 'out_for_delivery', 'delivered', 'cancelled'],
      default: 'not_shipped'
    },
    deliveryInfo: {
      partner: { type: String, trim: true, default: '' }, // e.g. "Self delivery", "India Post"
      trackingId: { type: String, trim: true, default: '' },
      expectedDate: Date
    },
    statusHistory: [statusEventSchema],
    shippingAddress: {
      fullName: { type: String, required: true, trim: true },
      phone: { type: String, required: true, trim: true },
      addressLine: { type: String, required: true, trim: true },
      city: { type: String, required: true, trim: true },
      state: { type: String, required: true, trim: true },
      pincode: { type: String, required: true, trim: true }
    },
    customerNote: { type: String, trim: true, maxlength: 300, default: '' },
    cancelReason: { type: String, trim: true, default: '' }
  },
  { timestamps: true }
);

orderSchema.index({ sellerId: 1, createdAt: -1 });
orderSchema.index({ customerId: 1, createdAt: -1 });
orderSchema.index({ sellerId: 1, orderStatus: 1 });
orderSchema.index({ 'items.productId': 1 });

// Derive the customer-facing delivery status from the order status
orderSchema.statics.deliveryStatusFor = function (orderStatus) {
  switch (orderStatus) {
    case 'shipped': return 'in_transit';
    case 'out_for_delivery': return 'out_for_delivery';
    case 'delivered': return 'delivered';
    case 'cancelled': return 'cancelled';
    default: return 'not_shipped';
  }
};

orderSchema.set('toJSON', {
  transform(doc, ret) {
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Order', orderSchema);
