const express = require("express");
const HaySub = require("../models/HaySub");
const router = express.Router();

// @POST Create subscriber
router.post("/", async (req, res) => {
  try {
    const { email, source } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Check if email already exists
    const existing = await HaySub.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "Already subscribed" });
    }

    const newSub = new HaySub({ email, source });
    await newSub.save();

    res.status(201).json({
      message: "Subscribed successfully",
      subscriber: newSub,
    });
  } catch (error) {
    res.status(500).json({ message: "Error subscribing", error: error.message });
  }
});

// @GET Fetch all subscribers
router.get("/", async (req, res) => {
  try {
    const subscribers = await HaySub.find().sort({ createdAt: -1 });
    res.status(200).json(subscribers);
  } catch (error) {
    res.status(500).json({ message: "Error fetching subscribers", error: error.message });
  }
});

// @GET Count all subscribers
router.get("/count", async (req, res) => {
  try {
    const total = await HaySub.countDocuments();
    res.status(200).json({ total });
  } catch (error) {
    res.status(500).json({ message: "Error counting subscribers", error: error.message });
  }
});

// @GET Count by Source
router.get("/count", async (req, res) => {
  try {
    const { source } = req.params;
    const count = await HaySub.countDocuments({ source });
    res.status(200).json({ source, totalSubscribers: count });
  } catch (error) {
    res.status(500).json({ message: "Error counting by source", error: error.message });
  }
});

// @PUT Edit subscriber (change email or source)
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await HaySub.findByIdAndUpdate(id, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: "Subscriber not found" });

    res.status(200).json({ message: "Subscriber updated", subscriber: updated });
  } catch (error) {
    res.status(500).json({ message: "Error updating subscriber", error: error.message });
  }
});

// @DELETE Remove subscriber
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await HaySub.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: "Subscriber not found" });

    res.status(200).json({ message: "Subscriber deleted" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting subscriber", error: error.message });
  }
});

module.exports = router;
