const Promotion = require('../models/Promotion');
const Product = require('../models/Product');

// Re-compute the promoted / featured / discount flags of a product from its active promotions
async function syncProductFlags(productId) {
  const [active, product] = await Promise.all([
    Promotion.find({ productId, active: true, endDate: { $gt: new Date() } }).lean(),
    Product.findById(productId).select('adminFeatured').lean()
  ]);
  if (!product) return;
  await Product.updateOne(
    { _id: productId },
    {
      promoted: active.some((p) => p.type === 'promoted'),
      featured: product.adminFeatured || active.some((p) => p.type === 'featured')
    }
  );
}

// End a promotion and undo its effects
async function endPromotion(promo) {
  promo.active = false;
  if (promo.endDate > new Date()) promo.endDate = new Date();
  await promo.save();
  if (promo.type === 'discount') {
    await Product.updateOne({ _id: promo.productId }, { discountPercent: promo.previousDiscount || 0 });
  }
  await syncProductFlags(promo.productId);
}

// Deactivate promotions whose end date has passed
async function expirePromotions() {
  const expired = await Promotion.find({ active: true, endDate: { $lte: new Date() } });
  for (const promo of expired) await endPromotion(promo);
  return expired.length;
}

function startPromotionScheduler() {
  expirePromotions().catch((e) => console.error('[promotions] expiry failed', e.message));
  setInterval(() => expirePromotions().catch(() => {}), 15 * 60 * 1000).unref();
}

module.exports = { syncProductFlags, endPromotion, expirePromotions, startPromotionScheduler };
