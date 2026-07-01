const WordManager = require("./WordManager");
const wordManager = new WordManager();

class Game {
  constructor({ gameId, roomId, players, settings }) {
    this.gameId = gameId;
    this.roomId = roomId;
    this.settings = settings;

    // Only active (non-spectator) players participate in turns
    this.turnOrder = players.filter(p => p.isPlayer).map(p => p.id);
    this.players = new Map(players.map(p => [p.id, p]));

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
    this.skipVotes = new Set();
  }

  get currentDrawer() {
    const id = this.turnOrder[this.currentDrawerIndex];
    return this.players.get(id) || null;
  }

  startDrawPhase(word, onEnd) {
    this.currentWord = word;
    this.phase = "drawing";
    this.roundStartTime = Date.now();
    this.guessOrder = [];
    this.strokes = [];
    this.skipVotes = new Set();
    this.hintRevealOrder = wordManager.buildHintRevealOrder(word);
    this.revealedHintCount = 0;
    for (const player of this.players.values()) player.resetRound();
    this.clearTimers();
    this.drawTimer = setTimeout(() => { this.phase = "round_end"; onEnd(); }, this.drawTime * 1000);
  }

  clearTimers() {
    if (this.drawTimer) { clearTimeout(this.drawTimer); this.drawTimer = null; }
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
    this.guessOrder.push(playerId);
    const drawerPoints = Math.round(points * 0.3);
    if (this.currentDrawer) this.currentDrawer.addScore(drawerPoints);
    return { points, drawerPoints, isFirst };
  }

  shouldEndRoundEarly() {
    // Only consider connected, active (non-spectator) guessers
    const guessers = this.turnOrder.filter(id => {
      if (id === this.currentDrawer?.id) return false;
      const p = this.players.get(id);
      return p && p.isConnected && p.isPlayer;
    });
    return guessers.length > 0 && guessers.every(id => {
      const p = this.players.get(id);
      return p && p.hasGuessedCorrectly;
    });
  }

  // ─── Skip vote ────────────────────────────────────────────────────────
  addSkipVote(playerId) {
    this.skipVotes.add(playerId);
    // Majority of non-drawer active players must vote
    const eligible = this.turnOrder.filter(id => id !== this.currentDrawer?.id);
    const needed = Math.ceil(eligible.length / 2);
    return this.skipVotes.size >= needed;
  }

  /**
   * Remove a player from the turn order when they disconnect mid-game.
   * Adjusts currentDrawerIndex so the next turn still flows correctly.
   */
  removePlayer(playerId) {
    const idx = this.turnOrder.indexOf(playerId);
    if (idx === -1) return; // not in turn order (spectator or already removed)

    // If removing a player before or at the current index, shift index back
    // so we don't skip the next player
    if (idx < this.currentDrawerIndex) {
      this.currentDrawerIndex--;
    } else if (idx === this.currentDrawerIndex) {
      // The current drawer left — index stays, will point to next player after removal
      // (or wrap to 0 if this was the last player)
    }

    // Remove from turn order
    this.turnOrder.splice(idx, 1);

    // Clamp index in case we removed the last player
    if (this.turnOrder.length > 0) {
      this.currentDrawerIndex = this.currentDrawerIndex % this.turnOrder.length;
    }
  }

  /**
   * Advance to the next CONNECTED player, skipping any disconnected ones.
   * Returns false if game should end (< 2 connected players remain).
   */
  nextRound() {
    // Remove any disconnected players from turn order before advancing
    const disconnected = this.turnOrder.filter(id => {
      const p = this.players.get(id);
      return !p || !p.isConnected;
    });
    disconnected.forEach(id => this.removePlayer(id));

    if (this.turnOrder.length < 2) {
      this.phase = "game_over";
      return false;
    }

    this.currentDrawerIndex = (this.currentDrawerIndex + 1) % this.turnOrder.length;
    if (this.currentDrawerIndex === 0) this.currentRound++;
    if (this.currentRound >= this.totalRounds) { this.phase = "game_over"; return false; }
    return true;
  }

  generateWordChoices() {
    this.wordChoices = wordManager.getWordChoices(this.wordCount, this.difficulty, this.customWords);
    return this.wordChoices;
  }

  getCurrentHint() {
    if (!this.currentWord) return "";
    if (!this.hintsEnabled) return wordManager.getBlankHint(this.currentWord);
    const elapsed = (Date.now() - this.roundStartTime) / 1000;
    const letterCount = this.currentWord.replace(/ /g, "").length;
    const maxReveal = Math.min(this.maxHints, Math.max(1, Math.floor(letterCount / 2)));
    let targetReveal = 0;
    for (let i = 1; i <= maxReveal; i++) {
      const threshold = this.drawTime * (0.25 + (i - 1) * (0.5 / maxReveal));
      if (elapsed >= threshold) targetReveal = i;
    }
    if (targetReveal > this.revealedHintCount) this.revealedHintCount = targetReveal;
    const revealed = this.hintRevealOrder.slice(0, this.revealedHintCount);
    return wordManager.buildHintString(this.currentWord, revealed);
  }

  getLeaderboard() {
    return Array.from(this.players.values())
      .filter(p => p.isPlayer)
      .map(p => ({ id: p.id, nickname: p.nickname, avatar: p.avatar, score: p.score }))
      .sort((a, b) => b.score - a.score);
  }

  addStroke(stroke) {
    this.strokes.push(stroke);
    if (this.strokes.length > 2000) this.strokes = this.strokes.slice(-1000);
  }
  undoLastStroke() {
    if (this.strokes.length === 0) return;

    // Walk backwards to find the last "unit" to remove:
    // a canvas_fill is a single undoable unit
    // a pen/eraser stroke group is: draw_start ... draw_moves ... draw_end
    let i = this.strokes.length - 1;

    // Skip trailing draw_end if present
    if (this.strokes[i]?.type === "draw_end") i--;

    // If we landed on a canvas_fill, remove just that one event
    if (i >= 0 && this.strokes[i]?.type === "canvas_fill") {
      this.strokes = this.strokes.slice(0, i);
      return;
    }

    // Otherwise walk back to find draw_start of this stroke group
    while (i >= 0 && this.strokes[i].type !== "draw_start") i--;
    if (i >= 0) this.strokes = this.strokes.slice(0, i);
  }
  clearCanvas() { this.strokes = []; }

  toJSON() {
    return {
      gameId: this.gameId,
      phase: this.phase,
      currentRound: this.currentRound,
      totalRounds: this.totalRounds,
      currentDrawerId: this.currentDrawer?.id || null,
      currentDrawerName: this.currentDrawer?.nickname || null,
      players: Array.from(this.players.values()).map(p => p.toJSON()),
      drawTime: this.drawTime,
      roundStartTime: this.roundStartTime,
    };
  }
}

module.exports = Game;