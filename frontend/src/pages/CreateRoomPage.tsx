import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useGame } from "../contexts/GameContext";

export default function CreateRoomPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { createRoom } = useGame();

  const nick = params.get("nick") || "";
  const av = params.get("av") || "🎨";

  const [maxPlayers, setMaxPlayers] = useState(8);
  const [rounds, setRounds] = useState(3);
  const [drawTime, setDrawTime] = useState(80);
  const [wordCount, setWordCount] = useState(3);
  const [hintsEnabled, setHintsEnabled] = useState(true);
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    if (!nick) return navigate("/");
    setLoading(true);
    setError("");
    try {
      const { roomCode } = await createRoom(nick, av, {
        maxPlayers,
        rounds,
        drawTime,
        wordCount,
        hintsEnabled,
        isPrivate,
        maxHints: 3,
      });
      navigate(`/lobby/${roomCode}`);
    } catch (e: any) {
      setError(e.message || "Failed to create room");
    } finally {
      setLoading(false);
    }
  };

  const Setting = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex items-center justify-between gap-4">
      <span className="text-gray-300 font-semibold text-sm w-36 shrink-0">{label}</span>
      {children}
    </div>
  );

  return (
    <div className="min-h-screen bg-game-bg flex items-center justify-center p-4">
      <div className="bg-game-card border border-game-border rounded-2xl p-8 w-full max-w-md shadow-2xl">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-white mb-4 text-sm">← Back</button>
        <h1 className="font-game text-game-accent text-3xl mb-6">Create Room</h1>

        <div className="space-y-4">
          <Setting label="Max Players">
            <div className="flex items-center gap-2">
              <input
                type="range" min={2} max={20} value={maxPlayers}
                onChange={(e) => setMaxPlayers(+e.target.value)}
                className="flex-1 accent-game-accent"
              />
              <span className="text-yellow-400 font-bold w-6 text-center">{maxPlayers}</span>
            </div>
          </Setting>

          <Setting label="Rounds">
            <div className="flex items-center gap-2">
              <input
                type="range" min={2} max={10} value={rounds}
                onChange={(e) => setRounds(+e.target.value)}
                className="flex-1 accent-game-accent"
              />
              <span className="text-yellow-400 font-bold w-6 text-center">{rounds}</span>
            </div>
          </Setting>

          <Setting label="Draw Time (s)">
            <div className="flex items-center gap-2">
              <input
                type="range" min={15} max={240} step={5} value={drawTime}
                onChange={(e) => setDrawTime(+e.target.value)}
                className="flex-1 accent-game-accent"
              />
              <span className="text-yellow-400 font-bold w-8 text-center">{drawTime}</span>
            </div>
          </Setting>

          <Setting label="Word Choices">
            <div className="flex items-center gap-2">
              <input
                type="range" min={1} max={5} value={wordCount}
                onChange={(e) => setWordCount(+e.target.value)}
                className="flex-1 accent-game-accent"
              />
              <span className="text-yellow-400 font-bold w-6 text-center">{wordCount}</span>
            </div>
          </Setting>

          <Setting label="Hints">
            <button
              onClick={() => setHintsEnabled(!hintsEnabled)}
              className={`px-4 py-1.5 rounded-lg font-bold text-sm transition-all ${
                hintsEnabled ? "bg-green-600 text-white" : "bg-game-border text-gray-400"
              }`}
            >
              {hintsEnabled ? "On" : "Off"}
            </button>
          </Setting>

          <Setting label="Private Room">
            <button
              onClick={() => setIsPrivate(!isPrivate)}
              className={`px-4 py-1.5 rounded-lg font-bold text-sm transition-all ${
                isPrivate ? "bg-game-accent text-white" : "bg-game-border text-gray-400"
              }`}
            >
              {isPrivate ? "Private 🔒" : "Public 🌐"}
            </button>
          </Setting>
        </div>

        {error && <p className="text-game-accent text-sm mt-3">{error}</p>}

        <button
          onClick={handleCreate}
          disabled={loading}
          className="mt-6 w-full py-3 bg-game-accent text-white font-game text-xl rounded-xl hover:bg-red-500 disabled:opacity-60 transition-all hover:scale-105 active:scale-95"
        >
          {loading ? "Creating…" : "🚀 Create Room"}
        </button>
      </div>
    </div>
  );
}
