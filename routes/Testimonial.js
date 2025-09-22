const express = require("express");
const Testimonial = require("../models/Testimonial");
const router = express.Router();

// ✅ Add testimonial (with position field)
router.post("/add", async (req, res) => {
  try {
    const { name, position, message } = req.body;

    if (!name || !position || !message) {
      return res.status(400).json({ message: "Name, position, and message are required" });
    }

    const newTestimonial = new Testimonial({ name, position, message });
    await newTestimonial.save();
    
    res.status(201).json({ message: "Testimonial added successfully", newTestimonial });
  } catch (error) {
    console.error("Error adding testimonial:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ✅ Get all testimonials
router.get("/", async (req, res) => {
  try {
    const testimonials = await Testimonial.find().sort({ createdAt: -1 });
    res.status(200).json(testimonials);
  } catch (error) {
    console.error("Error fetching testimonials:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ✅ Count testimonials
router.get("/count", async (req, res) => {
  try {
    const count = await Testimonial.countDocuments();
    res.status(200).json({ total: count });
  } catch (error) {
    console.error("Error counting testimonials:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ✅ Get single testimonial
router.get("/:id", async (req, res) => {
  try {
    const testimonial = await Testimonial.findById(req.params.id);
    if (!testimonial) {
      return res.status(404).json({ message: "Testimonial not found" });
    }
    res.status(200).json(testimonial);
  } catch (error) {
    console.error("Error fetching testimonial:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ✅ Update testimonial (with position field)
router.put("/update/:id", async (req, res) => {
  try {
    const { name, position, message } = req.body;

    const updatedTestimonial = await Testimonial.findByIdAndUpdate(
      req.params.id,
      { name, position, message },
      { new: true }
    );

    if (!updatedTestimonial) {
      return res.status(404).json({ message: "Testimonial not found" });
    }

    res.status(200).json({ message: "Testimonial updated successfully", updatedTestimonial });
  } catch (error) {
    console.error("Error updating testimonial:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ✅ Delete testimonial
router.delete("/delete/:id", async (req, res) => {
  try {
    const deletedTestimonial = await Testimonial.findByIdAndDelete(req.params.id);
    if (!deletedTestimonial) {
      return res.status(404).json({ message: "Testimonial not found" });
    }

    res.status(200).json({ message: "Testimonial deleted successfully" });
  } catch (error) {
    console.error("Error deleting testimonial:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
