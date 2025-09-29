const postmark = require('postmark');
require('dotenv').config(); 

const client = new postmark.ServerClient(process.env.POSTMARK_API_KEY);

const sendEmail = async ({ email, subject, message }) => {
  try {
    await client.sendEmail({
      From: process.env.EMAIL_USER,  
      To: email,                   
      Subject: subject,
      TextBody: message,             
      HtmlBody: `<p>${message}</p>`, 
      MessageStream: "outbound",    
    });

    console.log(`Email sent to: ${email}`);
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error('Email sending failed');
  }
};

module.exports = { sendEmail };
