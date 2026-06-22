const { v4: uuidv4 } = require("uuid");
const Room = require("./Room");

/**
 * GameManager - Singleton that manages all active rooms
 */
class GameManager {
  constructor() {
    this.rooms = new Map(); // roomCode -> Room
    this.socketToRoom = new Map(); // socketId -> roomCode

    // Periodically clean up empty/stale rooms
    setInterval(() => this._cleanup(), 5 * 60 * 1000); // every 5 min
  }

  /**
   * Generate a unique 6-character room code
   */
  _generateRoomCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code;
    do {
      code = Array.from(
        { length: 6 },
        () => chars[Math.floor(Math.random() * chars.length)]
      ).join("");
    } while (this.rooms.has(code));
    return code;
  }

  /**
   * Create a new room
   */
  createRoom({ hostId, settings, io }) {
    const roomCode = this._generateRoomCode();
    const room = new Room({ roomCode, hostId, settings, io });
    this.rooms.set(roomCode, room);
    return room;
  }

  /**
   * Get room by code
   */
  getRoom(roomCode) {
    return this.rooms.get(roomCode) || null;
  }

  /**
   * Get public rooms for browsing
   */
  getPublicRooms() {
    return Array.from(this.rooms.values())
      .filter((r) => !r.settings.isPrivate && r.status === "waiting")
      .map((r) => r.toJSON());
  }

  /**
   * Register socket -> room mapping
   */
  registerSocket(socketId, roomCode) {
    this.socketToRoom.set(socketId, roomCode);
  }

  /**
   * Get room for a socket
   */
  getRoomBySocket(socketId) {
    const code = this.socketToRoom.get(socketId);
    return code ? this.getRoom(code) : null;
  }

  /**
   * Handle socket disconnection
   */
  handleDisconnect(socketId) {
    const room = this.getRoomBySocket(socketId);
    this.socketToRoom.delete(socketId);

    if (!room) return null;

    const isEmpty = room.removePlayer(socketId);
    if (isEmpty) {
      this.rooms.delete(room.roomCode);
      return { room, destroyed: true };
    }

    return { room, destroyed: false };
  }

  /**
   * Remove stale rooms (finished or empty rooms older than 30min)
   */
  _cleanup() {
    const now = Date.now();
    for (const [code, room] of this.rooms) {
      const age = now - room.createdAt;
      const isStale =
        room.players.size === 0 ||
        (room.status === "finished" && age > 30 * 60 * 1000);
      if (isStale) {
        this.rooms.delete(code);
        console.log(`🧹 Cleaned up room ${code}`);
      }
    }
  }
}

// Export singleton
module.exports = new GameManager();
