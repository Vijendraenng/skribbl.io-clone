import React from "react";
import { useCanvas } from "../../hooks/useCanvas";

const COLORS = [
  "#1a1a2e", "#ffffff", "#e94560", "#f59e0b", "#4ade80",
  "#60a5fa", "#a78bfa", "#f472b6", "#34d399", "#fb923c",
  "#6b7280", "#92400e", "#065f46", "#1e3a5f", "#7c3aed",
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

export default function DrawingCanvas({ isDrawer, word, hint }: DrawingCanvasProps) {
  const { canvasRef, settings, setSettings, clearCanvas, undoStroke } = useCanvas({ isDrawer });

  return (
    <div className="flex flex-col gap-2">
      {/* Word display */}
      <div className="bg-game-card border border-game-border rounded-xl px-4 py-2 text-center min-h-[48px] flex items-center justify-center">
        {isDrawer && word ? (
          <span className="text-game-accent font-game text-2xl tracking-widest">{word}</span>
        ) : hint ? (
          <span className="text-white font-game text-2xl tracking-[0.3em]">{hint}</span>
        ) : (
          <span className="text-gray-400 text-sm">Waiting for word…</span>
        )}
      </div>

      {/* Canvas */}
      <div className="relative rounded-xl overflow-hidden border-2 border-game-border shadow-lg">
        <canvas
          ref={canvasRef}
          width={800}
          height={500}
          className={`block w-full bg-white ${isDrawer ? "cursor-crosshair" : "cursor-default"}`}
          style={{ touchAction: "none" }}
        />
        {!isDrawer && (
          <div className="absolute inset-0 pointer-events-none" />
        )}
      </div>

      {/* Toolbar — only for drawer */}
      {isDrawer && (
        <div className="bg-game-card border border-game-border rounded-xl p-3 flex flex-wrap gap-3 items-center">
          {/* Colors */}
          <div className="flex flex-wrap gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setSettings((s) => ({ ...s, color: c, tool: "pen" }))}
                className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${
                  settings.color === c && settings.tool === "pen"
                    ? "border-white scale-110 shadow-lg"
                    : "border-transparent"
                }`}
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>

          <div className="w-px h-8 bg-game-border" />

          {/* Brush sizes */}
          <div className="flex gap-1 items-center">
            {SIZES.map((s) => (
              <button
                key={s.value}
                onClick={() => setSettings((prev) => ({ ...prev, size: s.value, tool: "pen" }))}
                className={`px-2 py-1 rounded text-xs font-bold transition-all ${
                  settings.size === s.value && settings.tool === "pen"
                    ? "bg-game-accent text-white"
                    : "bg-game-border text-gray-300 hover:bg-game-accent/50"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="w-px h-8 bg-game-border" />

          {/* Tools */}
          <button
            onClick={() => setSettings((s) => ({ ...s, tool: "eraser", size: 20 }))}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
              settings.tool === "eraser"
                ? "bg-game-accent text-white"
                : "bg-game-border text-gray-300 hover:bg-game-accent/50"
            }`}
          >
            🧹 Eraser
          </button>

          <button
            onClick={undoStroke}
            className="px-3 py-1.5 rounded-lg text-sm font-bold bg-game-border text-gray-300 hover:bg-yellow-600/50 transition-all"
          >
            ↩ Undo
          </button>

          <button
            onClick={clearCanvas}
            className="px-3 py-1.5 rounded-lg text-sm font-bold bg-game-border text-gray-300 hover:bg-red-600/50 transition-all"
          >
            🗑️ Clear
          </button>

          {/* Preview */}
          <div className="ml-auto flex items-center gap-2 text-xs text-gray-400">
            <div
              className="rounded-full border border-gray-500"
              style={{
                width: Math.max(settings.size, 6),
                height: Math.max(settings.size, 6),
                backgroundColor: settings.tool === "eraser" ? "#fff" : settings.color,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
