// express-validator rule sets. Messages are written for non-technical users.
const { body, param } = require('express-validator');
const {
  REGISTRATION_ROLES, ORDER_STATUSES, PAYMENT_METHODS, PAYMENT_STATUSES, DELIVERY_OPTIONS,
  PROMOTION_TYPES, PROMOTION_DURATIONS, PRODUCT_STATUSES, REVIEW_STATUSES
} = require('../config/constants');

const phone = (field = 'phone') =>
  body(field).trim().matches(/^[6-9]\d{9}$/).withMessage('Please enter a valid 10-digit mobile number');

const mongoId = (field = 'id') => param(field).isMongoId().withMessage('Invalid ID');

// Accept either a JSON array or a comma-separated string (FormData sends strings)
const toList = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed;
  } catch (e) { /* not JSON */ }
  return value.split(',');
};

exports.register = [
  body('name').trim().isLength({ min: 2, max: 60 }).withMessage('Please enter your full name (2–60 letters)'),
  body('email').trim().isEmail().withMessage('Please enter a valid email address').normalizeEmail({ gmail_remove_dots: false }),
  phone(),
  body('password')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
    .matches(/\d/).withMessage('Password must contain at least one number'),
  body('confirmPassword').custom((v, { req }) => v === req.body.password).withMessage('Passwords do not match'),
  body('location').trim().isLength({ min: 2, max: 100 }).withMessage('Please enter your village / town / city'),
  body('role').isIn(REGISTRATION_ROLES).withMessage('Please choose a valid role')
];

exports.login = [
  body('identifier').trim().notEmpty().withMessage('Please enter your email or mobile number'),
  body('password').notEmpty().withMessage('Please enter your password')
];

exports.changePassword = [
  body('currentPassword').notEmpty().withMessage('Please enter your current password'),
  body('newPassword')
    .isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
    .matches(/\d/).withMessage('New password must contain at least one number')
];

exports.updateProfile = [
  body('name').optional().trim().isLength({ min: 2, max: 60 }).withMessage('Please enter your full name (2–60 letters)'),
  body('email').optional().trim().isEmail().withMessage('Please enter a valid email address').normalizeEmail({ gmail_remove_dots: false }),
  body('phone').optional().trim().matches(/^[6-9]\d{9}$/).withMessage('Please enter a valid 10-digit mobile number'),
  body('location').optional().trim().isLength({ max: 100 }),
  body('language').optional().isIn(['en', 'hi']),
  body('businessName').optional().trim().isLength({ max: 100 }).withMessage('Business name is too long'),
  body('description').optional().trim().isLength({ max: 1000 }).withMessage('Description is too long (max 1000 letters)'),
  body('upiId').optional().trim().matches(/^$|^[\w.-]{2,256}@[a-zA-Z]{2,64}$/).withMessage('Please enter a valid UPI ID (example: name@upi)'),
  body('categories').optional().customSanitizer(toList),
  body('deliveryOptions').optional().customSanitizer(toList)
    .custom((list) => list.every((d) => DELIVERY_OPTIONS.includes(d))).withMessage('Invalid delivery option'),
  body('whatsappEnabled').optional().toBoolean()
];

const productRules = (isUpdate) => [
  body('name').if(() => !isUpdate).exists().withMessage('Product name is required'),
  body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Product name must be 2–100 letters'),
  body('category').if(() => !isUpdate).exists().withMessage('Please choose a category'),
  body('category').optional().trim().notEmpty().withMessage('Please choose a category'),
  body('description').optional().trim().isLength({ max: 2000 }).withMessage('Description is too long (max 2000 letters)'),
  body('price').if(() => !isUpdate).exists().withMessage('Price is required'),
  body('price').optional().isFloat({ min: 1, max: 1000000 }).withMessage('Please enter a valid price (₹1 or more)').toFloat(),
  body('quantity').if(() => !isUpdate).exists().withMessage('Quantity is required'),
  body('quantity').optional().isInt({ min: 0, max: 100000 }).withMessage('Quantity cannot be negative').toInt(),
  body('discountPercent').optional({ values: 'falsy' }).isInt({ min: 0, max: 90 }).withMessage('Discount must be between 0 and 90%').toInt(),
  body('deliveryOption').optional().isIn(DELIVERY_OPTIONS).withMessage('Please choose a delivery option'),
  body('deliveryCharge').optional({ values: 'falsy' }).isFloat({ min: 0, max: 10000 }).withMessage('Delivery charge must be between ₹0 and ₹10,000').toFloat(),
  body('location').optional().trim().isLength({ max: 100 }),
  body('tags').optional().customSanitizer((v) => toList(v).map((t) => String(t).trim().toLowerCase()).filter(Boolean).slice(0, 10)),
  body('keepImages').optional().customSanitizer(toList),
  body('action').optional().isIn(['draft', 'publish']).withMessage('Invalid action')
];
exports.createProduct = productRules(false);
exports.updateProduct = [mongoId(), ...productRules(true)];

exports.createOrder = [
  body('items').isArray({ min: 1, max: 30 }).withMessage('Your cart is empty'),
  body('items.*.productId').isMongoId().withMessage('Invalid product in cart'),
  body('items.*.quantity').isInt({ min: 1, max: 100 }).withMessage('Quantity must be between 1 and 100').toInt(),
  body('paymentMethod').isIn(PAYMENT_METHODS).withMessage('Please choose Cash on Delivery or UPI'),
  body('shippingAddress.fullName').trim().isLength({ min: 2, max: 60 }).withMessage('Please enter the receiver name'),
  phone('shippingAddress.phone'),
  body('shippingAddress.addressLine').trim().isLength({ min: 5, max: 200 }).withMessage('Please enter the full address'),
  body('shippingAddress.city').trim().isLength({ min: 2, max: 60 }).withMessage('Please enter the city / village'),
  body('shippingAddress.state').trim().isLength({ min: 2, max: 60 }).withMessage('Please enter the state'),
  body('shippingAddress.pincode').trim().matches(/^[1-9]\d{5}$/).withMessage('Please enter a valid 6-digit PIN code'),
  body('customerNote').optional().trim().isLength({ max: 300 })
];

exports.updateOrderStatus = [
  mongoId(),
  body('status').isIn(ORDER_STATUSES).withMessage('Invalid order status'),
  body('note').optional().trim().isLength({ max: 200 }),
  body('deliveryPartner').optional().trim().isLength({ max: 60 }),
  body('trackingId').optional().trim().isLength({ max: 60 }),
  body('expectedDate').optional({ values: 'falsy' }).isISO8601().withMessage('Invalid expected delivery date')
];

exports.updatePayment = [
  mongoId(),
  body('paymentStatus').isIn(PAYMENT_STATUSES).withMessage('Invalid payment status')
];

exports.paymentReference = [
  mongoId(),
  body('reference').trim().matches(/^[A-Za-z0-9]{6,30}$/).withMessage('Please enter the UPI transaction ID / UTR shown in your UPI app (6–30 letters or numbers)')
];

exports.createReview = [
  body('productId').isMongoId().withMessage('Invalid product'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Please choose a rating from 1 to 5 stars').toInt(),
  body('comment').optional().trim().isLength({ max: 1000 }).withMessage('Review is too long (max 1000 letters)')
];

exports.reportReview = [mongoId(), body('reason').optional().trim().isLength({ max: 200 })];

exports.createPromotion = [
  body('productId').isMongoId().withMessage('Please choose a product'),
  body('type').isIn(PROMOTION_TYPES).withMessage('Please choose a promotion type'),
  body('durationDays').isIn(PROMOTION_DURATIONS.map(String).concat(PROMOTION_DURATIONS)).withMessage('Please choose a duration').toInt(),
  body('discountPercent').if(body('type').equals('discount'))
    .isInt({ min: 5, max: 90 }).withMessage('Discount must be between 5% and 90%').toInt()
];

exports.updatePromotion = [
  mongoId(),
  body('action').isIn(['stop', 'extend']).withMessage('Invalid action'),
  body('days').optional().isInt({ min: 1, max: 30 }).toInt()
];

exports.adminProductStatus = [
  mongoId(),
  body('status').isIn(PRODUCT_STATUSES.filter((s) => s !== 'draft')).withMessage('Invalid product status'),
  body('reason').optional().trim().isLength({ max: 200 })
];

exports.adminFeatured = [mongoId(), body('featured').isBoolean().withMessage('featured must be true or false').toBoolean()];
exports.adminUserStatus = [mongoId(), body('isActive').isBoolean().toBoolean()];
exports.adminReviewStatus = [mongoId(), body('status').isIn(REVIEW_STATUSES).withMessage('Invalid review status')];
exports.adminSellerFeatured = [mongoId(), body('featured').isBoolean().toBoolean()];

exports.category = [
  body('name').trim().isLength({ min: 2, max: 50 }).withMessage('Category name must be 2–50 letters'),
  body('nameHi').optional().trim().isLength({ max: 50 }),
  body('icon').optional().trim().matches(/^[a-z0-9-]{1,30}$/).withMessage('Invalid icon name'),
  body('active').optional().toBoolean()
];

exports.mongoId = mongoId;
