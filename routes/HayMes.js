const express = require("express");
const router = express.Router();
const HayMes = require("../models/HayMes");
const postmark = require("postmark");

// ---------------- POSTMARK CLIENT ----------------
const POSTMARK_API_KEY = process.env.POSTMARK_API_KEY;
const EMAIL_USER = process.env.EMAIL_USER; // e.g., communication@clickalchemysolutions.com
const client = new postmark.ServerClient(POSTMARK_API_KEY);

// ---------------- GET MESSAGES ----------------
router.get("/:userId", async (req, res) => {
  try {
    const messages = await HayMes.find({ userId: req.params.userId }).sort({ createdAt: 1 });
    res.status(200).json(messages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// ---------------- CREATE MESSAGE ----------------
router.post("/", async (req, res) => {
  const { userId, sender, message } = req.body;
  try {
    // Save message to database
    const newMessage = new HayMes({ userId, sender, message });
    await newMessage.save();

    res.status(201).json(newMessage); // ✅ Send response first

    // Emit via socket
    const io = req.app.get("io");
    if (io) {
      if (sender === "admin") {
        io.to(userId).emit("receive_message", { userId, message });
      } else {
        io.to("admins").emit("receive_message", { userId, message });
      }
    }

    // ---------------- SEND POSTMARK EMAIL ----------------
    if (sender === "user") {
      await client.sendEmail({
        From: EMAIL_USER,
        To: EMAIL_USER, // Notify your support team
        Subject: `New message from user ${userId}`,
        TextBody: `User ${userId} sent a new message:\n\n${message}`,
        MessageStream: "outbound" // default stream
      });
      console.log(`✅ Postmark email sent for user ${userId}`);
    }

  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to save message" });
    }
  }
});

// ---------------- DELETE ALL MESSAGES OF A USER ----------------
router.delete("/:userId", async (req, res) => {
  try {
    await HayMes.deleteMany({ userId: req.params.userId });

    // Notify sockets
    const io = req.app.get("io");
    if (io) {
      io.to(req.params.userId).emit("messages_deleted");
      io.to("admins").emit("user_deleted", req.params.userId);
    }

    res.status(200).json({ message: "Messages deleted" });
  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to delete messages" });
    }
  }
});

module.exports = router;
