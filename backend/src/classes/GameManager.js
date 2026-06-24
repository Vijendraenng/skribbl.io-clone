const { v4: uuidv4 } = require("uuid");
const Room = require("./Room");

class GameManager {
  constructor() {
    this.rooms = new Map();       // roomCode -> Room
    this.socketToRoom = new Map(); // socketId -> roomCode
    // Track empty rooms with a grace period before deletion
    this.emptyRoomTimers = new Map(); // roomCode -> timeout

    setInterval(() => this._cleanup(), 5 * 60 * 1000);
  }

  _generateRoomCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code;
    do {
      code = Array.from({ length: 6 }, () =>
        chars[Math.floor(Math.random() * chars.length)]
      ).join("");
    } while (this.rooms.has(code));
    return code;
  }

  createRoom({ hostId, settings, io }) {
    const roomCode = this._generateRoomCode();
    const room = new Room({ roomCode, hostId, settings, io });
    this.rooms.set(roomCode, room);
    return room;
  }

  getRoom(roomCode) {
    return this.rooms.get(roomCode) || null;
  }

  getPublicRooms() {
    return Array.from(this.rooms.values())
      .filter((r) => !r.settings.isPrivate && r.status !== "finished")
      .map((r) => r.toJSON());
  }

  registerSocket(socketId, roomCode) {
    this.socketToRoom.set(socketId, roomCode);
  }

  getRoomBySocket(socketId) {
    const code = this.socketToRoom.get(socketId);
    return code ? this.getRoom(code) : null;
  }

  /**
   * Handle disconnect — mark player disconnected but keep them in room for 60s
   */
  handleDisconnect(socketId) {
    const room = this.getRoomBySocket(socketId);
    this.socketToRoom.delete(socketId);
    if (!room) return null;

    const playerId = room.markPlayerDisconnected(socketId);

    // If all players are disconnected, schedule room deletion after 60s
    const allGone = Array.from(room.players.values()).every((p) => !p.isConnected);
    if (allGone) {
      console.log(`⏳ Room ${room.roomCode} empty — closing in 60s`);
      const timer = setTimeout(() => {
        // Double-check still empty
        const stillEmpty = Array.from(room.players.values()).every((p) => !p.isConnected);
        if (stillEmpty) {
          this.rooms.delete(room.roomCode);
          this.emptyRoomTimers.delete(room.roomCode);
          console.log(`🗑️ Room ${room.roomCode} closed after grace period`);
        }
      }, 60 * 1000);
      this.emptyRoomTimers.set(room.roomCode, timer);
    }

    return { room, playerId };
  }

  /**
   * Cancel room deletion timer when a player reconnects
   */
  cancelDeletion(roomCode) {
    const timer = this.emptyRoomTimers.get(roomCode);
    if (timer) {
      clearTimeout(timer);
      this.emptyRoomTimers.delete(roomCode);
      console.log(`✅ Room ${roomCode} deletion cancelled — player reconnected`);
    }
  }

  _cleanup() {
    const now = Date.now();
    for (const [code, room] of this.rooms) {
      const age = now - room.createdAt;
      const isStale = room.status === "finished" && age > 30 * 60 * 1000;
      if (isStale) {
        this.rooms.delete(code);
        console.log(`🧹 Cleaned up stale room ${code}`);
      }
    }
  }
}

module.exports = new GameManager();