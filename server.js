// ---------------- LOAD ENV ----------------
const dotenv = require("dotenv");
dotenv.config();

// ---------------- IMPORTS ----------------
const http = require("http");
const express = require("express");
const mongoose = require("mongoose");
const { Server } = require("socket.io");
const cors = require("cors");

const app = require("./app"); // your existing Express app

// ---------------- CORS ----------------
app.use(cors({
  origin: "http://localhost:5173", // frontend URL
  methods: ["GET","POST","DELETE","PUT","PATCH"],
  credentials: true,
}));

// ---------------- MONGODB CONNECTION ----------------
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// ---------------- HTTP SERVER ----------------
const server = http.createServer(app);

// ---------------- SOCKET.IO ----------------
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

// Make io accessible in routes
app.set("io", io);

// ---------------- SOCKET.IO LOGIC ----------------
const users = new Map(); // userId -> socket.id
let adminSocket = null;

io.on("connection", (socket) => {
  console.log("🟢 New client connected:", socket.id);

  // 🔹 User connects
  socket.on("user_connected", (userId) => {
    users.set(userId, socket.id);
    console.log(`👤 User connected: ${userId}`);
    if (adminSocket) {
      adminSocket.emit("user_list", Array.from(users.keys()));
    }
  });

  // 🔹 Admin connects
  socket.on("admin_connected", () => {
    adminSocket = socket;
    console.log("🧑‍💼 Admin connected");
    adminSocket.emit("user_list", Array.from(users.keys()));
  });

  // 🔹 User sends a message → send to admin
  socket.on("user_message", (data) => {
    console.log(`💬 User(${data.userId}): ${data.message}`);
    if (adminSocket) {
      adminSocket.emit("receive_message", data);
    }
  });

  // 🔹 Admin replies → send to specific user
  socket.on("admin_reply", (data) => {
    const userSocketId = users.get(data.userId);
    if (userSocketId) {
      io.to(userSocketId).emit("receive_message", {
        sender: "admin",
        message: data.message,
      });
      console.log(`🧑‍💼 Admin → ${data.userId}: ${data.message}`);
    }
  });

  // 🔹 Handle disconnect
  socket.on("disconnect", () => {
    console.log("🔴 Client disconnected:", socket.id);

    // Remove disconnected user
    for (const [userId, sockId] of users.entries()) {
      if (sockId === socket.id) {
        users.delete(userId);
        console.log(`🚫 User disconnected: ${userId}`);
        if (adminSocket) {
          adminSocket.emit("user_list", Array.from(users.keys()));
        }
        break;
      }
    }

    // Check if admin disconnected
    if (socket.id === adminSocket?.id) {
      adminSocket = null;
      console.log("❌ Admin disconnected");
    }
  });
});

// ---------------- START SERVER ----------------
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
