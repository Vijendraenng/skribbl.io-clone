const WORDS = require("../../data/words");

class WordManager {
  constructor() {
    this.allWords = WORDS;
    this.usedWords = new Set();
  }

  getWordChoices(count = 3, categories = null) {
    const availableCategories = categories || Object.keys(this.allWords);
    const pool = [];
    for (const cat of availableCategories) {
      if (this.allWords[cat]) pool.push(...this.allWords[cat]);
    }
    const fresh = pool.filter((w) => !this.usedWords.has(w));
    const source = fresh.length >= count ? fresh : pool;
    const chosen = [...source].sort(() => Math.random() - 0.5).slice(0, count);
    chosen.forEach((w) => {
      this.usedWords.add(w);
      if (this.usedWords.size > 200) this.usedWords.clear();
    });
    return chosen;
  }

  /**
   * Build a FIXED hint reveal set for a word at the start of a round.
   * Returns an array of letter indices that will be revealed (in order they unlock).
   * This is stored once per round so hints are consistent.
   */
  buildHintRevealOrder(word) {
    const chars = word.split("");
    const letterIndices = chars
      .map((c, i) => (c !== " " ? i : null))
      .filter((i) => i !== null);
    // Shuffle once — this is the fixed order for this round
    return [...letterIndices].sort(() => Math.random() - 0.5);
  }

  /**
   * Generate hint string given the word and a fixed set of already-revealed indices.
   */
  buildHintString(word, revealedIndices) {
    const revealed = new Set(revealedIndices);
    return word
      .split("")
      .map((c, i) => {
        if (c === " ") return "  ";
        if (revealed.has(i)) return c;
        return "_";
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
