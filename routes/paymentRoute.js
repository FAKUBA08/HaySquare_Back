const express = require("express");
const dotenv = require("dotenv");
const Payment = require("../models/paymentModel");
const { sendEmail } = require("../config/postmarkClient");

dotenv.config();
const router = express.Router();

// ---------------------------
// ENV + CONFIG
// ---------------------------
const PAYPAL_API = process.env.PAYPAL_API || "https://api-m.sandbox.paypal.com";
const CLIENT = process.env.PAYPAL_CLIENT_ID;
const SECRET = process.env.PAYPAL_CLIENT_SECRET;
const EMAIL_USER = process.env.EMAIL_USER;
const MERCHANT_EMAIL = process.env.PAYPAL_MERCHANT_EMAIL;
const MERCHANT_NAME = "ClickAlchemySolutions";

const FRONTEND_URL =
  process.env.NODE_ENV === "production"
    ? process.env.FRONTEND_URL || "https://clickalchemysolutions.com/#/"
    : `${process.env.FRONTEND_LOCAL_URL || "http://localhost:5173"}/#/`;

// ---------------------------
// FETCH FALLBACK
// ---------------------------
let fetchFn;
try {
  fetchFn = fetch;
} catch {
  fetchFn = require("node-fetch");
}

// ---------------------------
// TOKEN CACHING
// ---------------------------
let cachedToken = null;
let tokenExpiry = null;

async function getAccessToken() {
  const now = Date.now();
  if (cachedToken && tokenExpiry && now < tokenExpiry) return cachedToken;

  console.log("🔄 Fetching new PayPal access token...");

  const response = await fetchFn(`${PAYPAL_API}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${CLIENT}:${SECRET}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
  });

  const data = await response.json();
  if (!data.access_token) throw new Error("Failed to obtain PayPal access token");

  cachedToken = data.access_token;
  tokenExpiry = now + 9 * 60 * 1000; // 9 minutes cache
  return cachedToken;
}

// ---------------------------
// CREATE ORDER
// ---------------------------
router.post("/create-order", async (req, res) => {
  const { amount, fullName, email } = req.body;
  if (!amount || !fullName || !email)
    return res.status(400).json({ message: "Amount, fullName, and email are required" });

  const [given_name, ...rest] = fullName.trim().split(" ");
  const surname = rest.join(" ") || "Unknown";

  try {
    const formattedAmount = parseFloat(amount).toFixed(2);
    const accessToken = await getAccessToken();

    const bodyData = {
      intent: "CAPTURE",
      payer: {
        name: { given_name, surname },
        email_address: email,
      },
      purchase_units: [
        {
          amount: { currency_code: "USD", value: formattedAmount },
          description: `Payment to ${MERCHANT_NAME}`,
          payee: { email_address: MERCHANT_EMAIL },
        },
      ],
      application_context: {
        brand_name: MERCHANT_NAME,
        landing_page: "LOGIN",
        user_action: "PAY_NOW",
        return_url: `${FRONTEND_URL}payment-success`,
        cancel_url: `${FRONTEND_URL}payment-cancel`,
      },
    };

    const response = await fetchFn(`${PAYPAL_API}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(bodyData),
    });

    const data = await response.json();
    if (!data.id) return res.status(500).json({ message: "No order ID returned", data });

    const approveUrl = data.links?.find((link) => link.rel === "approve")?.href;
    if (!approveUrl) return res.status(500).json({ message: "No approve URL returned", data });

    res.json({
      orderId: data.id,
      approveUrl,
      merchantName: MERCHANT_NAME,
      message: "Order created. Redirect buyer to PayPal to approve payment.",
    });
  } catch (error) {
    console.error("❌ Error creating PayPal order:", error);
    res.status(500).json({ message: "Error creating PayPal order", error: error.message });
  }
});

// ---------------------------
// CAPTURE ORDER
// ---------------------------
router.post("/capture-order", async (req, res) => {
  const { orderId, userEmail } = req.body;
  if (!orderId || !userEmail)
    return res.status(400).json({ message: "orderId and userEmail are required" });

  try {
    const accessToken = await getAccessToken();

    const response = await fetchFn(`${PAYPAL_API}/v2/checkout/orders/${orderId}/capture`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();
    if (data.status !== "COMPLETED")
      return res.status(400).json({
        message: "Order not completed. Buyer must approve payment in PayPal first.",
        data,
      });

    const capture = data.purchase_units?.[0]?.payments?.captures?.[0];
    const payerEmail = data.payer?.email_address || userEmail;

    // ✅ Prevent duplicate order insertion
    const existing = await Payment.findOne({ orderId: data.id });
    if (existing) return res.json({ success: true, payment: existing, merchantName: MERCHANT_NAME });

    const payment = await Payment.create({
      userEmail: payerEmail,
      orderId: data.id,
      payerName: data.payer?.name?.given_name || "Unknown",
      payerEmail,
      amount: capture?.amount?.value,
      currency: capture?.amount?.currency_code || "USD",
      status: data.status,
    });

    console.log("✅ Payment saved to DB:", payment);

    // Send email notifications
    await sendEmail(
      payerEmail,
      "Payment Successful",
      `Hi ${payment.payerName}, your payment of $${payment.amount} was successful!`,
      EMAIL_USER
    );

    await sendEmail(
      EMAIL_USER,
      "New Purchase Received",
      `Hi Admin,\n\nPurchase from ${payment.payerName} (${payment.payerEmail}).\nAmount: $${payment.amount}\nOrder ID: ${payment.orderId}`,
      EMAIL_USER
    );

    res.json({ success: true, payment, merchantName: MERCHANT_NAME });
  } catch (error) {
    console.error("❌ Error capturing PayPal order:", error);
    res.status(500).json({ message: "Error capturing PayPal order", error: error.message });
  }
});

module.exports = router;
