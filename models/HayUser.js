const mongoose = require("mongoose");

const hayUserSchema = new mongoose.Schema({
  userId: { 
    type: String, 
    required: true, 
    unique: true, 
    trim: true
  },
  lastMessage: { type: String, default: "" },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("HayUser", hayUserSchema);
