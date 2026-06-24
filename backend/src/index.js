require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const { initDatabase } = require("./config/database");
const apiRoutes = require("./routes/api");
const SocketHandler = require("./classes/SocketHandler");

const app = express();
const server = http.createServer(app);

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

// Open CORS for REST API (public room listing needs this)
app.use("/api", cors({ origin: "*" }));

// Stricter CORS for everything else
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const allowed = [
      FRONTEND_URL,
      "http://localhost:3000",
      "http://localhost:5173",
    ];
    const ok = allowed.some(o => origin === o || origin.startsWith(o));
    callback(ok ? null : new Error("Not allowed by CORS"), ok);
  },
  credentials: true,
}));

app.use(express.json());

// ─── Socket.IO ────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 60000,
  pingInterval: 25000,
});

const socketHandler = new SocketHandler(io);
io.on("connection", (socket) => { socketHandler.attach(socket); });

// ─── REST Routes ──────────────────────────────────────────────────────────
app.use("/api", apiRoutes);
app.get("/", (req, res) => res.json({ message: "Skribbl Clone API", status: "ok" }));

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
    console.log(`🌐 Frontend: ${FRONTEND_URL}`);
  });
}

start();