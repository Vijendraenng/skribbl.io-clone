import React from "react";
import { useGame } from "../../contexts/GameContext";
import type { RoundEndPayload } from "../../types";

interface RoundEndOverlayProps {
  data: RoundEndPayload;
}

export default function RoundEndOverlay({ data }: RoundEndOverlayProps) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 flex items-center justify-center p-4">
      <div className="bg-game-card border-2 border-game-border rounded-2xl p-8 max-w-sm w-full text-center animate-slide-up shadow-2xl">
        <div className="text-5xl mb-3">⏱️</div>
        <div className="font-game text-white text-xl mb-1">Round Over!</div>
        <div className="text-gray-400 mb-4">The word was</div>
        <div className="font-game text-game-accent text-4xl mb-6 tracking-wide">
          {data.word}
        </div>

        <div className="space-y-2">
          {data.scores.slice(0, 5).map((entry, i) => (
            <div
              key={entry.id}
              className="flex items-center gap-2 bg-game-bg rounded-lg px-3 py-2"
            >
              <span className="text-gray-400 w-5 text-sm">{i + 1}.</span>
              <span className="text-lg">{entry.avatar}</span>
              <span className="flex-1 text-white font-semibold text-sm truncate">
                {entry.nickname}
              </span>
              <span className="text-yellow-400 font-bold text-sm">{entry.score} pts</span>
            </div>
          ))}
        </div>

        <div className="mt-5 text-gray-500 text-sm animate-pulse">
          Next round starting…
        </div>
      </div>
    </div>
  );
}
