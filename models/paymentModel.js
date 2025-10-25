const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    userEmail: { type: String, required: true },
    orderId: { type: String, required: true, unique: true },
    payerName: { type: String, required: true },
    payerEmail: { type: String, required: true },
    amount: { type: Number, required: true },       // Amount received in NGN
    currency: { type: String, default: "NGN" },
    status: { type: String, required: true },

    // New fields for USD reference
    usdAmount: { type: Number, required: true },    // Original USD price
    conversionRate: { type: Number, required: true }, // USD → NGN rate used
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", paymentSchema);
