import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useGame } from "../contexts/GameContext";
import { randomAvatar, AVATARS } from "../utils/avatars";

export default function JoinRoomPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { joinRoom } = useGame();

  // nick/av come from HomePage flow; code comes from invite link
  const nickFromUrl = params.get("nick") || "";
  const avFromUrl = params.get("av") || "";
  const codeFromUrl = params.get("code") || "";

  const [nickname, setNickname] = useState(nickFromUrl);
  const [avatar, setAvatar] = useState(avFromUrl || randomAvatar());
  const [showAvatars, setShowAvatars] = useState(false);
  const [roomCode, setRoomCode] = useState(codeFromUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // If arrived via invite link (has code but no nick), we show the nickname form.
  // If arrived from HomePage (has nick), roomCode may still be empty — show code input.
  const arrivedViaLink = !!codeFromUrl && !nickFromUrl;

  const canJoin = nickname.trim().length >= 2 && roomCode.trim().length === 6;

  const handleJoin = async () => {
    if (!canJoin) return;
    setLoading(true);
    setError("");
    try {
      await joinRoom(roomCode.trim().toUpperCase(), nickname.trim(), avatar);
      navigate(`/lobby/${roomCode.trim().toUpperCase()}`);
    } catch (e: any) {
      setError(e.message || "Could not join room");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-game-bg flex items-center justify-center p-4">
      <div className="bg-game-card border border-game-border rounded-2xl p-8 w-full max-w-sm shadow-2xl">
        <button
          onClick={() => navigate("/")}
          className="text-gray-400 hover:text-white mb-4 text-sm"
        >
          ← Back
        </button>

        <h1 className="font-game text-game-accent text-3xl mb-2">Join Room</h1>

        {arrivedViaLink && (
          <p className="text-gray-400 text-sm mb-5">
            You were invited! Enter your nickname to join room{" "}
            <span className="text-yellow-400 font-bold tracking-widest">
              {codeFromUrl}
            </span>
          </p>
        )}

        {/* Nickname — always shown */}
        <div className="mb-4">
          <label className="text-gray-400 text-xs mb-1 block">
            Your nickname
          </label>

          {/* Avatar picker inline */}
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={() => setShowAvatars((s) => !s)}
              className="w-12 h-12 rounded-full bg-game-bg border-2 border-game-border hover:border-game-accent text-2xl flex items-center justify-center transition-all hover:scale-110 shrink-0"
              title="Pick avatar"
            >
              {avatar}
            </button>
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value.slice(0, 20))}
              placeholder="Enter nickname…"
              maxLength={20}
              autoFocus
              className="flex-1 bg-game-bg border-2 border-game-border rounded-xl px-4 py-2.5 text-white font-semibold placeholder-gray-500 focus:outline-none focus:border-game-accent"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleJoin();
              }}
            />
          </div>

          {showAvatars && (
            <div className="grid grid-cols-8 gap-1 p-2 bg-game-bg rounded-xl border border-game-border mb-2">
              {AVATARS.map((a) => (
                <button
                  key={a}
                  onClick={() => {
                    setAvatar(a);
                    setShowAvatars(false);
                  }}
                  className={`text-xl p-1 rounded hover:bg-game-border transition-all ${avatar === a ? "bg-game-border" : ""}`}
                >
                  {a}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Room code — shown when NOT arrived via link (or always editable) */}
        {!arrivedViaLink && (
          <div className="mb-4">
            <label className="text-gray-400 text-xs mb-1 block">
              Room code
            </label>
            <input
              value={roomCode}
              onChange={(e) =>
                setRoomCode(e.target.value.toUpperCase().slice(0, 6))
              }
              placeholder="XXXXXX"
              maxLength={6}
              className="w-full bg-game-bg border-2 border-game-border rounded-xl px-4 py-3 text-white font-game text-2xl placeholder-gray-500 focus:outline-none focus:border-game-accent text-center tracking-widest uppercase"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleJoin();
              }}
            />
          </div>
        )}

        {error && <p className="text-game-accent text-sm mb-3">{error}</p>}

        <button
          onClick={handleJoin}
          disabled={loading || !canJoin}
          className="w-full py-3 bg-game-accent text-white font-game text-xl rounded-xl hover:bg-red-500 disabled:opacity-40 transition-all hover:scale-105 active:scale-95"
        >
          {loading ? "Joining…" : "🚪 Join Game"}
        </button>
      </div>
    </div>
  );
}
