const WordManager = require("./WordManager");
const wordManager = new WordManager();

class Game {
  constructor({ gameId, roomId, players, settings }) {
    this.gameId = gameId;
    this.roomId = roomId;
    this.settings = settings;
    this.turnOrder = players.filter((p) => p.isPlayer).map((p) => p.id);
    this.players = new Map(players.map((p) => [p.id, p]));
    this.currentRound = 0;
    this.totalRounds = settings.rounds || 3;
    this.currentDrawerIndex = 0;
    this.currentWord = null;
    this.wordChoices = [];
    this.phase = "waiting";
    this.drawTimer = null;
    this.roundStartTime = null;
    this.drawTime = settings.drawTime || 80;
    this.wordCount = settings.wordCount || 3;
    this.hintsEnabled = settings.hintsEnabled !== false;
    this.maxHints = settings.maxHints || 3;
    this.difficulty = settings.difficulty || "all";
    this.customWords = settings.customWords || [];
    this.hintRevealOrder = [];
    this.revealedHintCount = 0;
    this.guessOrder = [];
    this.strokes = [];
    this.redoStack = [];
    this.skipVotes = new Set();

    // Per-player stats for achievement tracking
    // { playerId: { correctGuesses, firstGuesses, fastestGuessMs, allGuessedMyDrawing, noneGuessedMyDrawing, wasLastAtSomePoint } }
    this.playerStats = {};
    for (const p of players) {
      this.playerStats[p.id] = {
        correctGuesses: 0,
        firstGuesses: 0,
        fastestGuessMs: Infinity,
        allGuessedMyDrawing: false,
        noneGuessedMyDrawing: false,
        wasLastAtSomePoint: false,
      };
    }
  }

  get currentDrawer() {
    const id = this.turnOrder[this.currentDrawerIndex];
    return this.players.get(id) || null;
  }

  removePlayer(playerId) {
    const idx = this.turnOrder.indexOf(playerId);
    if (idx === -1) return;
    if (idx < this.currentDrawerIndex) this.currentDrawerIndex--;
    this.turnOrder.splice(idx, 1);
    if (this.turnOrder.length > 0)
      this.currentDrawerIndex = this.currentDrawerIndex % this.turnOrder.length;
  }

  nextRound() {
    const disconnected = this.turnOrder.filter((id) => {
      const p = this.players.get(id);
      return !p || !p.isConnected;
    });
    disconnected.forEach((id) => this.removePlayer(id));
    if (this.turnOrder.length < 2) {
      this.phase = "game_over";
      return false;
    }
    this.currentDrawerIndex =
      (this.currentDrawerIndex + 1) % this.turnOrder.length;
    if (this.currentDrawerIndex === 0) this.currentRound++;
    if (this.currentRound >= this.totalRounds) {
      this.phase = "game_over";
      return false;
    }
    return true;
  }

  startDrawPhase(word, onEnd) {
    this.currentWord = word;
    this.phase = "drawing";
    this.roundStartTime = Date.now();
    this.guessOrder = [];
    this.strokes = [];
    this.redoStack = [];
    this.skipVotes = new Set();
    this.hintRevealOrder = wordManager.buildHintRevealOrder(word);
    this.revealedHintCount = 0;
    for (const player of this.players.values()) player.resetRound();
    this.clearTimers();
    this.drawTimer = setTimeout(() => {
      onEnd();
    }, this.drawTime * 1000);
  }

  clearTimers() {
    if (this.drawTimer) {
      clearTimeout(this.drawTimer);
      this.drawTimer = null;
    }
  }

  handleCorrectGuess(playerId) {
    const player = this.players.get(playerId);
    if (!player || player.hasGuessedCorrectly) return { points: 0 };
    const elapsed = (Date.now() - this.roundStartTime) / 1000;
    const timeRatio = Math.max(0, (this.drawTime - elapsed) / this.drawTime);
    const isFirst = this.guessOrder.length === 0;
    let points = Math.round(100 + timeRatio * 400);
    if (isFirst) points += 50;
    player.addScore(points);
    player.markGuessedCorrectly();
    const elapsedMs = Date.now() - this.roundStartTime;
    this.guessOrder.push(playerId);
    const drawerPoints = Math.round(points * 0.3);
    if (this.currentDrawer) this.currentDrawer.addScore(drawerPoints);

    // Track stats for achievements
    if (this.playerStats[playerId]) {
      this.playerStats[playerId].correctGuesses++;
      this.playerStats[playerId].fastestGuessMs = Math.min(
        this.playerStats[playerId].fastestGuessMs,
        elapsedMs,
      );
      if (isFirst) this.playerStats[playerId].firstGuesses++;
    }
    return { points, drawerPoints, isFirst };
  }

  shouldEndRoundEarly() {
    const guessers = this.turnOrder.filter((id) => {
      if (id === this.currentDrawer?.id) return false;
      const p = this.players.get(id);
      return p && p.isConnected && p.isPlayer;
    });
    return (
      guessers.length > 0 &&
      guessers.every((id) => {
        const p = this.players.get(id);
        return p && p.hasGuessedCorrectly;
      })
    );
  }

  addSkipVote(playerId) {
    this.skipVotes.add(playerId);
    const eligible = this.turnOrder.filter(
      (id) => id !== this.currentDrawer?.id,
    );
    const needed = Math.ceil(eligible.length / 2);
    return this.skipVotes.size >= needed;
  }

  generateWordChoices() {
    this.wordChoices = wordManager.getWordChoices(
      this.wordCount,
      this.difficulty,
      this.customWords,
    );
    return this.wordChoices;
  }

  getCurrentHint() {
    if (!this.currentWord) return "";
    if (!this.hintsEnabled) return wordManager.getBlankHint(this.currentWord);
    const elapsed = (Date.now() - this.roundStartTime) / 1000;
    const letterCount = this.currentWord.replace(/ /g, "").length;
    const maxReveal = Math.min(
      this.maxHints,
      Math.max(1, Math.floor(letterCount / 2)),
    );
    let targetReveal = 0;
    for (let i = 1; i <= maxReveal; i++) {
      const threshold = this.drawTime * (0.25 + (i - 1) * (0.5 / maxReveal));
      if (elapsed >= threshold) targetReveal = i;
    }
    if (targetReveal > this.revealedHintCount)
      this.revealedHintCount = targetReveal;
    const revealed = this.hintRevealOrder.slice(0, this.revealedHintCount);
    return wordManager.buildHintString(this.currentWord, revealed);
  }

  // Called at round end to update drawing stats
  recordRoundDrawingStats() {
    const drawer = this.currentDrawer;
    if (!drawer || !this.playerStats[drawer.id]) return;
    const guessers = this.turnOrder.filter((id) => id !== drawer.id);
    const allGuessed =
      guessers.length > 0 &&
      guessers.every((id) => {
        const p = this.players.get(id);
        return p && p.hasGuessedCorrectly;
      });
    const noneGuessed =
      guessers.length > 0 &&
      guessers.every((id) => {
        const p = this.players.get(id);
        return p && !p.hasGuessedCorrectly;
      });
    if (allGuessed) this.playerStats[drawer.id].allGuessedMyDrawing = true;
    if (noneGuessed) this.playerStats[drawer.id].noneGuessedMyDrawing = true;

    // Track comeback: check if winner was ever last
    const lb = this.getLeaderboard();
    if (lb.length > 1) {
      const last = lb[lb.length - 1];
      if (this.playerStats[last.id])
        this.playerStats[last.id].wasLastAtSomePoint = true;
    }
  }

  getLeaderboard() {
    return Array.from(this.players.values())
      .filter((p) => p.isPlayer)
      .map((p) => ({
        id: p.id,
        nickname: p.nickname,
        avatar: p.avatar,
        score: p.score,
      }))
      .sort((a, b) => b.score - a.score);
  }

  // ─── Stroke history ───────────────────────────────────────────────────

  addStroke(stroke) {
    // New drawing action clears redo history
    const isNewAction =
      stroke.type === "draw_start" ||
      stroke.type === "canvas_fill" ||
      stroke.type === "draw_shape";
    if (isNewAction) this.redoStack = [];
    this.strokes.push(stroke);
    if (this.strokes.length > 2000) this.strokes = this.strokes.slice(-1000);
  }

  undoLastStroke() {
    if (this.strokes.length === 0) return false;
    let i = this.strokes.length - 1;

    // Skip trailing draw_end
    if (this.strokes[i]?.type === "draw_end") i--;

    // Single-event undoable units: fill and shape
    if (
      i >= 0 &&
      (this.strokes[i]?.type === "canvas_fill" ||
        this.strokes[i]?.type === "draw_shape")
    ) {
      const removed = this.strokes.splice(i, 1);
      this.redoStack.push(removed);
      return true;
    }

    // Stroke group: walk back to draw_start
    while (i >= 0 && this.strokes[i].type !== "draw_start") i--;
    if (i < 0) return false;
    const removed = this.strokes.splice(i);
    this.redoStack.push(removed);
    return true;
  }

  redoLastStroke() {
    if (this.redoStack.length === 0) return false;
    const unit = this.redoStack.pop();
    this.strokes.push(...unit);
    return true;
  }

  clearCanvas() {
    this.strokes = [];
    this.redoStack = [];
  }

  get canUndo() {
    return this.strokes.length > 0;
  }
  get canRedo() {
    return this.redoStack.length > 0;
  }

  toJSON() {
    return {
      gameId: this.gameId,
      phase: this.phase,
      currentRound: this.currentRound,
      totalRounds: this.totalRounds,
      currentDrawerId: this.currentDrawer?.id || null,
      currentDrawerName: this.currentDrawer?.nickname || null,
      players: Array.from(this.players.values()).map((p) => p.toJSON()),
      drawTime: this.drawTime,
      roundStartTime: this.roundStartTime,
    };
  }
}

module.exports = Game;
