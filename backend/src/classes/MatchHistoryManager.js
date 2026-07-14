/**
 * MatchHistoryManager — stores completed game records in memory.
 * Last 1000 games kept globally; per-player last 50 games accessible by playerId.
 */

class MatchHistoryManager {
  constructor() {
    this.games = []; // all games, newest first, max 1000
    this.byPlayer = new Map(); // playerId -> [gameRecord, ...], max 50 each
  }

  /**
   * Record a completed game.
   * @param {object} params
   */
  record({ gameId, roomCode, players, winner, wordCount, duration, playedAt }) {
    const record = {
      gameId,
      roomCode,
      players: players.map((p) => ({
        id: p.id,
        nickname: p.nickname,
        avatar: p.avatar,
        score: p.score,
      })),
      winner: winner
        ? {
            id: winner.id,
            nickname: winner.nickname,
            avatar: winner.avatar,
            score: winner.score,
          }
        : null,
      wordCount,
      duration, // seconds
      playedAt: playedAt || Date.now(),
    };

    // Global list
    this.games.unshift(record);
    if (this.games.length > 1000) this.games.pop();

    // Per-player
    for (const p of players) {
      if (!this.byPlayer.has(p.id)) this.byPlayer.set(p.id, []);
      const list = this.byPlayer.get(p.id);
      list.unshift(record);
      if (list.length > 50) list.pop();
    }
  }

  getByPlayer(playerId, limit = 20) {
    return (this.byPlayer.get(playerId) || []).slice(0, limit);
  }

  getRecent(limit = 50) {
    return this.games.slice(0, limit);
  }
}

module.exports = new MatchHistoryManager();
