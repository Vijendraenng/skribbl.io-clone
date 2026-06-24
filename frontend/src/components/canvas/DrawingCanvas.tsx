import React from "react";
import { useCanvas } from "../../hooks/useCanvas";

const COLORS = [
  "#000000",
  "#ffffff",
  "#e94560",
  "#f59e0b",
  "#4ade80",
  "#60a5fa",
  "#a78bfa",
  "#f472b6",
  "#34d399",
  "#fb923c",
  "#6b7280",
  "#92400e",
  "#065f46",
  "#1e3a5f",
  "#7c3aed",
  "#fbbf24",
  "#ec4899",
  "#14b8a6",
  "#8b5cf6",
  "#ef4444",
];

const SIZES = [
  { label: "XS", value: 3 },
  { label: "S", value: 6 },
  { label: "M", value: 12 },
  { label: "L", value: 20 },
  { label: "XL", value: 32 },
];

interface DrawingCanvasProps {
  isDrawer: boolean;
  word?: string | null;
  hint?: string | null;
}

export default function DrawingCanvas({
  isDrawer,
  word,
  hint,
}: DrawingCanvasProps) {
  const { canvasRef, settings, setSettings, clearCanvas, undoStroke } =
    useCanvas({ isDrawer });

  return (
    <div className="flex flex-col gap-1 w-full h-full min-h-0 overflow-hidden">
      {/* Word display */}
      <div className="bg-game-card border border-game-border rounded-xl px-3 py-2 text-center min-h-[44px] flex items-center justify-center">
        {isDrawer && word ? (
          <span className="text-game-accent font-game text-xl md:text-2xl tracking-widest">
            {word}
          </span>
        ) : hint ? (
          <span className="text-white font-game text-xl md:text-2xl tracking-[0.3em]">
            {hint}
          </span>
        ) : (
          <span className="text-gray-400 text-sm">Waiting for word…</span>
        )}
      </div>

      {/* Canvas */}
      <div className="relative rounded-xl overflow-hidden border-2 border-game-border shadow-lg w-full flex-shrink-0">
        <canvas
          ref={canvasRef}
          width={800}
          height={500}
          className={`block w-full bg-white ${
            isDrawer
              ? settings.tool === "fill"
                ? "cursor-cell"
                : settings.tool === "eraser"
                  ? "cursor-cell"
                  : "cursor-crosshair"
              : "cursor-default"
          }`}
          style={{
            touchAction: "none",
            display: "block",
            width: "100%",
            height: "auto",
          }}
        />
      </div>

      {/* Toolbar — only for drawer */}
      {isDrawer && (
        <div className="bg-game-card border border-game-border rounded-xl p-2 md:p-3 flex flex-wrap gap-2 items-center">
          {/* Colors */}
          <div className="flex flex-wrap gap-1">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() =>
                  setSettings((s) => ({
                    ...s,
                    color: c,
                    tool:
                      s.tool === "eraser" || s.tool === "fill" ? s.tool : "pen",
                  }))
                }
                className={`w-6 h-6 md:w-7 md:h-7 rounded-full border-2 transition-transform hover:scale-110 ${
                  settings.color === c && settings.tool !== "eraser"
                    ? "border-white scale-110 shadow-lg"
                    : "border-transparent"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          <div className="w-px h-6 bg-game-border hidden sm:block" />

          {/* Brush sizes */}
          <div className="flex gap-1 items-center">
            {SIZES.map((s) => (
              <button
                key={s.value}
                onClick={() =>
                  setSettings((prev) => ({
                    ...prev,
                    size: s.value,
                    tool: "pen",
                  }))
                }
                className={`px-1.5 py-0.5 rounded text-xs font-bold transition-all ${
                  settings.size === s.value && settings.tool === "pen"
                    ? "bg-game-accent text-white"
                    : "bg-game-border text-gray-300 hover:bg-game-accent/50"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="w-px h-6 bg-game-border hidden sm:block" />

          {/* Tool buttons */}
          <div className="flex gap-1 flex-wrap">
            <button
              onClick={() => setSettings((s) => ({ ...s, tool: "fill" }))}
              className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                settings.tool === "fill"
                  ? "bg-blue-600 text-white"
                  : "bg-game-border text-gray-300 hover:bg-blue-600/50"
              }`}
              title="Fill bucket"
            >
              🪣 Fill
            </button>
            <button
              onClick={() =>
                setSettings((s) => ({ ...s, tool: "eraser", size: 20 }))
              }
              className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                settings.tool === "eraser"
                  ? "bg-game-accent text-white"
                  : "bg-game-border text-gray-300 hover:bg-game-accent/50"
              }`}
            >
              🧹 Erase
            </button>
            <button
              onClick={undoStroke}
              className="px-2 py-1 rounded-lg text-xs font-bold bg-game-border text-gray-300 hover:bg-yellow-600/50 transition-all"
            >
              ↩ Undo
            </button>
            <button
              onClick={clearCanvas}
              className="px-2 py-1 rounded-lg text-xs font-bold bg-game-border text-gray-300 hover:bg-red-600/50 transition-all"
            >
              🗑️ Clear
            </button>
          </div>

          {/* Current brush preview */}
          <div className="ml-auto hidden sm:flex items-center gap-1">
            <div
              className="rounded-full border border-gray-500"
              style={{
                width: Math.max(settings.size, 6),
                height: Math.max(settings.size, 6),
                backgroundColor:
                  settings.tool === "eraser" ? "#fff" : settings.color,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
