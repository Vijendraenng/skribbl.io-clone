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

// ─── CORS Configuration ───────────────────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL || "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:5173",
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.some(o => origin.startsWith(o))) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
}));
app.use(express.json());

// ─── Socket.IO ────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

const socketHandler = new SocketHandler(io);

io.on("connection", (socket) => {
  socketHandler.attach(socket);
});

// ─── REST Routes ──────────────────────────────────────────────────────────
app.use("/api", apiRoutes);

app.get("/", (req, res) => res.json({ message: "Skribbl Clone API" }));

// ─── Start ────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;

async function start() {
  // Try to init DB but don't crash if unavailable
  if (process.env.DATABASE_URL) {
    await initDatabase();
  } else {
    console.log("⚠️  DATABASE_URL not set; running without persistence");
  }

  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 Accepting connections from: ${allowedOrigins.join(", ")}`);
  });
}

start();
