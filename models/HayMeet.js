const mongoose = require("mongoose");

const hayMeetSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
  },
  topic: {
    type: String,
    required: true,
  },
  description: {
    type: String,
  },
  scheduledDate: {
    type: Date,
    required: true,
  },
  duration: {
    type: Number,
    default: 30,
  },
  status: {
    type: String,
    enum: ["upcoming", "done"],
    default: "upcoming",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Automatically mark as "done" if date is in the past
hayMeetSchema.pre("save", function (next) {
  if (this.scheduledDate < new Date()) {
    this.status = "done";
  }
  next();
});

module.exports = mongoose.model("HayMeet", hayMeetSchema);
