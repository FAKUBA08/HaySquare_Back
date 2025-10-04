const express = require("express");
const router = express.Router();
const HayMeet = require("../models/HayMeet");

// 🗓 Create a HayMeet
router.post("/", async (req, res) => {
  try {
    const { email, topic, description, scheduledDate, duration } = req.body;

    // Basic validation
    if (!email || !topic || !description || !scheduledDate || !duration) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const meet = new HayMeet({
      email,
      topic,
      description,
      scheduledDate,
      duration,
    });

    await meet.save();
    res.status(201).json({ message: "HayMeet scheduled successfully", meet });
  } catch (err) {
    console.error("❌ Error scheduling HayMeet:", err);
    res.status(500).json({ error: "Error scheduling HayMeet" });
  }
});

// 📋 Get all HayMeets
router.get("/", async (req, res) => {
  try {
    const meets = await HayMeet.find().sort({ scheduledDate: 1 });
    res.json(meets);
  } catch (err) {
    console.error("❌ Failed to fetch HayMeets:", err);
    res.status(500).json({ error: "Failed to fetch HayMeets" });
  }
});

// 🕐 Upcoming HayMeets
router.get("/upcoming", async (req, res) => {
  try {
    const now = new Date();
    const meets = await HayMeet.find({ scheduledDate: { $gte: now } }).sort({
      scheduledDate: 1,
    });
    res.json(meets);
  } catch (err) {
    console.error("❌ Failed to fetch upcoming HayMeets:", err);
    res.status(500).json({ error: "Failed to fetch upcoming HayMeets" });
  }
});

// ✅ Done HayMeets
router.get("/done", async (req, res) => {
  try {
    const now = new Date();
    const meets = await HayMeet.find({ scheduledDate: { $lt: now } }).sort({
      scheduledDate: -1,
    });
    res.json(meets);
  } catch (err) {
    console.error("❌ Failed to fetch done HayMeets:", err);
    res.status(500).json({ error: "Failed to fetch done HayMeets" });
  }
});

// 🗑 Delete a HayMeet
router.delete("/:id", async (req, res) => {
  try {
    await HayMeet.findByIdAndDelete(req.params.id);
    res.json({ message: "HayMeet deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting HayMeet:", err);
    res.status(500).json({ error: "Error deleting HayMeet" });
  }
});

module.exports = router;
