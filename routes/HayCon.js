const express = require('express');
const router = express.Router();
const Message = require('../models/HayCon');
const postmark = require('postmark');

const client = new postmark.ServerClient(process.env.POSTMARK_API_KEY);

const sendMail = async ({ name, email, subject, message }) => {
  await client.sendEmail({
    From: process.env.EMAIL_USER,  
    To: process.env.EMAIL_USER,   
    ReplyTo: email,           
    Subject: subject || 'New Contact Message',
    HtmlBody: `
      <h3>New message from your website contact form</h3>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      ${subject ? `<p><strong>Subject:</strong> ${subject}</p>` : ''}
      <p><strong>Message:</strong><br/>${message}</p>
    `,
    TextBody: `
      New message from your website contact form
      
      Name: ${name}
      Email: ${email}
      ${subject ? `Subject: ${subject}` : ''}
      Message: ${message}
    `,
    MessageStream: "outbound",
  });
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
