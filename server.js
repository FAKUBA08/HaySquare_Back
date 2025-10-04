// Load environment variables
const dotenv = require("dotenv");
dotenv.config();

const http = require("http");
const mongoose = require("mongoose");
const { Server } = require("socket.io");
const app = require("./app");

// ✅ Connect MongoDB (for your existing project)
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// ✅ Create HTTP server from Express
const server = http.createServer(app);

// ✅ Setup Socket.IO
const io = new Server(server, {
  cors: {
    origin: "*", // allow all for now; can restrict later
    methods: ["GET", "POST"],
  },
});

// ---------------- SOCKET.IO LOGIC ----------------

// Store connected users and admin
const users = new Map(); // userId -> socket.id
let adminSocket = null;

// Connection event
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
