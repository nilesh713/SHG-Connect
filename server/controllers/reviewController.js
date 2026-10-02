const mongoose = require('mongoose');
const Review = require('../models/Review');
const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const SellerProfile = require('../models/SellerProfile');
const { asyncHandler, AppError, getPagination, paginationMeta } = require('../utils/helpers');
const { notify } = require('../services/notificationService');

// Recalculate product and seller average rating from approved reviews
async function refreshRatings(productId, sellerId) {
  const [prod] = await Review.aggregate([
    { $match: { productId: new mongoose.Types.ObjectId(String(productId)), status: { $ne: 'hidden' } } },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } }
  ]);
  await Product.updateOne({ _id: productId }, { rating: prod ? Math.round(prod.avg * 10) / 10 : 0, ratingCount: prod ? prod.count : 0 });

  const [sel] = await Review.aggregate([
    { $match: { sellerId: new mongoose.Types.ObjectId(String(sellerId)), status: { $ne: 'hidden' } } },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } }
  ]);
  await SellerProfile.updateOne({ userId: sellerId }, { rating: sel ? Math.round(sel.avg * 10) / 10 : 0, ratingCount: sel ? sel.count : 0 });
}

// POST /api/reviews – only after the product was delivered to this customer
exports.createReview = asyncHandler(async (req, res) => {
  const { productId, rating, comment } = req.body;
  const product = await Product.findById(productId).select('sellerId name').lean();
  if (!product) throw new AppError('Product not found', 404);

  const order = await Order.findOne({ customerId: req.user._id, 'items.productId': productId, orderStatus: 'delivered' }).select('_id').lean();
  if (!order) throw new AppError('You can review a product only after it has been delivered to you.', 403);
  if (await Review.exists({ productId, customerId: req.user._id })) throw new AppError('You have already reviewed this product.', 409);

  const review = await Review.create({ productId, customerId: req.user._id, sellerId: product.sellerId, orderId: order._id, rating, comment });
  await refreshRatings(productId, product.sellerId);

  notify(product.sellerId, {
    type: 'new_review',
    title: 'New review',
    message: `${req.user.name} rated "${product.name}" ${rating}★.`,
    link: '/reviews.html',
    data: { productName: product.name, rating, customer: req.user.name }
  });
  res.status(201).json({ success: true, message: 'Thank you! Your review has been posted.', data: review });
});

// GET /api/products/:id/reviews – public, with average + distribution
exports.getProductReviews = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query, 10, 50);
  const productId = new mongoose.Types.ObjectId(String(req.params.id));
  const filter = { productId, status: { $ne: 'hidden' } };

  const [reviews, total, dist] = await Promise.all([
    Review.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('customerId', 'name').lean(),
    Review.countDocuments(filter),
    Review.aggregate([{ $match: filter }, { $group: { _id: '$rating', count: { $sum: 1 } } }])
  ]);

  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0;
  let count = 0;
  for (const d of dist) {
    distribution[d._id] = d.count;
    sum += d._id * d.count;
    count += d.count;
  }

  res.json({
    success: true,
    data: {
      average: count ? Math.round((sum / count) * 10) / 10 : 0,
      count,
      distribution,
      reviews: reviews.map((r) => ({
        _id: r._id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
        customerName: r.customerId?.name ? r.customerId.name.split(' ')[0] : 'Customer' // first name only
      }))
    },
    pagination: paginationMeta(total, page, limit)
  });
});

// GET /api/reviews/can-review/:productId – tells the product page whether to show the review form
exports.canReview = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const [delivered, already] = await Promise.all([
    Order.exists({ customerId: req.user._id, 'items.productId': productId, orderStatus: 'delivered' }),
    Review.exists({ customerId: req.user._id, productId })
  ]);
  res.json({ success: true, data: { canReview: Boolean(delivered) && !already, alreadyReviewed: Boolean(already) } });
});

// GET /api/reviews/seller – reviews of the logged-in seller's products
exports.getSellerReviews = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query, 20, 100);
  const filter = { sellerId: req.user._id };
  const rating = parseInt(req.query.rating, 10);
  if (rating >= 1 && rating <= 5) filter.rating = rating;

  const [reviews, total, summary] = await Promise.all([
    Review.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit)
      .populate('customerId', 'name').populate('productId', 'name images').lean(),
    Review.countDocuments(filter),
    Review.aggregate([{ $match: { sellerId: req.user._id, status: { $ne: 'hidden' } } }, { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } }])
  ]);
  res.json({
    success: true,
    data: {
      average: summary[0] ? Math.round(summary[0].avg * 10) / 10 : 0,
      count: summary[0]?.count || 0,
      reviews: reviews.map((r) => ({
        ...r,
        customerName: r.customerId?.name || 'Customer',
        product: r.productId ? { _id: r.productId._id, name: r.productId.name, image: r.productId.images?.[0] || '' } : null,
        customerId: undefined,
        productId: r.productId?._id
      }))
    },
    pagination: paginationMeta(total, page, limit)
  });
});

// PUT /api/reviews/:id/report – seller flags an inappropriate review for admin moderation
exports.reportReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) throw new AppError('Review not found', 404);
  if (String(review.sellerId) !== String(req.user._id)) throw new AppError('You can only report reviews of your own products.', 403);
  review.status = 'flagged';
  review.reportReason = req.body.reason || '';
  await review.save();

  const admins = await User.find({ role: 'admin' }).select('_id').lean();
  admins.forEach((a) => notify(a._id, { type: 'system', title: 'Review reported', message: 'A seller reported a review for moderation.', link: '/admin-dashboard.html#reviews' }));
  res.json({ success: true, message: 'Review reported. Admin will check it.', data: review });
});

exports.refreshRatings = refreshRatings;
