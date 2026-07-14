import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useGame } from "../contexts/GameContext";

const BACKEND = (
  ((import.meta as any).env?.VITE_BACKEND_URL as string) ||
  "http://localhost:3001"
).replace(/\/$/, "");

interface GameRecord {
  gameId: string;
  roomCode: string;
  playedAt: number;
  duration: number;
  winner: {
    id: string;
    nickname: string;
    avatar: string;
    score: number;
  } | null;
  players: { id: string; nickname: string; avatar: string; score: number }[];
}

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60),
    s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function MatchHistoryPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { playerId: myId } = useGame();
  const playerId = params.get("player") || myId || "";

  const [records, setRecords] = useState<GameRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!playerId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`${BACKEND}/api/history/${playerId}?limit=20`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setRecords(d.records || []))
      .catch(() => setError("Could not load match history"))
      .finally(() => setLoading(false));
  }, [playerId]);

  return (
    <div className="min-h-screen bg-game-bg py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="text-gray-400 hover:text-white text-sm border border-game-border px-3 py-1.5 rounded-lg transition-all"
          >
            ← Back
          </button>
          <h1 className="font-game text-game-accent text-3xl">
            📜 Match History
          </h1>
        </div>

        {loading && (
          <div className="text-center py-16 text-gray-400 animate-pulse">
            Loading…
          </div>
        )}
        {error && (
          <div className="text-center py-16 text-game-accent">{error}</div>
        )}

        {!loading && !error && records.length === 0 && (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">🎮</div>
            <p className="text-gray-400 font-game text-lg">
              No games played yet
            </p>
            <p className="text-gray-500 text-sm mt-1">
              Complete a game to see it here
            </p>
            <button
              onClick={() => navigate("/")}
              className="mt-4 px-6 py-2 bg-game-accent text-white font-game rounded-xl hover:bg-red-500 transition-all"
            >
              Play Now
            </button>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {records.map((record, idx) => {
            const myEntry = record.players.find((p) => p.id === playerId);
            const isWinner = record.winner?.id === playerId;
            const rank =
              record.players
                .sort((a, b) => b.score - a.score)
                .findIndex((p) => p.id === playerId) + 1;

            return (
              <div
                key={record.gameId || idx}
                className={`bg-game-card border rounded-xl p-4 transition-all ${
                  isWinner ? "border-yellow-600/50" : "border-game-border"
                }`}
              >
                {/* Top row */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {isWinner && (
                      <span className="text-yellow-400 text-lg">🏆</span>
                    )}
                    <div>
                      <div className="text-white font-bold text-sm">
                        {isWinner
                          ? "Victory!"
                          : rank > 0
                            ? `Rank #${rank}`
                            : "Participated"}
                      </div>
                      <div className="text-gray-500 text-xs">
                        {timeAgo(record.playedAt)} ·{" "}
                        {formatDuration(record.duration)} · Room{" "}
                        {record.roomCode}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`font-game font-bold text-xl ${isWinner ? "text-yellow-400" : "text-white"}`}
                    >
                      {myEntry?.score.toLocaleString() ?? "—"}
                    </div>
                    <div className="text-gray-500 text-xs">pts</div>
                  </div>
                </div>

                {/* Players */}
                <div className="flex flex-wrap gap-1.5">
                  {[...record.players]
                    .sort((a, b) => b.score - a.score)
                    .map((p, i) => (
                      <div
                        key={p.id}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs border ${
                          p.id === playerId
                            ? "border-game-accent bg-game-accent/10 text-white font-bold"
                            : "border-game-border text-gray-400"
                        }`}
                      >
                        <span>{p.avatar}</span>
                        <span className="hidden sm:inline">{p.nickname}</span>
                        <span className="text-yellow-400 font-bold">
                          {p.score}
                        </span>
                        {i === 0 && <span>🥇</span>}
                      </div>
                    ))}
                </div>
              </div>
            );
          })}
        </div>

        {records.length > 0 && (
          <p className="text-center text-gray-600 text-xs mt-8">
            Showing last {records.length} games · History resets on server
            restart
          </p>
        )}
      </div>
    </div>
  );
}
