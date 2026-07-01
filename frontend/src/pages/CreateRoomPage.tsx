import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useGame } from "../contexts/GameContext";

type Difficulty = "all" | "easy" | "medium" | "hard";

export default function CreateRoomPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { createRoom } = useGame();

  const nick = params.get("nick") || "";
  const av   = params.get("av")   || "🎨";

  const [maxPlayers,   setMaxPlayers]   = useState(8);
  const [rounds,       setRounds]       = useState(3);
  const [drawTime,     setDrawTime]     = useState(80);
  const [wordCount,    setWordCount]    = useState(3);
  const [hintsEnabled, setHintsEnabled] = useState(true);
  const [isPrivate,    setIsPrivate]    = useState(false);
  const [difficulty,   setDifficulty]   = useState<Difficulty>("all");
  const [customWordsRaw, setCustomWordsRaw] = useState("");
  const [showCustomWords, setShowCustomWords] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const customWords = customWordsRaw
    .split(",")
    .map(w => w.trim())
    .filter(w => w.length > 0);

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
        difficulty,
        customWords,
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

  const diffColors: Record<Difficulty, string> = {
    all:    "bg-game-border text-gray-300",
    easy:   "bg-green-700 text-white",
    medium: "bg-yellow-600 text-white",
    hard:   "bg-red-700 text-white",
  };

  return (
    <div className="min-h-screen bg-game-bg flex items-center justify-center p-4">
      <div className="bg-game-card border border-game-border rounded-2xl p-8 w-full max-w-md shadow-2xl">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-white mb-4 text-sm">← Back</button>
        <h1 className="font-game text-game-accent text-3xl mb-6">Create Room</h1>

        <div className="space-y-4">
          {/* Max Players */}
          <Setting label="Max Players">
            <div className="flex items-center gap-2">
              <input type="range" min={2} max={20} value={maxPlayers}
                onChange={e => setMaxPlayers(+e.target.value)}
                className="flex-1 accent-game-accent" />
              <span className="text-yellow-400 font-bold w-6 text-center">{maxPlayers}</span>
            </div>
          </Setting>

          {/* Rounds */}
          <Setting label="Rounds">
            <div className="flex items-center gap-2">
              <input type="range" min={2} max={10} value={rounds}
                onChange={e => setRounds(+e.target.value)}
                className="flex-1 accent-game-accent" />
              <span className="text-yellow-400 font-bold w-6 text-center">{rounds}</span>
            </div>
          </Setting>

          {/* Draw Time */}
          <Setting label="Draw Time (s)">
            <div className="flex items-center gap-2">
              <input type="range" min={15} max={240} step={5} value={drawTime}
                onChange={e => setDrawTime(+e.target.value)}
                className="flex-1 accent-game-accent" />
              <span className="text-yellow-400 font-bold w-8 text-center">{drawTime}</span>
            </div>
          </Setting>

          {/* Word Choices */}
          <Setting label="Word Choices">
            <div className="flex items-center gap-2">
              <input type="range" min={1} max={5} value={wordCount}
                onChange={e => setWordCount(+e.target.value)}
                className="flex-1 accent-game-accent" />
              <span className="text-yellow-400 font-bold w-6 text-center">{wordCount}</span>
            </div>
          </Setting>

          {/* Difficulty */}
          <Setting label="Difficulty">
            <div className="flex gap-1">
              {(["all","easy","medium","hard"] as Difficulty[]).map(d => (
                <button key={d} onClick={() => setDifficulty(d)}
                  className={`px-2 py-1 rounded-lg text-xs font-bold capitalize transition-all ${
                    difficulty === d ? diffColors[d] : "bg-game-border text-gray-400 hover:text-white"
                  }`}>
                  {d}
                </button>
              ))}
            </div>
          </Setting>

          {/* Hints */}
          <Setting label="Hints">
            <button onClick={() => setHintsEnabled(!hintsEnabled)}
              className={`px-4 py-1.5 rounded-lg font-bold text-sm transition-all ${
                hintsEnabled ? "bg-green-600 text-white" : "bg-game-border text-gray-400"
              }`}>
              {hintsEnabled ? "On" : "Off"}
            </button>
          </Setting>

          {/* Private */}
          <Setting label="Visibility">
            <button onClick={() => setIsPrivate(!isPrivate)}
              className={`px-4 py-1.5 rounded-lg font-bold text-sm transition-all ${
                isPrivate ? "bg-game-accent text-white" : "bg-game-border text-gray-400"
              }`}>
              {isPrivate ? "Private 🔒" : "Public 🌐"}
            </button>
          </Setting>

          {/* Private passcode note */}
          {isPrivate && (
            <div className="bg-yellow-900/20 border border-yellow-800/40 rounded-xl px-4 py-3 text-sm">
              <div className="flex items-center gap-2 text-yellow-400 font-semibold mb-1">
                🔒 Private Room
              </div>
              <p className="text-gray-400 text-xs leading-relaxed">
                A <strong className="text-yellow-300">6-character passcode</strong> will be auto-generated
                when the room is created. Share it with players so they can join.
                You'll see it in the lobby.
              </p>
            </div>
          )}

          {/* Custom Words */}
          <div>
            <button onClick={() => setShowCustomWords(s => !s)}
              className="text-sm text-game-accent hover:text-red-400 flex items-center gap-1 mb-2">
              📝 {showCustomWords ? "Hide" : "Add"} Custom Words
              {customWords.length > 0 && (
                <span className="bg-game-accent text-white text-xs px-1.5 rounded-full">{customWords.length}</span>
              )}
            </button>
            {showCustomWords && (
              <div>
                <textarea
                  value={customWordsRaw}
                  onChange={e => setCustomWordsRaw(e.target.value)}
                  placeholder="apple, rocket ship, dancing, eiffel tower…"
                  rows={3}
                  className="w-full bg-game-bg border border-game-border rounded-xl px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-game-accent resize-none"
                />
                <p className="text-gray-500 text-xs mt-1">
                  Separate with commas · {customWords.length} word{customWords.length !== 1 ? "s" : ""} added
                  {customWords.length > 0 && customWords.length < wordCount && (
                    <span className="text-yellow-500"> · Will mix with default words</span>
                  )}
                </p>
              </div>
            )}
          </div>
        </div>

        {error && <p className="text-game-accent text-sm mt-3">{error}</p>}

        <button onClick={handleCreate} disabled={loading}
          className="mt-6 w-full py-3 bg-game-accent text-white font-game text-xl rounded-xl hover:bg-red-500 disabled:opacity-60 transition-all hover:scale-105 active:scale-95">
          {loading ? "Creating…" : "🚀 Create Room"}
        </button>
      </div>
    </div>
  );
}