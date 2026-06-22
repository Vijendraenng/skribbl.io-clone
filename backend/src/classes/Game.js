const WordManager = require("./WordManager");

const wordManager = new WordManager();

/**
 * Game - Manages round logic, turn order, and scoring
 */
class Game {
  constructor({ gameId, roomId, players, settings }) {
    this.gameId = gameId;
    this.roomId = roomId;
    this.settings = settings;

    // Turn order: snapshot of players at game start
    this.turnOrder = players.map((p) => p.id);
    this.players = new Map(players.map((p) => [p.id, p]));

    this.currentRound = 0;
    this.totalRounds = settings.rounds || 3;
    this.currentDrawerIndex = 0;
    this.currentWord = null;
    this.wordChoices = [];
    this.phase = "waiting"; // waiting | choosing | drawing | round_end | game_over
    this.drawTimer = null;
    this.hintTimer = null;
    this.roundStartTime = null;
    this.drawTime = settings.drawTime || 80;
    this.wordCount = settings.wordCount || 3;
    this.hintsEnabled = settings.hintsEnabled !== false;
    this.maxHints = settings.maxHints || 3;

    this.guessOrder = []; // Track order of correct guesses for scoring
    this.strokes = []; // Canvas stroke history for reconnecting players
  }

  /**
   * Get the current drawer player object
   */
  get currentDrawer() {
    const id = this.turnOrder[this.currentDrawerIndex];
    return this.players.get(id) || null;
  }

  /**
   * Advance to next round
   * @returns {boolean} true if game continues, false if game over
   */
  nextRound() {
    this.currentDrawerIndex = (this.currentDrawerIndex + 1) % this.turnOrder.length;

    // After all players have drawn in a round, increment round counter
    if (this.currentDrawerIndex === 0) {
      this.currentRound++;
    }

    if (this.currentRound >= this.totalRounds) {
      this.phase = "game_over";
      return false;
    }

    return true;
  }

  /**
   * Start the drawing phase after word is chosen
   * @param {string} word
   * @param {Function} onEnd - Callback when draw time expires
   */
  startDrawPhase(word, onEnd) {
    this.currentWord = word;
    this.phase = "drawing";
    this.roundStartTime = Date.now();
    this.guessOrder = [];
    this.strokes = [];

    // Reset all players' round state
    for (const player of this.players.values()) {
      player.resetRound();
    }

    // Clear any existing timers
    this.clearTimers();

    // Start draw countdown
    this.drawTimer = setTimeout(() => {
      this.phase = "round_end";
      onEnd();
    }, this.drawTime * 1000);
  }

  /**
   * Clear all active timers
   */
  clearTimers() {
    if (this.drawTimer) {
      clearTimeout(this.drawTimer);
      this.drawTimer = null;
    }
    if (this.hintTimer) {
      clearInterval(this.hintTimer);
      this.hintTimer = null;
    }
  }

  /**
   * Handle a correct guess - calculate and award points
   * @param {string} playerId
   * @returns {{ points: number, isFirst: boolean }}
   */
  handleCorrectGuess(playerId) {
    const player = this.players.get(playerId);
    if (!player || player.hasGuessedCorrectly) return { points: 0, isFirst: false };

    const elapsed = (Date.now() - this.roundStartTime) / 1000;
    const timeRatio = Math.max(0, (this.drawTime - elapsed) / this.drawTime);
    const isFirst = this.guessOrder.length === 0;

    // Base points: 100-500 based on speed
    let points = Math.round(100 + timeRatio * 400);
    // First correct guess bonus
    if (isFirst) points += 50;

    player.addScore(points);
    player.markGuessedCorrectly();
    this.guessOrder.push(playerId);

    // Award drawer points too
    const drawerPoints = Math.round(points * 0.3);
    const drawer = this.currentDrawer;
    if (drawer) drawer.addScore(drawerPoints);

    return { points, drawerPoints, isFirst };
  }

  /**
   * Check if round should end early (all players guessed)
   * @returns {boolean}
   */
  shouldEndRoundEarly() {
    const guessers = this.turnOrder.filter((id) => id !== this.currentDrawer?.id);
    return guessers.length > 0 && guessers.every((id) => {
      const p = this.players.get(id);
      return p && p.hasGuessedCorrectly;
    });
  }

  /**
   * Get word choices for the current drawer
   * @returns {string[]}
   */
  generateWordChoices() {
    this.wordChoices = wordManager.getWordChoices(this.wordCount);
    return this.wordChoices;
  }

  /**
   * Get current hint based on elapsed time
   * @returns {string}
   */
  getCurrentHint() {
    if (!this.currentWord) return "";
    if (!this.hintsEnabled) return wordManager.getBlankHint(this.currentWord);

    const elapsed = (Date.now() - this.roundStartTime) / 1000;
    return wordManager.getProgressiveHint(
      this.currentWord,
      elapsed,
      this.drawTime,
      this.maxHints
    );
  }

  /**
   * Get leaderboard sorted by score
   * @returns {Array}
   */
  getLeaderboard() {
    return Array.from(this.players.values())
      .map((p) => ({ id: p.id, nickname: p.nickname, avatar: p.avatar, score: p.score }))
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Add stroke to history
   * @param {Object} stroke
   */
  addStroke(stroke) {
    this.strokes.push(stroke);
    // Keep stroke history manageable
    if (this.strokes.length > 2000) {
      this.strokes = this.strokes.slice(-1000);
    }
  }

  /**
   * Undo last stroke group
   */
  undoLastStroke() {
    // Find the last draw_end marker and remove everything after last draw_start
    let i = this.strokes.length - 1;
    while (i >= 0 && this.strokes[i].type !== "draw_start") i--;
    if (i >= 0) this.strokes = this.strokes.slice(0, i);
  }

  /**
   * Clear canvas history
   */
  clearCanvas() {
    this.strokes = [];
  }

  /**
   * Serialize game state for client
   */
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
