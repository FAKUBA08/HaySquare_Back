const mongoose = require('mongoose');

const buyerSchema = new mongoose.Schema({
  fullName: { type: String, required: true, minlength: 2, maxlength: 100, trim: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, required: true, minlength: 8 },
  isVerified: { type: Boolean, default: false },
  resetPasswordToken: { type: String, default: null },
  resetPasswordExpire: { type: Date, default: null },
  profileImg: {
    data: { type: String, default: '' },
    contentType: { type: String, default: '' },
  },
}, { timestamps: true });

buyerSchema.index({ email: 1 });

// Fix: Use existing model if already compiled
module.exports = mongoose.models.Buyer || mongoose.model('Buyer', buyerSchema);
