const express = require("express");
const router = express.Router();
const multer = require("multer");
const fs = require("fs");
const fsPromises = fs.promises;
const path = require("path");
const cron = require("node-cron");
const axios = require("axios");
const postmark = require("postmark");
const zlib = require("zlib");
const sharp = require("sharp");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const HayMes = require("../models/HayMes");

ffmpeg.setFfmpegPath(ffmpegPath);

// ---------------- ENV VARIABLES ----------------
const {
  POSTMARK_API_KEY,
  EMAIL_USER,
  ZOOM_ACCOUNT_ID,
  ZOOM_CLIENT_ID,
  ZOOM_CLIENT_SECRET,
} = process.env;

const POSTMARK_ENABLED = Boolean(POSTMARK_API_KEY && EMAIL_USER);
const client = POSTMARK_ENABLED ? new postmark.ServerClient(POSTMARK_API_KEY) : null;

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
  "image/jpeg", "image/png", "image/gif",
  "application/pdf",
  "video/mp4", "video/quicktime",
  "text/plain", "application/zip",
];

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => cb(null, allowedMimes.includes(file.mimetype)),
  limits: { fileSize: 20 * 1024 * 1024 }, 
});


const validSenders = new Set(["user", "admin"]);

const makeFileUrl = (filename, req) => {
  const protocol = req.protocol;
  const host = req.get("host");
  return `${protocol}://${host}/uploads/${filename}`;
};

async function notifyPostmark(userId, message) {
  if (!POSTMARK_ENABLED) return;
  try {
    await client.sendEmail({
      From: EMAIL_USER,
      To: EMAIL_USER,
      Subject: `New message from ${userId}`,
      TextBody: `User ${userId} sent:\n\n${message}`,
      MessageStream: "outbound",
    });
    console.log("📧 Postmark notification sent");
  } catch (err) {
    console.error("Postmark error:", err);
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
    return filePath; // No need to compress if < 1MB
  }

  console.log(`🌀 Compressing ${mimetype} file: ${path.basename(filePath)}`);

  // --- Image compression ---
  if (mimetype.startsWith("image")) {
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
      input.pipe(zlib.createGzip()).pipe(output)
        .on("finish", resolve)
        .on("error", reject);
    });
    return compressedPath + ".gz";
  }

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

    if (sender === "user") notifyPostmark(userId, message);
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

    const newMessage = await new HayMes({
      userId,
      sender,
      message: fileUrl,
      type,
      fileName: finalName,
      originalName: file.originalname,
      mimeType: mimetype,
      size: (await fsPromises.stat(compressedPath)).size,
    }).save();

    res.status(201).json(newMessage);

    const io = req.app.get("io");
    if (io)
      sender === "admin"
        ? io.to(userId).emit("receive_message", newMessage)
        : io.to("admins").emit("receive_message", newMessage);

    if (sender === "user") notifyPostmark(userId, `Uploaded file: ${file.originalname}`);
  } catch (err) {
    console.error("❌ Compression/upload error:", err);
    res.status(500).json({ error: "File upload failed" });
  }
});

// CRON cleanup
cron.schedule("0 * * * *", async () => {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const oldMsgs = await HayMes.find({ createdAt: { $lt: cutoff } });

    for (const msg of oldMsgs) {
      if (msg.fileName) {
        try {
          await fsPromises.unlink(path.join(uploadDir, msg.fileName));
        } catch (e) {
          if (e.code !== "ENOENT") console.error(e);
        }
      }
      await HayMes.deleteOne({ _id: msg._id });
    }
    console.log("🧹 Old messages/files cleaned");
  } catch (err) {
    console.error("Cron error:", err);
  }
});

module.exports = router;
