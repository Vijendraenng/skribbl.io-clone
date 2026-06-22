import React from "react";
import { avatarBgColor } from "../../utils/avatars";
import type { Player } from "../../types";

interface PlayerListProps {
  players: Player[];
  currentDrawerId?: string | null;
  hostId?: string;
  myId?: string | null;
  showScores?: boolean;
}

export default function PlayerList({
  players,
  currentDrawerId,
  hostId,
  myId,
  showScores = false,
}: PlayerListProps) {
  const sorted = showScores
    ? [...players].sort((a, b) => b.score - a.score)
    : players;

  return (
    <div className="flex flex-col gap-1.5">
      {sorted.map((player) => {
        const isDrawing = player.id === currentDrawerId;
        const isHost = player.id === hostId;
        const isMe = player.id === myId;

        return (
          <div
            key={player.id}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
              isDrawing
                ? "border-game-accent bg-game-accent/10 animate-pulse-glow"
                : "border-game-border bg-game-card"
            } ${isMe ? "ring-1 ring-blue-400" : ""}`}
          >
            {/* Avatar */}
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-lg shrink-0 border-2"
              style={{
                backgroundColor: avatarBgColor(player.nickname),
                borderColor: isDrawing ? "#e94560" : "transparent",
              }}
            >
              {player.avatar}
            </div>

            {/* Name + badges */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 flex-wrap">
                <span className="font-bold text-sm text-white truncate">
                  {player.nickname}
                  {isMe && <span className="text-gray-400 text-xs"> (you)</span>}
                </span>
                {isHost && (
                  <span className="text-xs bg-yellow-600/30 text-yellow-400 px-1 rounded">
                    👑 Host
                  </span>
                )}
                {isDrawing && (
                  <span className="text-xs bg-game-accent/30 text-game-accent px-1 rounded">
                    ✏️ Drawing
                  </span>
                )}
                {player.hasGuessedCorrectly && (
                  <span className="text-xs text-green-400">✅</span>
                )}
              </div>
              {showScores && (
                <div className="text-xs text-game-warning font-bold">{player.score} pts</div>
              )}
            </div>

            {/* Round score pop */}
            {showScores && player.roundScore > 0 && (
              <span className="text-xs text-green-400 font-bold shrink-0">
                +{player.roundScore}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
