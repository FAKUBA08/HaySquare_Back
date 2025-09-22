const mongoose = require("mongoose");

const hayTesSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    position: { type: String, required: true }, // added back
    message: { type: String, required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("HayTes", hayTesSchema);
