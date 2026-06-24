import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useGame } from "../contexts/GameContext";
import { avatarBgColor } from "../utils/avatars";

export default function LobbyPage() {
  const navigate = useNavigate();
  const { roomCode } = useParams<{ roomCode: string }>();
  const { room, game, isHost, playerId, nickname, startGame, fullReset } = useGame();
  const [copied, setCopied] = useState(false);

  // Navigate to game as soon as game starts (any active phase)
  useEffect(() => {
    if (game && room?.status === "playing" && game.phase !== "game_over") {
      navigate(`/game/${room?.roomCode}`);
    }
  }, [game, room?.status, navigate, room]);

  // Redirect if no room or nickname (hard refresh)
  useEffect(() => {
    if (!room && !nickname) navigate("/");
  }, [room, nickname, navigate]);

  if (!room) return null;

  // Invite link — just needs the room code, user will enter nickname on the join page
  const shareLink = `${window.location.origin}/join?code=${room.roomCode}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers that block clipboard API
      const ta = document.createElement("textarea");
      ta.value = shareLink;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const canStart =
    room.players.length >= 2 &&
    (room.status === "waiting" || room.status === "finished");

  return (
    <div className="min-h-screen bg-game-bg flex items-center justify-center p-4">
      <div className="bg-game-card border border-game-border rounded-2xl p-8 w-full max-w-2xl shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">

          {/* Left side — exit button + title */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => { fullReset(); navigate("/"); }}
              className="text-gray-400 hover:text-red-400 text-sm border border-game-border hover:border-red-500 px-2 py-1 rounded-lg transition-all"
            >
              ← Exit
            </button>
            <h1 className="font-game text-game-accent text-3xl">
              {room.status === "finished" ? "Play Again?" : "Game Lobby"}
            </h1>
          </div>

          {/* Right side — room code, copy button, player count */}
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <span className="text-gray-400 text-sm">Room Code:</span>
              <span className="font-game text-white text-xl tracking-widest bg-game-bg px-3 py-0.5 rounded-lg border border-game-border">
                {room.roomCode}
              </span>
              <button
                onClick={copyLink}
                className={`relative text-xs px-3 py-1.5 rounded-lg border transition-all font-semibold ${
                  copied
                    ? "bg-green-600/20 border-green-500 text-green-400"
                    : "bg-game-bg border-game-border text-gray-400 hover:border-game-accent hover:text-game-accent"
                }`}
              >
                {copied ? "✅ Copied!" : "📋 Copy Invite Link"}
              </button>
            </div>
            <div className="text-right text-sm text-gray-400">
              <div>{room.players.length} / {room.settings.maxPlayers} players</div>
              <div>{room.settings.rounds} rounds · {room.settings.drawTime}s draw</div>
            </div>
          </div>

        </div>
        {/* End Header */}

        {/* Player grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {room.players.map((player) => (
            <div
              key={player.id}
              className={`bg-game-bg border rounded-xl p-3 flex flex-col items-center gap-2 text-center ${
                player.id === playerId ? "border-game-accent" : "border-game-border"
              }`}
            >
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-2xl border-2"
                style={{
                  backgroundColor: avatarBgColor(player.nickname),
                  borderColor: player.id === room.hostId ? "#f59e0b" : "transparent",
                }}
              >
                {player.avatar}
              </div>
              <div className="text-xs font-bold text-white truncate w-full">
                {player.nickname}
              </div>
              <div className="flex gap-1 flex-wrap justify-center">
                {player.id === room.hostId && (
                  <span className="text-xs bg-yellow-600/20 text-yellow-400 px-1.5 rounded">👑</span>
                )}
                {player.id === playerId && (
                  <span className="text-xs bg-blue-600/20 text-blue-400 px-1.5 rounded">You</span>
                )}
              </div>
            </div>
          ))}

          {/* Empty slots */}
          {Array.from({ length: Math.max(0, room.settings.maxPlayers - room.players.length) })
            .slice(0, 4)
            .map((_, i) => (
              <div
                key={`empty-${i}`}
                className="bg-game-bg/50 border border-dashed border-game-border rounded-xl p-3 flex flex-col items-center gap-2 opacity-40"
              >
                <div className="w-12 h-12 rounded-full bg-game-border flex items-center justify-center text-2xl">?</div>
                <div className="text-xs text-gray-500">Waiting…</div>
              </div>
            ))}
        </div>

        {/* Settings summary */}
        <div className="bg-game-bg rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 text-center text-sm">
          {[
            { label: "Rounds", value: room.settings.rounds },
            { label: "Draw Time", value: `${room.settings.drawTime}s` },
            { label: "Word Choices", value: room.settings.wordCount },
            { label: "Hints", value: room.settings.hintsEnabled ? "On" : "Off" },
          ].map((s) => (
            <div key={s.label}>
              <div className="text-gray-500 text-xs">{s.label}</div>
              <div className="text-yellow-400 font-bold">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Actions */}
        {isHost ? (
          <div>
            <button
              onClick={startGame}
              disabled={!canStart}
              className="w-full py-4 bg-game-accent text-white font-game text-2xl rounded-xl hover:bg-red-500 disabled:opacity-40 transition-all hover:scale-105 active:scale-95"
            >
              {room.status === "finished" ? "🔄 Start New Game" : "🎮 Start Game"}
            </button>
            {!canStart && (
              <p className="text-center text-gray-400 text-sm mt-2">Need at least 2 players</p>
            )}
          </div>
        ) : (
          <div className="text-center text-gray-400 animate-pulse">
            Waiting for host to start…
 </div>
        )}

      </div>
    </div>
  );
}