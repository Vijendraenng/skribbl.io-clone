import React from "react";

interface TimerBarProps {
  timeLeft: number;
  totalTime: number;
}

export default function TimerBar({ timeLeft, totalTime }: TimerBarProps) {
  const percentage = totalTime > 0 ? (timeLeft / totalTime) * 100 : 0;
  const color =
    percentage > 50 ? "#4ade80" : percentage > 25 ? "#fbbf24" : "#e94560";
  const urgent = percentage <= 25;

  return (
    <div className="flex items-center gap-3">
      <div
        className={`font-game text-3xl tabular-nums w-16 text-right ${
          urgent ? "text-game-accent animate-pulse" : "text-white"
        }`}
      >
        {timeLeft}
      </div>
      <div className="flex-1 h-3 bg-game-border rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{ width: `${percentage}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
