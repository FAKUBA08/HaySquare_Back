const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  lastMessage: { type: String, default: "" },
  active: { type: Boolean, default: true },
});

module.exports = mongoose.model("User", userSchema);
