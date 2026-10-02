const User = require('../models/User');
const SellerProfile = require('../models/SellerProfile');
const { signToken } = require('../middleware/auth');
const { asyncHandler, AppError } = require('../utils/helpers');
const { SELLER_ROLES } = require('../config/constants');

async function buildSession(user) {
  const sellerProfile = SELLER_ROLES.includes(user.role)
    ? await SellerProfile.findOne({ userId: user._id }).lean()
    : null;
  return { token: signToken(user), user: user.toJSON(), sellerProfile };
}

// POST /api/auth/register
exports.register = asyncHandler(async (req, res) => {
  const { name, email, phone, password, location, role } = req.body;

  const existing = await User.findOne({ $or: [{ email }, { phone }] }).select('email phone').lean();
  if (existing) {
    const field = existing.email === email ? 'email' : 'phone';
    const message = field === 'email'
      ? 'An account with this email already exists. Please login instead.'
      : 'An account with this mobile number already exists. Please login instead.';
    throw new AppError(message, 409, [{ field, message }]);
  }

  const user = await User.create({ name, email, phone, password, location, role });

  if (SELLER_ROLES.includes(role)) {
    await SellerProfile.create({
      userId: user._id,
      sellerType: role,
      businessName: name,
      location,
      deliveryOptions: ['local']
    });
  }

  res.status(201).json({ success: true, message: 'Account created successfully', data: await buildSession(user) });
});

// POST /api/auth/login  (email OR mobile number)
exports.login = asyncHandler(async (req, res) => {
  const identifier = String(req.body.identifier).trim().toLowerCase();
  const query = /^\d{10}$/.test(identifier) ? { phone: identifier } : { email: identifier };
  const user = await User.findOne(query).select('+password');

  if (!user || !(await user.comparePassword(req.body.password))) {
    throw new AppError('Wrong email/mobile number or password. Please try again.', 401);
  }
  if (!user.isActive) {
    throw new AppError('Your account has been suspended. Please contact the admin.', 403);
  }

  res.json({ success: true, message: 'Logged in successfully', data: await buildSession(user) });
});

// GET /api/auth/me
exports.me = asyncHandler(async (req, res) => {
  const session = await buildSession(req.user);
  delete session.token;
  res.json({ success: true, data: session });
});

// PUT /api/auth/change-password
exports.changePassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.comparePassword(req.body.currentPassword))) {
    throw new AppError('Your current password is not correct.', 400, [{ field: 'currentPassword', message: 'Current password is not correct' }]);
  }
  user.password = req.body.newPassword;
  await user.save();
  res.json({ success: true, message: 'Password changed successfully' });
});
