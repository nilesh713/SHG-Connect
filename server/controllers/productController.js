const Product = require('../models/Product');
const User = require('../models/User');
const SellerProfile = require('../models/SellerProfile');
const Category = require('../models/Category');
const Order = require('../models/Order');
const Promotion = require('../models/Promotion');
const Review = require('../models/Review');
const { asyncHandler, AppError, escapeRegex, getPagination, paginationMeta } = require('../utils/helpers');
const { saveImages, deleteImage } = require('../services/storage');
const { notify } = require('../services/notificationService');

const MAX_IMAGES = 5;
const PUBLIC_FILTER = { status: 'approved', sellerActive: true };

// Attach public seller info (never email/phone) to a list of products
async function withSellerInfo(products) {
  const ids = [...new Set(products.map((p) => String(p.sellerId?._id || p.sellerId)))];
  const [users, profiles] = await Promise.all([
    User.find({ _id: { $in: ids } }).select('name profileImage').lean(),
    SellerProfile.find({ userId: { $in: ids } }).select('userId businessName location sellerType rating ratingCount upiId').lean()
  ]);
  const userMap = new Map(users.map((u) => [String(u._id), u]));
  const profMap = new Map(profiles.map((p) => [String(p.userId), p]));
  return products.map((p) => {
    const sid = String(p.sellerId?._id || p.sellerId);
    const u = userMap.get(sid) || {};
    const prof = profMap.get(sid) || {};
    return {
      ...p,
      sellerId: sid,
      seller: {
        _id: sid,
        name: u.name || 'Seller',
        businessName: prof.businessName || u.name || 'Seller',
        location: prof.location || '',
        sellerType: prof.sellerType || '',
        profileImage: u.profileImage || '',
        acceptsUpi: Boolean(prof.upiId) // the UPI ID itself is not exposed publicly
      }
    };
  });
}

function toPlain(doc) {
  return doc.toJSON ? doc.toJSON() : doc;
}

async function assertCategory(slug) {
  if (!(await Category.exists({ slug, active: true }))) {
    throw new AppError('Please choose a valid category', 422, [{ field: 'category', message: 'Please choose a valid category' }]);
  }
}

const publishStatus = () => (process.env.PRODUCT_APPROVAL_REQUIRED === 'true' ? 'pending' : 'approved');

const SORTS = {
  newest: { createdAt: -1 },
  price_asc: { price: 1 },
  price_desc: { price: -1 },
  popular: { soldCount: -1, views: -1 },
  rating: { rating: -1, ratingCount: -1 }
};

// GET /api/products
exports.getProducts = asyncHandler(async (req, res) => {
  const { q, seller, category, location, sort, promoted, featured, sellerId, inStock } = req.query;
  const { page, limit, skip } = getPagination(req.query, 12, 48);
  const filter = { ...PUBLIC_FILTER };

  if (typeof category === 'string' && category) filter.category = category;
  if (typeof location === 'string' && location) filter.location = new RegExp(escapeRegex(location), 'i');
  if (promoted === 'true') filter.promoted = true;
  if (featured === 'true') filter.featured = true;
  if (inStock === 'true') filter.quantity = { $gt: 0 };
  if (typeof sellerId === 'string' && /^[a-f\d]{24}$/i.test(sellerId)) filter.sellerId = sellerId;

  const minPrice = parseFloat(req.query.minPrice);
  const maxPrice = parseFloat(req.query.maxPrice);
  if (!isNaN(minPrice) || !isNaN(maxPrice)) {
    filter.price = {};
    if (!isNaN(minPrice)) filter.price.$gte = minPrice;
    if (!isNaN(maxPrice)) filter.price.$lte = maxPrice;
  }

  // Seller-name search (also used when the main search text matches a seller)
  const sellerIdsFor = async (text) => {
    const rx = new RegExp(escapeRegex(text), 'i');
    const [profiles, users] = await Promise.all([
      SellerProfile.find({ businessName: rx }).select('userId').lean(),
      User.find({ name: rx, role: { $ne: 'customer' } }).select('_id').lean()
    ]);
    return [...profiles.map((p) => p.userId), ...users.map((u) => u._id)];
  };

  if (typeof seller === 'string' && seller.trim()) {
    filter.sellerId = { $in: await sellerIdsFor(seller.trim()) };
  }
  if (typeof q === 'string' && q.trim()) {
    const text = q.trim().slice(0, 60);
    const rx = new RegExp(escapeRegex(text), 'i');
    filter.$or = [{ name: rx }, { tags: rx }, { description: rx }, { sellerId: { $in: await sellerIdsFor(text) } }];
  }

  const [items, total] = await Promise.all([
    Product.find(filter).sort(SORTS[sort] || SORTS.newest).skip(skip).limit(limit).lean(),
    Product.countDocuments(filter)
  ]);

  // Count an impression for products shown in the promoted area
  if (promoted === 'true' && items.length) {
    Promotion.updateMany({ productId: { $in: items.map((p) => p._id) }, type: 'promoted', active: true }, { $inc: { views: 1 } }).catch(() => {});
  }

  const data = (await withSellerInfo(items)).map(addComputed);
  res.json({ success: true, data, pagination: paginationMeta(total, page, limit) });
});

// lean() drops virtuals, so compute them here
function addComputed(p) {
  const finalPrice = p.discountPercent ? Math.round(p.price * (1 - p.discountPercent / 100)) : p.price;
  return { ...p, finalPrice, inStock: p.quantity > 0 };
}

// GET /api/products/locations – distinct seller locations for the filter dropdown
exports.getLocations = asyncHandler(async (req, res) => {
  const locations = await Product.distinct('location', { ...PUBLIC_FILTER, location: { $ne: '' } });
  res.json({ success: true, data: locations.sort() });
});

// GET /api/products/mine – seller's own products in every status
exports.getMyProducts = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query, 20, 100);
  const filter = { sellerId: req.user._id };
  if (typeof req.query.status === 'string' && req.query.status) filter.status = req.query.status;
  if (typeof req.query.q === 'string' && req.query.q.trim()) filter.name = new RegExp(escapeRegex(req.query.q.trim()), 'i');
  const [items, total] = await Promise.all([
    Product.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
    Product.countDocuments(filter)
  ]);
  res.json({ success: true, data: items.map(addComputed), pagination: paginationMeta(total, page, limit) });
});

// GET /api/products/:id
exports.getProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id).lean();
  if (!product) throw new AppError('Product not found', 404);

  const isOwner = req.user && String(req.user._id) === String(product.sellerId);
  const isAdmin = req.user && req.user.role === 'admin';
  const isPublic = product.status === 'approved' && product.sellerActive;
  if (!isPublic && !isOwner && !isAdmin) throw new AppError('Product not found', 404);

  if (!isOwner && !isAdmin) {
    // Track views for the seller's "Product Views" and promotion statistics
    const promoInc = { views: 1 };
    const fromPromo = req.query.ref === 'promo';
    Product.updateOne({ _id: product._id }, { $inc: { views: 1 } }).catch(() => {});
    Promotion.updateMany({ productId: product._id, active: true }, { $inc: promoInc }).catch(() => {});
    if (fromPromo) {
      Promotion.updateMany({ productId: product._id, active: true, type: 'promoted' }, { $inc: { clicks: 1 } }).catch(() => {});
    }
    product.views += 1;
  }

  const [withSeller] = await withSellerInfo([product]);
  const profile = await SellerProfile.findOne({ userId: product.sellerId }).select('description whatsappEnabled').lean();
  const sellerUser = await User.findById(product.sellerId).select('phone').lean();
  withSeller.seller.description = profile?.description || '';
  // WhatsApp number is shared only if the seller allows it in Settings
  withSeller.seller.whatsapp = profile?.whatsappEnabled && sellerUser ? `91${sellerUser.phone}` : '';

  res.json({ success: true, data: addComputed(withSeller) });
});

// POST /api/products  (multipart/form-data)
exports.createProduct = asyncHandler(async (req, res) => {
  const b = req.body;
  await assertCategory(b.category);
  const action = b.action === 'draft' ? 'draft' : 'publish';
  const files = req.files || [];
  if (action === 'publish' && files.length === 0) {
    throw new AppError('Please add at least one product photo before publishing.', 422, [{ field: 'images', message: 'Add at least one photo' }]);
  }

  const profile = await SellerProfile.findOne({ userId: req.user._id }).select('location').lean();
  const images = await saveImages(files);

  const product = await Product.create({
    sellerId: req.user._id,
    name: b.name,
    category: b.category,
    description: b.description || '',
    price: b.price,
    quantity: b.quantity,
    discountPercent: b.discountPercent || 0,
    images,
    location: b.location || profile?.location || req.user.location || '',
    deliveryOption: b.deliveryOption || 'local',
    deliveryCharge: b.deliveryCharge || 0,
    tags: b.tags || [],
    status: action === 'draft' ? 'draft' : publishStatus()
  });

  const message = product.status === 'draft'
    ? 'Draft saved. You can publish it any time.'
    : product.status === 'pending'
      ? 'Product submitted. It will be visible after admin approval.'
      : 'Product published! Customers can now see it.';
  res.status(201).json({ success: true, message, data: toPlain(product) });
});

async function loadEditable(req) {
  const product = await Product.findById(req.params.id);
  if (!product) throw new AppError('Product not found', 404);
  if (String(product.sellerId) !== String(req.user._id) && req.user.role !== 'admin') {
    throw new AppError('You can only change your own products.', 403);
  }
  return product;
}

// PUT /api/products/:id  (multipart/form-data)
exports.updateProduct = asyncHandler(async (req, res) => {
  const product = await loadEditable(req);
  const b = req.body;
  if (b.category !== undefined) await assertCategory(b.category);

  for (const f of ['name', 'category', 'description', 'price', 'quantity', 'discountPercent', 'location', 'deliveryOption', 'deliveryCharge', 'tags']) {
    if (b[f] !== undefined) product[f] = b[f];
  }

  // Images: keep the ones the seller did not remove, then append new uploads
  const files = req.files || [];
  if (b.keepImages !== undefined || files.length) {
    const keep = b.keepImages !== undefined ? product.images.filter((u) => b.keepImages.includes(u)) : product.images;
    if (keep.length + files.length > MAX_IMAGES) {
      throw new AppError(`You can have up to ${MAX_IMAGES} photos per product.`, 422, [{ field: 'images', message: `Maximum ${MAX_IMAGES} photos` }]);
    }
    const removed = product.images.filter((u) => !keep.includes(u));
    product.images = [...keep, ...(await saveImages(files))];
    await Promise.all(removed.map(deleteImage));
  }

  if (b.action === 'draft') product.status = 'draft';
  if (b.action === 'publish') {
    if (!product.images.length) {
      throw new AppError('Please add at least one product photo before publishing.', 422, [{ field: 'images', message: 'Add at least one photo' }]);
    }
    // Re-publishing an approved product keeps it live; others go through the normal flow
    if (product.status !== 'approved' || req.user.role === 'admin') product.status = publishStatus();
    product.rejectionReason = '';
  }

  await product.save();
  res.json({ success: true, message: 'Product updated', data: toPlain(product) });
});

// DELETE /api/products/:id
exports.deleteProduct = asyncHandler(async (req, res) => {
  const product = await loadEditable(req);
  const openOrder = await Order.exists({
    'items.productId': product._id,
    orderStatus: { $nin: ['delivered', 'cancelled'] }
  });
  if (openOrder) {
    throw new AppError('This product has orders that are not finished yet. Complete or cancel them first, or set quantity to 0 to stop new orders.', 409);
  }
  await Promise.all([
    Promotion.deleteMany({ productId: product._id }),
    Review.deleteMany({ productId: product._id }),
    ...product.images.map(deleteImage)
  ]);
  await product.deleteOne();
  res.json({ success: true, message: 'Product deleted' });
});

// Used by the admin controller when approving / rejecting
exports.notifyProductStatus = (product, status, reason) =>
  notify(product.sellerId, {
    type: 'product_status',
    title: status === 'approved' ? 'Product approved' : 'Product not approved',
    message: status === 'approved'
      ? `"${product.name}" is now live on the marketplace.`
      : `"${product.name}" was not approved.${reason ? ' Reason: ' + reason : ''}`,
    link: '/seller-products.html',
    data: { productName: product.name, status, reason }
  });

exports.withSellerInfo = withSellerInfo;
exports.addComputed = addComputed;
