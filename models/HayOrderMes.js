const mongoose = require("mongoose");


const hayOrderMesSchema = new mongoose.Schema(
  {
    sender: { type: String, enum: ["user", "admin"], required: true },
    userId: { type: String, required: true, index: true },
    message: { type: String, required: true },
    type: { type: String, enum: ["text","image","pdf","video","document","offer","delivery","zoom","order"], default: "text" },
    fileInfo: { originalName: String, mimeType: String, size: Number },
    packageType: String,
    shortContent: String,
    price: Number,
    duration: String, // consider Number if needed
    workDone: String,
    orderId: String,
    status: { type: String, enum: ["pending", "confirmed"], default: "pending" },
  },
  { timestamps: true } // includes createdAt and updatedAt automatically
);


module.exports = mongoose.model("HayOrderMes", hayOrderMesSchema);
