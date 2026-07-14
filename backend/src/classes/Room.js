const { v4: uuidv4 } = require("uuid");
const Player = require("./Player");
const Game = require("./Game");
const WordManager = require("./WordManager");
const leaderboardManager = require("./LeaderboardManager");
const achievementEngine = require("./AchievementEngine");
const matchHistoryManager = require("./MatchHistoryManager");

const wm = new WordManager();

class Room {
  constructor({ roomCode, hostId, settings = {}, io }) {
    this.id = uuidv4();
    this.roomCode = roomCode;
    this.hostId = hostId;
    this.io = io;

    const isPrivate = settings.isPrivate || false;

    this.settings = {
      maxPlayers: settings.maxPlayers || 8,
      rounds: settings.rounds || 3,
      drawTime: settings.drawTime || 80,
      wordCount: settings.wordCount || 3,
      hintsEnabled: settings.hintsEnabled !== false,
      maxHints: settings.maxHints || 3,
      isPrivate,
      difficulty: settings.difficulty || "all",
      customWords: settings.customWords || [],
    };

    // Auto-generate a 6-digit passcode when room is private
    this.passcode = isPrivate ? Room._generatePasscode() : null;

    this.players = new Map(); // playerId -> Player
    this.socketToPlayer = new Map(); // socketId -> playerId
    this.bannedIds = new Set(); // banned playerIds
    this.game = null;
    this.status = "waiting";
    this.createdAt = Date.now();
    this.messageCooldowns = new Map();
    this._hintInterval = null;
    this._chooseTimeout = null;
  }

  // ─── Player Management ────────────────────────────────────────────────

  addPlayer({ id, socketId, nickname, avatar, role = "player" }) {
    // Banned check
    if (this.bannedIds.has(id))
      throw new Error("You have been banned from this room");

    // Reconnect existing player
    const existing = this.players.get(id);
    if (existing) {
      existing.socketId = socketId;
      existing.isConnected = true;
      this.socketToPlayer.set(socketId, id);
      return existing;
    }

    // Spectators don't count toward max players
    if (role === "player") {
      const activePlayers = Array.from(this.players.values()).filter(
        (p) => p.isConnected && p.isPlayer,
      ).length;
      if (activePlayers >= this.settings.maxPlayers)
        throw new Error("Room is full");
      if (this.status === "playing")
        throw new Error("Game already in progress — join as spectator?");
    }

    const player = new Player({ id, socketId, nickname, avatar, role });
    this.players.set(id, player);
    this.socketToPlayer.set(socketId, id);
    if (this.players.size === 1) this.hostId = id;
    return player;
  }

  markPlayerDisconnected(socketId) {
    const playerId = this.socketToPlayer.get(socketId);
    if (!playerId) return null;
    this.socketToPlayer.delete(socketId);
    const player = this.players.get(playerId);
    if (player) {
      player.isConnected = false;

      // Remove from game turn order immediately so they never get a turn
      if (this.game) {
        this.game.removePlayer(playerId);
      }

      // Transfer host to next connected player
      if (this.hostId === playerId) {
        const next = Array.from(this.players.values()).find(
          (p) => p.isConnected && p.isPlayer,
        );
        if (next) this.hostId = next.id;
      }
    }
    return playerId;
  }

  // ─── Host Controls ────────────────────────────────────────────────────

  kickPlayer(hostSocketId, targetPlayerId) {
    const host = this.getPlayerBySocket(hostSocketId);
    if (!host || host.id !== this.hostId)
      throw new Error("Only host can kick players");
    const target = this.players.get(targetPlayerId);
    if (!target) throw new Error("Player not found");
    if (target.id === this.hostId) throw new Error("Cannot kick yourself");

    // Disconnect their socket
    const targetSocket = target.socketId;
    target.isConnected = false;
    this.players.delete(targetPlayerId);
    this.socketToPlayer.delete(targetSocket);

    // Send kick event to the kicked player
    this.sendTo(targetSocket, "kicked", {
      reason: "You were kicked by the host",
    });
    // Force socket to leave room
    this.io.sockets.sockets.get(targetSocket)?.leave(this.roomCode);

    return { targetSocket, targetPlayerId };
  }

  banPlayer(hostSocketId, targetPlayerId) {
    const { targetSocket } = this.kickPlayer(hostSocketId, targetPlayerId);
    this.bannedIds.add(targetPlayerId);
    this.sendTo(targetSocket, "kicked", {
      reason: "You have been banned from this room",
    });
    return targetPlayerId;
  }

  // ─── Skip Vote ────────────────────────────────────────────────────────

  handleSkipVote(socketId) {
    const { game } = this;
    if (!game || game.phase !== "drawing")
      return { votes: 0, needed: 0, triggered: false };

    const player = this.getPlayerBySocket(socketId);
    if (!player || player.id === game.currentDrawer?.id)
      return { votes: 0, needed: 0, triggered: false };
    if (player.skipVote)
      return { votes: game.skipVotes.size, needed: 0, triggered: false };

    player.skipVote = true;
    const triggered = game.addSkipVote(player.id);
    const eligible = game.turnOrder.filter(
      (id) => id !== game.currentDrawer?.id,
    );
    const needed = Math.ceil(eligible.length / 2);

    if (triggered) {
      setTimeout(() => this.endRound(true), 500);
    }

    return { votes: game.skipVotes.size, needed, triggered };
  }

  // ─── Getters ─────────────────────────────────────────────────────────

  getPlayerBySocket(socketId) {
    const id = this.socketToPlayer.get(socketId);
    return id ? this.players.get(id) : null;
  }
  getPlayerById(id) {
    return this.players.get(id) || null;
  }
  getPlayerList() {
    return Array.from(this.players.values())
      .filter((p) => p.isConnected)
      .map((p) => p.toJSON());
  }

  // ─── Broadcast ────────────────────────────────────────────────────────

  broadcast(ev, data) {
    this.io.to(this.roomCode).emit(ev, data);
  }
  broadcastExcept(sid, ev, data) {
    this.io.to(this.roomCode).except(sid).emit(ev, data);
  }
  sendTo(sid, ev, data) {
    this.io.to(sid).emit(ev, data);
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
    const activePlayers = Array.from(this.players.values()).filter(
      (p) => p.isConnected && p.isPlayer,
    );
    if (activePlayers.length < 2) throw new Error("Need at least 2 players");
    if (this.status === "playing") throw new Error("Game already started");

    // Check all NON-HOST players are ready (host starts instead of readying)
    const nonHostPlayers = activePlayers.filter((p) => p.id !== this.hostId);
    const anyReady = nonHostPlayers.some((p) => p.isReady);
    if (anyReady) {
      const allReady = nonHostPlayers.every((p) => p.isReady);
      if (!allReady) throw new Error("Not all players are ready yet");
    }

    this.status = "playing";
    if (this._hintInterval) clearInterval(this._hintInterval);
    if (this._chooseTimeout) clearTimeout(this._chooseTimeout);

    for (const p of this.players.values()) {
      p.score = 0;
      p.roundScore = 0;
      p.hasGuessedCorrectly = false;
      p.isReady = false;
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
    // Guard: don't start a turn if game already ended
    if (game.phase === "game_over") return;

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
        this.broadcastExcept(socketId, "hint_update", {
          hint: game.getCurrentHint(),
        });
      }, 10000);
    }
  }

  handleGuess(socketId, text) {
    const { game } = this;
    if (!game || game.phase !== "drawing") return { correct: false };
    const player = this.getPlayerBySocket(socketId);
    if (!player || player.isSpectator) return { correct: false };
    if (player.id === game.currentDrawer?.id) return { correct: false };
    if (player.hasGuessedCorrectly) return { correct: false };
    if (this.isSpamming(player.id)) return { correct: false };

    if (wm.validateGuess(text, game.currentWord)) {
      const result = game.handleCorrectGuess(player.id);
      if (game.shouldEndRoundEarly()) setTimeout(() => this.endRound(), 1500);
      return { correct: true, ...result };
    }
    return { correct: false, isClose: wm.isCloseGuess(text, game.currentWord) };
  }

  endRound(skipped = false) {
    const { game } = this;
    if (!game) return;
    // Guard against double-call (timer fires + disconnect handler both call endRound)
    if (game.phase === "round_end" || game.phase === "game_over") return;
    if (this._hintInterval) {
      clearInterval(this._hintInterval);
      this._hintInterval = null;
    }
    if (this._chooseTimeout) {
      clearTimeout(this._chooseTimeout);
      this._chooseTimeout = null;
    }
    game.clearTimers();
    game.phase = "round_end";

    // Record drawing stats for this round (for achievements)
    game.recordRoundDrawingStats();

    this.broadcast("round_end", {
      word: game.currentWord,
      scores: game.getLeaderboard(),
      drawerId: game.currentDrawer?.id,
      skipped,
      strokes: game.strokes,
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
    // Record match history
    matchHistoryManager.record({
      gameId: game.gameId,
      roomCode: this.roomCode,
      players: leaderboard,
      winner: leaderboard[0] || null,
      wordCount: game.strokes.filter((s) => s.type === "draw_end").length,
      duration: Math.round(
        (Date.now() - (game.roundStartTime || Date.now())) / 1000,
      ),
      playedAt: Date.now(),
    });

    // Record results in global leaderboard
    leaderboardManager.recordGame(leaderboard);

    // Check and award achievements
    try {
      const gameStats = game.playerStats || {};
      // Inject total games / wins from leaderboard manager for cumulative achievements
      leaderboard.forEach((entry) => {
        const lbData = leaderboardManager.allTime.get(entry.id);
        if (lbData && gameStats[entry.id]) {
          gameStats[entry.id].totalGames = lbData.gamesPlayed;
          gameStats[entry.id].totalWins = lbData.wins;
        }
      });
      const newAchievements = achievementEngine.checkGameEnd(
        leaderboard,
        gameStats,
      );
      // Send each achievement to the player who earned it
      newAchievements.forEach(({ playerId, achievement }) => {
        const player = this.players.get(playerId);
        if (player?.isConnected) {
          this.sendTo(player.socketId, "achievement_unlocked", { achievement });
        }
      });
    } catch (err) {
      console.error("Achievement check error:", err.message);
    }

    this.broadcast("game_over", {
      winner: leaderboard[0] || null,
      leaderboard,
    });
  }

  // ─── Passcode ────────────────────────────────────────────────────────

  checkPasscode(code) {
    if (!this.passcode) return true; // public room — no check needed
    return code?.trim().toUpperCase() === this.passcode;
  }

  get hasPasscode() {
    return !!this.passcode;
  }

  toJSON() {
    return {
      id: this.id,
      roomCode: this.roomCode,
      hostId: this.hostId,
      settings: {
        ...this.settings,
        hasPasscode: this.hasPasscode, // tell clients if a passcode is required
        // passcode itself is NEVER sent here — only given to host via create_room callback
      },
      status: this.status,
      players: this.getPlayerList(),
      playerCount: Array.from(this.players.values()).filter(
        (p) => p.isConnected && p.isPlayer,
      ).length,
      spectatorCount: Array.from(this.players.values()).filter(
        (p) => p.isConnected && p.isSpectator,
      ).length,
    };
  }
}

Room._generatePasscode = function () {
  // 6 uppercase alphanumeric characters, easy to read (no 0/O/I/1)
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(
    { length: 6 },
    () => chars[Math.floor(Math.random() * chars.length)],
  ).join("");
};

module.exports = Room;
