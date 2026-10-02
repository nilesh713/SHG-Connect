const User = require('../models/User');
const SellerProfile = require('../models/SellerProfile');
const { asyncHandler, AppError } = require('../utils/helpers');
const { saveImage, deleteImage } = require('../services/storage');
const { SELLER_ROLES } = require('../config/constants');

// GET /api/users/profile
exports.getProfile = asyncHandler(async (req, res) => {
  const sellerProfile = SELLER_ROLES.includes(req.user.role)
    ? await SellerProfile.findOne({ userId: req.user._id }).lean()
    : null;
  res.json({ success: true, data: { user: req.user.toJSON(), sellerProfile } });
});

// PUT /api/users/profile  (multipart: optional profileImage)
exports.updateProfile = asyncHandler(async (req, res) => {
  const user = req.user;
  const b = req.body;

  for (const field of ['name', 'location', 'language']) {
    if (b[field] !== undefined) user[field] = b[field];
  }

  // Changing email/phone must not collide with another account
  if (b.email && b.email !== user.email) {
    if (await User.exists({ email: b.email, _id: { $ne: user._id } })) {
      throw new AppError('Another account already uses this email.', 409, [{ field: 'email', message: 'Email already in use' }]);
    }
    user.email = b.email;
  }
  if (b.phone && b.phone !== user.phone) {
    if (await User.exists({ phone: b.phone, _id: { $ne: user._id } })) {
      throw new AppError('Another account already uses this mobile number.', 409, [{ field: 'phone', message: 'Mobile number already in use' }]);
    }
    user.phone = b.phone;
  }

  if (req.file) {
    const old = user.profileImage;
    user.profileImage = await saveImage(req.file, { folder: 'profile', maxWidth: 400 });
    await deleteImage(old);
  }
  await user.save();

  let sellerProfile = null;
  if (SELLER_ROLES.includes(user.role)) {
    sellerProfile = await SellerProfile.findOne({ userId: user._id });
    if (!sellerProfile) sellerProfile = new SellerProfile({ userId: user._id, sellerType: user.role });
    for (const field of ['businessName', 'description', 'upiId', 'categories', 'deliveryOptions', 'whatsappEnabled']) {
      if (b[field] !== undefined) sellerProfile[field] = b[field];
    }
    if (b.location !== undefined) sellerProfile.location = b.location;
    await sellerProfile.save();
    sellerProfile = sellerProfile.toJSON();
  }

  res.json({ success: true, message: 'Profile saved', data: { user: user.toJSON(), sellerProfile } });
});
