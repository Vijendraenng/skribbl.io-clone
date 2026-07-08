import React from "react";
import DrawingReplay from "../canvas/DrawingReplay";
import type { RoundEndPayload } from "../../types";

interface RoundEndOverlayProps {
  data: RoundEndPayload;
}

export default function RoundEndOverlay({ data }: RoundEndOverlayProps) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 flex items-center justify-center p-4">
      <div className="bg-game-card border-2 border-game-border rounded-2xl p-4 md:p-6 max-w-4xl w-full animate-slide-up shadow-2xl">
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_280px] md:items-start">
          <div>
            <div className="mb-3 text-center md:text-left">
              <div className="font-game text-white text-xl mb-1">
                {data.skipped ? "Round Skipped!" : "Round Over!"}
              </div>
              <div className="text-gray-400 text-sm">The word was</div>
              <div className="font-game text-game-accent text-3xl md:text-4xl tracking-wide break-words">
                {data.word}
              </div>
            </div>

            <div className="rounded-xl overflow-hidden border-2 border-game-border shadow-lg">
              <DrawingReplay strokes={data.strokes} durationMs={5000} />
            </div>
          </div>

          <div>
            <div className="font-game text-white text-lg mb-3 text-center md:text-left">
              Scores
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
                  <span className="text-yellow-400 font-bold text-sm">
                    {entry.score} pts
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-5 text-gray-500 text-sm animate-pulse text-center md:text-left">
              Next round starting...
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
