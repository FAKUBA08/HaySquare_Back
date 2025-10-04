const express = require("express");
const router = express.Router();
const HayMes = require("../models/HayMes");

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
    const newMessage = new HayMes({ userId, sender, message });
    await newMessage.save();

    res.status(201).json(newMessage); // ✅ Send response first

    // Emit via socket (won't affect response)
    const io = req.app.get("io");
    if (io) {
      if (sender === "admin") {
        io.to(userId).emit("receive_message", { userId, message });
      } else {
        io.to("admins").emit("receive_message", { userId, message });
      }
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
