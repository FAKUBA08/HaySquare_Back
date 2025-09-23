const express = require('express');
const router = express.Router();
const Message = require('../models/HayCon');
const nodemailer = require('nodemailer');

const sendMail = async ({ name, email, subject, message }) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail', 
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: `"${name}" <${email}>`,
    to: process.env.EMAIL_USER,
    subject: subject || 'New Contact Message',
    html: `
      <h3>New message from your portfolio contact form</h3>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      ${subject ? `<p><strong>Subject:</strong> ${subject}</p>` : ''}
      <p><strong>Message:</strong><br/>${message}</p>
    `,
  };

  await transporter.sendMail(mailOptions);
};

router.post('/', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

 
    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Name, email, and message are required.' });
    }

    const newMessage = new Message({ name, email, subject, message });
    await newMessage.save();
    await sendMail({ name, email, subject, message });

    res.status(201).json({ message: 'Message sent and saved successfully!' });
  } catch (err) {
    console.error('Error handling message:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again later.' });
  }
});

module.exports = router;
