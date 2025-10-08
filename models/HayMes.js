const mongoose = require("mongoose");

const hayMesSchema = new mongoose.Schema(
  {
    sender: {
      type: String,
      enum: ["user", "admin"],
      required: true,
    },
    userId: {
      type: String,
      required: true,
      index: true, // Faster lookups
    },
    message: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["text", "image", "pdf", "video", "document", "zoom"],
      default: "text",
    },
    // 🆕 Optional metadata for uploaded files
    fileInfo: {
      originalName: { type: String },
      mimeType: { type: String },
      size: { type: Number }, // in bytes
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true, // Adds createdAt & updatedAt automatically
  }
);

module.exports = mongoose.model("HayMes", hayMesSchema);
