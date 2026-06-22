const { v4: uuidv4 } = require("uuid");
const Player = require("./Player");
const Game = require("./Game");

/**
 * Room - Manages players, settings, and coordinates game flow
 */
class Room {
  constructor({ roomCode, hostId, settings = {}, io }) {
    this.id = uuidv4();
    this.roomCode = roomCode;
    this.hostId = hostId;
    this.io = io; // Socket.IO server instance

    this.settings = {
      maxPlayers: settings.maxPlayers || 8,
      rounds: settings.rounds || 3,
      drawTime: settings.drawTime || 80,
      wordCount: settings.wordCount || 3,
      hintsEnabled: settings.hintsEnabled !== false,
      maxHints: settings.maxHints || 3,
      isPrivate: settings.isPrivate || false,
      ...settings,
    };

    this.players = new Map(); // playerId -> Player
    this.socketToPlayer = new Map(); // socketId -> playerId
    this.game = null;
    this.status = "waiting"; // waiting | playing | finished
    this.createdAt = Date.now();

    // Anti-spam: track message timestamps per player
    this.messageCooldowns = new Map();
  }

  // ─── Player Management ───────────────────────────────────────────────────

  /**
   * Add a player to the room
   */
  addPlayer({ id, socketId, nickname, avatar }) {
    if (this.players.size >= this.settings.maxPlayers) {
      throw new Error("Room is full");
    }
    if (this.status === "playing") {
      throw new Error("Game already in progress");
    }

    const player = new Player({ id, socketId, nickname, avatar });
    this.players.set(id, player);
    this.socketToPlayer.set(socketId, id);

    // Auto-set first player as host if host disconnected
    if (this.players.size === 1) this.hostId = id;

    return player;
  }

  /**
   * Remove a player from the room
   * @returns {boolean} true if room should be destroyed
   */
  removePlayer(socketId) {
    const playerId = this.socketToPlayer.get(socketId);
    if (!playerId) return this.players.size === 0;

    this.socketToPlayer.delete(socketId);
    const player = this.players.get(playerId);
    if (player) {
      player.isConnected = false;
      // Remove entirely from room
      this.players.delete(playerId);
    }

    // Transfer host if host left
    if (this.hostId === playerId && this.players.size > 0) {
      this.hostId = this.players.keys().next().value;
    }

    return this.players.size === 0;
  }

  getPlayerBySocket(socketId) {
    const playerId = this.socketToPlayer.get(socketId);
    return playerId ? this.players.get(playerId) : null;
  }

  getPlayerList() {
    return Array.from(this.players.values()).map((p) => p.toJSON());
  }

  // ─── Broadcast Helpers ────────────────────────────────────────────────────

  broadcast(event, data) {
    this.io.to(this.roomCode).emit(event, data);
  }

  broadcastExcept(socketId, event, data) {
    this.io.to(this.roomCode).except(socketId).emit(event, data);
  }

  sendTo(socketId, event, data) {
    this.io.to(socketId).emit(event, data);
  }

  // ─── Anti-Spam ────────────────────────────────────────────────────────────

  isSpamming(playerId) {
    const now = Date.now();
    const last = this.messageCooldowns.get(playerId) || 0;
    if (now - last < 300) return true; // 300ms cooldown
    this.messageCooldowns.set(playerId, now);
    return false;
  }

  // ─── Game Flow ────────────────────────────────────────────────────────────

  /**
   * Start the game - called by host
   */
  startGame() {
    if (this.players.size < 2) throw new Error("Need at least 2 players");
    if (this.status === "playing") throw new Error("Game already started");

    // Reset room + player scores so play-again works cleanly
    this.status = "playing";
    this._hintInterval && clearInterval(this._hintInterval);
    this._chooseTimeout && clearTimeout(this._chooseTimeout);
    for (const player of this.players.values()) {
      player.score = 0;
      player.roundScore = 0;
      player.hasGuessedCorrectly = false;
    }

    const players = Array.from(this.players.values());

    this.game = new Game({
      gameId: uuidv4(),
      roomId: this.id,
      players,
      settings: this.settings,
    });

    return this.game;
  }

  /**
   * Begin a new turn - send word choices to drawer
   */
  beginTurn() {
    const { game } = this;
    if (!game) return;

    game.phase = "choosing";
    const choices = game.generateWordChoices();
    const drawer = game.currentDrawer;

    if (!drawer) return;

    // Broadcast round start to everyone
    this.broadcast("round_start", {
      round: game.currentRound + 1,
      totalRounds: game.totalRounds,
      drawerId: drawer.id,
      drawerName: drawer.nickname,
      drawTime: game.drawTime,
    });

    // Send word choices only to drawer
    this.sendTo(drawer.socketId, "word_choices", {
      words: choices,
      timeLimit: 15, // seconds to choose
    });

    // Auto-pick word if drawer doesn't choose in time
    this._chooseTimeout = setTimeout(() => {
      if (game.phase === "choosing") {
        this.handleWordChosen(drawer.socketId, choices[0]);
      }
    }, 15000);
  }

  /**
   * Handle drawer choosing a word
   */
  handleWordChosen(socketId, word) {
    const { game } = this;
    if (!game || game.phase !== "choosing") return;

    const drawer = this.getPlayerBySocket(socketId);
    if (!drawer || drawer.id !== game.currentDrawer?.id) return;

    if (this._chooseTimeout) clearTimeout(this._chooseTimeout);

    const blankHint = word
      .split("")
      .map((c) => (c === " " ? "  " : "_"))
      .join(" ");

    // Start draw phase - end round callback
    game.startDrawPhase(word, () => this.endRound());

    // Send word to drawer
    this.sendTo(socketId, "word_assigned", {
      word,
      hint: blankHint,
    });

    // Send hint (blanks) to everyone else
    this.broadcastExcept(socketId, "word_hint", {
      hint: blankHint,
      wordLength: word.length,
    });

    // Start hint updates every 10 seconds
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

  /**
   * Handle a player's guess
   * @returns {{ correct: boolean, points?: number, isFirst?: boolean, isClose?: boolean }}
   */
  handleGuess(socketId, text) {
    const { game } = this;
    if (!game || game.phase !== "drawing") return { correct: false };

    const player = this.getPlayerBySocket(socketId);
    if (!player) return { correct: false };
    if (player.id === game.currentDrawer?.id) return { correct: false }; // Drawer can't guess
    if (player.hasGuessedCorrectly) return { correct: false }; // Already guessed
    if (this.isSpamming(player.id)) return { correct: false };

    const WordManager = require("./WordManager");
    const wm = new WordManager();

    if (wm.validateGuess(text, game.currentWord)) {
      const { points, drawerPoints, isFirst } = game.handleCorrectGuess(
        player.id,
      );

      // Check if all guessers have answered
      if (game.shouldEndRoundEarly()) {
        setTimeout(() => this.endRound(), 1500);
      }

      return { correct: true, points, drawerPoints, isFirst };
    }

    // Check for close guess
    const isClose = wm.isCloseGuess(text, game.currentWord);
    return { correct: false, isClose };
  }

  /**
   * End current round
   */
  endRound() {
    const { game } = this;
    if (!game) return;

    clearInterval(this._hintInterval);
    game.clearTimers();
    game.phase = "round_end";

    const roundData = {
      word: game.currentWord,
      scores: game.getLeaderboard(),
      drawerId: game.currentDrawer?.id,
    };

    this.broadcast("round_end", roundData);

    // Advance to next round after a pause
    setTimeout(() => {
      const continues = game.nextRound();
      if (continues) {
        this.beginTurn();
      } else {
        this.endGame();
      }
    }, 5000);
  }

  /**
   * End the entire game
   */
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

  // ─── Serialization ────────────────────────────────────────────────────────

  toJSON() {
    return {
      id: this.id,
      roomCode: this.roomCode,
      hostId: this.hostId,
      settings: this.settings,
      status: this.status,
      players: this.getPlayerList(),
      playerCount: this.players.size,
    };
  }
}

module.exports = Room;
