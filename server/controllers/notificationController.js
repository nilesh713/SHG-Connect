const Notification = require('../models/Notification');
const { asyncHandler, AppError, getPagination } = require('../utils/helpers');

// GET /api/notifications
exports.getNotifications = asyncHandler(async (req, res) => {
  const { limit, skip } = getPagination(req.query, 20, 100);
  const filter = { userId: req.user._id };
  if (req.query.unread === 'true') filter.read = false;
  const [items, unread] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Notification.countDocuments({ userId: req.user._id, read: false })
  ]);
  res.json({ success: true, data: { items, unread } });
});

// PUT /api/notifications/:id/read
exports.markRead = asyncHandler(async (req, res) => {
  const n = await Notification.findOneAndUpdate({ _id: req.params.id, userId: req.user._id }, { read: true }, { new: true });
  if (!n) throw new AppError('Notification not found', 404);
  res.json({ success: true, data: n });
});

// PUT /api/notifications/read-all
exports.markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ userId: req.user._id, read: false }, { read: true });
  res.json({ success: true, message: 'All notifications marked as read' });
});
