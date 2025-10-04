const router = require("express").Router();
const HayMes = require("../models/HayMes");
const HayUser = require("../models/HayUser");

// DELETE user and all messages
router.delete("/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    await HayMes.deleteMany({ userId });
    await HayUser.deleteOne({ userId });
    const io = req.app.get("io");
    if (io) {
      io.to(userId).emit("user_deleted");
      io.to("admins").emit("user_deleted", userId);
    }
    res.status(200).json({ message: "User and messages deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

module.exports = router;
