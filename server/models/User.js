const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLES, SELLER_ROLES } = require('../config/constants');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true, minlength: 2, maxlength: 60 },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
    },
    phone: {
      type: String,
      required: [true, 'Mobile number is required'],
      unique: true,
      trim: true,
      match: [/^[6-9]\d{9}$/, 'Please enter a valid 10-digit mobile number']
    },
    password: { type: String, required: true, minlength: 6, select: false },
    role: { type: String, enum: ROLES, default: 'customer' },
    location: { type: String, trim: true, maxlength: 100, default: '' },
    profileImage: { type: String, default: '' },
    language: { type: String, enum: ['en', 'hi'], default: 'en' },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

userSchema.index({ role: 1, createdAt: -1 });

userSchema.virtual('isSeller').get(function () {
  return SELLER_ROLES.includes(this.role);
});

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

// Never send the password hash (or internal fields) to the client
userSchema.set('toJSON', {
  virtuals: true,
  transform(doc, ret) {
    delete ret.password;
    delete ret.__v;
    delete ret.id;
    return ret;
  }
});

module.exports = mongoose.model('User', userSchema);
