class Player {
  constructor({ id, socketId, nickname, avatar = "🎨", role = "player" }) {
    this.id = id;
    this.socketId = socketId;
    this.nickname = nickname;
    this.avatar = avatar;
    this.role = role; // "player" | "spectator"
    this.score = 0;
    this.roundScore = 0;
    this.hasGuessedCorrectly = false;
    this.isReady = false;
    this.isConnected = true;
    this.joinedAt = Date.now();
    this.skipVote = false; // voted to skip current drawer
  }

  addScore(points) {
    this.score += points;
    this.roundScore += points;
  }

  resetRound() {
    this.roundScore = 0;
    this.hasGuessedCorrectly = false;
    this.skipVote = false;
  }

  markGuessedCorrectly() {
    this.hasGuessedCorrectly = true;
  }

  get isSpectator() {
    return this.role === "spectator";
  }
  get isPlayer() {
    return this.role === "player";
  }

  toJSON() {
    return {
      id: this.id,
      socketId: this.socketId,
      nickname: this.nickname,
      avatar: this.avatar,
      role: this.role,
      score: this.score,
      roundScore: this.roundScore,
      hasGuessedCorrectly: this.hasGuessedCorrectly,
      isReady: this.isReady,
      isConnected: this.isConnected,
      skipVote: this.skipVote,
    };
  }
}

module.exports = Player;
