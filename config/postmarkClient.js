const postmark = require("postmark");

const postmarkClient = new postmark.ServerClient(process.env.POSTMARK_API_KEY);

const sendEmail = async (to, subject, message) => {
  try {
    await postmarkClient.sendEmail({
      From: process.env.EMAIL_USER, 
      To: to,
      Subject: subject,
      TextBody: message,
    });

    console.log(`✅ Email sent to ${to}`);
  } catch (err) {
    console.error("❌ Postmark error:", err.message);
  }
};

module.exports = { postmarkClient, sendEmail };
