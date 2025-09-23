const express = require("express");
const HayLinks = require("../models/HayLinks");
const router = express.Router();
// ✅ Add new link
// Add new link
router.post("/", async (req, res) => {
  try {
    const { platform, url } = req.body;
    const newLink = new HayLinks({ platform, url });
    await newLink.save();
    res.status(201).json(newLink);
  } catch (error) {
    res.status(500).json({ message: "Error saving link", error: error.message });
  }
});


// ✅ Get all links
router.get("/", async (req, res) => {
  try {
    const links = await HayLinks.find();
    res.status(200).json(links);
  } catch (error) {
    res.status(500).json({ message: "Error fetching links", error: error.message });
  }
});

// ✅ Update a link
router.put("/:id", async (req, res) => {
  try {
    const { platform, url } = req.body;
    const updated = await HayLinks.findByIdAndUpdate(
      req.params.id,
      { platform, url },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: "Link not found" });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Error updating link", error: error.message });
  }
});

// ✅ Delete a link
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await HayLinks.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Link not found" });
    res.json({ message: "Link deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting link", error: error.message });
  }
});

module.exports = router;
