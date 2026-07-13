/**
 * LeaderboardManager — in-memory global leaderboard.
 * Updated after every game ends. Persists for the lifetime of the server process.
 * No DB needed — resets on server restart (acceptable for free tier).
 */

class LeaderboardManager {
  constructor() {
    // Map of playerId -> entry
    this.allTime = new Map();
    // Weekly entries — reset every Monday at midnight UTC
    this.weekly = new Map();
    this.weekStart = this._getWeekStart();
    // Start weekly reset check
    this._scheduleWeeklyReset();
  }

  /**
   * Record results from a completed game.
   * @param {Array<{id, nickname, avatar, score}>} leaderboard
   */
  recordGame(leaderboard) {
    if (!leaderboard?.length) return;
    this._checkWeeklyReset();

    const winner = leaderboard[0];

    leaderboard.forEach((entry, rank) => {
      const { id, nickname, avatar, score } = entry;
      if (!id || !nickname || score <= 0) return;

      // All-time
      const at = this.allTime.get(id) || {
        id,
        nickname,
        avatar,
        totalScore: 0,
        gamesPlayed: 0,
        wins: 0,
        bestScore: 0,
      };
      at.nickname = nickname; // update in case they changed it
      at.avatar = avatar;
      at.totalScore += score;
      at.gamesPlayed += 1;
      at.wins += rank === 0 ? 1 : 0;
      at.bestScore = Math.max(at.bestScore, score);
      this.allTime.set(id, at);

      // Weekly
      const wk = this.weekly.get(id) || {
        id,
        nickname,
        avatar,
        totalScore: 0,
        gamesPlayed: 0,
        wins: 0,
        bestScore: 0,
      };
      wk.nickname = nickname;
      wk.avatar = avatar;
      wk.totalScore += score;
      wk.gamesPlayed += 1;
      wk.wins += rank === 0 ? 1 : 0;
      wk.bestScore = Math.max(wk.bestScore, score);
      this.weekly.set(id, wk);
    });
  }

  /**
   * Get top N entries sorted by totalScore.
   * @param {"alltime"|"weekly"} period
   * @param {number} limit
   */
  getTop(period = "alltime", limit = 100) {
    const map = period === "weekly" ? this.weekly : this.allTime;
    return Array.from(map.values())
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, limit)
      .map((e, i) => ({ ...e, rank: i + 1 }));
  }

  // ── Private ─────────────────────────────────────────────────────────────

  _getWeekStart() {
    const now = new Date();
    const day = now.getUTCDay(); // 0=Sun, 1=Mon …
    const diff = day === 0 ? -6 : 1 - day; // days back to Monday
    const monday = new Date(now);
    monday.setUTCDate(now.getUTCDate() + diff);
    monday.setUTCHours(0, 0, 0, 0);
    return monday.getTime();
  }

  _checkWeeklyReset() {
    const now = Date.now();
    if (now >= this.weekStart + 7 * 24 * 60 * 60 * 1000) {
      this.weekly.clear();
      this.weekStart = this._getWeekStart();
      console.log("🏆 Weekly leaderboard reset");
    }
  }

  _scheduleWeeklyReset() {
    // Check every hour
    setInterval(() => this._checkWeeklyReset(), 60 * 60 * 1000);
  }
}

module.exports = new LeaderboardManager(); // singleton
