const mongoose = require("mongoose");

// Define the schema for order messages
const hayOrderMesSchema = new mongoose.Schema(
  {
    sender: {
      type: String,
      enum: ["user", "admin"],
      required: true, // must be either "user" or "admin"
    },
    userId: {
      type: String,
      required: true, // link to the user
      index: true, // for faster queries
    },
    message: {
      type: String,
      required: true, // the main message content
    },
    type: {
      type: String,
      enum: ["text","image","pdf","video","document","offer","delivery","zoom","order"],
      default: "text", // default type
    },
    fileInfo: {
      originalName: String,
      mimeType: String,
      size: Number, // useful for uploaded files
    },
    // --- Order-related fields ---
    packageType: {
      type: String,
      required: function() { return this.type === "order"; }, // required if type is "order"
    },
    shortContent: String, // optional summary of the order
    price: {
      type: Number,
      required: function() { return this.type === "order"; }, // required if type is "order"
      min: 0,
    },
    duration: {
      type: String, // could be "3 days", "1 week", etc.
      required: function() { return this.type === "order"; }, // required if type is "order"
    },
    workDone: String, // optional description of completed work
    orderId: String, // unique order identifier
    status: {
      type: String,
      enum: ["pending", "confirmed"],
      default: "pending",
    },
  },
  { timestamps: true } // automatically adds createdAt and updatedAt
);

// Export the model for use elsewhere
module.exports = mongoose.model("HayOrderMes", hayOrderMesSchema);
