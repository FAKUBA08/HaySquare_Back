// routes/messages.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const fs = require("fs");
const fsPromises = fs.promises;
const path = require("path");
const axios = require("axios");
const zlib = require("zlib");
const sharp = require("sharp");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const HayMes = require("../models/HayMes");

ffmpeg.setFfmpegPath(ffmpegPath);

// ---------------- ENV VARIABLES ----------------
const {
  EMAIL_USER,
  ZOOM_ACCOUNT_ID,
  ZOOM_CLIENT_ID,
  ZOOM_CLIENT_SECRET,
  FRONTEND_URL,
  NODE_ENV,
} = process.env;

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
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit
});

const validSenders = new Set(["user", "admin"]);

const makeFileUrl = (filename, req) => {
  const protocol = req.protocol;
  const host = req.get("host");
  return `${protocol}://${host}/uploads/${filename}`;
};

// ---------------- NOTIFICATIONS (WhatsApp) ----------------
// Using WhatsApp "wa.me" link format. Note: server cannot push message to a phone
// unless using WhatsApp Business API. This will construct a clickable link and attempt
// a GET request (which will return HTML). We log the URL so you can click it or forward.
const ADMIN_WHATSAPP_NUMBER = "2349025479011"; // from user (without +). Adjust if needed.

function adminLoginLink() {
  if (NODE_ENV === "production" && FRONTEND_URL) {
    return `${FRONTEND_URL.replace(/\/$/, "")}/adminlogin`;
  }
  return "http://localhost:5173/#/adminlogin";
}

async function notifyAdminViaWhatsApp(userId, previewText) {
  try {
    const loginUrl = adminLoginLink();
    const text = `🟢 New Chat Message
From: ${userId}
${previewText}

Admin login: ${loginUrl}`;

    const encoded = encodeURIComponent(text);
    const waUrl = `https://wa.me/${ADMIN_WHATSAPP_NUMBER}?text=${encoded}`;

    // Log the link (useful in server logs)
    console.log("🔔 WhatsApp notification link:", waUrl);

    // Try to call the wa.me URL (this will not send a WhatsApp message from server
    // to the phone — it's a convenience attempt and will return HTML). If you want
    // real programmatic delivery, integrate WhatsApp Business API.
    await axios.get(waUrl, { timeout: 5000 }).catch((err) => {
      // non-fatal: log and continue
      console.warn("wa.me request notice (non-fatal):", err.message || err.toString());
    });

    return waUrl;
  } catch (err) {
    console.error("notifyAdminViaWhatsApp error:", err);
    return null;
  }
}

// ---------------- VALIDATION ----------------
async function basicValidateMessage(req, res, next) {
  const { userId, sender } = req.body;
  if (!userId || typeof userId !== "string") {
    return res.status(400).json({ error: "Invalid userId" });
  }
  req.body.sender = validSenders.has(sender) ? sender : "user";
  next();
}

// ---------------- FILE COMPRESSION ----------------
async function compressFile(filePath, mimetype) {
  const ext = path.extname(filePath);
  const compressedPath = filePath.replace(ext, `_compressed${ext}`);
  const stats = await fsPromises.stat(filePath);

  if (stats.size <= 1024 * 1024) {
    // No need to compress if <= 1MB
    return filePath;
  }

  console.log(`🌀 Compressing ${mimetype} file: ${path.basename(filePath)}`);

  // --- Image compression ---
  if (mimetype.startsWith("image")) {
    // convert to jpeg compressed as default; if original is png/gif you'll get jpeg
    await sharp(filePath)
      .resize({ width: 1280, withoutEnlargement: true })
      .jpeg({ quality: 70 })
      .toFile(compressedPath);
  }

  // --- Video compression ---
  else if (mimetype.startsWith("video")) {
    await new Promise((resolve, reject) => {
      ffmpeg(filePath)
        .outputOptions(["-vcodec libx264", "-crf 28", "-preset veryfast"])
        .on("end", resolve)
        .on("error", reject)
        .save(compressedPath);
    });
  }

  // --- PDF or other large docs ---
  else {
    const input = fs.createReadStream(filePath);
    const output = fs.createWriteStream(compressedPath + ".gz");
    await new Promise((resolve, reject) => {
      input
        .pipe(zlib.createGzip())
        .pipe(output)
        .on("finish", resolve)
        .on("error", reject);
    });
    return compressedPath + ".gz";
  }

  // remove original file if compressed successfully
  await fsPromises.unlink(filePath).catch(() => {});
  return compressedPath;
}

// ---------------- ROUTES ----------------

// GET all messages
router.get("/:userId", async (req, res) => {
  try {
    const messages = await HayMes.find({ userId: req.params.userId }).sort({ createdAt: 1 }).lean();
    res.json(messages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// POST text
router.post("/", basicValidateMessage, async (req, res) => {
  try {
    const { userId, sender, message } = req.body;
    if (!message) return res.status(400).json({ error: "Invalid message" });

    const newMessage = await new HayMes({ userId, sender, message, type: "text" }).save();
    res.status(201).json(newMessage);

    const io = req.app.get("io");
    if (io)
      sender === "admin"
        ? io.to(userId).emit("receive_message", newMessage)
        : io.to("admins").emit("receive_message", newMessage);

    // Notify admin via WhatsApp link instead of Postmark email (only for user messages)
    if (sender === "user") {
      // include a short preview: first 200 chars
      const preview = message.length > 200 ? `${message.slice(0, 197)}...` : message;
      notifyAdminViaWhatsApp(userId, preview).catch((e) => {
        console.error("WhatsApp notify failed:", e);
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save message" });
  }
});

// POST file upload (with compression)
router.post("/upload", upload.single("file"), basicValidateMessage, async (req, res) => {
  try {
    const { userId, sender } = req.body;
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    const compressedPath = await compressFile(file.path, file.mimetype);
    const finalName = path.basename(compressedPath);
    const fileUrl = makeFileUrl(finalName, req);

    const mimetype = file.mimetype;
    const type = mimetype.startsWith("image")
      ? "image"
      : mimetype.startsWith("video")
      ? "video"
      : mimetype === "application/pdf"
      ? "pdf"
      : "document";

    const stats = await fsPromises.stat(compressedPath).catch(() => ({ size: file.size }));
    const newMessage = await new HayMes({
      userId,
      sender,
      message: fileUrl,
      type,
      fileName: finalName,
      originalName: file.originalname,
      mimeType: mimetype,
      size: stats.size,
    }).save();

    res.status(201).json(newMessage);

    const io = req.app.get("io");
    if (io)
      sender === "admin"
        ? io.to(userId).emit("receive_message", newMessage)
        : io.to("admins").emit("receive_message", newMessage);

    // Notify admin via WhatsApp link instead of Postmark email (only for user uploads)
    if (sender === "user") {
      const preview = `Uploaded file: ${file.originalname}`;
      notifyAdminViaWhatsApp(userId, preview).catch((e) => {
        console.error("WhatsApp notify failed:", e);
      });
    }
  } catch (err) {
    console.error("❌ Compression/upload error:", err);
    res.status(500).json({ error: "File upload failed" });
  }
});

// NOTE: Removed cron cleanup — messages and files are persisted indefinitely now.

module.exports = router;
