import { io, Socket } from "socket.io-client";

// Safely read env — works in both Vite (import.meta.env) and plain TS
const BACKEND_URL: string =
  (typeof import.meta !== "undefined" &&
    (import.meta as any).env?.VITE_BACKEND_URL) ||
  "http://localhost:3001";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(BACKEND_URL, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
  }
  return socket;
}

export function connectSocket(): Socket {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket(): void {
  socket?.disconnect();
}
