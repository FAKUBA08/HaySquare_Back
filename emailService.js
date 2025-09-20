const nodemailer = require('nodemailer');
require('dotenv').config(); 

const sendEmail = async ({ email, subject, message }) => {

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    secure: true, 
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email, 
    subject: subject, 
    text: message, 
  };

  try {

    await transporter.sendMail(mailOptions);
    console.log(`Email sent to: ${email}`); 
  } catch (error) {

    console.error('Error sending email:', error);                
    throw new Error('Email sending failed');
  }
};


module.exports = { sendEmail };
