const express = require("express");
const dotenv = require("dotenv");
const Payment = require("../models/paymentModel");
const { sendEmail } = require("../config/postmarkClient");
const axios = require("axios");

dotenv.config();
const router = express.Router();

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_API = process.env.PAYSTACK_API || "https://api.paystack.co";
const EMAIL_USER = process.env.EMAIL_USER;
const MERCHANT_NAME = process.env.MERCHANT_NAME || "ClickAlchemySolutions";

const FRONTEND_URL =
  process.env.NODE_ENV === "production"
    ? process.env.FRONTEND_URL || "https://clickalchemysolutions.com/#/"
    : `${process.env.FRONTEND_LOCAL_URL || "http://localhost:5173"}/#/`;

// -------------------- Initialize Payment --------------------
router.post("/initialize-payment", async (req, res) => {
  const { amount, fullName, email, conversionRate } = req.body;

  if (!amount || !fullName || !email || !conversionRate) {
    return res.status(400).json({ message: "amount, fullName, email, and conversionRate are required" });
  }

  try {
    const ngnAmount = Math.round(parseFloat(amount) * parseFloat(conversionRate) * 100); // in kobo

    const response = await axios.post(
      `${PAYSTACK_API}/transaction/initialize`,
      {
        email,
        amount: ngnAmount,
        currency: "NGN",
        callback_url: `${FRONTEND_URL}payment-success`,
        metadata: {
          fullName,
          merchant: MERCHANT_NAME,
          usdAmount: parseFloat(amount),
          conversionRate: parseFloat(conversionRate),
        },
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const { data } = response.data;

    console.log("✅ Payment initialized:", data.reference, "NGN amount:", ngnAmount);

    res.json({
      success: true,
      authorization_url: data.authorization_url,
      reference: data.reference,
      message: `Payment initialized in NGN (~₦${(ngnAmount / 100).toLocaleString()}) for $${amount}`,
    });
  } catch (error) {
    console.error("❌ Error initializing Paystack payment:", error.response?.data || error.message);
    res.status(500).json({
      message: "Error initializing payment",
      error: error.response?.data || error.message,
    });
  }
});

// -------------------- Verify Payment --------------------
router.get("/verify-payment/:reference", async (req, res) => {
  const { reference } = req.params;
  if (!reference) return res.status(400).json({ message: "reference is required" });

  try {
    const response = await axios.get(`${PAYSTACK_API}/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
    });

    const data = response.data.data;

    if (data.status !== "success") {
      return res.status(400).json({ message: "Payment not successful", data });
    }

    // Check if payment already exists
    const existing = await Payment.findOne({ orderId: data.reference });
    if (existing) return res.json({ success: true, payment: existing, merchantName: MERCHANT_NAME });

    const payment = await Payment.create({
      userEmail: data.customer.email,
      orderId: data.reference,
      payerName: data.metadata.fullName,
      payerEmail: data.customer.email,
      amount: data.amount / 100,              // NGN amount
      currency: data.currency,
      status: data.status,
      usdAmount: data.metadata.usdAmount,     // original USD
      conversionRate: data.metadata.conversionRate,
    });

    // Send confirmation emails
    await sendEmail(
      payment.payerEmail,
      "Payment Successful",
      `Hi ${payment.payerName}, your payment of ${payment.amount} ${payment.currency} (~$${payment.usdAmount}) was successful!`,
      EMAIL_USER
    );

    await sendEmail(
      EMAIL_USER,
      "New Purchase Received",
      `New payment from ${payment.payerName} (${payment.payerEmail}).\nAmount: ${payment.amount} ${payment.currency} (~$${payment.usdAmount})\nReference: ${payment.orderId}`,
      EMAIL_USER
    );

    console.log("✅ Payment verified:", data.reference, "NGN amount:", payment.amount);

    res.json({ success: true, payment, merchantName: MERCHANT_NAME });
  } catch (error) {
    console.error("❌ Error verifying Paystack payment:", error.response?.data || error.message);
    res.status(500).json({
      message: "Error verifying payment",
      error: error.response?.data || error.message,
    });
  }
});

module.exports = router;
