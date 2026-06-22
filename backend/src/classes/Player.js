/**
 * Player class - Represents a connected player
 */
class Player {
  constructor({ id, socketId, nickname, avatar = "🎨" }) {
    this.id = id;
    this.socketId = socketId;
    this.nickname = nickname;
    this.avatar = avatar;
    this.score = 0;
    this.roundScore = 0;
    this.hasGuessedCorrectly = false;
    this.isReady = false;
    this.isConnected = true;
    this.joinedAt = Date.now();
  }

  /**
   * Add points to player's score
   * @param {number} points
   */
  addScore(points) {
    this.score += points;
    this.roundScore += points;
  }

  /**
   * Reset round-specific state
   */
  resetRound() {
    this.roundScore = 0;
    this.hasGuessedCorrectly = false;
  }

  /**
   * Mark player as correctly guessed
   */
  markGuessedCorrectly() {
    this.hasGuessedCorrectly = true;
  }

  /**
   * Get serialized player data (safe for broadcast)
   */
  toJSON() {
    return {
      id: this.id,
      socketId: this.socketId,
      nickname: this.nickname,
      avatar: this.avatar,
      score: this.score,
      roundScore: this.roundScore,
      hasGuessedCorrectly: this.hasGuessedCorrectly,
      isReady: this.isReady,
      isConnected: this.isConnected,
    };
  }
}

module.exports = Player;
