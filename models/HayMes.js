const mongoose = require("mongoose");

const hayMesSchema = new mongoose.Schema({
  sender: { type: String, enum: ["user", "admin"], required: true },
  userId: { type: String, required: true }, // reference to user
  message: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("HayMes", hayMesSchema);
