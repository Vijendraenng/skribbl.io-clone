import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { randomAvatar, AVATARS } from "../utils/avatars";
import { useGame } from "../contexts/GameContext";

const BACKEND_URL =
  ((import.meta as any).env?.VITE_BACKEND_URL as string) ||
  "http://localhost:3001";

export default function HomePage() {
  const navigate = useNavigate();
  const { fullReset } = useGame();
  const [nickname, setNickname] = useState("");
  const [avatar, setAvatar] = useState(randomAvatar);
  const [showAvatars, setShowAvatars] = useState(false);
  const [publicRoomCount, setPublicRoomCount] = useState<number | null>(null);

  useEffect(() => {
    fullReset();
    // Fetch public room count to show on the browse button
    fetch(`${BACKEND_URL}/api/rooms`)
      .then((r) => r.json())
      .then((d) => setPublicRoomCount(d.rooms?.length ?? 0))
      .catch(() => {});
  }, []);

  const canPlay = nickname.trim().length >= 2;
  const enc = (s: string) => encodeURIComponent(s);

  return (
    <div className="min-h-screen bg-game-bg flex flex-col items-center justify-center p-4">
      {/* Hero */}
      <div className="text-center mb-10">
        <div className="font-game text-7xl text-game-accent mb-2 drop-shadow-lg">
          Skribbl
        </div>
        <div className="font-game text-2xl text-yellow-400">
          Draw. Guess. Win! ✏️
        </div>
        <p className="text-gray-400 mt-2 max-w-sm mx-auto text-sm">
          Multiplayer drawing and guessing game. Play with friends or join a
          public room!
        </p>
      </div>

      {/* Setup card */}
      <div className="bg-game-card border border-game-border rounded-2xl p-8 w-full max-w-sm shadow-2xl">
        {/* Avatar picker */}
        <div className="flex items-center justify-center mb-5">
          <button
            onClick={() => setShowAvatars((s) => !s)}
            className="w-20 h-20 rounded-full bg-game-bg border-2 border-game-border hover:border-game-accent text-5xl flex items-center justify-center transition-all hover:scale-110"
            title="Choose avatar"
          >
            {avatar}
          </button>
        </div>

        {showAvatars && (
          <div className="grid grid-cols-8 gap-1.5 mb-4 p-3 bg-game-bg rounded-xl border border-game-border">
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

        {/* Nickname */}
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value.slice(0, 20))}
          placeholder="Your nickname…"
          maxLength={20}
          className="w-full bg-game-bg border-2 border-game-border rounded-xl px-4 py-3 text-white font-semibold placeholder-gray-500 focus:outline-none focus:border-game-accent mb-4 text-center text-lg"
          onKeyDown={(e) => {
            if (e.key === "Enter" && canPlay)
              navigate(`/create?nick=${enc(nickname)}&av=${enc(avatar)}`);
          }}
        />

        {/* Buttons */}
        <div className="flex flex-col gap-3">
          <button
            onClick={() =>
              navigate(`/create?nick=${enc(nickname)}&av=${enc(avatar)}`)
            }
            disabled={!canPlay}
            className="w-full py-3 bg-game-accent text-white font-game text-lg rounded-xl hover:bg-red-500 disabled:opacity-40 transition-all hover:scale-105 active:scale-95"
          >
            🏠 Create Room
          </button>

          {/* Browse public rooms — primary CTA with live count badge */}
          <button
            onClick={() =>
              navigate(`/rooms?nick=${enc(nickname)}&av=${enc(avatar)}`)
            }
            disabled={!canPlay}
            className="w-full py-3 bg-game-border text-white font-game text-lg rounded-xl hover:bg-green-700/40 hover:border-green-500 disabled:opacity-40 transition-all hover:scale-105 active:scale-95 border border-game-border relative"
          >
            🌐 Browse Public Rooms
            {publicRoomCount !== null && publicRoomCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[22px] text-center">
                {publicRoomCount}
              </span>
            )}
          </button>

          <button
            onClick={() =>
              navigate(`/join?nick=${enc(nickname)}&av=${enc(avatar)}`)
            }
            disabled={!canPlay}
            className="w-full py-2.5 bg-transparent text-gray-400 font-semibold text-sm rounded-xl hover:text-white hover:bg-game-border disabled:opacity-40 transition-all border border-game-border"
          >
            🔑 Join by Code
          </button>
        </div>

        {nickname.trim().length > 0 && nickname.trim().length < 2 && (
          <p className="text-game-accent text-xs text-center mt-2">
            Nickname must be at least 2 characters
          </p>
        )}
      </div>

      <p className="text-gray-600 text-xs mt-8">
        Free, no account required · Up to 20 players per room
      </p>
    </div>
  );
}
