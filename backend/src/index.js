require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { initDatabase } = require("./config/database");
const apiRoutes = require("./routes/api");
const SocketHandler = require("./classes/SocketHandler");

const app = express();
const server = http.createServer(app);

// ─── CORS — handle manually so we control every response ─────────────────
app.use((req, res, next) => {
  // Allow all origins for API routes (public room listing must work cross-domain)
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
  pingTimeout: 60000,
  pingInterval: 25000,
});

const socketHandler = new SocketHandler(io);
io.on("connection", (socket) => {
  socketHandler.attach(socket);
});

// ─── REST Routes ──────────────────────────────────────────────────────────
app.use("/api", apiRoutes);
app.get("/", (req, res) =>
  res.json({ message: "Skribbl Clone API", status: "ok" }),
);

// ─── Start ────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;

async function start() {
  if (process.env.DATABASE_URL) {
    await initDatabase();
  } else {
    console.log("⚠️  No DATABASE_URL — running in-memory only");
  }
  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}

start();
