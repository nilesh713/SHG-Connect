const User = require('../models/User');
const SellerProfile = require('../models/SellerProfile');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Review = require('../models/Review');
const { asyncHandler, AppError, escapeRegex, getPagination, paginationMeta } = require('../utils/helpers');
const { withSellerInfo, addComputed, notifyProductStatus } = require('./productController');
const { decorate } = require('./orderController');
const { refreshRatings } = require('./reviewController');
const { syncProductFlags } = require('../services/promotionService');
const { SELLER_ROLES } = require('../config/constants');
const { notify } = require('../services/notificationService');

// GET /api/admin/stats
exports.getStats = asyncHandler(async (req, res) => {
  const [sellers, customers, products, pendingProducts, orders, completed, flaggedReviews, gmv] = await Promise.all([
    User.countDocuments({ role: { $in: SELLER_ROLES } }),
    User.countDocuments({ role: 'customer' }),
    Product.countDocuments({ status: { $ne: 'draft' } }),
    Product.countDocuments({ status: 'pending' }),
    Order.countDocuments(),
    Order.countDocuments({ orderStatus: 'delivered' }),
    Review.countDocuments({ status: 'flagged' }),
    Order.aggregate([{ $match: { orderStatus: { $ne: 'cancelled' } } }, { $group: { _id: null, total: { $sum: '$totalAmount' } } }])
  ]);
  res.json({
    success: true,
    data: { sellers, customers, products, pendingProducts, orders, completedOrders: completed, flaggedReviews, totalSales: gmv[0]?.total || 0 }
  });
});

// GET /api/admin/users?role=&q=&status=
exports.getUsers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query, 20, 100);
  const filter = {};
  const { role, q, status } = req.query;
  if (role === 'seller') filter.role = { $in: SELLER_ROLES };
  else if (typeof role === 'string' && role) filter.role = role;
  if (status === 'active') filter.isActive = true;
  if (status === 'suspended') filter.isActive = false;
  if (typeof q === 'string' && q.trim()) {
    const rx = new RegExp(escapeRegex(q.trim()), 'i');
    filter.$or = [{ name: rx }, { email: rx }, { phone: rx }, { location: rx }];
  }
  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter)
  ]);
  const profiles = await SellerProfile.find({ userId: { $in: users.map((u) => u._id) } }).select('userId businessName featured').lean();
  const pm = new Map(profiles.map((p) => [String(p.userId), p]));
  const data = users.map(({ password, ...u }) => ({ ...u, businessName: pm.get(String(u._id))?.businessName || '', featured: Boolean(pm.get(String(u._id))?.featured) }));
  res.json({ success: true, data, pagination: paginationMeta(total, page, limit) });
});

// PUT /api/admin/users/:id/status – suspend / activate
exports.setUserStatus = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError('User not found', 404);
  if (user.role === 'admin') throw new AppError('Admin accounts cannot be suspended here.', 400);
  user.isActive = req.body.isActive;
  await user.save();
  // Hide or show the seller's products on the marketplace
  await Product.updateMany({ sellerId: user._id }, { sellerActive: user.isActive });
  res.json({ success: true, message: user.isActive ? 'Account activated' : 'Account suspended', data: user });
});

// PUT /api/admin/sellers/:id/featured – Featured Artisans
exports.setSellerFeatured = asyncHandler(async (req, res) => {
  const profile = await SellerProfile.findOneAndUpdate({ userId: req.params.id }, { featured: req.body.featured }, { new: true });
  if (!profile) throw new AppError('Seller not found', 404);
  res.json({ success: true, message: req.body.featured ? 'Seller is now a Featured Artisan' : 'Removed from Featured Artisans', data: profile });
});

// GET /api/admin/products?status=&q=&category=
exports.getProducts = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query, 20, 100);
  const filter = { status: { $ne: 'draft' } };
  const { status, q, category } = req.query;
  if (typeof status === 'string' && status) filter.status = status;
  if (typeof category === 'string' && category) filter.category = category;
  if (typeof q === 'string' && q.trim()) filter.name = new RegExp(escapeRegex(q.trim()), 'i');
  const [items, total] = await Promise.all([
    Product.find(filter).sort({ status: 1, createdAt: -1 }).skip(skip).limit(limit).lean(),
    Product.countDocuments(filter)
  ]);
  res.json({ success: true, data: (await withSellerInfo(items)).map(addComputed), pagination: paginationMeta(total, page, limit) });
});

// PUT /api/admin/products/:id/status – approve / reject
exports.setProductStatus = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new AppError('Product not found', 404);
  const { status, reason } = req.body;
  product.status = status;
  product.rejectionReason = status === 'rejected' ? reason || 'Does not meet listing guidelines' : '';
  if (status !== 'approved') {
    product.promoted = false;
    product.featured = false;
    product.adminFeatured = false;
  }
  await product.save();
  if (status !== 'pending') notifyProductStatus(product, status, product.rejectionReason);
  res.json({ success: true, message: `Product ${status}`, data: product });
});

// PUT /api/admin/products/:id/featured
exports.setProductFeatured = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new AppError('Product not found', 404);
  if (req.body.featured && product.status !== 'approved') throw new AppError('Only approved products can be featured.', 400);
  product.adminFeatured = req.body.featured;
  await product.save();
  await syncProductFlags(product._id);
  if (req.body.featured) {
    notify(product.sellerId, { type: 'promotion', title: 'Your product is featured', message: `Admin featured "${product.name}" on the home page.`, link: '/promotions.html', data: { productName: product.name } });
  }
  res.json({ success: true, message: req.body.featured ? 'Product featured' : 'Product removed from featured' });
});

// GET /api/admin/orders?status=&q=
exports.getOrders = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query, 20, 100);
  const filter = {};
  const { status, paymentStatus, q } = req.query;
  if (typeof status === 'string' && status) filter.orderStatus = status;
  if (typeof paymentStatus === 'string' && paymentStatus) filter.paymentStatus = paymentStatus;
  if (typeof q === 'string' && q.trim()) filter.orderNumber = new RegExp(escapeRegex(q.trim()), 'i');
  const [orders, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Order.countDocuments(filter)
  ]);
  res.json({ success: true, data: await decorate(orders), pagination: paginationMeta(total, page, limit) });
});

// GET /api/admin/reviews?status=
exports.getReviews = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query, 20, 100);
  const filter = {};
  if (typeof req.query.status === 'string' && req.query.status) filter.status = req.query.status;
  const [reviews, total] = await Promise.all([
    Review.find(filter).sort({ status: 1, createdAt: -1 }).skip(skip).limit(limit)
      .populate('customerId', 'name').populate('productId', 'name').lean(),
    Review.countDocuments(filter)
  ]);
  res.json({
    success: true,
    data: reviews.map((r) => ({ ...r, customerName: r.customerId?.name || 'Customer', productName: r.productId?.name || '(deleted product)', productId: r.productId?._id, customerId: undefined })),
    pagination: paginationMeta(total, page, limit)
  });
});

// PUT /api/admin/reviews/:id/status – approve / hide
exports.setReviewStatus = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) throw new AppError('Review not found', 404);
  review.status = req.body.status;
  await review.save();
  await refreshRatings(review.productId, review.sellerId);
  res.json({ success: true, message: review.status === 'hidden' ? 'Review hidden' : 'Review approved', data: review });
});

// GET /api/admin/reports
exports.getReports = asyncHandler(async (req, res) => {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5, 1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const [ordersByStatus, monthly, byCategory, topSellers, usersByRole, payments] = await Promise.all([
    Order.aggregate([{ $group: { _id: '$orderStatus', n: { $sum: 1 } } }]),
    Order.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo }, orderStatus: { $ne: 'cancelled' } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt', timezone: '+05:30' } }, orders: { $sum: 1 }, sales: { $sum: '$totalAmount' } } },
      { $sort: { _id: 1 } }
    ]),
    Order.aggregate([
      { $match: { orderStatus: { $ne: 'cancelled' } } },
      { $unwind: '$items' },
      { $lookup: { from: 'products', localField: 'items.productId', foreignField: '_id', as: 'p' } },
      { $group: { _id: { $ifNull: [{ $first: '$p.category' }, 'other'] }, sales: { $sum: '$items.subtotal' }, quantity: { $sum: '$items.quantity' } } },
      { $sort: { sales: -1 } }
    ]),
    Order.aggregate([
      { $match: { orderStatus: { $ne: 'cancelled' } } },
      { $group: { _id: '$sellerId', sales: { $sum: '$totalAmount' }, orders: { $sum: 1 } } },
      { $sort: { sales: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'sellerprofiles', localField: '_id', foreignField: 'userId', as: 'sp' } },
      { $project: { sales: 1, orders: 1, name: { $first: '$sp.businessName' } } }
    ]),
    User.aggregate([{ $group: { _id: '$role', n: { $sum: 1 } } }]),
    Order.aggregate([{ $group: { _id: { method: '$paymentMethod', status: '$paymentStatus' }, n: { $sum: 1 }, amount: { $sum: '$totalAmount' } } }])
  ]);

  // Fill the last 6 months
  const mMap = new Map(monthly.map((m) => [m._id, m]));
  const months = [];
  const d = new Date(sixMonthsAgo);
  for (let i = 0; i < 6; i++) {
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.push({ date: k, orders: mMap.get(k)?.orders || 0, sales: mMap.get(k)?.sales || 0 });
    d.setMonth(d.getMonth() + 1);
  }

  res.json({
    success: true,
    data: {
      ordersByStatus: Object.fromEntries(ordersByStatus.map((s) => [s._id, s.n])),
      monthly: months,
      byCategory,
      topSellers,
      usersByRole: Object.fromEntries(usersByRole.map((s) => [s._id, s.n])),
      payments: payments.map((p) => ({ method: p._id.method, status: p._id.status, count: p.n, amount: p.amount }))
    }
  });
});
