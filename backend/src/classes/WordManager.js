const { WORDS, getWordsByDifficulty } = require("../../data/words");

class WordManager {
  constructor() {
    this.usedWords = new Set();
  }

  /**
   * Get N random word choices for the drawer
   * @param {number} count
   * @param {"easy"|"medium"|"hard"|"all"} difficulty
   * @param {string[]} customWords - host-supplied custom words (optional)
   */
  getWordChoices(count = 3, difficulty = "all", customWords = []) {
    let pool;

    if (customWords && customWords.length >= count) {
      // Use custom words if host provided enough
      pool = [...customWords];
    } else {
      // Mix custom words with default words if not enough custom ones
      const defaults = getWordsByDifficulty(difficulty);
      pool = [...defaults, ...(customWords || [])];
    }

    // Filter recently used
    const fresh = pool.filter((w) => !this.usedWords.has(w.toLowerCase()));
    const source = fresh.length >= count ? fresh : pool;

    const chosen = [...source].sort(() => Math.random() - 0.5).slice(0, count);

    chosen.forEach((w) => {
      this.usedWords.add(w.toLowerCase());
      if (this.usedWords.size > 300) this.usedWords.clear();
    });

    return chosen;
  }

  /**
   * Build a FIXED hint reveal order for a word — called once per round
   */
  buildHintRevealOrder(word) {
    const chars = word.split("");
    const letterIndices = chars
      .map((c, i) => (c !== " " ? i : null))
      .filter((i) => i !== null);
    return [...letterIndices].sort(() => Math.random() - 0.5);
  }

  /**
   * Build hint string from a fixed set of revealed indices
   */
  buildHintString(word, revealedIndices) {
    const revealed = new Set(revealedIndices);
    return word
      .split("")
      .map((c, i) => {
        if (c === " ") return "  ";
        return revealed.has(i) ? c : "_";
      })
      .join(" ");
  }

  getBlankHint(word) {
    return word
      .split("")
      .map((c) => (c === " " ? "  " : "_"))
      .join(" ");
  }

  validateGuess(guess, word) {
    return guess.trim().toLowerCase() === word.trim().toLowerCase();
  }

  isCloseGuess(guess, word) {
    const g = guess.trim().toLowerCase();
    const w = word.trim().toLowerCase();
    if (g === w) return false;
    if (Math.abs(g.length - w.length) > 2) return false;
    return this._levenshtein(g, w) <= 1;
  }

  _levenshtein(a, b) {
    const dp = Array.from({ length: a.length + 1 }, (_, i) =>
      Array.from({ length: b.length + 1 }, (_, j) =>
        i === 0 ? j : j === 0 ? i : 0,
      ),
    );
    for (let i = 1; i <= a.length; i++)
      for (let j = 1; j <= b.length; j++)
        dp[i][j] =
          a[i - 1] === b[j - 1]
            ? dp[i - 1][j - 1]
            : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    return dp[a.length][b.length];
  }
}

module.exports = WordManager;
