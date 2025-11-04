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
app.use(
  cors({
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "DELETE", "PUT", "PATCH"],
    credentials: true,
  })
);

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
const users = new Map(); // userId -> { socketId, active, lastMessage, typing }
let adminSocket = null;

io.on("connection", (socket) => {
  console.log("🟢 New client connected:", socket.id);

  // ---------------- USER CONNECT ----------------
  socket.on("user_connected", (userId) => {
    const existing = users.get(userId);
    users.set(userId, {
      socketId: socket.id,
      active: true,
      lastMessage: existing?.lastMessage || "",
      typing: false,
    });
    console.log(`👤 User connected: ${userId}`);
    if (adminSocket) {
      adminSocket.emit("user_list", Array.from(users.entries()).map(([id, u]) => ({
        userId: id,
        active: u.active,
        lastMessage: u.lastMessage,
        typing: u.typing,
        firstMessageSent: true,
      })));
    }
  });

  // ---------------- ADMIN CONNECT ----------------
  socket.on("admin_connected", () => {
    adminSocket = socket;
    console.log("🧑‍💼 Admin connected");
    adminSocket.emit("user_list", Array.from(users.entries()).map(([id, u]) => ({
      userId: id,
      active: u.active,
      lastMessage: u.lastMessage,
      typing: u.typing,
      firstMessageSent: true,
    })));
  });

  // ---------------- USER MESSAGE ----------------
  socket.on("user_message", (data) => {
    const { userId, message, type = "text" } = data;
    console.log(`💬 User(${userId}): ${message}`);
    const user = users.get(userId);
    if (user) {
      user.lastMessage = message;
      users.set(userId, user);
    }
    if (adminSocket) {
      adminSocket.emit("receive_message", { userId, message, sender: "user", type });
    }
  });

  // ---------------- ADMIN REPLY ----------------
  socket.on("admin_reply", (data) => {
    const { userId, message, type = "text" } = data;
    const user = users.get(userId);
    if (user) {
      io.to(user.socketId).emit("receive_message", { sender: "admin", message, type });
      user.lastMessage = message;
      users.set(userId, user);
      console.log(`🧑‍💼 Admin → ${userId}: ${message}`);
    }
  });

  // ---------------- TYPING EVENTS ----------------
  socket.on("user_typing", (userId) => {
    const user = users.get(userId);
    if (user) {
      user.typing = true;
      users.set(userId, user);
      if (adminSocket) adminSocket.emit("user_typing", userId);
      setTimeout(() => {
        user.typing = false;
        users.set(userId, user);
        if (adminSocket) adminSocket.emit("user_typing", userId);
      }, 2000);
    }
  });

  socket.on("admin_typing", (userId) => {
    const user = users.get(userId);
    if (user) {
      io.to(user.socketId).emit("admin_typing");
    }
  });

  // ---------------- DISCONNECT ----------------
  socket.on("disconnect", () => {
    console.log("🔴 Client disconnected:", socket.id);

    // Mark users as inactive rather than removing
    for (const [userId, u] of users.entries()) {
      if (u.socketId === socket.id) {
        users.set(userId, { ...u, active: false });
        console.log(`🚫 User disconnected: ${userId}`);
        if (adminSocket) {
          adminSocket.emit(
            "user_list",
            Array.from(users.entries()).map(([id, u]) => ({
              userId: id,
              active: u.active,
              lastMessage: u.lastMessage,
              typing: u.typing,
              firstMessageSent: true,
            }))
          );
        }
        break;
      }
    }

    // Admin disconnect
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
