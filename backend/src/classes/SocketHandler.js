const { v4: uuidv4 } = require("uuid");
const gameManager = require("./GameManager");

class SocketHandler {
  constructor(io) {
    this.io = io;
  }

  attach(socket) {
    console.log(`🔌 Socket connected: ${socket.id}`);
    socket.on("create_room", (d, cb) => this._onCreateRoom(socket, d, cb));
    socket.on("join_room", (d, cb) => this._onJoinRoom(socket, d, cb));
    socket.on("reconnect_room", (d, cb) =>
      this._onReconnectRoom(socket, d, cb),
    );
    socket.on("start_game", (d, cb) => this._onStartGame(socket, d, cb));
    socket.on("word_chosen", (d) => this._onWordChosen(socket, d));
    socket.on("draw_start", (d) => this._onDrawStart(socket, d));
    socket.on("draw_move", (d) => this._onDrawMove(socket, d));
    socket.on("draw_end", (d) => this._onDrawEnd(socket, d));
    socket.on("canvas_clear", () => this._onCanvasClear(socket));
    socket.on("draw_undo", () => this._onDrawUndo(socket));
    socket.on("guess", (d) => this._onGuess(socket, d));
    socket.on("chat", (d) => this._onChat(socket, d));
    socket.on("player_ready", (d) => this._onPlayerReady(socket, d));
    socket.on("get_room_state", (d, cb) => this._onGetRoomState(socket, d, cb));
    socket.on("disconnect", () => this._onDisconnect(socket));
  }

  // ─── Room Events ──────────────────────────────────────────────────────

  _onCreateRoom(socket, data, callback) {
    try {
      const { nickname, avatar, settings } = data;
      if (!nickname?.trim()) return callback?.({ error: "Nickname required" });

      const playerId = uuidv4();
      const room = gameManager.createRoom({
        hostId: playerId,
        settings: settings || {},
        io: this.io,
      });
      room.addPlayer({
        id: playerId,
        socketId: socket.id,
        nickname: nickname.trim(),
        avatar,
      });
      gameManager.registerSocket(socket.id, room.roomCode);
      socket.join(room.roomCode);

      callback?.({
        success: true,
        roomCode: room.roomCode,
        playerId,
        room: room.toJSON(),
      });
      console.log(`🏠 Room ${room.roomCode} created by ${nickname}`);
    } catch (err) {
      callback?.({ error: err.message });
    }
  }

  _onJoinRoom(socket, data, callback) {
    try {
      const { roomCode, nickname, avatar, playerId: existingId } = data;
      if (!roomCode?.trim() || !nickname?.trim())
        return callback?.({ error: "Room code and nickname required" });

      const room = gameManager.getRoom(roomCode.toUpperCase());
      if (!room) return callback?.({ error: "Room not found" });

      // Allow rejoin if player already exists in room
      const existingPlayer = existingId ? room.getPlayerById(existingId) : null;
      if (!existingPlayer && room.status === "playing")
        return callback?.({ error: "Game in progress" });

      const playerId = existingId || uuidv4();
      const player = room.addPlayer({
        id: playerId,
        socketId: socket.id,
        nickname: nickname.trim(),
        avatar,
      });

      gameManager.registerSocket(socket.id, room.roomCode);
      gameManager.cancelDeletion(room.roomCode);
      socket.join(room.roomCode);

      room.broadcastExcept(socket.id, "player_joined", {
        player: player.toJSON(),
        players: room.getPlayerList(),
      });
      callback?.({ success: true, playerId, room: room.toJSON() });
      console.log(`👤 ${nickname} joined room ${room.roomCode}`);
    } catch (err) {
      callback?.({ error: err.message });
    }
  }

  /**
   * Reconnect after page refresh — restore socket mapping without re-adding player
   */
  _onReconnectRoom(socket, data, callback) {
    try {
      const { roomCode, playerId, nickname, avatar } = data;
      if (!roomCode || !playerId) return callback?.({ error: "Missing data" });

      const room = gameManager.getRoom(roomCode.toUpperCase());
      if (!room) return callback?.({ error: "Room no longer exists" });

      // Re-add or update player (addPlayer handles reconnect internally)
      const player = room.addPlayer({
        id: playerId,
        socketId: socket.id,
        nickname: nickname || "Player",
        avatar: avatar || "🎨",
      });

      gameManager.registerSocket(socket.id, room.roomCode);
      gameManager.cancelDeletion(room.roomCode);
      socket.join(room.roomCode);

      // Tell others this player is back
      room.broadcastExcept(socket.id, "player_reconnected", {
        player: player.toJSON(),
        players: room.getPlayerList(),
      });

      callback?.({
        success: true,
        room: room.toJSON(),
        game: room.game ? room.game.toJSON() : null,
        strokes: room.game ? room.game.strokes : [],
      });

      console.log(`🔄 ${player.nickname} reconnected to room ${room.roomCode}`);
    } catch (err) {
      callback?.({ error: err.message });
    }
  }

  _onStartGame(socket, data, callback) {
    try {
      const room = gameManager.getRoomBySocket(socket.id);
      if (!room) return callback?.({ error: "Not in a room" });
      const player = room.getPlayerBySocket(socket.id);
      if (!player || player.id !== room.hostId)
        return callback?.({ error: "Only the host can start the game" });

      room.startGame();
      room.broadcast("game_started", { game: room.game.toJSON() });
      room.beginTurn();
      callback?.({ success: true });
    } catch (err) {
      callback?.({ error: err.message });
    }
  }

  // ─── Game Events ──────────────────────────────────────────────────────

  _onWordChosen(socket, data) {
    const room = gameManager.getRoomBySocket(socket.id);
    if (room) room.handleWordChosen(socket.id, data.word);
  }

  _onPlayerReady(socket, data) {
    const room = gameManager.getRoomBySocket(socket.id);
    if (!room) return;
    const player = room.getPlayerBySocket(socket.id);
    if (!player) return;
    player.isReady = data.ready !== false;
    room.broadcast("player_ready_update", {
      playerId: player.id,
      isReady: player.isReady,
      players: room.getPlayerList(),
    });
  }

  _onGetRoomState(socket, data, callback) {
    const room = data?.roomCode
      ? gameManager.getRoom(data.roomCode)
      : gameManager.getRoomBySocket(socket.id);
    if (!room) return callback?.({ error: "Room not found" });
    callback?.({
      room: room.toJSON(),
      game: room.game ? room.game.toJSON() : null,
      strokes: room.game ? room.game.strokes : [],
    });
  }

  // ─── Drawing Events ───────────────────────────────────────────────────

  _onDrawStart(socket, data) {
    const room = gameManager.getRoomBySocket(socket.id);
    if (!room?.game || room.game.phase !== "drawing") return;
    const drawer = room.game.currentDrawer;
    if (!drawer || drawer.socketId !== socket.id) return;
    const stroke = { type: "draw_start", ...data };
    room.game.addStroke(stroke);
    room.broadcastExcept(socket.id, "draw_data", stroke);
  }

  _onDrawMove(socket, data) {
    const room = gameManager.getRoomBySocket(socket.id);
    if (!room?.game || room.game.phase !== "drawing") return;
    const drawer = room.game.currentDrawer;
    if (!drawer || drawer.socketId !== socket.id) return;
    const stroke = { type: "draw_move", ...data };
    room.game.addStroke(stroke);
    room.broadcastExcept(socket.id, "draw_data", stroke);
  }

  _onDrawEnd(socket, data) {
    const room = gameManager.getRoomBySocket(socket.id);
    if (!room?.game || room.game.phase !== "drawing") return;
    const drawer = room.game.currentDrawer;
    if (!drawer || drawer.socketId !== socket.id) return;
    const stroke = { type: "draw_end", ...data };
    room.game.addStroke(stroke);
    room.broadcastExcept(socket.id, "draw_data", stroke);
  }

  _onCanvasClear(socket) {
    const room = gameManager.getRoomBySocket(socket.id);
    if (!room?.game || room.game.phase !== "drawing") return;
    const drawer = room.game.currentDrawer;
    if (!drawer || drawer.socketId !== socket.id) return;
    room.game.clearCanvas();
    room.broadcast("canvas_cleared", {});
  }

  _onCanvasFill(socket, data) {
    const room = gameManager.getRoomBySocket(socket.id);
    if (!room?.game || room.game.phase !== "drawing") return;
    const drawer = room.game.currentDrawer;
    if (!drawer || drawer.socketId !== socket.id) return;
    const stroke = {
      type: "canvas_fill",
      x: data.x,
      y: data.y,
      color: data.color,
    };
    room.game.addStroke(stroke);
    room.broadcastExcept(socket.id, "canvas_fill", {
      x: data.x,
      y: data.y,
      color: data.color,
    });
  }

  _onDrawUndo(socket) {
    const room = gameManager.getRoomBySocket(socket.id);
    if (!room?.game || room.game.phase !== "drawing") return;
    const drawer = room.game.currentDrawer;
    if (!drawer || drawer.socketId !== socket.id) return;
    room.game.undoLastStroke();
    room.broadcast("draw_undone", { strokes: room.game.strokes });
  }

  // ─── Chat & Guessing ──────────────────────────────────────────────────

  _onGuess(socket, data) {
    const room = gameManager.getRoomBySocket(socket.id);
    if (!room) return;
    const player = room.getPlayerBySocket(socket.id);
    if (!player) return;
    const text = data?.text?.trim();
    if (!text || text.length > 100) return;

    const result = room.handleGuess(socket.id, text);

    if (result.correct) {
      room.sendTo(socket.id, "guess_result", {
        correct: true,
        points: result.points,
        word: room.game.currentWord,
      });
      room.broadcast("player_guessed", {
        playerId: player.id,
        playerName: player.nickname,
        points: result.points,
        players: room.getPlayerList(),
      });
    } else {
      if (result.isClose) room.sendTo(socket.id, "close_guess", { text });
      const drawer = room.game?.currentDrawer;
      if (drawer) {
        room.broadcastExcept(drawer.socketId, "chat_message", {
          playerId: player.id,
          playerName: player.nickname,
          text,
          type: "guess",
        });
      } else {
        room.broadcast("chat_message", {
          playerId: player.id,
          playerName: player.nickname,
          text,
          type: "guess",
        });
      }
    }
  }

  _onChat(socket, data) {
    const room = gameManager.getRoomBySocket(socket.id);
    if (!room) return;
    const player = room.getPlayerBySocket(socket.id);
    if (!player || room.isSpamming(player.id)) return;
    const text = data?.text?.trim();
    if (!text || text.length > 200) return;
    room.broadcast("chat_message", {
      playerId: player.id,
      playerName: player.nickname,
      text,
      type: "chat",
    });
  }

  // ─── Disconnect ───────────────────────────────────────────────────────

  _onDisconnect(socket) {
    console.log(`🔌 Socket disconnected: ${socket.id}`);
    const result = gameManager.handleDisconnect(socket.id);
    if (!result) return;

    const { room, playerId } = result;
    room.broadcast("player_left", {
      playerId,
      players: room.getPlayerList(),
      newHostId: room.hostId,
    });

    // If drawer disconnected during game, end round after short delay
    if (room.game?.phase === "drawing") {
      const drawer = room.game.currentDrawer;
      if (drawer && drawer.id === playerId) {
        setTimeout(() => {
          if (room.game?.phase === "drawing") room.endRound();
        }, 3000);
      }
    }
  }
}

module.exports = SocketHandler;
