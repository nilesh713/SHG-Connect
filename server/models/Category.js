const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, match: /^[a-z0-9-]+$/ },
    name: { type: String, required: true, trim: true, maxlength: 50 },
    nameHi: { type: String, trim: true, maxlength: 50, default: '' },
    icon: { type: String, trim: true, default: 'package' },
    active: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Category', categorySchema);
