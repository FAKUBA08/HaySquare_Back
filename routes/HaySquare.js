const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Admin = require('../models/HaySquare');
const { sendEmail } = require('../emailService');
const { authenticateToken } = require('../authMiddleWare');

const router = express.Router();


router.post('/adminSignup', async (req, res) => {
  let { firstName, lastName, email, phoneNumber, password } = req.body;

  if (!email.startsWith('*.')) {
    return res.status(400).json({ message: 'You must be an admin' });
  }

  email = email.slice(2);

  try {
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({ message: 'Admin already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newAdmin = new Admin({
      firstName,
      lastName,
      email,
      phoneNumber,
      password: hashedPassword,
      isVerified: false,
    });

    await newAdmin.save();

    const verificationToken = jwt.sign(
      { id: newAdmin._id },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    const backendUrl = process.env.BACKEND_URL;
    const subject = 'Please Verify Your Email';
    const message = `Please click the following link to verify your email: ${backendUrl}/HaySquare/verify?token=${verificationToken}`;

    await sendEmail({ email: newAdmin.email, subject, message });

    res.status(201).json({ message: 'Admin created successfully. Please verify your email.' });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'The provided email or phone number is already associated with an account.' });
    }
    console.error('Signup Error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});



router.post('/adminLogin', async (req, res) => {
  const { email, password } = req.body;

  try {
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(400).json({ message: 'Admin not found' });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: admin._id }, process.env.JWT_SECRET, { expiresIn: '1d' });

    res.status(200).json({
      message: 'Login successful',
      token,
      admin: {
        _id: admin._id,
        firstName: admin.firstName,
        lastName: admin.lastName,
        email: admin.email,
        isVerified: admin.isVerified,
      },
    });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});



// Email verification route
router.get('/verify', async (req, res) => {
  const { token } = req.query;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await Admin.findById(decoded.id);

    if (!admin) {
      return res.status(400).json({ message: 'Invalid token or admin not found' });
    }

    admin.isVerified = true;
    await admin.save();

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    return res.redirect(`${frontendUrl}/adminlogin?message=${encodeURIComponent('Email verified successfully')}`);
  } catch (error) {
    console.error('Verification Error:', error);
    res.status(500).json({ message: 'Server error during verification' });
  }
});



// Resend verification email route
router.post('/resend-verification', async (req, res) => {
  const { email } = req.body;

  try {
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    if (admin.isVerified) {
      return res.status(400).json({ message: 'Admin is already verified' });
    }

    const verificationToken = jwt.sign(
      { id: admin._id },
      process.env.JWT_SECRET,
      { expiresIn: '1d' } 
    );

    const backendUrl = process.env.BACKEND_URL;
    const subject = 'Resend Verification Email';
    const message = `Please click the following link to verify your email: ${backendUrl}/HaySquare/verify?token=${verificationToken}`;

    await sendEmail({ email: admin.email, subject, message });

    res.status(200).json({ message: 'Verification email resent successfully!' });
  } catch (error) {
    console.error('Resend Verification Error:', error);
    res.status(500).json({ message: 'Error resending verification email' });
  }
});



// Forgot password route
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  try {
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(404).json({ message: 'No admin found with that email address' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    admin.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    admin.resetPasswordExpire = Date.now() + 30 * 60 * 1000;
    await admin.save();

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetUrl = `${frontendUrl}/reset-password/${resetToken}`;
    const message = `You requested a password reset. Click the link below to reset your password:\n\n${resetUrl}`;

    await sendEmail({ email: admin.email, subject: 'Password Reset Request', message });

    res.status(200).json({ message: 'Password reset link sent to your email address' });
  } catch (error) {
    console.error('Forgot Password Error:', error);
    res.status(500).json({ message: 'Server error. Please try again later.' });
  }
});



// Reset password route
router.post('/reset-password/:resetToken', async (req, res) => {
  const { resetToken } = req.params;
  const { newPassword } = req.body;

  try {
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    const admin = await Admin.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!admin) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    admin.password = await bcrypt.hash(newPassword, 10);
    admin.resetPasswordToken = undefined;
    admin.resetPasswordExpire = undefined;

    await admin.save();

    res.status(200).json({ message: 'Password has been reset successfully' });
  } catch (error) {
    console.error('Reset Password Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});





// Dashboard route with admin details
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const admin = await Admin.findById(req.user.id).select('firstName lastName email _id');

    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    res.status(200).json({
      firstName: admin.firstName,
      lastName: admin.lastName,
      email: admin.email,
      adminId: admin._id,
    });
  } catch (error) {
    console.error('Dashboard Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
