const WordManager = require("./WordManager");
const wordManager = new WordManager();

class Game {
  constructor({ gameId, roomId, players, settings }) {
    this.gameId = gameId;
    this.roomId = roomId;
    this.settings = settings;
    this.turnOrder = players.map((p) => p.id);
    this.players = new Map(players.map((p) => [p.id, p]));
    this.currentRound = 0;
    this.totalRounds = settings.rounds || 3;
    this.currentDrawerIndex = 0;
    this.currentWord = null;
    this.wordChoices = [];
    this.phase = "waiting";
    this.drawTimer = null;
    this.hintTimer = null;
    this.roundStartTime = null;
    this.drawTime = settings.drawTime || 80;
    this.wordCount = settings.wordCount || 3;
    this.hintsEnabled = settings.hintsEnabled !== false;
    this.maxHints = settings.maxHints || 3;
    this.hintRevealOrder = [];
    this.revealedHintCount = 0;
    this.guessOrder = [];
    this.strokes = [];
  }

  get currentDrawer() {
    const id = this.turnOrder[this.currentDrawerIndex];
    return this.players.get(id) || null;
  }

  nextRound() {
    this.currentDrawerIndex = (this.currentDrawerIndex + 1) % this.turnOrder.length;
    if (this.currentDrawerIndex === 0) this.currentRound++;
    if (this.currentRound >= this.totalRounds) { this.phase = "game_over"; return false; }
    return true;
  }

  startDrawPhase(word, onEnd) {
    this.currentWord = word;
    this.phase = "drawing";
    this.roundStartTime = Date.now();
    this.guessOrder = [];
    this.strokes = [];
    // Build fixed hint reveal order ONCE per round
    this.hintRevealOrder = wordManager.buildHintRevealOrder(word);
    this.revealedHintCount = 0;

    for (const player of this.players.values()) player.resetRound();
    this.clearTimers();

    this.drawTimer = setTimeout(() => {
      this.phase = "round_end";
      onEnd();
    }, this.drawTime * 1000);
  }

  clearTimers() {
    if (this.drawTimer) { clearTimeout(this.drawTimer); this.drawTimer = null; }
    if (this.hintTimer) { clearInterval(this.hintTimer); this.hintTimer = null; }
  }

  handleCorrectGuess(playerId) {
    const player = this.players.get(playerId);
    if (!player || player.hasGuessedCorrectly) return { points: 0, isFirst: false };
    const elapsed = (Date.now() - this.roundStartTime) / 1000;
    const timeRatio = Math.max(0, (this.drawTime - elapsed) / this.drawTime);
    const isFirst = this.guessOrder.length === 0;
    let points = Math.round(100 + timeRatio * 400);
    if (isFirst) points += 50;
    player.addScore(points);
    player.markGuessedCorrectly();
    this.guessOrder.push(playerId);
    const drawerPoints = Math.round(points * 0.3);
    const drawer = this.currentDrawer;
    if (drawer) drawer.addScore(drawerPoints);
    return { points, drawerPoints, isFirst };
  }

  shouldEndRoundEarly() {
    const guessers = this.turnOrder.filter((id) => id !== this.currentDrawer?.id);
    return guessers.length > 0 && guessers.every((id) => {
      const p = this.players.get(id);
      return p && p.hasGuessedCorrectly;
    });
  }

  generateWordChoices() {
    this.wordChoices = wordManager.getWordChoices(this.wordCount);
    return this.wordChoices;
  }

  /**
   * Get current hint — reveals letters progressively.
   * First hint at 25% of time, then every (75/maxHints)% after.
   */
  getCurrentHint() {
    if (!this.currentWord) return "";
    if (!this.hintsEnabled) return wordManager.getBlankHint(this.currentWord);

    const elapsed = (Date.now() - this.roundStartTime) / 1000;
    const letterCount = this.currentWord.replace(/ /g, "").length;
    // Never reveal more than half the letters
    const maxReveal = Math.min(this.maxHints, Math.max(1, Math.floor(letterCount / 2)));

    // Reveal first letter at 25% elapsed, then one more every equal interval up to 75%
    // e.g. drawTime=80: first at 20s, then 30s, 40s for maxReveal=3
    let targetReveal = 0;
    for (let i = 1; i <= maxReveal; i++) {
      const threshold = this.drawTime * (0.25 + (i - 1) * (0.5 / maxReveal));
      if (elapsed >= threshold) targetReveal = i;
    }

    if (targetReveal > this.revealedHintCount) {
      this.revealedHintCount = targetReveal;
    }

    const revealed = this.hintRevealOrder.slice(0, this.revealedHintCount);
    return wordManager.buildHintString(this.currentWord, revealed);
  }

  getLeaderboard() {
    return Array.from(this.players.values())
      .map((p) => ({ id: p.id, nickname: p.nickname, avatar: p.avatar, score: p.score }))
      .sort((a, b) => b.score - a.score);
  }

  addStroke(stroke) {
    this.strokes.push(stroke);
    if (this.strokes.length > 2000) this.strokes = this.strokes.slice(-1000);
  }

  undoLastStroke() {
    let i = this.strokes.length - 1;
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
      players: Array.from(this.players.values()).map((p) => p.toJSON()),
      drawTime: this.drawTime,
      roundStartTime: this.roundStartTime,
    };
  }
}

module.exports = Game;