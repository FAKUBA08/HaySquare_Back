const dotenv = require("dotenv");
dotenv.config();

const http = require("http");
const express = require("express");
const mongoose = require("mongoose");
const { Server } = require("socket.io");
const cors = require("cors");

const app = require("./app");

// ---------------- CORS ----------------
app.use(
  cors({
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "DELETE", "PUT", "PATCH"],
    credentials: true,
  })
);

// ---------------- MONGODB ----------------
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

io.on("connection", (socket) => {
  console.log("🟢 New client connected:", socket.id);

  // ---------------- USER CONNECT ----------------
  socket.on("user_connected", (userId) => {
    socket.join(userId); // Join a room with the userId
    users.set(userId, {
      socketId: socket.id,
      active: true,
      lastMessage: users.get(userId)?.lastMessage || "",
      typing: false,
    });
    console.log(`👤 User connected: ${userId}`);

    // Notify all admins about updated user list
    io.to("admins").emit(
      "user_list",
      Array.from(users.entries()).map(([id, u]) => ({
        userId: id,
        active: u.active,
        lastMessage: u.lastMessage,
        typing: u.typing,
        firstMessageSent: true,
      }))
    );
  });

  // ---------------- ADMIN CONNECT ----------------
  socket.on("admin_connected", () => {
    socket.join("admins"); // Admin room
    console.log("🧑‍💼 Admin connected");

    // Send current user list to this admin
    io.to(socket.id).emit(
      "user_list",
      Array.from(users.entries()).map(([id, u]) => ({
        userId: id,
        active: u.active,
        lastMessage: u.lastMessage,
        typing: u.typing,
        firstMessageSent: true,
      }))
    );
  });

  // ---------------- USER MESSAGE ----------------
  socket.on("user_message", ({ userId, message, type = "text" }) => {
    console.log(`💬 User(${userId}): ${message}`);

    const user = users.get(userId);
    if (user) {
      user.lastMessage = message;
      users.set(userId, user);
    }

    // Broadcast to all admins
    io.to("admins").emit("receive_message", {
      userId,
      message,
      sender: "user",
      type,
    });
  });

  // ---------------- ADMIN REPLY ----------------
  socket.on("admin_reply", ({ userId, message, type = "text", meta = null }) => {
    // Send message to the user's room
    io.to(userId).emit("receive_message", { sender: "admin", message, type, meta });

    // Update last message
    const user = users.get(userId);
    if (user) {
      user.lastMessage = message;
      users.set(userId, user);
    }

    console.log(`🧑‍💼 Admin → ${userId}: ${message}`);
    if (type === "offer") console.log("📦 Offer meta:", meta);
  });

  // ---------------- TYPING EVENTS ----------------
  socket.on("user_typing", (userId) => {
    const user = users.get(userId);
    if (!user) return;

    user.typing = true;
    users.set(userId, user);

    // Notify all admins
    io.to("admins").emit("user_typing", userId);

    setTimeout(() => {
      user.typing = false;
      users.set(userId, user);
      io.to("admins").emit("user_typing", userId);
    }, 2000);
  });

  socket.on("admin_typing", (userId) => {
    io.to(userId).emit("admin_typing");
  });

  // ---------------- DISCONNECT ----------------
  socket.on("disconnect", () => {
    console.log("🔴 Client disconnected:", socket.id);

    // Check if user
    for (const [userId, u] of users.entries()) {
      if (u.socketId === socket.id) {
        users.set(userId, { ...u, active: false });
        console.log(`🚫 User disconnected: ${userId}`);

        // Notify admins
        io.to("admins").emit(
          "user_list",
          Array.from(users.entries()).map(([id, u]) => ({
            userId: id,
            active: u.active,
            lastMessage: u.lastMessage,
            typing: u.typing,
            firstMessageSent: true,
          }))
        );
        break;
      }
    }

    // Admin disconnect: no extra action needed since multiple admins supported
  });
});

// ---------------- START SERVER ----------------
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
