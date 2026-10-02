const QRCode = require('qrcode');
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const SellerProfile = require('../models/SellerProfile');
const Promotion = require('../models/Promotion');
const Review = require('../models/Review');
const Counter = require('../models/Counter');
const { asyncHandler, AppError, escapeRegex, getPagination, paginationMeta } = require('../utils/helpers');
const { notify, STATUS_LABEL, CUSTOMER_TYPE } = require('../services/notificationService');
const { ORDER_FLOW, SELLER_ROLES } = require('../config/constants');

const finalPrice = (p) => (p.discountPercent ? Math.round(p.price * (1 - p.discountPercent / 100)) : p.price);
const money = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

function roleOf(user, order) {
  if (user.role === 'admin') return 'admin';
  if (String(order.sellerId) === String(user._id)) return 'seller';
  if (String(order.customerId) === String(user._id)) return 'customer';
  return null;
}

// POST /api/orders – checkout. One order is created per seller in the cart.
exports.createOrder = asyncHandler(async (req, res) => {
  const { items, paymentMethod, shippingAddress, customerNote } = req.body;

  // Merge duplicate lines of the same product
  const qtyById = new Map();
  for (const it of items) qtyById.set(it.productId, (qtyById.get(it.productId) || 0) + it.quantity);

  const products = await Product.find({ _id: { $in: [...qtyById.keys()] } });
  if (products.length !== qtyById.size) throw new AppError('Some products in your cart are no longer available. Please refresh your cart.', 409);

  for (const p of products) {
    if (p.status !== 'approved' || !p.sellerActive) throw new AppError(`"${p.name}" is no longer available.`, 409);
    if (String(p.sellerId) === String(req.user._id)) throw new AppError('You cannot order your own product.', 400);
    const want = qtyById.get(String(p._id));
    if (p.quantity < want) {
      throw new AppError(p.quantity === 0 ? `"${p.name}" is out of stock.` : `Only ${p.quantity} left of "${p.name}". Please reduce the quantity.`, 409);
    }
  }

  // Group cart lines by seller
  const bySeller = new Map();
  for (const p of products) {
    const sid = String(p.sellerId);
    if (!bySeller.has(sid)) bySeller.set(sid, []);
    bySeller.get(sid).push(p);
  }

  if (paymentMethod === 'upi') {
    const profiles = await SellerProfile.find({ userId: { $in: [...bySeller.keys()] } }).select('userId upiId businessName').lean();
    const missing = [...bySeller.keys()].filter((sid) => !profiles.find((pr) => String(pr.userId) === sid && pr.upiId));
    if (missing.length) {
      const names = profiles.filter((pr) => missing.includes(String(pr.userId))).map((pr) => pr.businessName).join(', ');
      throw new AppError(`${names || 'A seller in your cart'} does not accept UPI yet. Please choose Cash on Delivery.`, 422);
    }
  }

  // Reserve stock atomically; undo everything if any line fails (no multi-document transactions needed)
  const reserved = [];
  try {
    for (const p of products) {
      const q = qtyById.get(String(p._id));
      const r = await Product.updateOne({ _id: p._id, quantity: { $gte: q } }, { $inc: { quantity: -q, soldCount: q } });
      if (r.modifiedCount !== 1) throw new AppError(`"${p.name}" just went out of stock. Please update your cart.`, 409);
      reserved.push([p._id, q]);
    }
  } catch (err) {
    await Promise.all(reserved.map(([id, q]) => Product.updateOne({ _id: id }, { $inc: { quantity: q, soldCount: -q } })));
    throw err;
  }

  const created = [];
  try {
    for (const [sellerId, list] of bySeller) {
      const orderItems = list.map((p) => {
        const quantity = qtyById.get(String(p._id));
        const price = finalPrice(p);
        return { productId: p._id, name: p.name, image: p.images[0] || '', price, quantity, subtotal: price * quantity };
      });
      const itemsTotal = orderItems.reduce((s, i) => s + i.subtotal, 0);
      const deliveryCharge = Math.max(0, ...list.filter((p) => p.deliveryOption !== 'pickup').map((p) => p.deliveryCharge || 0));
      const seq = await Counter.next('order');

      const order = await Order.create({
        orderNumber: `SC${seq}`,
        customerId: req.user._id,
        sellerId,
        items: orderItems,
        itemsTotal,
        deliveryCharge,
        totalAmount: itemsTotal + deliveryCharge,
        paymentMethod,
        shippingAddress,
        customerNote: customerNote || '',
        statusHistory: [{ status: 'new', note: 'Order placed', by: 'customer' }]
      });
      created.push(order);

      Promotion.updateMany({ productId: { $in: list.map((p) => p._id) }, active: true }, { $inc: { orders: 1 } }).catch(() => {});
      notify(sellerId, {
        type: 'new_order',
        title: 'New order received',
        message: `Order ${order.orderNumber} for ${money(order.totalAmount)} from ${req.user.name}. Please confirm it.`,
        link: `/order-details.html?id=${order._id}`,
        data: { orderNumber: order.orderNumber, amount: order.totalAmount, customer: req.user.name }
      });
    }
  } catch (err) {
    await Promise.all(reserved.map(([id, q]) => Product.updateOne({ _id: id }, { $inc: { quantity: q, soldCount: -q } })));
    await Order.deleteMany({ _id: { $in: created.map((o) => o._id) } });
    throw err;
  }

  res.status(201).json({
    success: true,
    message: created.length > 1 ? `${created.length} orders placed (one per seller)` : 'Order placed successfully',
    data: created.map((o) => o.toJSON())
  });
});

// Add customer / seller display names to orders
async function decorate(orders) {
  const ids = [...new Set(orders.flatMap((o) => [String(o.customerId), String(o.sellerId)]))];
  const [users, profiles] = await Promise.all([
    User.find({ _id: { $in: ids } }).select('name').lean(),
    SellerProfile.find({ userId: { $in: ids } }).select('userId businessName location').lean()
  ]);
  const names = new Map(users.map((u) => [String(u._id), u.name]));
  const biz = new Map(profiles.map((p) => [String(p.userId), p]));
  return orders.map((o) => ({
    ...o,
    customerName: names.get(String(o.customerId)) || 'Customer',
    sellerName: biz.get(String(o.sellerId))?.businessName || names.get(String(o.sellerId)) || 'Seller',
    sellerLocation: biz.get(String(o.sellerId))?.location || ''
  }));
}

const DELIVERY_VIEW = ['confirmed', 'processing', 'ready_to_ship', 'shipped', 'out_for_delivery'];

// GET /api/orders – customer sees own orders, seller sees received orders, admin sees all
exports.getOrders = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query, 15, 100);
  const filter = {};
  const asCustomer = req.query.as === 'customer' || !SELLER_ROLES.includes(req.user.role);
  if (req.user.role !== 'admin' || req.query.as) {
    if (asCustomer) filter.customerId = req.user._id;
    else filter.sellerId = req.user._id;
  }
  const { status, paymentStatus, q, view } = req.query;
  if (typeof status === 'string' && status) {
    filter.orderStatus = status === 'active' ? { $nin: ['delivered', 'cancelled'] } : status;
  }
  if (view === 'delivery') filter.orderStatus = { $in: DELIVERY_VIEW };
  if (typeof paymentStatus === 'string' && paymentStatus) filter.paymentStatus = paymentStatus;
  if (typeof q === 'string' && q.trim()) filter.orderNumber = new RegExp(escapeRegex(q.trim()), 'i');

  const [orders, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Order.countDocuments(filter)
  ]);
  res.json({ success: true, data: await decorate(orders), pagination: paginationMeta(total, page, limit) });
});

// GET /api/orders/:id
exports.getOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).lean();
  if (!order) throw new AppError('Order not found', 404);
  const role = roleOf(req.user, order);
  if (!role) throw new AppError('You do not have access to this order.', 403);

  const [decorated] = await decorate([order]);
  decorated.viewerRole = role;
  if (role === 'customer') {
    const reviews = await Review.find({ customerId: req.user._id, productId: { $in: order.items.map((i) => i.productId) } }).select('productId').lean();
    decorated.reviewedProductIds = reviews.map((r) => String(r.productId));
  }
  res.json({ success: true, data: decorated });
});

// PUT /api/orders/:id/status
exports.updateOrderStatus = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw new AppError('Order not found', 404);
  const role = roleOf(req.user, order);
  if (!role) throw new AppError('You do not have access to this order.', 403);

  const next = req.body.status;
  const current = order.orderStatus;
  if (next === current) throw new AppError(`Order is already "${STATUS_LABEL[next]}".`, 400);
  if (['delivered', 'cancelled'].includes(current)) throw new AppError(`This order is already ${STATUS_LABEL[current].toLowerCase()} and cannot be changed.`, 400);

  if (next === 'cancelled') {
    if (role === 'customer' && !['new', 'confirmed'].includes(current)) {
      throw new AppError('This order is already being prepared and cannot be cancelled online. Please contact the seller.', 400);
    }
    if (role === 'seller' && ORDER_FLOW.indexOf(current) >= ORDER_FLOW.indexOf('shipped')) {
      throw new AppError('Shipped orders cannot be cancelled.', 400);
    }
  } else {
    if (role === 'customer') throw new AppError('Only the seller can update the order status.', 403);
    if (ORDER_FLOW.indexOf(next) < ORDER_FLOW.indexOf(current)) {
      throw new AppError('Order status can only move forward.', 400);
    }
  }

  order.orderStatus = next;
  order.deliveryStatus = Order.deliveryStatusFor(next);
  order.statusHistory.push({ status: next, note: req.body.note || '', by: role });

  if (req.body.deliveryPartner !== undefined) order.deliveryInfo.partner = req.body.deliveryPartner;
  if (req.body.trackingId !== undefined) order.deliveryInfo.trackingId = req.body.trackingId;
  if (req.body.expectedDate) order.deliveryInfo.expectedDate = new Date(req.body.expectedDate);

  if (next === 'delivered' && order.paymentMethod === 'cod' && order.paymentStatus === 'pending') {
    order.paymentStatus = 'paid'; // cash collected at the door
    order.paidAt = new Date();
  }
  if (next === 'cancelled') {
    order.cancelReason = req.body.note || '';
    await Promise.all(order.items.map((i) => Product.updateOne({ _id: i.productId }, { $inc: { quantity: i.quantity, soldCount: -i.quantity } })));
  }
  await order.save();

  // Notifications
  const link = `/order-details.html?id=${order._id}`;
  const data = { orderNumber: order.orderNumber, status: next };
  if (role !== 'customer') {
    notify(order.customerId, {
      type: CUSTOMER_TYPE[next] || 'order_status',
      title: `Order ${STATUS_LABEL[next].toLowerCase()}`,
      message: `Your order ${order.orderNumber} is now: ${STATUS_LABEL[next]}.`,
      link,
      data
    });
  }
  if (role === 'customer') {
    notify(order.sellerId, { type: 'order_cancelled', title: 'Order cancelled', message: `Customer cancelled order ${order.orderNumber}.`, link, data });
  } else if (role === 'admin') {
    notify(order.sellerId, {
      type: next === 'cancelled' ? 'order_cancelled' : 'delivery_update',
      title: next === 'cancelled' ? 'Order cancelled' : 'Delivery status updated',
      message: `Order ${order.orderNumber} was updated to "${STATUS_LABEL[next]}" by admin.`,
      link,
      data
    });
  }

  res.json({ success: true, message: `Order updated to "${STATUS_LABEL[next]}"`, data: order.toJSON() });
});

// PUT /api/orders/:id/payment – seller/admin records the payment result
exports.updatePaymentStatus = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw new AppError('Order not found', 404);
  const role = roleOf(req.user, order);
  if (role !== 'seller' && role !== 'admin') throw new AppError('Only the seller can update the payment status.', 403);

  const next = req.body.paymentStatus;
  if (next === 'refunded' && order.paymentStatus !== 'paid') throw new AppError('Only paid orders can be marked as refunded.', 400);
  if (next === 'paid' && order.orderStatus === 'cancelled') throw new AppError('This order was cancelled.', 400);

  order.paymentStatus = next;
  if (next === 'paid') order.paidAt = new Date();
  await order.save();

  const labels = { paid: 'Payment confirmed', failed: 'Payment not received', refunded: 'Payment refunded', pending: 'Payment pending' };
  notify(order.customerId, {
    type: 'order_status',
    title: labels[next],
    message: `${labels[next]} for order ${order.orderNumber} (${money(order.totalAmount)}).`,
    link: `/order-details.html?id=${order._id}`,
    data: { orderNumber: order.orderNumber, paymentStatus: next }
  });
  res.json({ success: true, message: labels[next], data: order.toJSON() });
});

// POST /api/orders/:id/payment-reference – customer submits the UPI transaction ID after paying
exports.submitPaymentReference = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw new AppError('Order not found', 404);
  if (roleOf(req.user, order) !== 'customer') throw new AppError('Only the customer can submit a payment reference.', 403);
  if (order.paymentMethod !== 'upi') throw new AppError('This order is Cash on Delivery.', 400);
  if (order.paymentStatus === 'paid') throw new AppError('This order is already paid.', 400);
  if (order.orderStatus === 'cancelled') throw new AppError('This order was cancelled.', 400);

  order.paymentReference = req.body.reference.toUpperCase();
  order.paymentStatus = 'pending';
  await order.save();

  notify(order.sellerId, {
    type: 'payment_received',
    title: 'UPI payment received – please verify',
    message: `Customer paid ${money(order.totalAmount)} by UPI for ${order.orderNumber}. Ref: ${order.paymentReference}. Check your UPI app and mark it as Paid.`,
    link: '/payments.html',
    data: { orderNumber: order.orderNumber, amount: order.totalAmount, reference: order.paymentReference }
  });
  res.json({ success: true, message: 'Payment reference sent to the seller for verification.', data: order.toJSON() });
});

// GET /api/orders/:id/upi – UPI deep link + QR for the customer of this order (demo flow, no gateway)
exports.getUpiDetails = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).lean();
  if (!order) throw new AppError('Order not found', 404);
  if (roleOf(req.user, order) !== 'customer' && req.user.role !== 'admin') throw new AppError('You do not have access to this order.', 403);
  if (order.paymentMethod !== 'upi') throw new AppError('This order is Cash on Delivery.', 400);

  const profile = await SellerProfile.findOne({ userId: order.sellerId }).select('upiId businessName').lean();
  if (!profile?.upiId) throw new AppError('The seller has not added a UPI ID yet. Please contact the seller.', 404);

  const params = new URLSearchParams({
    pa: profile.upiId,
    pn: profile.businessName || 'SHG Connect Seller',
    am: order.totalAmount.toFixed(2),
    cu: 'INR',
    tn: `SHG Connect ${order.orderNumber}`
  });
  const link = `upi://pay?${params.toString()}`;
  const qr = await QRCode.toDataURL(link, { margin: 1, width: 240 });
  res.json({
    success: true,
    data: { upiId: profile.upiId, payeeName: profile.businessName, amount: order.totalAmount, orderNumber: order.orderNumber, link, qr }
  });
});

exports.decorate = decorate;
