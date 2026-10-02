// Saves uploaded images. Images are resized + compressed to WebP when `sharp` is available.
// If Cloudinary credentials exist in .env, files go to Cloudinary; otherwise to /uploads.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let sharp = null;
try {
  sharp = require('sharp');
} catch (e) {
  console.warn('sharp not available – images will be stored without compression');
}

let cloudinary = null;
if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  try {
    cloudinary = require('cloudinary').v2;
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    });
  } catch (e) {
    console.warn('cloudinary package not installed – using local uploads');
  }
}

const UPLOAD_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

async function compress(file, maxWidth) {
  if (!sharp) return { buffer: file.buffer, ext: path.extname(file.originalname).toLowerCase() || '.jpg' };
  try {
    const buffer = await sharp(file.buffer)
      .rotate()
      .resize({ width: maxWidth, height: maxWidth, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer();
    return { buffer, ext: '.webp' };
  } catch (e) {
    const err = new Error('This image file could not be read. Please choose another photo.');
    err.status = 400;
    throw err;
  }
}

async function saveImage(file, { folder = 'products', maxWidth = 1200 } = {}) {
  const { buffer, ext } = await compress(file, maxWidth);
  if (cloudinary) {
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream({ folder: `shg-connect/${folder}`, resource_type: 'image' }, (err, res) => (err ? reject(err) : resolve(res)))
        .end(buffer);
    });
    return result.secure_url;
  }
  const name = `${folder}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
  await fs.promises.writeFile(path.join(UPLOAD_DIR, name), buffer);
  return `/uploads/${name}`;
}

async function saveImages(files = [], opts) {
  return Promise.all(files.map((f) => saveImage(f, opts)));
}

// Remove a locally stored upload (Cloudinary/demo assets are left untouched)
async function deleteImage(url) {
  if (!url || !url.startsWith('/uploads/')) return;
  const file = path.join(UPLOAD_DIR, path.basename(url));
  await fs.promises.unlink(file).catch(() => {});
}

module.exports = { saveImage, saveImages, deleteImage };
