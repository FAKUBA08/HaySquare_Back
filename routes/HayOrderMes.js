const express = require("express");
const router = express.Router();
const multer = require("multer");
const fs = require("fs");
const fsPromises = fs.promises;
const path = require("path");
const zlib = require("zlib");
const sharp = require("sharp");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const mongoose = require("mongoose");
const HayOrderMes = require("../models/HayOrderMes");

ffmpeg.setFfmpegPath(ffmpegPath);

// ---------------- FILE STORAGE ----------------
const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname) || "";
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const allowedMimes = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "application/pdf",
  "video/mp4",
  "video/quicktime",
  "text/plain",
  "application/zip",
];

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => cb(null, allowedMimes.includes(file.mimetype)),
  limits: { fileSize: 20 * 1024 * 1024 },
});

// ---------------- HELPERS ----------------
const validSenders = new Set(["user", "admin"]);
const makeFileUrl = (filename, req) => `${req.protocol}://${req.get("host")}/uploads/${filename}`;

async function basicValidateMessage(req, res, next) {
  const { userId, sender } = req.body;
  if (!userId || typeof userId !== "string") {
    return res.status(400).json({ error: "Invalid userId" });
  }
  req.body.sender = validSenders.has(sender) ? sender : "user";
  next();
}

// ---------------- COMPRESSION ----------------
async function compressFile(filePath, mimetype) {
  const ext = path.extname(filePath);
  const compressedPath = filePath.replace(ext, `_compressed${ext}`);
  const stats = await fsPromises.stat(filePath);

  if (stats.size <= 1024 * 1024) return filePath;

  if (mimetype.startsWith("image")) {
    await sharp(filePath)
      .resize({ width: 1280, withoutEnlargement: true })
      .jpeg({ quality: 70 })
      .toFile(compressedPath);
  } else if (mimetype.startsWith("video")) {
    await new Promise((resolve, reject) => {
      ffmpeg(filePath)
        .outputOptions(["-vcodec libx264", "-crf 28", "-preset veryfast"])
        .on("end", resolve)
        .on("error", reject)
        .save(compressedPath);
    });
  } else {
    const input = fs.createReadStream(filePath);
    const output = fs.createWriteStream(compressedPath + ".gz");
    await new Promise((resolve, reject) => {
      input.pipe(zlib.createGzip()).pipe(output).on("finish", resolve).on("error", reject);
    });
    return compressedPath + ".gz";
  }

  await fsPromises.unlink(filePath).catch(() => {});
  return compressedPath;
}

// ---------------- ROUTES ----------------

// Get all messages for a user
router.get("/:userId", async (req, res) => {
  try {
    const messages = await HayOrderMes.find({ userId: req.params.userId }).sort({ createdAt: 1 }).lean();
    res.json(messages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// Post text message
router.post("/", basicValidateMessage, async (req, res) => {
  try {
    const { userId, sender, message, type } = req.body;
    if (!message || !message.trim()) return res.status(400).json({ error: "Message cannot be empty" });

    const newMessage = await new HayOrderMes({ userId, sender, message, type: type || "text" }).save();

    // Emit admin message to user if sender is admin
    if (sender === "admin" && req.app.get("io")) {
      const io = req.app.get("io");
      io.to(userId).emit("receive_message", {
        userId,
        sender,
        message,
        type: type || "text",
        timestamp: newMessage.createdAt,
      });
    }

    res.status(201).json(newMessage);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save message" });
  }
});

// Upload files
router.post("/upload", upload.single("file"), basicValidateMessage, async (req, res) => {
  try {
    const { userId, sender } = req.body;
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    const compressedPath = await compressFile(file.path, file.mimetype);
    const fileUrl = makeFileUrl(path.basename(compressedPath), req);

    const type = file.mimetype.startsWith("image")
      ? "image"
      : file.mimetype.startsWith("video")
      ? "video"
      : file.mimetype === "application/pdf"
      ? "pdf"
      : "document";

    const newMessage = await new HayOrderMes({
      userId,
      sender,
      message: fileUrl,
      type,
      fileInfo: {
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
      },
    }).save();

    if (sender === "admin" && req.app.get("io")) {
      const io = req.app.get("io");
      io.to(userId).emit("receive_message", {
        userId,
        sender,
        message: fileUrl,
        type,
        timestamp: newMessage.createdAt,
      });
    }

    res.status(201).json(newMessage);
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "File upload failed" });
  }
});

// ---------------- OFFER ----------------
router.post("/offer", async (req, res) => {
  try {
    const { userId, packageType, shortContent, price, duration } = req.body;

    if (!userId || !packageType || !shortContent || !price || !duration) {
      return res.status(400).json({ error: "All fields are required" });
    }

    if (shortContent.split(" ").length > 12) {
      return res.status(400).json({ error: "Order details must not exceed 12 words" });
    }

    const parsedPrice = Number(price);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      return res.status(400).json({ error: "Price must be a valid number greater than 0" });
    }

    const offerId = new mongoose.Types.ObjectId();
    const newOffer = await new HayOrderMes({
      userId,
      sender: "admin",
      message: `Offer: ${shortContent}`,
      type: "offer",
      packageType,
      price: parsedPrice,
      duration,
      meta: {
        offer: {
          _id: offerId,
          title: shortContent,
          price: parsedPrice,
          duration,
          packages: {
            basic: { price: parsedPrice, deliveryTime: duration }
          }
        },
        packageKey: "basic",
        shortContent,
      }
    }).save();

    if (req.app.get("io")) {
      const io = req.app.get("io");
      io.to(userId).emit("receive_message", {
        userId,
        sender: "admin",
        message: `Offer: ${shortContent}`,
        type: "offer",
        price: parsedPrice,
        duration,
        timestamp: newOffer.createdAt,
      });
    }

    res.status(201).json(newOffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to post offer" });
  }
});

// Cancel offer
router.post("/cancelOffer", async (req, res) => {
  try {
    const { userId, offerId } = req.body;
    if (!userId || !offerId) return res.status(400).json({ error: "userId and offerId required" });

    const deleted = await HayOrderMes.deleteMany({
      userId,
      type: "offer",
      $or: [{ _id: offerId }, { "meta.offer._id": offerId }]
    });

    res.json({ success: true, deletedCount: deleted.deletedCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to cancel offer" });
  }
});

// ---------------- DELIVERY ----------------
router.post("/delivery", async (req, res) => {
  try {
    const { userId, packageType, workDone } = req.body;
    if (!userId || !packageType || !workDone) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const newDelivery = await new HayOrderMes({
      userId,
      sender: "admin",
      message: `Delivery completed: ${workDone}`,
      type: "delivery",
      packageType,
      workDone,
    }).save();

    if (req.app.get("io")) {
      const io = req.app.get("io");
      io.to(userId).emit("receive_message", {
        userId,
        sender: "admin",
        message: `Delivery completed: ${workDone}`,
        type: "delivery",
        timestamp: newDelivery.createdAt,
      });
    }

    res.status(201).json(newDelivery);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to post delivery" });
  }
});

// ---------------- ORDER MANAGEMENT ----------------
router.post("/orders", async (req, res) => {
  try {
    const { userId, orderId, message, packageType, price, duration } = req.body;
    if (!userId || !orderId || !message || !packageType || !price || !duration) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const parsedPrice = Number(price);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      return res.status(400).json({ error: "Price must be a valid number greater than 0" });
    }

    const newOrder = await new HayOrderMes({
      userId,
      sender: "admin",
      message,
      type: "order",
      orderId,
      status: "pending",
      packageType,
      price: parsedPrice,
      duration,
    }).save();

    if (req.app.get("io")) {
      const io = req.app.get("io");
      io.to(userId).emit("receive_message", {
        userId,
        sender: "admin",
        message,
        type: "order",
        price: parsedPrice,
        duration,
        timestamp: newOrder.createdAt,
      });
    }

    res.status(201).json(newOrder);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create order" });
  }
});

// Get all orders for a user
router.get("/orders/:userId", async (req, res) => {
  try {
    const orders = await HayOrderMes.find({ userId: req.params.userId, type: "order" }).sort({ createdAt: 1 });
    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// Confirm an order
router.put("/orders/:id/confirm", async (req, res) => {
  try {
    const order = await HayOrderMes.findByIdAndUpdate(
      req.params.id,
      { status: "confirmed" },
      { new: true }
    );
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to confirm order" });
  }
});

module.exports = router;
