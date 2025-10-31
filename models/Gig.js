const mongoose = require('mongoose');

// Package schema for Basic, Standard, Premium
const packageSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  price: { type: Number, required: true },
});

// Main Gig schema
const gigSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required:false },

    // Main image
    image: {
      data: String,
      contentType: String,
    },

    // Optional screenshots
    screenshots: [
      {
        data: String,
        contentType: String,
      },
    ],

    // Pricing packages
    basicPackage: { type: packageSchema },
    standardPackage: { type: packageSchema },
    premiumPackage: { type: packageSchema },

    // Languages / tags
    languages: [String],

    // Live/demo URL
    liveUrl: { type: String },

    // Likes for buyers
    likes: { type: Number, default: 0 },
    likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Gig', gigSchema);
