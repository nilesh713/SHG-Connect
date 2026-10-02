const Promotion = require('../models/Promotion');
const Product = require('../models/Product');
const { asyncHandler, AppError } = require('../utils/helpers');
const { syncProductFlags, endPromotion, expirePromotions } = require('../services/promotionService');

const DAY = 24 * 60 * 60 * 1000;

// POST /api/promotions
exports.createPromotion = asyncHandler(async (req, res) => {
  const { productId, type, durationDays, discountPercent } = req.body;
  const product = await Product.findById(productId);
  if (!product) throw new AppError('Product not found', 404);
  if (String(product.sellerId) !== String(req.user._id)) throw new AppError('You can only promote your own products.', 403);
  if (product.status !== 'approved') throw new AppError('Only published (live) products can be promoted.', 400);

  if (await Promotion.exists({ productId, type, active: true, endDate: { $gt: new Date() } })) {
    throw new AppError('This product already has this promotion running. You can extend it instead.', 409);
  }

  const promo = new Promotion({
    productId,
    sellerId: req.user._id,
    type,
    startDate: new Date(),
    endDate: new Date(Date.now() + durationDays * DAY)
  });

  if (type === 'discount') {
    // Only one discount at a time – stop any running discount first
    const running = await Promotion.findOne({ productId, type: 'discount', active: true });
    if (running) await endPromotion(running);
    const fresh = await Product.findById(productId).select('discountPercent');
    promo.previousDiscount = fresh.discountPercent || 0;
    promo.discountPercent = discountPercent;
    await Product.updateOne({ _id: productId }, { discountPercent });
  }

  await promo.save();
  await syncProductFlags(productId);

  const labels = { promoted: 'Product is now promoted', featured: 'Product is now featured', discount: `${discountPercent}% discount is live` };
  res.status(201).json({ success: true, message: labels[type], data: promo });
});

// GET /api/promotions – seller's promotions (admin: all)
exports.getPromotions = asyncHandler(async (req, res) => {
  await expirePromotions();
  const filter = req.user.role === 'admin' ? {} : { sellerId: req.user._id };
  if (req.query.active === 'true') filter.active = true;
  const promos = await Promotion.find(filter).sort({ active: -1, createdAt: -1 }).limit(200)
    .populate('productId', 'name images price discountPercent views soldCount').lean();
  res.json({
    success: true,
    data: promos.map((p) => ({
      ...p,
      product: p.productId ? { _id: p.productId._id, name: p.productId.name, image: p.productId.images?.[0] || '', price: p.productId.price, views: p.productId.views } : null,
      productId: p.productId?._id,
      daysLeft: p.active ? Math.max(0, Math.ceil((new Date(p.endDate) - Date.now()) / DAY)) : 0
    }))
  });
});

// PUT /api/promotions/:id – stop or extend
exports.updatePromotion = asyncHandler(async (req, res) => {
  const promo = await Promotion.findById(req.params.id);
  if (!promo) throw new AppError('Promotion not found', 404);
  if (String(promo.sellerId) !== String(req.user._id) && req.user.role !== 'admin') throw new AppError('You can only change your own promotions.', 403);
  if (!promo.active) throw new AppError('This promotion has already ended.', 400);

  if (req.body.action === 'stop') {
    await endPromotion(promo);
    return res.json({ success: true, message: 'Promotion stopped', data: promo });
  }
  const days = req.body.days || 7;
  promo.endDate = new Date(promo.endDate.getTime() + days * DAY);
  await promo.save();
  res.json({ success: true, message: `Promotion extended by ${days} days`, data: promo });
});
