require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { initDatabase } = require("./config/database");
const apiRoutes = require("./routes/api");
const SocketHandler = require("./classes/SocketHandler");

const app = express();
const server = http.createServer(app);

// ─── CORS ─────────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(express.json());

// ─── Socket.IO ────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  // Production-tuned timeouts
  pingTimeout: 60000,
  pingInterval: 25000,
  // Allow more concurrent connections
  maxHttpBufferSize: 1e6,
  // Use websocket first, fall back to polling
  transports: ["websocket", "polling"],
});

const socketHandler = new SocketHandler(io);
io.on("connection", (socket) => {
  // Log transport type — helps debug production WebSocket issues
  console.log(`🔌 ${socket.id} connected via ${socket.conn.transport.name}`);
  socket.conn.on("upgrade", (transport) => {
    console.log(`⬆️  ${socket.id} upgraded to ${transport.name}`);
  });
  socketHandler.attach(socket);
});

// ─── REST Routes ──────────────────────────────────────────────────────────
app.use("/api", apiRoutes);
app.get("/", (req, res) =>
  res.json({ message: "Skribbl Clone API", status: "ok", ts: Date.now() }),
);
app.get("/health", (req, res) =>
  res.json({
    status: "ok",
    rooms: require("./classes/GameManager").rooms.size,
  }),
);

// ─── Start server FIRST, then init DB in background ───────────────────────
// This eliminates the cold-start delay — server accepts connections immediately
// DB connection happens async in the background
const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);

  // Init DB non-blocking — game works in-memory even if DB fails
  if (process.env.DATABASE_URL) {
    initDatabase()
      .then(() => console.log("✅ Database connected"))
      .catch((err) =>
        console.error(
          "⚠️  Database connection failed (running in-memory):",
          err.message,
        ),
      );
  } else {
    console.log("⚠️  No DATABASE_URL — running in-memory only");
  }
});

// Handle unhandled promise rejections gracefully
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});
