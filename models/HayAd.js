const mongoose = require("mongoose");

const hayAdSchema = new mongoose.Schema({
  adminId: { type: String, required: true, unique: true },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("HayAd", hayAdSchema);
