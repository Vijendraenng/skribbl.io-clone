const express = require("express");
const router = express.Router();
const gameManager = require("../classes/GameManager");

/**
 * GET /api/rooms - List public rooms
 */
router.get("/rooms", (req, res) => {
  // Allow any origin for public room listing (needed for cross-origin Vercel -> Render)
  res.setHeader("Access-Control-Allow-Origin", "*");
  const rooms = gameManager.getPublicRooms();
  res.json({ rooms });
});

router.get("/health", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json({ status: "ok", rooms: gameManager.rooms.size, uptime: process.uptime() });
});

/**
 * GET /api/rooms/:code - Get room info
 */
router.get("/rooms/:code", (req, res) => {
  const room = gameManager.getRoom(req.params.code.toUpperCase());
  if (!room) return res.status(404).json({ error: "Room not found" });
  res.json({ room: room.toJSON() });
});



module.exports = router;