const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Buyer = require('../models/Buyer');
const { authenticateToken } = require('../authMiddleWare');
const { ServerClient } = require('postmark');
require('dotenv').config();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});
const upload = multer({ storage });
const router = express.Router();
const postmarkClient = new ServerClient(process.env.POSTMARK_API_KEY);

const BRAND_COLOR = '#050754';
const APP_NAME = 'Clickalchemysolutions';
const EMAIL_FOOTER = `
  <hr style="border:none;border-top:1px solid #eee;margin-top:30px;">
  <p style="font-size:13px;color:#555;">
    This is an automated message from <b>${APP_NAME}</b>.  
    If you didn’t request this, please ignore this email.
  </p>
  <p style="font-size:12px;color:#aaa;">&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
`;

// Handle URLs for local and production
const BACKEND_URL =
  process.env.NODE_ENV === 'production'
    ? process.env.BACKEND_URL
    : process.env.BACKEND_URL_LOCAL || 'http://localhost:3000/api';

const FRONTEND_URL =
  process.env.NODE_ENV === 'production'
    ? process.env.FRONTEND_URL
    : process.env.FRONTEND_URL_LOCAL || 'http://localhost:5173/#';

// ====================== BUYER SIGNUP ======================
router.post('/buyerSignup', async (req, res) => {
  const { fullName, email, password, confirmPassword } = req.body;

  if (!fullName || !email || !password || !confirmPassword)
    return res.status(400).json({ message: 'All fields are required' });

  if (password !== confirmPassword)
    return res.status(400).json({ message: 'Passwords do not match' });

  try {
    const existingBuyer = await Buyer.findOne({ email });
    if (existingBuyer)
      return res.status(400).json({ message: 'Buyer already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newBuyer = new Buyer({
      fullName,
      email,
      password: hashedPassword,
      isVerified: false,
    });

    await newBuyer.save();

    const verificationToken = jwt.sign(
      { id: newBuyer._id },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    const verifyUrl = `${BACKEND_URL}/buyers/verify?token=${verificationToken}`;

    await postmarkClient.sendEmail({
      From: process.env.EMAIL_USER,
      To: newBuyer.email,
      Subject: 'Verify Your Email - HaySquare',
      HtmlBody: `
        <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:20px;background:#f7f9fc;border-radius:8px;">
          <h2 style="color:${BRAND_COLOR};text-align:center;">Welcome to ${APP_NAME}, ${newBuyer.fullName}!</h2>
          <p style="font-size:15px;color:#333;">
            We're excited to have you. Please verify your email address to activate your account.
          </p>
          <div style="text-align:center;margin:30px 0;">
            <a href="${verifyUrl}" 
              style="background:${BRAND_COLOR};color:white;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:bold;">
              Verify My Email
            </a>
          </div>
          <p style="font-size:13px;color:#555;">This link will expire in 24 hours.</p>
          ${EMAIL_FOOTER}
        </div>
      `,
    });

    res.status(201).json({
      message: 'Buyer created successfully. Please verify your email.',
    });
  } catch (error) {
    console.error('Signup Error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// ====================== BUYER LOGIN ======================
router.post('/buyerLogin', async (req, res) => {
  const { email, password } = req.body;

  try {
    const buyer = await Buyer.findOne({ email });
    if (!buyer)
      return res.status(400).json({ message: 'Buyer not found' });

    const isMatch = await bcrypt.compare(password, buyer.password);
    if (!isMatch)
      return res.status(400).json({ message: 'Invalid credentials' });

    if (!buyer.isVerified) {
      return res.status(403).json({
        message:
          'Your account is not verified. Please verify your email or request a new link.',
      });
    }

    const token = jwt.sign({ id: buyer._id }, process.env.JWT_SECRET, {
      expiresIn: '1d',
    });

    res.status(200).json({
      message: 'Login successful',
      token,
      buyer: {
        _id: buyer._id,
        fullName: buyer.fullName,
        email: buyer.email,
        isVerified: buyer.isVerified,
        profileImg: buyer.profileImg,
      },
    });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// ====================== EMAIL VERIFICATION ======================
router.get('/verify', async (req, res) => {
  const { token } = req.query;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const buyer = await Buyer.findById(decoded.id);

    if (!buyer)
      return res.status(400).json({ message: 'Invalid token or buyer not found' });

    buyer.isVerified = true;
    await buyer.save();

    return res.redirect(
      `${FRONTEND_URL}/get-my-services?message=${encodeURIComponent(
        'Email verified successfully'
      )}`
    );
  } catch (error) {
    console.error('Verification Error:', error);
    res.status(500).json({ message: 'Server error during verification' });
  }
});

// ====================== RESEND VERIFICATION ======================
router.post('/resend-verification', async (req, res) => {
  const { email } = req.body;

  try {
    const buyer = await Buyer.findOne({ email });
    if (!buyer)
      return res.status(404).json({ message: 'Buyer not found' });

    if (buyer.isVerified)
      return res.status(400).json({ message: 'Buyer is already verified' });

    const verificationToken = jwt.sign(
      { id: buyer._id },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    const verifyUrl = `${BACKEND_URL}/buyers/verify?token=${verificationToken}`;

    await postmarkClient.sendEmail({
      From: process.env.EMAIL_USER,
      To: buyer.email,
      Subject: 'Verify Your Email Again - HaySquare',
      HtmlBody: `
        <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:20px;background:#f7f9fc;border-radius:8px;">
          <h3 style="color:${BRAND_COLOR};">Hello, ${buyer.fullName}</h3>
          <p style="font-size:15px;">Click the button below to verify your email address:</p>
          <div style="text-align:center;margin:30px 0;">
            <a href="${verifyUrl}" 
              style="background:${BRAND_COLOR};color:white;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:bold;">
              Verify Email
            </a>
          </div>
          <p style="font-size:13px;color:#555;">This link will expire in 24 hours.</p>
          ${EMAIL_FOOTER}
        </div>
      `,
    });

    res.status(200).json({ message: 'Verification email resent successfully!' });
  } catch (error) {
    console.error('Resend Verification Error:', error);
    res.status(500).json({ message: 'Error resending verification email' });
  }
});

// ====================== FORGOT PASSWORD ======================
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const buyer = await Buyer.findOne({ email });

    if (!buyer)
      return res.status(404).json({ message: 'No account found with this email.' });

    const resetToken = jwt.sign({ id: buyer._id }, process.env.JWT_SECRET, {
      expiresIn: '15m',
    });

    const resetUrl = `${FRONTEND_URL}/buyer-reset/${resetToken}`;

    await postmarkClient.sendEmail({
      From: process.env.EMAIL_USER,
      To: email,
      Subject: 'Reset Your Password - HaySquare',
      HtmlBody: `
        <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:20px;background:#f7f9fc;border-radius:8px;">
          <h2 style="color:${BRAND_COLOR};text-align:center;">Reset Your Password</h2>
          <p style="font-size:15px;color:#333;">
            We received a request to reset your password. Click below to create a new one:
          </p>
          <div style="text-align:center;margin:30px 0;">
            <a href="${resetUrl}" 
              style="background:${BRAND_COLOR};color:white;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:bold;">
              Reset Password
            </a>
          </div>
          <p style="font-size:13px;color:#555;">This link will expire in 15 minutes.</p>
          ${EMAIL_FOOTER}
        </div>
      `,
    });

    res.json({ message: 'Password reset email sent successfully.' });
  } catch (error) {
    console.error('Forgot Password Error:', error);
    res.status(500).json({ message: 'Something went wrong.' });
  }
});

// ====================== RESET PASSWORD ======================
router.post('/reset-password/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.trim() === "") {
      return res.status(400).json({ message: "New password is required." });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const buyer = await Buyer.findById(decoded.id);

    if (!buyer)
      return res.status(404).json({ message: 'Buyer not found.' });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    buyer.password = hashedPassword;
    await buyer.save();

    res.json({ message: 'Password reset successful.' });
  } catch (error) {
    console.error('Reset Password Error:', error);
    res.status(400).json({ message: 'Invalid or expired token.' });
  }
});

// ====================== VERIFY STATUS ======================
router.get('/verify-status', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: 'No token provided' });

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const buyer = await Buyer.findById(decoded.id);

    if (!buyer) return res.status(404).json({ message: 'Buyer not found' });

    res.status(200).json({ isVerified: buyer.isVerified });
  } catch (error) {
    console.error('Verify Status Error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// ====================== DASHBOARD ======================
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const buyer = await Buyer.findById(req.user.id).select('fullName email _id profileImg');

    if (!buyer)
      return res.status(404).json({ message: 'Buyer not found' });

    res.status(200).json({
      fullName: buyer.fullName,
      email: buyer.email,
      buyerId: buyer._id,
      profileImg: buyer.profileImg,
    });
  } catch (error) {
    console.error('Dashboard Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ====================== UPDATE PROFILE ======================
router.put('/update-profile', authenticateToken, upload.single('profileImg'), async (req, res) => {
  try {
    const buyer = await Buyer.findById(req.user.id);
    if (!buyer) return res.status(404).json({ message: 'Buyer not found' });

    const { fullName } = req.body;
    if (fullName) buyer.fullName = fullName;

if (req.file) {
  buyer.profileImg = {
    data: `/uploads/${req.file.filename}`, // store file path
    contentType: req.file.mimetype,        // store MIME type
  };
}

    await buyer.save();

    res.status(200).json({
      message: 'Profile updated successfully',
      buyer: {
        _id: buyer._id,
        fullName: buyer.fullName,
        email: buyer.email,
        profileImg: buyer.profileImg,
      },
    });
  } catch (error) {
    console.error('Update Profile Error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});
// PUT /buyers/change-password
router.put('/change-password', authenticateToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const buyer = await Buyer.findById(req.user.id);
  if (!buyer) return res.status(404).json({ message: 'Buyer not found' });

  const isMatch = await bcrypt.compare(currentPassword, buyer.password);
  if (!isMatch) return res.status(400).json({ message: 'Current password is incorrect' });

  buyer.password = await bcrypt.hash(newPassword, 10);
  await buyer.save();

  res.json({ message: 'Password updated successfully' });
});
// DELETE /buyers/delete-account
router.delete('/delete-account', authenticateToken, async (req, res) => {
  try {
    await Buyer.findByIdAndDelete(req.user.id);
    res.json({ message: 'Account deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to delete account' });
  }
});

module.exports = router;
