// All REST API routes in one place so the API surface is easy to read.
const express = require('express');
const rateLimit = require('express-rate-limit');
const { protect, optionalAuth, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const v = require('../middleware/validators');
const { uploadProductImages, uploadProfileImage } = require('../middleware/upload');

const auth = require('../controllers/authController');
const users = require('../controllers/userController');
const products = require('../controllers/productController');
const orders = require('../controllers/orderController');
const reviews = require('../controllers/reviewController');
const promotions = require('../controllers/promotionController');
const notifications = require('../controllers/notificationController');
const sellers = require('../controllers/sellerController');
const categories = require('../controllers/categoryController');
const admin = require('../controllers/adminController');

const router = express.Router();
const seller = [protect, authorize('seller')];
const adminOnly = [protect, authorize('admin')];

// Slow down password guessing
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please wait a few minutes and try again.' }
});

// ---------- AUTH ----------
router.post('/auth/register', authLimiter, v.register, validate, auth.register);
router.post('/auth/login', authLimiter, v.login, validate, auth.login);
router.get('/auth/me', protect, auth.me);
router.put('/auth/change-password', protect, v.changePassword, validate, auth.changePassword);

// ---------- USERS ----------
router.get('/users/profile', protect, users.getProfile);
router.put('/users/profile', protect, uploadProfileImage, v.updateProfile, validate, users.updateProfile);

// ---------- CATEGORIES ----------
router.get('/categories', optionalAuth, categories.getCategories);

// ---------- PRODUCTS ----------
router.get('/products', products.getProducts);
router.get('/products/locations', products.getLocations);
router.get('/products/mine', ...seller, products.getMyProducts);
router.get('/products/:id', v.mongoId(), validate, optionalAuth, products.getProduct);
router.get('/products/:id/reviews', v.mongoId(), validate, reviews.getProductReviews);
router.post('/products', ...seller, uploadProductImages, v.createProduct, validate, products.createProduct);
router.put('/products/:id', protect, uploadProductImages, v.updateProduct, validate, products.updateProduct);
router.delete('/products/:id', protect, v.mongoId(), validate, products.deleteProduct);

// ---------- SELLERS (public profile + seller dashboard data) ----------
router.get('/sellers', sellers.getSellers);
router.get('/sellers/me/dashboard', ...seller, sellers.getDashboard);
router.get('/sellers/me/sales', ...seller, sellers.getSales);
router.get('/sellers/:id', v.mongoId(), validate, sellers.getSeller);

// ---------- ORDERS ----------
router.post('/orders', protect, v.createOrder, validate, orders.createOrder);
router.get('/orders', protect, orders.getOrders);
router.get('/orders/:id', protect, v.mongoId(), validate, orders.getOrder);
router.put('/orders/:id/status', protect, v.updateOrderStatus, validate, orders.updateOrderStatus);
router.put('/orders/:id/payment', protect, v.updatePayment, validate, orders.updatePaymentStatus);
router.post('/orders/:id/payment-reference', protect, v.paymentReference, validate, orders.submitPaymentReference);
router.get('/orders/:id/upi', protect, v.mongoId(), validate, orders.getUpiDetails);

// ---------- REVIEWS ----------
router.post('/reviews', protect, authorize('customer', 'seller'), v.createReview, validate, reviews.createReview);
router.get('/reviews/seller', ...seller, reviews.getSellerReviews);
router.get('/reviews/can-review/:productId', protect, v.mongoId('productId'), validate, reviews.canReview);
router.put('/reviews/:id/report', ...seller, v.reportReview, validate, reviews.reportReview);

// ---------- PROMOTIONS ----------
router.post('/promotions', ...seller, v.createPromotion, validate, promotions.createPromotion);
router.get('/promotions', protect, authorize('seller', 'admin'), promotions.getPromotions);
router.put('/promotions/:id', protect, authorize('seller', 'admin'), v.updatePromotion, validate, promotions.updatePromotion);

// ---------- NOTIFICATIONS ----------
router.get('/notifications', protect, notifications.getNotifications);
router.put('/notifications/read-all', protect, notifications.markAllRead);
router.put('/notifications/:id/read', protect, v.mongoId(), validate, notifications.markRead);

// ---------- ADMIN ----------
router.get('/admin/stats', ...adminOnly, admin.getStats);
router.get('/admin/reports', ...adminOnly, admin.getReports);
router.get('/admin/users', ...adminOnly, admin.getUsers);
router.put('/admin/users/:id/status', ...adminOnly, v.adminUserStatus, validate, admin.setUserStatus);
router.put('/admin/sellers/:id/featured', ...adminOnly, v.adminSellerFeatured, validate, admin.setSellerFeatured);
router.get('/admin/products', ...adminOnly, admin.getProducts);
router.put('/admin/products/:id/status', ...adminOnly, v.adminProductStatus, validate, admin.setProductStatus);
router.put('/admin/products/:id/featured', ...adminOnly, v.adminFeatured, validate, admin.setProductFeatured);
router.get('/admin/orders', ...adminOnly, admin.getOrders);
router.get('/admin/reviews', ...adminOnly, admin.getReviews);
router.put('/admin/reviews/:id/status', ...adminOnly, v.adminReviewStatus, validate, admin.setReviewStatus);
router.post('/admin/categories', ...adminOnly, v.category, validate, categories.createCategory);
router.put('/admin/categories/:id', ...adminOnly, v.mongoId(), v.category, validate, categories.updateCategory);
router.delete('/admin/categories/:id', ...adminOnly, v.mongoId(), validate, categories.deleteCategory);

// Unknown API route
router.use((req, res) => res.status(404).json({ success: false, message: 'API route not found' }));

module.exports = router;
