const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    userEmail: { type: String, required: true },
    orderId: { type: String, required: true, unique: true },
    payerName: { type: String, required: true },
    payerEmail: { type: String, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: "USD" },
    status: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", paymentSchema);
