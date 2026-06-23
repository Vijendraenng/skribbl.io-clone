import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useGame } from "../contexts/GameContext";
import { randomAvatar, AVATARS } from "../utils/avatars";
import { avatarBgColor } from "../utils/avatars";

const BACKEND_URL =
  ((import.meta as any).env?.VITE_BACKEND_URL as string) ||
  "http://localhost:3001";

interface PublicRoom {
  id: string;
  roomCode: string;
  hostId: string;
  settings: {
    maxPlayers: number;
    rounds: number;
    drawTime: number;
    hintsEnabled: boolean;
    isPrivate: boolean;
  };
  status: string;
  players: { id: string; nickname: string; avatar: string }[];
  playerCount: number;
}

export default function PublicRoomsPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { joinRoom } = useGame();

  const nickFromUrl = params.get("nick") || "";
  const avFromUrl = params.get("av") || "";

  const [nickname, setNickname] = useState(nickFromUrl);
  const [avatar, setAvatar] = useState(avFromUrl || randomAvatar());
  const [showAvatars, setShowAvatars] = useState(false);
  const [rooms, setRooms] = useState<PublicRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);
  const [error, setError] = useState("");

  const canPlay = nickname.trim().length >= 2;

  const fetchRooms = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/rooms`);
      const data = await res.json();
      setRooms(data.rooms || []);
    } catch {
      // silently ignore fetch errors on polling
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + poll every 3 seconds
  useEffect(() => {
    fetchRooms();
    const iv = setInterval(fetchRooms, 3000);
    return () => clearInterval(iv);
  }, [fetchRooms]);

  const handleJoin = async (roomCode: string) => {
    if (!canPlay) return setError("Enter a nickname first");
    setJoining(roomCode);
    setError("");
    try {
      await joinRoom(roomCode, nickname.trim(), avatar);
      navigate(`/lobby/${roomCode}`);
    } catch (e: any) {
      setError(e.message || "Could not join room");
      setJoining(null);
    }
  };

  const handleQuickJoin = async () => {
    if (!canPlay) return setError("Enter a nickname first");
    if (rooms.length === 0) return setError("No open rooms right now");
    // Pick the room with the most players (most active)
    const best = [...rooms].sort((a, b) => b.playerCount - a.playerCount)[0];
    await handleJoin(best.roomCode);
  };

  return (
    <div className="min-h-screen bg-game-bg p-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6 pt-4">
          <button
            onClick={() => navigate("/")}
            className="text-gray-400 hover:text-white text-sm"
          >
            ← Back
          </button>
          <h1 className="font-game text-game-accent text-3xl">Public Rooms</h1>
          <button
            onClick={fetchRooms}
            className="ml-auto text-gray-400 hover:text-white text-sm px-3 py-1 rounded-lg border border-game-border hover:border-game-accent transition-all"
          >
            🔄 Refresh
          </button>
        </div>

        {/* Identity bar */}
        <div className="bg-game-card border border-game-border rounded-2xl p-4 mb-6 flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setShowAvatars((s) => !s)}
            className="w-12 h-12 rounded-full bg-game-bg border-2 border-game-border hover:border-game-accent text-2xl flex items-center justify-center transition-all hover:scale-110 shrink-0"
          >
            {avatar}
          </button>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value.slice(0, 20))}
            placeholder="Your nickname to join…"
            maxLength={20}
            className="flex-1 min-w-[160px] bg-game-bg border-2 border-game-border rounded-xl px-4 py-2 text-white font-semibold placeholder-gray-500 focus:outline-none focus:border-game-accent"
          />
          <button
            onClick={handleQuickJoin}
            disabled={!canPlay || rooms.length === 0}
            className="px-5 py-2 bg-game-accent text-white font-game text-lg rounded-xl hover:bg-red-500 disabled:opacity-40 transition-all hover:scale-105 active:scale-95 shrink-0"
          >
            ⚡ Quick Join
          </button>
        </div>

        {showAvatars && (
          <div className="bg-game-card border border-game-border rounded-xl p-3 mb-4 grid grid-cols-8 gap-1.5">
            {AVATARS.map((a) => (
              <button
                key={a}
                onClick={() => {
                  setAvatar(a);
                  setShowAvatars(false);
                }}
                className={`text-2xl p-1 rounded-lg hover:bg-game-border transition-all ${avatar === a ? "bg-game-border scale-110" : ""}`}
              >
                {a}
              </button>
            ))}
          </div>
        )}

        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-xl px-4 py-2 text-red-400 text-sm mb-4">
            {error}
          </div>
        )}

        {/* Room list */}
        {loading ? (
          <div className="text-center text-gray-400 py-16 animate-pulse">
            Looking for open rooms…
          </div>
        ) : rooms.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">🎨</div>
            <div className="text-gray-300 font-semibold text-lg mb-1">
              No open rooms yet
            </div>
            <p className="text-gray-500 text-sm mb-5">
              Be the first to create one!
            </p>
            <button
              onClick={() =>
                navigate(
                  canPlay
                    ? `/create?nick=${encodeURIComponent(nickname)}&av=${encodeURIComponent(avatar)}`
                    : "/",
                )
              }
              className="px-6 py-3 bg-game-accent text-white font-game text-lg rounded-xl hover:bg-red-500 transition-all hover:scale-105"
            >
              🏠 Create Room
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-gray-400 text-sm">
              {rooms.length} open room{rooms.length !== 1 ? "s" : ""} · Updates
              every 3s
            </p>
            {rooms.map((room) => {
              const isFull = room.playerCount >= room.settings.maxPlayers;
              const fillPct = Math.round(
                (room.playerCount / room.settings.maxPlayers) * 100,
              );

              return (
                <div
                  key={room.roomCode}
                  className="bg-game-card border border-game-border rounded-2xl p-5 flex items-center gap-4 hover:border-game-accent/50 transition-all"
                >
                  {/* Room info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-game text-white text-lg tracking-widest">
                        {room.roomCode}
                      </span>
                      {isFull && (
                        <span className="text-xs bg-red-800/40 text-red-400 px-2 py-0.5 rounded-full">
                          Full
                        </span>
                      )}
                    </div>

                    {/* Player avatars */}
                    <div className="flex items-center gap-1 mb-2">
                      {room.players.slice(0, 8).map((p) => (
                        <div
                          key={p.id}
                          title={p.nickname}
                          className="w-6 h-6 rounded-full flex items-center justify-center text-xs border border-game-border"
                          style={{ backgroundColor: avatarBgColor(p.nickname) }}
                        >
                          {p.avatar}
                        </div>
                      ))}
                      {room.playerCount > 8 && (
                        <span className="text-xs text-gray-500">
                          +{room.playerCount - 8}
                        </span>
                      )}
                    </div>

                    {/* Settings chips */}
                    <div className="flex gap-2 flex-wrap text-xs text-gray-400">
                      <span className="bg-game-bg px-2 py-0.5 rounded">
                        👥 {room.playerCount}/{room.settings.maxPlayers}
                      </span>
                      <span className="bg-game-bg px-2 py-0.5 rounded">
                        🔄 {room.settings.rounds} rounds
                      </span>
                      <span className="bg-game-bg px-2 py-0.5 rounded">
                        ⏱ {room.settings.drawTime}s
                      </span>
                      {room.settings.hintsEnabled && (
                        <span className="bg-game-bg px-2 py-0.5 rounded">
                          💡 Hints
                        </span>
                      )}
                    </div>

                    {/* Fill bar */}
                    <div className="mt-2 h-1 bg-game-border rounded-full overflow-hidden w-32">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${fillPct}%`,
                          backgroundColor: isFull
                            ? "#e94560"
                            : fillPct > 75
                              ? "#fbbf24"
                              : "#4ade80",
                        }}
                      />
                    </div>
                  </div>

                  {/* Join button */}
                  <button
                    onClick={() => handleJoin(room.roomCode)}
                    disabled={isFull || !canPlay || joining === room.roomCode}
                    className="px-5 py-2.5 bg-game-accent text-white font-game text-lg rounded-xl hover:bg-red-500 disabled:opacity-40 transition-all hover:scale-105 active:scale-95 shrink-0"
                  >
                    {joining === room.roomCode
                      ? "Joining…"
                      : isFull
                        ? "Full"
                        : "Join →"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
