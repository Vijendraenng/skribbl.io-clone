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
    socket.on("join_spectator", (d, cb) =>
      this._onJoinSpectator(socket, d, cb),
    );
    socket.on("reconnect_room", (d, cb) =>
      this._onReconnectRoom(socket, d, cb),
    );
    socket.on("start_game", (d, cb) => this._onStartGame(socket, d, cb));
    socket.on("word_chosen", (d) => this._onWordChosen(socket, d));
    socket.on("draw_start", (d) => this._onDrawStart(socket, d));
    socket.on("draw_move", (d) => this._onDrawMove(socket, d));
    socket.on("draw_end", (d) => this._onDrawEnd(socket, d));
    socket.on("canvas_clear", () => this._onCanvasClear(socket));
    socket.on("canvas_fill", (d) => this._onCanvasFill(socket, d));
    socket.on("draw_undo", () => this._onDrawUndo(socket));
    socket.on("draw_redo", () => this._onDrawRedo(socket));
    socket.on("guess", (d) => this._onGuess(socket, d));
    socket.on("chat", (d) => this._onChat(socket, d));
    socket.on("player_ready", (d) => this._onPlayerReady(socket, d));
    socket.on("kick_player", (d, cb) => this._onKickPlayer(socket, d, cb));
    socket.on("ban_player", (d, cb) => this._onBanPlayer(socket, d, cb));
    socket.on("vote_skip", (d, cb) => this._onVoteSkip(socket, d, cb));
    socket.on("get_room_state", (d, cb) => this._onGetRoomState(socket, d, cb));
    socket.on("play_again", (d, cb) => this._onPlayAgain(socket, d, cb));
    socket.on("leave_room", (d, cb) => this._onLeaveRoom(socket, d, cb));
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
        passcode: room.passcode || null,
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

      // Passcode check for private rooms
      if (room.hasPasscode) {
        const { passcode } = data;
        if (!room.checkPasscode(passcode)) {
          return callback?.({ error: "Wrong passcode" });
        }
      }

      const existingPlayer = existingId ? room.getPlayerById(existingId) : null;
      if (!existingPlayer && room.status === "playing") {
        return callback?.({
          error: "Game in progress — you can join as a spectator",
        });
      }

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
    } catch (err) {
      callback?.({ error: err.message });
    }
  }

  _onJoinSpectator(socket, data, callback) {
    try {
      const { roomCode, nickname, avatar } = data;
      if (!roomCode?.trim() || !nickname?.trim())
        return callback?.({ error: "Room code and nickname required" });

      const room = gameManager.getRoom(roomCode.toUpperCase());
      if (!room) return callback?.({ error: "Room not found" });

      // Passcode check
      if (room.hasPasscode) {
        const { passcode } = data;
        if (!room.checkPasscode(passcode)) {
          return callback?.({ error: "Wrong passcode" });
        }
      }

      const playerId = uuidv4();
      const player = room.addPlayer({
        id: playerId,
        socketId: socket.id,
        nickname: nickname.trim(),
        avatar,
        role: "spectator",
      });

      gameManager.registerSocket(socket.id, room.roomCode);
      gameManager.cancelDeletion(room.roomCode);
      socket.join(room.roomCode);

      // Send current strokes so spectator sees current canvas
      room.broadcastExcept(socket.id, "player_joined", {
        player: player.toJSON(),
        players: room.getPlayerList(),
      });
      callback?.({
        success: true,
        playerId,
        room: room.toJSON(),
        game: room.game ? room.game.toJSON() : null,
        strokes: room.game ? room.game.strokes : [],
      });
    } catch (err) {
      callback?.({ error: err.message });
    }
  }

  _onReconnectRoom(socket, data, callback) {
    try {
      const { roomCode, playerId, nickname, avatar } = data;
      if (!roomCode || !playerId) return callback?.({ error: "Missing data" });

      const room = gameManager.getRoom(roomCode.toUpperCase());
      if (!room) return callback?.({ error: "Room no longer exists" });

      const player = room.addPlayer({
        id: playerId,
        socketId: socket.id,
        nickname: nickname || "Player",
        avatar: avatar || "🎨",
      });
      gameManager.registerSocket(socket.id, room.roomCode);
      gameManager.cancelDeletion(room.roomCode);
      socket.join(room.roomCode);

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
      console.log(`🔄 ${player.nickname} reconnected to ${room.roomCode}`);
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
        return callback?.({ error: "Only the host can start" });

      room.startGame();
      room.broadcast("game_started", { game: room.game.toJSON() });
      room.beginTurn();
      callback?.({ success: true });
    } catch (err) {
      callback?.({ error: err.message });
    }
  }

  // ─── Host Controls ────────────────────────────────────────────────────

  _onKickPlayer(socket, data, callback) {
    try {
      const room = gameManager.getRoomBySocket(socket.id);
      if (!room) return callback?.({ error: "Not in a room" });
      const { targetPlayerId } = data;
      room.kickPlayer(socket.id, targetPlayerId);
      room.broadcast("player_kicked", {
        playerId: targetPlayerId,
        players: room.getPlayerList(),
      });
      callback?.({ success: true });
    } catch (err) {
      callback?.({ error: err.message });
    }
  }

  _onBanPlayer(socket, data, callback) {
    try {
      const room = gameManager.getRoomBySocket(socket.id);
      if (!room) return callback?.({ error: "Not in a room" });
      const { targetPlayerId } = data;
      room.banPlayer(socket.id, targetPlayerId);
      room.broadcast("player_kicked", {
        playerId: targetPlayerId,
        players: room.getPlayerList(),
      });
      callback?.({ success: true });
    } catch (err) {
      callback?.({ error: err.message });
    }
  }

  _onVoteSkip(socket, data, callback) {
    try {
      const room = gameManager.getRoomBySocket(socket.id);
      if (!room) return callback?.({ error: "Not in a room" });
      const result = room.handleSkipVote(socket.id);
      room.broadcast("skip_vote_update", {
        votes: result.votes,
        needed: result.needed,
        triggered: result.triggered,
      });
      callback?.({ success: true, ...result });
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
    if (!player || player.isSpectator) return;
    // Explicitly use the boolean sent — never infer from absence
    player.isReady = data.ready === true;
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

  _onDrawRedo(socket) {
    const room = gameManager.getRoomBySocket(socket.id);
    if (!room?.game || room.game.phase !== "drawing") return;
    const drawer = room.game.currentDrawer;
    if (!drawer || drawer.socketId !== socket.id) return;
    const success = room.game.redoLastStroke();
    if (!success) return;
    // Broadcast full stroke list so all clients replay consistently
    room.broadcast("draw_redone", {
      strokes: room.game.strokes,
      canUndo: room.game.canUndo,
      canRedo: room.game.canRedo,
    });
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
    room.broadcastExcept(socket.id, "canvas_fill", stroke);
  }

  _onDrawUndo(socket) {
    const room = gameManager.getRoomBySocket(socket.id);
    if (!room?.game || room.game.phase !== "drawing") return;
    const drawer = room.game.currentDrawer;
    if (!drawer || drawer.socketId !== socket.id) return;
    const success = room.game.undoLastStroke();
    if (!success) return;
    // Broadcast to ALL including drawer so drawer's canvas replays correctly
    room.broadcast("draw_undone", {
      strokes: room.game.strokes,
      canUndo: room.game.canUndo,
      canRedo: room.game.canRedo,
    });
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

  // ─── Play Again ───────────────────────────────────────────────────────

  _onPlayAgain(socket, data, callback) {
    try {
      const room = gameManager.getRoomBySocket(socket.id);
      if (!room) return callback?.({ error: "Not in a room" });
      const player = room.getPlayerBySocket(socket.id);
      if (!player || player.id !== room.hostId)
        return callback?.({ error: "Only host can restart" });

      room.status = "waiting";
      room.game = null;
      for (const p of room.players.values()) {
        p.score = 0;
        p.roundScore = 0;
        p.hasGuessedCorrectly = false;
        p.isReady = false;
      }
      room.broadcast("redirect_to_lobby", { roomCode: room.roomCode });
      callback?.({ success: true });
    } catch (err) {
      callback?.({ error: err.message });
    }
  }

  // ─── Disconnect ───────────────────────────────────────────────────────

  _onLeaveRoom(socket, data, callback) {
    try {
      const room = gameManager.getRoomBySocket(socket.id);
      if (!room) return callback?.({ success: true });

      const player = room.getPlayerBySocket(socket.id);
      const playerId = player?.id;

      // Remove player completely (not just mark disconnected)
      room.markPlayerDisconnected(socket.id);
      gameManager.socketToRoom.delete(socket.id);
      socket.leave(room.roomCode);

      // Notify remaining players
      if (room.players.size > 0) {
        room.broadcast("player_left", {
          playerId,
          players: room.getPlayerList(),
          newHostId: room.hostId,
        });
      }

      // Count truly connected players
      const connected = Array.from(room.players.values()).filter(
        (p) => p.isConnected,
      );
      if (connected.length === 0) {
        gameManager.deleteRoom(room.roomCode);
        return callback?.({ success: true });
      }

      // Handle mid-game exit (same logic as disconnect)
      if (room.game && room.game.phase === "drawing") {
        const connectedInGame = room.game.turnOrder.filter((id) => {
          const p = room.game.players.get(id);
          return p && p.isConnected;
        });
        if (connectedInGame.length < 2) {
          room.endGame();
        } else {
          const drawer = room.game.currentDrawer;
          if (!drawer || !drawer.isConnected) {
            setTimeout(() => {
              if (room.game?.phase === "drawing") room.endRound();
            }, 1500);
          }
        }
      }

      callback?.({ success: true });
    } catch (err) {
      callback?.({ error: err.message });
    }
  }

  _onDisconnect(socket) {
    console.log(`🔌 Socket disconnected: ${socket.id}`);
    const result = gameManager.handleDisconnect(socket.id);
    if (!result) return;
    const { room, playerId } = result;

    // Broadcast updated player list (only connected players)
    room.broadcast("player_left", {
      playerId,
      players: room.getPlayerList(),
      newHostId: room.hostId,
    });

    // Handle mid-game disconnect
    if (room.game && room.game.phase === "drawing") {
      const connectedPlayers = room.game.turnOrder.filter((id) => {
        const p = room.game.players.get(id);
        return p && p.isConnected;
      });

      // Not enough players to continue
      if (connectedPlayers.length < 2) {
        room.endGame();
        return;
      }

      // If the drawer left, end round early and move to next turn
      const drawer = room.game.currentDrawer;
      if (!drawer || !drawer.isConnected) {
        // Small delay so clients process the player_left event first
        setTimeout(() => {
          if (room.game?.phase === "drawing") {
            room.endRound();
          }
        }, 2000);
      } else {
        // Drawer is still here — check if all remaining guessers have guessed
        if (room.game.shouldEndRoundEarly()) {
          setTimeout(() => {
            if (room.game?.phase === "drawing") room.endRound();
          }, 1500);
        }
      }
    } else if (room.game && room.game.phase === "choosing") {
      // Drawer left during word selection — end round
      const drawer = room.game.currentDrawer;
      if (!drawer || !drawer.isConnected) {
        if (room._chooseTimeout) {
          clearTimeout(room._chooseTimeout);
          room._chooseTimeout = null;
        }
        setTimeout(() => room.endRound(), 1000);
      }
    }
  }
}

module.exports = SocketHandler;
