import { io, Socket } from "socket.io-client";

const BACKEND_URL: string =
  typeof import.meta !== "undefined" &&
  (import.meta as any).env?.VITE_BACKEND_URL
    ? ((import.meta as any).env.VITE_BACKEND_URL as string).replace(/\/$/, "")
    : "http://localhost:3001";

let socket: Socket | null = null;
let keepAliveTimer: ReturnType<typeof setInterval> | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(BACKEND_URL, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      // Try WebSocket first — faster, lower latency
      transports: ["websocket", "polling"],
      // Increase timeout for Render cold starts
      timeout: 20000,
    });

    // Log transport for debugging
    socket.on("connect", () => {
      console.log(
        `✅ Socket connected via ${(socket as any).io.engine.transport.name}`,
      );
    });
    socket.on("disconnect", (reason) => {
      console.log(`❌ Socket disconnected: ${reason}`);
    });
  }
  return socket;
}

export function connectSocket(): Socket {
  const s = getSocket();
  if (!s.connected) s.connect();

  // Keep-alive ping every 20s to prevent Render free tier from sleeping mid-game
  if (!keepAliveTimer) {
    keepAliveTimer = setInterval(() => {
      if (s.connected) s.emit("ping_keep_alive");
    }, 20000);
  }

  return s;
}

export function disconnectSocket(): void {
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }
  socket?.disconnect();
}
