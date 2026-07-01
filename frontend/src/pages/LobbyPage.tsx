import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useGame } from "../contexts/GameContext";
import { getSocket } from "../utils/socket";
import { avatarBgColor } from "../utils/avatars";

export default function LobbyPage() {
  const navigate = useNavigate();
  const { room, game, isHost, playerId, nickname, startGame, fullReset, setReady, passcode } = useGame();
  const [copied, setCopied] = useState(false);
  const [copiedPasscode, setCopiedPasscode] = useState(false);
  const [startError, setStartError] = useState("");
  const [localReady, setLocalReady] = useState(false);

  // Sync localReady from server state (handles reconnects and play-again resets)
  useEffect(() => {
    const me = room?.players.find(p => p.id === playerId);
    if (me) setLocalReady(me.isReady);
  }, [room?.players, playerId]);

  // Navigate when game starts
  useEffect(() => {
    if (game && room?.status === "playing" && game.phase !== "game_over") {
      navigate(`/game/${room?.roomCode}`);
    }
  }, [game, room?.status, navigate, room]);

  useEffect(() => {
    if (!room && !nickname) navigate("/");
  }, [room, nickname, navigate]);

  // Listen for kick event
  useEffect(() => {
    const socket = getSocket();
    socket.on("kicked", ({ reason }: { reason: string }) => {
      fullReset();
      alert(reason);
      navigate("/");
    });
    return () => { socket.off("kicked"); };
  }, [fullReset, navigate]);

  if (!room) return null;

  const shareLink = `${window.location.origin}/join?code=${room.roomCode}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = shareLink;
      ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const myPlayer = room.players.find(p => p.id === playerId);
  const activePlayers = room.players.filter(p => p.isConnected && p.role !== "spectator");
  const spectators = room.players.filter(p => p.isConnected && p.role === "spectator");
  const nonHostPlayers = activePlayers.filter(p => p.id !== room.hostId);
  const allReady = nonHostPlayers.length > 0 && nonHostPlayers.every(p => p.isReady);
  const copyPasscode = async () => {
    if (!passcode) return;
    try {
      await navigator.clipboard.writeText(passcode);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = passcode;
      ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopiedPasscode(true);
    setTimeout(() => setCopiedPasscode(false), 2000);
  };

  const canStart = activePlayers.length >= 2 && (room.status === "waiting" || room.status === "finished");

  const handleKick = (targetId: string) => {
    getSocket().emit("kick_player", { targetPlayerId: targetId }, (res: any) => {
      if (res?.error) alert(res.error);
    });
  };

  const handleBan = (targetId: string) => {
    if (!confirm("Ban this player? They cannot rejoin this room.")) return;
    getSocket().emit("ban_player", { targetPlayerId: targetId }, (res: any) => {
      if (res?.error) alert(res.error);
    });
  };

  const handleStart = () => {
    setStartError("");
    getSocket().emit("start_game", {}, (res: any) => {
      if (res?.error) setStartError(res.error);
    });
  };

  return (
    <div className="min-h-screen bg-game-bg flex items-center justify-center p-4">
      <div className="bg-game-card border border-game-border rounded-2xl p-8 w-full max-w-2xl shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => { fullReset(); navigate("/"); }}
              className="text-gray-400 hover:text-red-400 text-sm border border-game-border hover:border-red-500 px-2 py-1 rounded-lg transition-all">
              ← Exit
            </button>
            <div>
              <h1 className="font-game text-game-accent text-3xl">
                {room.status === "finished" ? "Play Again?" : "Lobby"}
              </h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="font-game text-white text-xl tracking-widest bg-game-bg px-3 py-0.5 rounded-lg border border-game-border">
                  {room.roomCode}
                </span>
                {(room.settings as any).hasPasscode && isHost && passcode && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs bg-yellow-900/40 text-yellow-400 px-2 py-0.5 rounded border border-yellow-800">
                      🔒 Passcode:
                    </span>
                    <span className="font-game text-yellow-400 text-sm tracking-widest bg-game-bg px-2 py-0.5 rounded border border-yellow-800">
                      {passcode}
                    </span>
                    <button
                      onClick={copyPasscode}
                      className={`text-xs px-2 py-1 rounded border font-semibold transition-all ${
                        copiedPasscode
                          ? "bg-green-600/20 border-green-500 text-green-400"
                          : "border-yellow-800 text-yellow-500 hover:border-yellow-400"
                      }`}
                    >
                      {copiedPasscode ? "✅" : "📋"}
                    </button>
                  </div>
                )}
                {(room.settings as any).hasPasscode && !isHost && (
                  <span className="text-xs bg-yellow-900/40 text-yellow-400 px-2 py-0.5 rounded border border-yellow-800">🔒 Passcode required</span>
                )}
                <button onClick={copyLink}
                  className={`text-xs px-3 py-1.5 rounded-lg border font-semibold transition-all ${
                    copied ? "bg-green-600/20 border-green-500 text-green-400" : "bg-game-bg border-game-border text-gray-400 hover:border-game-accent hover:text-game-accent"
                  }`}>
                  {copied ? "✅ Copied!" : "📋 Invite Link"}
                </button>
              </div>
            </div>
          </div>
          <div className="text-right text-sm text-gray-400 hidden sm:block">
            <div>{activePlayers.length}/{room.settings.maxPlayers} players</div>
            {spectators.length > 0 && <div>{spectators.length} spectating</div>}
            <div>{room.settings.rounds}r · {room.settings.drawTime}s</div>
            {(room.settings as any).difficulty !== "all" && (
              <div className="capitalize text-yellow-400">{(room.settings as any).difficulty}</div>
            )}
          </div>
        </div>

        {/* Players grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {room.players.filter(p => p.isConnected).map(player => {
            const isMe = player.id === playerId;
            const isPlayerHost = player.id === room.hostId;
            const isSpectator = player.role === "spectator";
            return (
              <div key={player.id}
                className={`bg-game-bg border rounded-xl p-3 flex flex-col items-center gap-1.5 text-center relative ${
                  isMe ? "border-game-accent" : "border-game-border"
                } ${player.isReady && !isSpectator ? "border-green-600" : ""}`}>

                <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl border-2"
                  style={{ backgroundColor: avatarBgColor(player.nickname), borderColor: isPlayerHost ? "#f59e0b" : "transparent" }}>
                  {player.avatar}
                </div>

                <div className="text-xs font-bold text-white truncate w-full">{player.nickname}</div>

                <div className="flex gap-1 flex-wrap justify-center">
                  {isPlayerHost && <span className="text-xs bg-yellow-600/20 text-yellow-400 px-1.5 rounded">👑</span>}
                  {isMe && <span className="text-xs bg-blue-600/20 text-blue-400 px-1.5 rounded">You</span>}
                  {isSpectator && <span className="text-xs bg-purple-600/20 text-purple-400 px-1.5 rounded">👁 Watch</span>}
                  {player.isReady && !isSpectator && <span className="text-xs bg-green-600/20 text-green-400 px-1.5 rounded">✓ Ready</span>}
                </div>

                {/* Host controls — kick/ban */}
                {isHost && !isMe && (
                  <div className="flex gap-1 mt-0.5">
                    <button onClick={() => handleKick(player.id)}
                      className="text-xs px-1.5 py-0.5 rounded bg-yellow-900/30 text-yellow-500 hover:bg-yellow-700/50 transition-all"
                      title="Kick">
                      Kick
                    </button>
                    <button onClick={() => handleBan(player.id)}
                      className="text-xs px-1.5 py-0.5 rounded bg-red-900/30 text-red-500 hover:bg-red-700/50 transition-all"
                      title="Ban">
                      Ban
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {/* Empty slots */}
          {Array.from({ length: Math.max(0, room.settings.maxPlayers - room.players.filter(p => p.isConnected).length) })
            .slice(0, 4).map((_, i) => (
              <div key={`empty-${i}`}
                className="bg-game-bg/50 border border-dashed border-game-border rounded-xl p-3 flex flex-col items-center gap-2 opacity-30">
                <div className="w-12 h-12 rounded-full bg-game-border flex items-center justify-center text-2xl">?</div>
                <div className="text-xs text-gray-500">Waiting…</div>
              </div>
            ))}
        </div>

        {/* Settings */}
        <div className="bg-game-bg rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 text-center text-sm">
          {[
            { label: "Rounds",     value: room.settings.rounds },
            { label: "Draw Time",  value: `${room.settings.drawTime}s` },
            { label: "Difficulty", value: (room.settings as any).difficulty || "all" },
            { label: "Hints",      value: room.settings.hintsEnabled ? "On" : "Off" },
          ].map(s => (
            <div key={s.label}>
              <div className="text-gray-500 text-xs">{s.label}</div>
              <div className="text-yellow-400 font-bold capitalize">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Ready / Start */}
        <div className="space-y-3">
          {/* Ready button for non-hosts */}
          {!isHost && myPlayer && myPlayer.role !== "spectator" && (
            <button
              onClick={() => {
                const next = !localReady;
                setLocalReady(next);   // optimistic update — instant UI response
                setReady(next);        // emit to server
              }}
              className={`w-full py-3 font-game text-xl rounded-xl transition-all hover:scale-105 active:scale-95 ${
                localReady
                  ? "bg-green-600 text-white hover:bg-green-500"
                  : "bg-game-border text-white hover:bg-green-700"
              }`}>
              {localReady ? "✅ Ready!" : "Click when ready…"}
            </button>
          )}

          {isHost && (
            <div>
              <button onClick={handleStart} disabled={!canStart}
                className="w-full py-4 bg-game-accent text-white font-game text-2xl rounded-xl hover:bg-red-500 disabled:opacity-40 transition-all hover:scale-105 active:scale-95">
                {room.status === "finished" ? "🔄 Start New Game" : "🎮 Start Game"}
              </button>
              {startError && <p className="text-game-accent text-sm text-center mt-2">{startError}</p>}
              {!canStart && activePlayers.length < 2 && (
                <p className="text-center text-gray-400 text-sm mt-2">Need at least 2 players</p>
              )}
            </div>
          )}

          {!isHost && !nonHostPlayers.every(p => p.isReady) && (
            <div className="text-center text-gray-400 text-sm animate-pulse">
              Waiting for all players to ready up…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}