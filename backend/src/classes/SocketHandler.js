const { v4: uuidv4 } = require("uuid");
const gameManager = require("./GameManager");

/**
 * SocketHandler - Encapsulates all Socket.IO event handling
 */
class SocketHandler {
  constructor(io) {
    this.io = io;
  }

  /**
   * Attach handlers to a newly connected socket
   */
  attach(socket) {
    console.log(`🔌 Socket connected: ${socket.id}`);

    socket.on("create_room", (data, callback) =>
      this._onCreateRoom(socket, data, callback)
    );
    socket.on("join_room", (data, callback) =>
      this._onJoinRoom(socket, data, callback)
    );
    socket.on("start_game", (data, callback) =>
      this._onStartGame(socket, data, callback)
    );
    socket.on("word_chosen", (data) => this._onWordChosen(socket, data));
    socket.on("draw_start", (data) => this._onDrawStart(socket, data));
    socket.on("draw_move", (data) => this._onDrawMove(socket, data));
    socket.on("draw_end", (data) => this._onDrawEnd(socket, data));
    socket.on("canvas_clear", () => this._onCanvasClear(socket));
    socket.on("draw_undo", () => this._onDrawUndo(socket));
    socket.on("guess", (data) => this._onGuess(socket, data));
    socket.on("chat", (data) => this._onChat(socket, data));
    socket.on("player_ready", (data) => this._onPlayerReady(socket, data));
    socket.on("get_room_state", (data, callback) =>
      this._onGetRoomState(socket, data, callback)
    );
    socket.on("disconnect", () => this._onDisconnect(socket));
  }

  // ─── Room Events ──────────────────────────────────────────────────────────

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

      room.addPlayer({ id: playerId, socketId: socket.id, nickname: nickname.trim(), avatar });
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
      if (!roomCode?.trim() || !nickname?.trim()) {
        return callback?.({ error: "Room code and nickname required" });
      }

      const room = gameManager.getRoom(roomCode.toUpperCase());
      if (!room) return callback?.({ error: "Room not found" });
      if (room.status === "playing") return callback?.({ error: "Game in progress" });

      const playerId = existingId || uuidv4();
      const player = room.addPlayer({
        id: playerId,
        socketId: socket.id,
        nickname: nickname.trim(),
        avatar,
      });

      gameManager.registerSocket(socket.id, room.roomCode);
      socket.join(room.roomCode);

      // Notify existing players
      room.broadcastExcept(socket.id, "player_joined", {
        player: player.toJSON(),
        players: room.getPlayerList(),
      });

      callback?.({
        success: true,
        playerId,
        room: room.toJSON(),
      });

      console.log(`👤 ${nickname} joined room ${room.roomCode}`);
    } catch (err) {
      callback?.({ error: err.message });
    }
  }

  _onStartGame(socket, data, callback) {
    try {
      const room = gameManager.getRoomBySocket(socket.id);
      if (!room) return callback?.({ error: "Not in a room" });

      const player = room.getPlayerBySocket(socket.id);
      if (!player || player.id !== room.hostId) {
        return callback?.({ error: "Only the host can start the game" });
      }

      room.startGame();
      room.broadcast("game_started", { game: room.game.toJSON() });
      room.beginTurn();

      callback?.({ success: true });
      console.log(`🎮 Game started in room ${room.roomCode}`);
    } catch (err) {
      callback?.({ error: err.message });
    }
  }

  // ─── Game Events ──────────────────────────────────────────────────────────

  _onWordChosen(socket, data) {
    const room = gameManager.getRoomBySocket(socket.id);
    if (!room) return;
    room.handleWordChosen(socket.id, data.word);
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

    const state = {
      room: room.toJSON(),
      game: room.game ? room.game.toJSON() : null,
      strokes: room.game ? room.game.strokes : [],
    };
    callback?.(state);
  }

  // ─── Drawing Events ───────────────────────────────────────────────────────

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

  _onDrawUndo(socket) {
    const room = gameManager.getRoomBySocket(socket.id);
    if (!room?.game || room.game.phase !== "drawing") return;

    const drawer = room.game.currentDrawer;
    if (!drawer || drawer.socketId !== socket.id) return;

    room.game.undoLastStroke();
    room.broadcast("draw_undone", { strokes: room.game.strokes });
  }

  // ─── Chat & Guessing ──────────────────────────────────────────────────────

  _onGuess(socket, data) {
    const room = gameManager.getRoomBySocket(socket.id);
    if (!room) return;

    const player = room.getPlayerBySocket(socket.id);
    if (!player) return;

    const text = data?.text?.trim();
    if (!text || text.length > 100) return;

    const result = room.handleGuess(socket.id, text);

    if (result.correct) {
      // Tell guesser their score
      room.sendTo(socket.id, "guess_result", {
        correct: true,
        points: result.points,
        word: room.game.currentWord,
      });

      // Broadcast correct guess to all (without revealing word)
      room.broadcast("player_guessed", {
        playerId: player.id,
        playerName: player.nickname,
        points: result.points,
        players: room.getPlayerList(),
      });
    } else {
      // Show as chat message to everyone if not correct
      if (result.isClose) {
        room.sendTo(socket.id, "close_guess", { text });
      }
      // Broadcast as chat (drawer can't see if game is active)
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
    if (!player) return;
    if (room.isSpamming(player.id)) return;

    const text = data?.text?.trim();
    if (!text || text.length > 200) return;

    room.broadcast("chat_message", {
      playerId: player.id,
      playerName: player.nickname,
      text,
      type: "chat",
    });
  }

  // ─── Disconnect ───────────────────────────────────────────────────────────

  _onDisconnect(socket) {
    console.log(`🔌 Socket disconnected: ${socket.id}`);
    const result = gameManager.handleDisconnect(socket.id);
    if (!result) return;

    const { room, destroyed } = result;
    if (destroyed) {
      console.log(`🗑️ Room ${room.roomCode} destroyed`);
      return;
    }

    room.broadcast("player_left", {
      players: room.getPlayerList(),
      newHostId: room.hostId,
    });

    // If game in progress and drawer disconnected, end round early
    if (room.game?.phase === "drawing") {
      const drawer = room.game.currentDrawer;
      // Check if drawer socket still matches
      if (drawer && drawer.socketId === socket.id) {
        setTimeout(() => room.endRound(), 2000);
      }
    }
  }
}

module.exports = SocketHandler;
