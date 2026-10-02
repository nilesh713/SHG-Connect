const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: [
        'new_order', 'payment_received', 'payment_reference', 'order_cancelled', 'new_review',
        'delivery_update', 'order_confirmed', 'order_shipped', 'out_for_delivery', 'delivered',
        'order_status', 'product_status', 'promotion', 'system'
      ],
      default: 'system'
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    link: { type: String, default: '' },
    // Small payload so the frontend can rebuild the text in the selected language
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    read: { type: Boolean, default: false }
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, read: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
