const mongoose = require('mongoose');

const hayBlogSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    subcontent: { type: String },
    body: { type: String, required: true },

    // Main image
    image: {
      data: String,
      contentType: String,
    },

    screenshots: [
      {
        data: String,
        contentType: String,
      },
    ],

    customDate: { type: Date },
    languages: [String],
    liveUrl: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('HayBlog', hayBlogSchema);
