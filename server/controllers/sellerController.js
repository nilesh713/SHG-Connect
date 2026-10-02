const Product = require('../models/Product');
const User = require('../models/User');
const SellerProfile = require('../models/SellerProfile');
const Order = require('../models/Order');
const Promotion = require('../models/Promotion');
const { asyncHandler, AppError, resolveDateRange } = require('../utils/helpers');
const { decorate } = require('./orderController');
const { addComputed, withSellerInfo } = require('./productController');
const { expirePromotions } = require('../services/promotionService');

const DAY = 24 * 60 * 60 * 1000;
// Day buckets are in Indian Standard Time to match the $dateToString timezone below
const IST_OFFSET = 330 * 60 * 1000;
const dayKey = (d) => new Date(new Date(d).getTime() + IST_OFFSET).toISOString().slice(0, 10);

// Public seller fields only – no email, phone (unless WhatsApp enabled) or UPI ID
function publicSeller(user, profile) {
  return {
    _id: user._id,
    name: user.name,
    profileImage: user.profileImage || '',
    businessName: profile?.businessName || user.name,
    sellerType: profile?.sellerType || user.role,
    description: profile?.description || '',
    location: profile?.location || user.location || '',
    categories: profile?.categories || [],
    deliveryOptions: profile?.deliveryOptions || [],
    rating: profile?.rating || 0,
    ratingCount: profile?.ratingCount || 0,
    featured: Boolean(profile?.featured),
    whatsapp: profile?.whatsappEnabled ? `91${user.phone}` : '',
    memberSince: user.createdAt
  };
}

// GET /api/sellers?featured=true – "Featured Artisans"
exports.getSellers = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.featured === 'true') filter.featured = true;
  const limit = Math.min(24, parseInt(req.query.limit, 10) || 8);
  const profiles = await SellerProfile.find(filter).sort({ featured: -1, rating: -1 }).limit(limit * 2).lean();
  const users = await User.find({ _id: { $in: profiles.map((p) => p.userId) }, isActive: true }).select('name profileImage phone role location createdAt').lean();
  const userMap = new Map(users.map((u) => [String(u._id), u]));

  const counts = await Product.aggregate([
    { $match: { sellerId: { $in: users.map((u) => u._id) }, status: 'approved' } },
    { $group: { _id: '$sellerId', n: { $sum: 1 } } }
  ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c.n]));

  const data = profiles
    .filter((p) => userMap.has(String(p.userId)))
    .slice(0, limit)
    .map((p) => ({ ...publicSeller(userMap.get(String(p.userId)), p), productCount: countMap.get(String(p.userId)) || 0 }));
  res.json({ success: true, data });
});

// GET /api/sellers/:id – public profile + products
exports.getSeller = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).lean();
  if (!user || !user.isActive || user.role === 'customer' || user.role === 'admin') throw new AppError('Seller not found', 404);
  const profile = await SellerProfile.findOne({ userId: user._id }).lean();
  const products = await Product.find({ sellerId: user._id, status: 'approved', sellerActive: true }).sort({ createdAt: -1 }).limit(48).lean();
  res.json({ success: true, data: { seller: publicSeller(user, profile), products: (await withSellerInfo(products)).map(addComputed) } });
});

// GET /api/sellers/me/dashboard
exports.getDashboard = asyncHandler(async (req, res) => {
  await expirePromotions();
  const sellerId = req.user._id;
  const weekAgo = new Date(Date.now() - 6 * DAY);
  weekAgo.setHours(0, 0, 0, 0);

  const [productStats, orderStats, recent, topProducts, week, promos, profile] = await Promise.all([
    Product.aggregate([
      { $match: { sellerId } },
      { $group: { _id: null, total: { $sum: 1 }, live: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } }, views: { $sum: '$views' }, outOfStock: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'approved'] }, { $lte: ['$quantity', 0] }] }, 1, 0] } } } }
    ]),
    Order.aggregate([
      { $match: { sellerId } },
      { $group: { _id: '$orderStatus', n: { $sum: 1 }, amount: { $sum: '$totalAmount' } } }
    ]),
    Order.find({ sellerId }).sort({ createdAt: -1 }).limit(5).lean(),
    Product.find({ sellerId }).sort({ soldCount: -1, views: -1 }).limit(5).select('name images soldCount views price quantity status').lean(),
    Order.aggregate([
      { $match: { sellerId, createdAt: { $gte: weekAgo }, orderStatus: { $ne: 'cancelled' } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: '+05:30' } }, sales: { $sum: '$totalAmount' }, orders: { $sum: 1 } } }
    ]),
    Promotion.find({ sellerId, active: true }).populate('productId', 'name').lean(),
    SellerProfile.findOne({ userId: sellerId }).lean()
  ]);

  const by = Object.fromEntries(orderStats.map((s) => [s._id, s]));
  const sum = (keys, f = 'n') => keys.reduce((t, k) => t + (by[k]?.[f] || 0), 0);
  const activeKeys = ['new', 'confirmed', 'processing', 'ready_to_ship', 'shipped', 'out_for_delivery'];

  const weekMap = new Map(week.map((w) => [w._id, w]));
  const salesSummary = [];
  for (let i = 6; i >= 0; i--) {
    const k = dayKey(Date.now() - i * DAY);
    salesSummary.push({ date: k, sales: weekMap.get(k)?.sales || 0, orders: weekMap.get(k)?.orders || 0 });
  }

  const p = productStats[0] || { total: 0, live: 0, views: 0, outOfStock: 0 };
  res.json({
    success: true,
    data: {
      cards: {
        totalProducts: p.total,
        liveProducts: p.live,
        outOfStock: p.outOfStock,
        activeOrders: sum(activeKeys),
        newOrders: sum(['new']),
        completedOrders: sum(['delivered']),
        cancelledOrders: sum(['cancelled']),
        totalSales: sum([...activeKeys, 'delivered'], 'amount'),
        productViews: p.views
      },
      recentOrders: await decorate(recent),
      topProducts: topProducts.map((t) => ({ ...t, image: t.images?.[0] || '', images: undefined })),
      salesSummary,
      promotions: promos.map((pr) => ({
        _id: pr._id, type: pr.type, productName: pr.productId?.name || '', views: pr.views, clicks: pr.clicks, orders: pr.orders,
        daysLeft: Math.max(0, Math.ceil((new Date(pr.endDate) - Date.now()) / DAY))
      })),
      // Simple onboarding checklist for first-time sellers
      setup: {
        profile: Boolean(profile?.description),
        upi: Boolean(profile?.upiId),
        product: p.total > 0,
        published: p.live > 0
      }
    }
  });
});

// GET /api/sellers/me/sales?range=today|week|month|custom|all&from=&to=
exports.getSales = asyncHandler(async (req, res) => {
  const sellerId = req.user._id;
  const { from, to } = resolveDateRange(req.query);
  const match = { sellerId, createdAt: { $gte: from, $lte: to } };
  const notCancelled = { ...match, orderStatus: { $ne: 'cancelled' } };
  const spanDays = Math.ceil((to - from) / DAY);
  const format = spanDays > 92 ? '%Y-%m' : '%Y-%m-%d';

  const [totals, byStatus, series, topProducts, orders] = await Promise.all([
    Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          orders: { $sum: 1 },
          gross: { $sum: { $cond: [{ $ne: ['$orderStatus', 'cancelled'] }, '$totalAmount', 0] } },
          revenue: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$totalAmount', 0] } },
          completed: { $sum: { $cond: [{ $eq: ['$orderStatus', 'delivered'] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ['$orderStatus', 'cancelled'] }, 1, 0] } }
        }
      }
    ]),
    Order.aggregate([{ $match: match }, { $group: { _id: '$orderStatus', n: { $sum: 1 } } }]),
    Order.aggregate([
      { $match: notCancelled },
      { $group: { _id: { $dateToString: { format, date: '$createdAt', timezone: '+05:30' } }, sales: { $sum: '$totalAmount' }, orders: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]),
    Order.aggregate([
      { $match: notCancelled },
      { $unwind: '$items' },
      { $group: { _id: '$items.productId', name: { $first: '$items.name' }, quantity: { $sum: '$items.quantity' }, revenue: { $sum: '$items.subtotal' } } },
      { $sort: { quantity: -1 } },
      { $limit: 5 }
    ]),
    Order.find(match).sort({ createdAt: -1 }).limit(50).lean()
  ]);

  // Fill gaps so the chart shows every day (or month) in the range
  const seriesMap = new Map(series.map((s) => [s._id, s]));
  const filled = [];
  if (format === '%Y-%m') {
    const d = new Date(from.getFullYear(), from.getMonth(), 1);
    while (d <= to) {
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      filled.push({ date: k, sales: seriesMap.get(k)?.sales || 0, orders: seriesMap.get(k)?.orders || 0 });
      d.setMonth(d.getMonth() + 1);
    }
  } else {
    for (let t = new Date(from).setHours(0, 0, 0, 0); t <= to.getTime(); t += DAY) {
      const k = dayKey(t);
      filled.push({ date: k, sales: seriesMap.get(k)?.sales || 0, orders: seriesMap.get(k)?.orders || 0 });
    }
  }

  const t = totals[0] || { orders: 0, gross: 0, revenue: 0, completed: 0, cancelled: 0 };
  const itemsSold = topProducts.reduce((s, p) => s + p.quantity, 0);
  res.json({
    success: true,
    data: {
      range: { from, to },
      totals: {
        totalOrders: t.orders,
        totalSales: t.gross,
        revenue: t.revenue,
        completedOrders: t.completed,
        cancelledOrders: t.cancelled,
        averageOrderValue: t.orders - t.cancelled > 0 ? Math.round(t.gross / (t.orders - t.cancelled)) : 0
      },
      itemsSold,
      series: filled,
      byStatus: Object.fromEntries(byStatus.map((s) => [s._id, s.n])),
      topProducts,
      orders: await decorate(orders)
    }
  });
});
