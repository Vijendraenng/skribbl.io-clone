const { v4: uuidv4 } = require("uuid");
const Player = require("./Player");
const Game = require("./Game");
const WordManager = require("./WordManager");

const wm = new WordManager();

class Room {
  constructor({ roomCode, hostId, settings = {}, io }) {
    this.id = uuidv4();
    this.roomCode = roomCode;
    this.hostId = hostId;
    this.io = io;

    this.settings = {
      maxPlayers: settings.maxPlayers || 8,
      rounds: settings.rounds || 3,
      drawTime: settings.drawTime || 80,
      wordCount: settings.wordCount || 3,
      hintsEnabled: settings.hintsEnabled !== false,
      maxHints: settings.maxHints || 3,
      isPrivate: settings.isPrivate || false,
    };

    this.players = new Map(); // playerId -> Player
    this.socketToPlayer = new Map(); // socketId -> playerId
    this.game = null;
    this.status = "waiting";
    this.createdAt = Date.now();
    this.messageCooldowns = new Map();
    this._hintInterval = null;
    this._chooseTimeout = null;
  }

  // ─── Player Management ────────────────────────────────────────────────

  addPlayer({ id, socketId, nickname, avatar }) {
    // Check if reconnecting existing player
    const existing = this.players.get(id);
    if (existing) {
      existing.socketId = socketId;
      existing.isConnected = true;
      this.socketToPlayer.set(socketId, id);
      return existing;
    }

    // New player
    const connectedCount = Array.from(this.players.values()).filter(
      (p) => p.isConnected,
    ).length;
    if (connectedCount >= this.settings.maxPlayers)
      throw new Error("Room is full");
    if (this.status === "playing") throw new Error("Game already in progress");

    const player = new Player({ id, socketId, nickname, avatar });
    this.players.set(id, player);
    this.socketToPlayer.set(socketId, id);

    if (this.players.size === 1) this.hostId = id;
    return player;
  }

  /**
   * Mark player as disconnected (keep in room for reconnect grace period)
   * @returns {string} playerId
   */
  markPlayerDisconnected(socketId) {
    const playerId = this.socketToPlayer.get(socketId);
    if (!playerId) return null;

    this.socketToPlayer.delete(socketId);
    const player = this.players.get(playerId);
    if (player) {
      player.isConnected = false;
      // Transfer host if needed
      if (this.hostId === playerId) {
        const next = Array.from(this.players.values()).find(
          (p) => p.isConnected,
        );
        if (next) this.hostId = next.id;
      }
    }
    return playerId;
  }

  getPlayerBySocket(socketId) {
    const playerId = this.socketToPlayer.get(socketId);
    return playerId ? this.players.get(playerId) : null;
  }

  getPlayerById(playerId) {
    return this.players.get(playerId) || null;
  }

  getPlayerList() {
    return Array.from(this.players.values()).map((p) => p.toJSON());
  }

  // ─── Broadcast ────────────────────────────────────────────────────────

  broadcast(event, data) {
    this.io.to(this.roomCode).emit(event, data);
  }
  broadcastExcept(socketId, event, data) {
    this.io.to(this.roomCode).except(socketId).emit(event, data);
  }
  sendTo(socketId, event, data) {
    this.io.to(socketId).emit(event, data);
  }

  // ─── Anti-spam ────────────────────────────────────────────────────────

  isSpamming(playerId) {
    const now = Date.now();
    const last = this.messageCooldowns.get(playerId) || 0;
    if (now - last < 300) return true;
    this.messageCooldowns.set(playerId, now);
    return false;
  }

  // ─── Game Flow ────────────────────────────────────────────────────────

  startGame() {
    const connected = Array.from(this.players.values()).filter(
      (p) => p.isConnected,
    );
    if (connected.length < 2) throw new Error("Need at least 2 players");
    if (this.status === "playing") throw new Error("Game already started");

    this.status = "playing";
    if (this._hintInterval) clearInterval(this._hintInterval);
    if (this._chooseTimeout) clearTimeout(this._chooseTimeout);

    for (const player of this.players.values()) {
      player.score = 0;
      player.roundScore = 0;
      player.hasGuessedCorrectly = false;
    }

    const players = Array.from(this.players.values()).filter(
      (p) => p.isConnected,
    );
    this.game = new Game({
      gameId: uuidv4(),
      roomId: this.id,
      players,
      settings: this.settings,
    });
    return this.game;
  }

  beginTurn() {
    const { game } = this;
    if (!game) return;

    game.phase = "choosing";
    const choices = game.generateWordChoices();
    const drawer = game.currentDrawer;
    if (!drawer) return;

    this.broadcast("round_start", {
      round: game.currentRound + 1,
      totalRounds: game.totalRounds,
      drawerId: drawer.id,
      drawerName: drawer.nickname,
      drawTime: game.drawTime,
    });

    this.sendTo(drawer.socketId, "word_choices", {
      words: choices,
      timeLimit: 15,
    });

    this._chooseTimeout = setTimeout(() => {
      if (game.phase === "choosing")
        this.handleWordChosen(drawer.socketId, choices[0]);
    }, 15000);
  }

  handleWordChosen(socketId, word) {
    const { game } = this;
    if (!game || game.phase !== "choosing") return;

    const drawer = this.getPlayerBySocket(socketId);
    if (!drawer || drawer.id !== game.currentDrawer?.id) return;

    if (this._chooseTimeout) {
      clearTimeout(this._chooseTimeout);
      this._chooseTimeout = null;
    }

    const blankHint = word
      .split("")
      .map((c) => (c === " " ? "  " : "_"))
      .join(" ");

    game.startDrawPhase(word, () => this.endRound());

    this.sendTo(socketId, "word_assigned", { word, hint: blankHint });
    this.broadcastExcept(socketId, "word_hint", {
      hint: blankHint,
      wordLength: word.length,
    });

    if (game.hintsEnabled) {
      this._hintInterval = setInterval(() => {
        if (game.phase !== "drawing") {
          clearInterval(this._hintInterval);
          return;
        }
        const hint = game.getCurrentHint();
        this.broadcastExcept(socketId, "hint_update", { hint });
      }, 10000);
    }
  }

  handleGuess(socketId, text) {
    const { game } = this;
    if (!game || game.phase !== "drawing") return { correct: false };

    const player = this.getPlayerBySocket(socketId);
    if (!player) return { correct: false };
    if (player.id === game.currentDrawer?.id) return { correct: false };
    if (player.hasGuessedCorrectly) return { correct: false };
    if (this.isSpamming(player.id)) return { correct: false };

    if (wm.validateGuess(text, game.currentWord)) {
      const { points, drawerPoints, isFirst } = game.handleCorrectGuess(
        player.id,
      );
      if (game.shouldEndRoundEarly()) setTimeout(() => this.endRound(), 1500);
      return { correct: true, points, drawerPoints, isFirst };
    }

    return { correct: false, isClose: wm.isCloseGuess(text, game.currentWord) };
  }

  endRound() {
    const { game } = this;
    if (!game) return;
    if (this._hintInterval) {
      clearInterval(this._hintInterval);
      this._hintInterval = null;
    }
    game.clearTimers();
    game.phase = "round_end";

    this.broadcast("round_end", {
      word: game.currentWord,
      scores: game.getLeaderboard(),
      drawerId: game.currentDrawer?.id,
    });

    setTimeout(() => {
      const continues = game.nextRound();
      if (continues) this.beginTurn();
      else this.endGame();
    }, 5000);
  }

  endGame() {
    const { game } = this;
    if (!game) return;
    this.status = "finished";
    game.phase = "game_over";
    const leaderboard = game.getLeaderboard();
    this.broadcast("game_over", {
      winner: leaderboard[0] || null,
      leaderboard,
    });
  }

  toJSON() {
    return {
      id: this.id,
      roomCode: this.roomCode,
      hostId: this.hostId,
      settings: this.settings,
      status: this.status,
      players: this.getPlayerList(),
      playerCount: Array.from(this.players.values()).filter(
        (p) => p.isConnected,
      ).length,
    };
  }
}

module.exports = Room;
