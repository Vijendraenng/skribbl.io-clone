/**
 * AchievementEngine — checks and awards achievements after game events.
 * All achievements are defined here with their unlock conditions.
 */

const ACHIEVEMENTS = [
  // ── Winning ──────────────────────────────────────────────────────────
  {
    id: "first_win",
    icon: "🏆",
    title: "First Win",
    desc: "Win your first game",
  },
  { id: "hat_trick", icon: "🎩", title: "Hat Trick", desc: "Win 3 games" },
  { id: "champion", icon: "👑", title: "Champion", desc: "Win 10 games" },
  // ── Guessing ─────────────────────────────────────────────────────────
  {
    id: "speed_demon",
    icon: "⚡",
    title: "Speed Demon",
    desc: "Guess correctly in under 5 seconds",
  },
  {
    id: "sharp_eye",
    icon: "🔍",
    title: "Sharp Eye",
    desc: "Guess correctly 5 times in one game",
  },
  {
    id: "mind_reader",
    icon: "🧠",
    title: "Mind Reader",
    desc: "Be first to guess correctly 3 times in one game",
  },
  // ── Drawing ──────────────────────────────────────────────────────────
  {
    id: "picasso",
    icon: "🎨",
    title: "Picasso",
    desc: "Everyone guesses your drawing correctly",
  },
  {
    id: "abstract_artist",
    icon: "🖼️",
    title: "Abstract Artist",
    desc: "Nobody guesses your drawing",
  },
  // ── Participation ─────────────────────────────────────────────────────
  { id: "regular", icon: "🎮", title: "Regular", desc: "Play 5 games" },
  { id: "veteran", icon: "🎖️", title: "Veteran", desc: "Play 25 games" },
  {
    id: "high_scorer",
    icon: "💯",
    title: "High Scorer",
    desc: "Score 500+ points in a single game",
  },
  {
    id: "comeback_kid",
    icon: "🔥",
    title: "Comeback Kid",
    desc: "Win after being in last place",
  },
];

// In-memory store: playerId -> Set of earned achievement ids
const earned = new Map();

function getEarned(playerId) {
  if (!earned.has(playerId)) earned.set(playerId, new Set());
  return earned.get(playerId);
}

/**
 * Check achievements after a game ends.
 * @param {Array} leaderboard — [{id, nickname, avatar, score}, ...]
 * @param {Object} gameStats  — extra stats collected during the game
 * @returns {Array} [{playerId, achievement}, ...] newly unlocked
 */
function checkGameEnd(leaderboard, gameStats = {}) {
  const unlocked = [];
  const winner = leaderboard[0];

  leaderboard.forEach((entry, rank) => {
    const { id: playerId, score } = entry;
    const stats = gameStats[playerId] || {};
    const e = getEarned(playerId);

    const award = (achId) => {
      if (e.has(achId)) return;
      const ach = ACHIEVEMENTS.find((a) => a.id === achId);
      if (!ach) return;
      e.add(achId);
      unlocked.push({ playerId, achievement: ach });
    };

    // Wins
    const wins = stats.totalWins || 0;
    if (rank === 0) {
      award("first_win");
      if (wins >= 3) award("hat_trick");
      if (wins >= 10) award("champion");
    }

    // Score
    if (score >= 500) award("high_scorer");

    // Guessing
    if ((stats.correctGuesses || 0) >= 5) award("sharp_eye");
    if ((stats.firstGuesses || 0) >= 3) award("mind_reader");
    if ((stats.fastestGuessMs || Infinity) <= 5000) award("speed_demon");

    // Drawing
    if (stats.allGuessedMyDrawing) award("picasso");
    if (stats.noneGuessedMyDrawing) award("abstract_artist");

    // Comeback
    if (rank === 0 && stats.wasLastAtSomePoint) award("comeback_kid");

    // Games played
    const games = stats.totalGames || 0;
    if (games >= 5) award("regular");
    if (games >= 25) award("veteran");
  });

  return unlocked;
}

/**
 * Get all earned achievements for a player.
 */
function getPlayerAchievements(playerId) {
  const e = getEarned(playerId);
  return ACHIEVEMENTS.filter((a) => e.has(a.id));
}

module.exports = { checkGameEnd, getPlayerAchievements, ACHIEVEMENTS };
