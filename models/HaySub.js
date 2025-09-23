const mongoose = require("mongoose");

const haySubSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    source: {
      type: String,
      enum: ["Facebook", "Instagram", "Website", "Twitter", "Chrome","Fiverr","LinkedIn","Upwork","Other"], 
      default: "Website",
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("HaySub", haySubSchema);
