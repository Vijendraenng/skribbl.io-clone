const WORDS = require("../../data/words");

/**
 * WordManager - Handles word selection and hint generation
 */
class WordManager {
  constructor() {
    this.allWords = WORDS;
    this.usedWords = new Set();
  }

  /**
   * Get N random words for the drawer to choose from
   * @param {number} count - Number of words to offer
   * @param {string[]} categories - Categories to pull from
   * @returns {string[]} Array of word choices
   */
  getWordChoices(count = 3, categories = null) {
    const availableCategories = categories || Object.keys(this.allWords);
    const pool = [];

    for (const cat of availableCategories) {
      if (this.allWords[cat]) {
        pool.push(...this.allWords[cat]);
      }
    }

    // Filter out recently used words
    const fresh = pool.filter((w) => !this.usedWords.has(w));
    const source = fresh.length >= count ? fresh : pool; // fallback if all used

    const shuffled = [...source].sort(() => Math.random() - 0.5);
    const chosen = shuffled.slice(0, count);

    // Mark as used
    chosen.forEach((w) => {
      this.usedWords.add(w);
      // Clear used set if it gets too large (prevent memory leaks)
      if (this.usedWords.size > 200) {
        this.usedWords.clear();
      }
    });

    return chosen;
  }

  /**
   * Generate hint display for a word (e.g. "_ _ a _ _")
   * @param {string} word - The actual word
   * @param {number} revealCount - Number of letters to reveal
   * @returns {string} Hint string
   */
  generateHint(word, revealCount = 0) {
    const chars = word.split("");
    const letterIndices = chars
      .map((c, i) => (c !== " " ? i : null))
      .filter((i) => i !== null);

    // Randomly pick indices to reveal
    const shuffledIndices = [...letterIndices].sort(() => Math.random() - 0.5);
    const revealIndices = new Set(shuffledIndices.slice(0, revealCount));

    return chars
      .map((c, i) => {
        if (c === " ") return "  ";
        if (revealIndices.has(i)) return c;
        return "_";
      })
      .join(" ");
  }

  /**
   * Get a progressive hint that reveals more letters over time
   * @param {string} word
   * @param {number} elapsed - Seconds elapsed
   * @param {number} totalTime - Total draw time in seconds
   * @param {number} maxHints - Max hints to reveal
   * @returns {string}
   */
  getProgressiveHint(word, elapsed, totalTime, maxHints = 3) {
    const letterCount = word.replace(/ /g, "").length;
    const maxReveal = Math.min(maxHints, Math.floor(letterCount / 2));
    const progress = elapsed / totalTime;

    let revealCount = 0;
    if (maxReveal > 0) {
      revealCount = Math.floor(progress * maxReveal * 1.5); // start revealing at ~1/3 of time
      revealCount = Math.min(revealCount, maxReveal);
    }

    return this.generateHint(word, revealCount);
  }

  /**
   * Get the blank hint format (length display only)
   * @param {string} word
   * @returns {string}
   */
  getBlankHint(word) {
    return word
      .split("")
      .map((c) => (c === " " ? "  " : "_"))
      .join(" ");
  }

  /**
   * Validate a guess against the word
   * @param {string} guess
   * @param {string} word
   * @returns {boolean}
   */
  validateGuess(guess, word) {
    return guess.trim().toLowerCase() === word.trim().toLowerCase();
  }

  /**
   * Check if guess is close (within 1 char) - for "close!" messages
   * @param {string} guess
   * @param {string} word
   * @returns {boolean}
   */
  isCloseGuess(guess, word) {
    const g = guess.trim().toLowerCase();
    const w = word.trim().toLowerCase();
    if (g === w) return false;
    if (Math.abs(g.length - w.length) > 2) return false;
    return this._levenshtein(g, w) <= 1;
  }

  _levenshtein(a, b) {
    const dp = Array.from({ length: a.length + 1 }, (_, i) =>
      Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
    );
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        dp[i][j] =
          a[i - 1] === b[j - 1]
            ? dp[i - 1][j - 1]
            : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
    return dp[a.length][b.length];
  }
}

module.exports = WordManager;
