const Notification = require('../models/Notification');
const { emitToUser } = require('./socket');

// Create a notification in MongoDB and push it to the user in real time.
async function notify(userId, { type = 'system', title, message, link = '', data = {} }) {
  try {
    const doc = await Notification.create({ userId, type, title, message, link, data });
    emitToUser(userId, 'notification', doc.toJSON());
    return doc;
  } catch (e) {
    // A failed notification must never break the main action (e.g. placing an order)
    console.error('[notify] failed:', e.message);
    return null;
  }
}

const STATUS_LABEL = {
  new: 'Order placed',
  confirmed: 'Order confirmed',
  processing: 'Processing',
  ready_to_ship: 'Ready to ship',
  shipped: 'Shipped',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled'
};

// Which notification type the customer gets for each status change
const CUSTOMER_TYPE = {
  confirmed: 'order_confirmed',
  shipped: 'order_shipped',
  out_for_delivery: 'out_for_delivery',
  delivered: 'delivered',
  cancelled: 'order_cancelled'
};

module.exports = { notify, STATUS_LABEL, CUSTOMER_TYPE };
