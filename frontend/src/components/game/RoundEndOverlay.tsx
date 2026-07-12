import React, { useEffect, useState } from "react";
import DrawingReplay from "../canvas/DrawingReplay";
import { useRef } from "react";
import type { RoundEndPayload } from "../../types";

interface Props {
  data: RoundEndPayload;
}

export default function RoundEndOverlay({ data }: Props) {
  const [countdown, setCountdown] = useState(5);
  const [replaySpeed, setReplaySpeed] = useState(2);
  const replayCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const saveDrawing = () => {
    // Find the replay canvas via DOM since DrawingReplay owns its own ref
    const replayEl = document.querySelector(
      "[data-replay-canvas]",
    ) as HTMLCanvasElement | null;
    if (!replayEl) return;
    const out = document.createElement("canvas");
    const labelH = 36;
    out.width = replayEl.width;
    out.height = replayEl.height + labelH;
    const ctx = out.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(replayEl, 0, 0);
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, replayEl.height, out.width, labelH);
    ctx.fillStyle = "#e94560";
    ctx.font = "bold 18px 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      `✏️ "${data.word}"  —  Skribbl Clone`,
      out.width / 2,
      replayEl.height + labelH / 2,
    );
    const link = document.createElement("a");
    link.download = `skribbl-${data.word.replace(/\s+/g, "_")}.png`;
    link.href = out.toDataURL("image/png");
    link.click();
  };
  const hasStrokes = data.strokes && data.strokes.length > 0;

  // 5-second countdown
  useEffect(() => {
    setCountdown(5);
    const t = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(t);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [data]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
    >
      <div className="bg-game-card border border-game-border rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-5 pb-3 flex items-center justify-between">
          <div>
            <div className="text-gray-400 text-xs uppercase tracking-widest mb-1">
              {data.skipped ? "Round Skipped" : "Round Over"}
            </div>
            <div className="font-game text-white text-2xl">
              The word was{" "}
              <span className="text-game-accent tracking-widest">
                {data.word}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-center">
            <div className="font-game text-yellow-400 text-3xl">
              {countdown}
            </div>
            <div className="text-gray-500 text-xs">next round</div>
          </div>
        </div>

        {/* Drawing replay */}
        {hasStrokes && (
          <div className="px-4 pb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-xs flex items-center gap-1">
                🎬 Drawing Replay
              </span>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <span className="text-gray-500 text-xs">Speed:</span>
                  {[1, 2, 4].map((s) => (
                    <button
                      key={s}
                      onClick={() => setReplaySpeed(s)}
                      className={`px-2 py-0.5 rounded text-xs font-bold transition-all ${
                        replaySpeed === s
                          ? "bg-game-accent text-white"
                          : "bg-game-border text-gray-400 hover:text-white"
                      }`}
                    >
                      {s}×
                    </button>
                  ))}
                </div>
                <button
                  onClick={saveDrawing}
                  className="px-2 py-0.5 rounded text-xs font-bold bg-game-border text-gray-300 hover:bg-green-700/60 transition-all"
                  title="Save drawing as PNG"
                >
                  💾 Save
                </button>
              </div>
            </div>
            <div className="rounded-xl overflow-hidden border border-game-border">
              <DrawingReplay
                key={`${data.word}-${replaySpeed}`}
                strokes={data.strokes!}
                speed={replaySpeed}
                dataAttr="replay-canvas"
              />
            </div>
          </div>
        )}

        {/* Scores */}
        <div className="px-4 pb-5">
          <div className="text-gray-500 text-xs uppercase tracking-wider mb-2">
            Scores
          </div>
          <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
            {data.scores.map((p, i) => (
              <div
                key={p.id}
                className="flex items-center gap-3 bg-game-bg rounded-xl px-3 py-2"
              >
                <span className="text-sm w-6 text-center">
                  {i === 0
                    ? "🥇"
                    : i === 1
                      ? "🥈"
                      : i === 2
                        ? "🥉"
                        : `${i + 1}.`}
                </span>
                <span className="text-lg">{p.avatar}</span>
                <span className="flex-1 text-white text-sm font-semibold">
                  {p.nickname}
                </span>
                <span className="text-yellow-400 font-bold text-sm">
                  {p.score} pts
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
