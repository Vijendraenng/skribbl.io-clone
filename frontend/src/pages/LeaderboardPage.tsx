import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const BACKEND = (
  ((import.meta as any).env?.VITE_BACKEND_URL as string) ||
  "http://localhost:3001"
).replace(/\/$/, "");

interface Entry {
  rank: number;
  id: string;
  nickname: string;
  avatar: string;
  totalScore: number;
  gamesPlayed: number;
  wins: number;
  bestScore: number;
}

type Period = "alltime" | "weekly";

const MEDALS = ["🥇", "🥈", "🥉"];

export default function LeaderboardPage() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<Period>("alltime");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    setError("");
    fetch(`${BACKEND}/api/leaderboard?period=${period}&limit=50`, {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((d) => {
        setEntries(d.entries || []);
        setLastUpdated(d.updatedAt || null);
      })
      .catch(() => setError("Could not load leaderboard"))
      .finally(() => setLoading(false));
  }, [period]);

  const since = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="min-h-screen bg-game-bg py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate("/")}
            className="text-gray-400 hover:text-white text-sm border border-game-border px-3 py-1.5 rounded-lg transition-all hover:border-white"
          >
            ← Back
          </button>
          <div>
            <h1 className="font-game text-game-accent text-3xl">
              🏆 Leaderboard
            </h1>
            {since && (
              <p className="text-gray-500 text-xs mt-0.5">Updated {since}</p>
            )}
          </div>
        </div>

        {/* Period tabs */}
        <div className="flex gap-2 mb-6">
          {(["alltime", "weekly"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-5 py-2 rounded-xl font-game text-sm transition-all ${
                period === p
                  ? "bg-game-accent text-white shadow-lg scale-105"
                  : "bg-game-card border border-game-border text-gray-400 hover:text-white"
              }`}
            >
              {p === "alltime" ? "🌍 All Time" : "📅 This Week"}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading && (
          <div className="text-center py-16 text-gray-400 animate-pulse">
            Loading…
          </div>
        )}

        {error && (
          <div className="text-center py-16 text-game-accent">{error}</div>
        )}

        {!loading && !error && entries.length === 0 && (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">🏜️</div>
            <p className="text-gray-400 font-game text-lg">No scores yet</p>
            <p className="text-gray-500 text-sm mt-1">
              {period === "weekly"
                ? "Play some games this week!"
                : "Be the first to play!"}
            </p>
          </div>
        )}

        {!loading && !error && entries.length > 0 && (
          <div className="flex flex-col gap-2">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className={`flex items-center gap-4 rounded-xl px-4 py-3 border transition-all ${
                  entry.rank === 1
                    ? "bg-yellow-600/10 border-yellow-600/40"
                    : entry.rank === 2
                      ? "bg-gray-400/10 border-gray-400/30"
                      : entry.rank === 3
                        ? "bg-orange-700/10 border-orange-700/30"
                        : "bg-game-card border-game-border"
                }`}
              >
                {/* Rank */}
                <div className="w-8 text-center shrink-0">
                  {entry.rank <= 3 ? (
                    <span className="text-xl">{MEDALS[entry.rank - 1]}</span>
                  ) : (
                    <span className="text-gray-500 font-bold text-sm">
                      {entry.rank}
                    </span>
                  )}
                </div>

                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-game-bg flex items-center justify-center text-xl border border-game-border shrink-0">
                  {entry.avatar}
                </div>

                {/* Name + stats */}
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-white text-sm truncate">
                    {entry.nickname}
                  </div>
                  <div className="flex gap-3 text-xs text-gray-500 mt-0.5 flex-wrap">
                    <span>🎮 {entry.gamesPlayed} games</span>
                    <span>🏆 {entry.wins} wins</span>
                    <span>⭐ Best: {entry.bestScore}</span>
                  </div>
                </div>

                {/* Total score */}
                <div className="text-right shrink-0">
                  <div
                    className={`font-game font-bold text-lg ${
                      entry.rank === 1
                        ? "text-yellow-400"
                        : entry.rank === 2
                          ? "text-gray-300"
                          : entry.rank === 3
                            ? "text-orange-400"
                            : "text-white"
                    }`}
                  >
                    {entry.totalScore.toLocaleString()}
                  </div>
                  <div className="text-gray-500 text-xs">pts</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Disclaimer */}
        <p className="text-center text-gray-600 text-xs mt-8">
          Leaderboard resets every Monday · Top 50 shown
        </p>
      </div>
    </div>
  );
}
