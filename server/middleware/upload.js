const multer = require('multer');
const mongoSanitize = require('express-mongo-sanitize');

const MAX_SIZE_MB = 5;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

// Files are kept in memory briefly, then compressed and saved by services/storage.js
const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
  if (ALLOWED.includes(file.mimetype)) return cb(null, true);
  const err = new Error('Only JPG, PNG or WebP images are allowed.');
  err.status = 400;
  cb(err);
}

const productUpload = multer({ storage, fileFilter, limits: { fileSize: MAX_SIZE_MB * 1024 * 1024, files: 5 } });
const profileUpload = multer({ storage, fileFilter, limits: { fileSize: 2 * 1024 * 1024, files: 1 } });

// Convert Multer errors into friendly JSON messages
function wrap(mw) {
  return (req, res, next) =>
    mw(req, res, (err) => {
      if (!err) {
        // Multipart fields are parsed after the global sanitizer, so clean them here too
        if (req.body) mongoSanitize.sanitize(req.body, { replaceWith: '_' });
        return next();
      }
      let message = err.message;
      if (err.code === 'LIMIT_FILE_SIZE') message = `Each image must be smaller than ${req.path.includes('profile') ? 2 : MAX_SIZE_MB} MB.`;
      if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') message = 'You can upload up to 5 images.';
      return res.status(400).json({ success: false, message, errors: [{ field: 'images', message }] });
    });
}

exports.uploadProductImages = wrap(productUpload.array('images', 5));
exports.uploadProfileImage = wrap(profileUpload.single('profileImage'));
