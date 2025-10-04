// Load environment variables
const dotenv = require("dotenv");
dotenv.config();

const http = require("http");
const mongoose = require("mongoose");
const { Server } = require("socket.io");
const app = require("./app");
const User = require("./models/User");

// ---------------- MONGO DB ----------------
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// ---------------- HTTP & SOCKET.IO ----------------
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// ---------------- SOCKET.IO LOGIC ----------------

// Map of connected users: userId -> socketId
const users = new Map();
let adminSocket = null;

io.on("connection", (socket) => {
  console.log("🟢 New client connected:", socket.id);

  // ---------------- USER CONNECT ----------------
  socket.on("user_connected", async (userId) => {
    users.set(userId, socket.id);
    console.log(`👤 User connected: ${userId}`);

    // Persist user in DB
    try {
      await User.findOneAndUpdate(
        { userId },
        { active: true },
        { upsert: true }
      );
    } catch (err) {
      console.error("❌ Error saving user:", err);
    }

    if (adminSocket) {
      adminSocket.emit("user_list", await getActiveUsers());
    }
  });

  // ---------------- ADMIN CONNECT ----------------
  socket.on("admin_connected", async () => {
    adminSocket = socket;
    console.log("🧑‍💼 Admin connected");
    adminSocket.emit("user_list", await getActiveUsers());
  });

  // ---------------- USER MESSAGE ----------------
  socket.on("user_message", async (data) => {
    console.log(`💬 User(${data.userId}): ${data.message}`);

    // Update last message in DB
    try {
      await User.findOneAndUpdate(
        { userId: data.userId },
        { lastMessage: data.message }
      );
    } catch (err) {
      console.error("❌ Error updating user message:", err);
    }

    if (adminSocket) {
      adminSocket.emit("receive_message", data);
    }
  });

  // ---------------- ADMIN REPLY ----------------
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

  // ---------------- DELETE USER ----------------
  socket.on("delete_user", async (userId) => {
    try {
      // Remove from memory
      users.delete(userId);

      // Remove from DB
      await User.findOneAndDelete({ userId });
      console.log(`🗑️ User deleted: ${userId}`);

      // Notify admin
      if (adminSocket) {
        adminSocket.emit("user_list", await getActiveUsers());
      }

      // Notify the deleted user if online
      const userSocketId = users.get(userId);
      if (userSocketId) {
        io.to(userSocketId).emit("user_deleted");
      }
    } catch (err) {
      console.error("❌ Error deleting user:", err);
    }
  });

  // ---------------- DISCONNECT ----------------
  socket.on("disconnect", async () => {
    console.log("🔴 Client disconnected:", socket.id);

    for (const [userId, sockId] of users.entries()) {
      if (sockId === socket.id) {
        users.delete(userId);
        console.log(`🚫 User disconnected: ${userId}`);

        // Mark user inactive in DB
        try {
          await User.findOneAndUpdate({ userId }, { active: false });
        } catch (err) {
          console.error("❌ Error updating user status:", err);
        }

        if (adminSocket) {
          adminSocket.emit("user_list", await getActiveUsers());
        }
        break;
      }
    }

    if (socket.id === adminSocket?.id) {
      adminSocket = null;
      console.log("❌ Admin disconnected");
    }
  });
});

// ---------------- HELPER ----------------
async function getActiveUsers() {
  const usersDB = await User.find({ active: true }).select("userId lastMessage");
  return usersDB.map((u) => ({ userId: u.userId, lastMessage: u.lastMessage }));
}

// ---------------- START SERVER ----------------
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
