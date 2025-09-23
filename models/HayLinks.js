const mongoose = require("mongoose");

const hayLinksSchema = new mongoose.Schema(
  {
    platform: {
      type: String,
      required: true,
      enum: ["Fiverr", "Upwork", "Freelancer"], 
    },
    url: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("HayLinks", hayLinksSchema);
