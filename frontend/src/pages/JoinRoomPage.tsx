import React, { useState, useEffect, useRef, useCallback, memo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useGame } from "../contexts/GameContext";
import { randomAvatar, AVATARS } from "../utils/avatars";
import { getSocket } from "../utils/socket";

const BACKEND =
  ((import.meta as any).env?.VITE_BACKEND_URL as string) ||
  "http://localhost:3001";

/* ─────────────────────────────────────────────────────────────────────────
   PasscodeInput — fully isolated, zero useState, never loses focus
───────────────────────────────────────────────────────────────────────── */
const PasscodeInput = memo(function PasscodeInput({
  show,
  onPasscodeChange,
  onEnter,
}: {
  show: boolean;
  onPasscodeChange: (val: string) => void;
  onEnter: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (show) {
      if (inputRef.current) inputRef.current.value = "";
      onPasscodeChange("");
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [show]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    // Always in DOM — display toggled via style, never remounted
    <div style={{ display: show ? "block" : "none" }} className="mb-4">
      <label className="text-gray-400 text-xs mb-1 block">
        🔒 Room passcode required
      </label>
      <input
        ref={inputRef}
        type="text"
        placeholder="Enter 6-character passcode…"
        maxLength={6}
        autoComplete="off"
        onChange={(e) => {
          const val = e.target.value.toUpperCase();
          e.target.value = val; // keep input uppercase visually
          onPasscodeChange(val);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") onEnter();
        }}
        className="w-full bg-game-bg border-2 border-game-border rounded-xl
                   px-4 py-2.5 text-white font-game text-xl tracking-widest
                   placeholder-gray-500 placeholder:text-sm placeholder:font-sans
                   placeholder:tracking-normal focus:outline-none focus:border-yellow-500
                   uppercase text-center"
      />
      <p className="text-gray-500 text-xs mt-1 text-center">
        Ask the room host for the passcode
      </p>
    </div>
  );
});

/* ─────────────────────────────────────────────────────────────────────────
   JoinRoomPage
───────────────────────────────────────────────────────────────────────── */
export default function JoinRoomPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { joinRoom, joinAsSpectator } = useGame();

  const nickFromUrl = params.get("nick") || "";
  const avFromUrl = params.get("av") || "";
  const codeFromUrl = params.get("code") || "";

  const [nickname, setNickname] = useState(nickFromUrl);
  const [avatar, setAvatar] = useState(avFromUrl || randomAvatar());
  const [showAvatars, setShowAvatars] = useState(false);
  const [roomCode, setRoomCode] = useState(codeFromUrl);
  const [needsPasscode, setNeedsPasscode] = useState(false);
  const [asSpectator, setAsSpectator] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Passcode lives in a ref — never triggers re-renders
  const passcodeRef = useRef("");
  const checkedCodeRef = useRef("");

  const arrivedViaLink = !!codeFromUrl && !nickFromUrl;
  const canJoin = nickname.trim().length >= 2 && roomCode.trim().length === 6;

  const handlePasscodeChange = useCallback((val: string) => {
    passcodeRef.current = val;
  }, []);

  // Check if room needs a passcode — only when code hits 6 chars
  useEffect(() => {
    const code = roomCode.trim().toUpperCase();
    if (code.length !== 6 || code === checkedCodeRef.current) return;
    checkedCodeRef.current = code;
    passcodeRef.current = "";
    setNeedsPasscode(false);
    fetch(`${BACKEND}/api/rooms/${code}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.room?.settings?.hasPasscode) setNeedsPasscode(true);
      })
      .catch(() => {});
  }, [roomCode]);

  const handleJoin = useCallback(async () => {
    if (!canJoin) return;
    const pc = passcodeRef.current;
    if (needsPasscode && pc.length < 6) {
      setError("Please enter the 6-character passcode");
      return;
    }

    setLoading(true);
    setError("");
    try {
      if (asSpectator) {
        const { roomStatus } = await joinAsSpectator(
          roomCode.toUpperCase(),
          nickname.trim(),
          avatar,
          pc || undefined,
        );
        // If game is in progress, go straight to game page; otherwise lobby
        if (roomStatus === "playing") {
          navigate(`/game/${roomCode.toUpperCase()}`);
        } else {
          navigate(`/lobby/${roomCode.toUpperCase()}`);
        }
      } else {
        await joinRoom(
          roomCode.toUpperCase(),
          nickname.trim(),
          avatar,
          pc || undefined,
        );
        navigate(`/lobby/${roomCode.toUpperCase()}`);
      }
    } catch (e: any) {
      setError(e.message || "Could not join room");
    } finally {
      setLoading(false);
    }
  }, [
    canJoin,
    needsPasscode,
    asSpectator,
    roomCode,
    nickname,
    avatar,
    joinRoom,
    navigate,
  ]);

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
            You were invited! Join room{" "}
            <span className="text-yellow-400 font-bold tracking-widest">
              {codeFromUrl}
            </span>
          </p>
        )}

        {/* Nickname + avatar */}
        <div className="mb-4">
          <label className="text-gray-400 text-xs mb-1 block">
            Your nickname
          </label>
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={() => setShowAvatars((s) => !s)}
              className="w-12 h-12 rounded-full bg-game-bg border-2 border-game-border
                         hover:border-game-accent text-2xl flex items-center
                         justify-center transition-all shrink-0"
            >
              {avatar}
            </button>
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value.slice(0, 20))}
              placeholder="Enter nickname…"
              maxLength={20}
              autoFocus
              className="flex-1 bg-game-bg border-2 border-game-border rounded-xl
                         px-4 py-2.5 text-white font-semibold placeholder-gray-500
                         focus:outline-none focus:border-game-accent"
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
                  className={`text-xl p-1 rounded hover:bg-game-border ${avatar === a ? "bg-game-border" : ""}`}
                >
                  {a}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Room code */}
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
              className="w-full bg-game-bg border-2 border-game-border rounded-xl
                         px-4 py-3 text-white font-game text-2xl placeholder-gray-500
                         focus:outline-none focus:border-game-accent text-center
                         tracking-widest uppercase"
            />
          </div>
        )}

        {/* Passcode — isolated, always mounted, never loses focus */}
        <PasscodeInput
          show={needsPasscode}
          onPasscodeChange={handlePasscodeChange}
          onEnter={handleJoin}
        />

        {/* Spectator toggle */}
        <div className="mb-4">
          <button
            onClick={() => setAsSpectator((s) => !s)}
            className={`w-full py-2 rounded-xl text-sm font-semibold border transition-all ${
              asSpectator
                ? "bg-purple-700/30 border-purple-600 text-purple-300"
                : "border-game-border text-gray-400 hover:border-purple-600 hover:text-purple-400"
            }`}
          >
            {asSpectator
              ? "👁 Joining as Spectator"
              : "👁 Join as Spectator instead"}
          </button>
          {asSpectator && (
            <p className="text-xs text-gray-500 text-center mt-1">
              Watch the game without playing
            </p>
          )}
        </div>

        {error && <p className="text-game-accent text-sm mb-3">{error}</p>}

        <button
          onClick={handleJoin}
          disabled={loading || !canJoin}
          className="w-full py-3 bg-game-accent text-white font-game text-xl
                     rounded-xl hover:bg-red-500 disabled:opacity-40 transition-all
                     hover:scale-105 active:scale-95"
        >
          {loading
            ? "Joining…"
            : asSpectator
              ? "👁 Watch Game"
              : "🚪 Join Game"}
        </button>
      </div>
    </div>
  );
}
