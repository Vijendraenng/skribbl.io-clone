import React, { useEffect } from "react";
import { useCanvas } from "../../hooks/useCanvas";
import type { ShapeType } from "../../types";

const COLORS = [
  "#000000","#ffffff","#e94560","#f59e0b","#4ade80",
  "#60a5fa","#a78bfa","#f472b6","#34d399","#fb923c",
  "#6b7280","#92400e","#065f46","#1e3a5f","#7c3aed",
  "#fbbf24","#ec4899","#14b8a6","#8b5cf6","#ef4444",
];

// Sizes now use a slider (1-50px)

interface DrawingCanvasProps {
  isDrawer: boolean;
  word?: string | null;
  hint?: string | null;
}

export default function DrawingCanvas({ isDrawer, word, hint }: DrawingCanvasProps) {
  const {
    canvasRef, previewCanvasRef,
    settings, setSettings,
    clearCanvas, undoStroke, redoStroke,
    canUndo, canRedo, saveDrawing,
  } = useCanvas({ isDrawer });

  // Keyboard shortcuts
  useEffect(() => {
    if (!isDrawer) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key === "z" && !e.shiftKey) { e.preventDefault(); undoStroke(); }
      if (ctrl && (e.key === "y" || (e.key === "z" && e.shiftKey))) { e.preventDefault(); redoStroke(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isDrawer, undoStroke, redoStroke]);

  // Cursor for overlay canvas
  const cursor = () => {
    if (!isDrawer) return "cursor-default";
    if (settings.tool === "fill")        return "cursor-cell";
    if (settings.tool === "eraser")      return "cursor-cell";
    if (settings.tool === "eyedropper")  return "cursor-crosshair";
    return "cursor-crosshair";
  };

  return (
    <div className="flex flex-col gap-1 w-full">

      {/* Word / hint bar */}
      <div className="bg-game-card border border-game-border rounded-xl px-3 py-2
                      text-center min-h-[44px] flex items-center justify-center shrink-0">
        {isDrawer && word
          ? <span className="text-game-accent font-game text-xl md:text-2xl tracking-widest">{word}</span>
          : hint
          ? <span className="text-white font-game text-xl md:text-2xl tracking-[0.3em]">{hint}</span>
          : <span className="text-gray-400 text-sm">Waiting for word…</span>
        }
      </div>

      {/* Canvas stack */}
      <div className="relative rounded-xl overflow-hidden border-2 border-game-border shadow-lg w-full shrink-0">

        {/* Main canvas — drawing target, never receives pointer events (overlay does) */}
        <canvas
          ref={canvasRef}
          width={800}
          height={500}
          className="block w-full bg-white pointer-events-none"
          style={{ touchAction:"none", aspectRatio:"8/5" }}
        />

        {/* Overlay canvas — ALWAYS on top and always captures pointer events for drawer.
            For non-drawers it is pointer-events-none so they can interact with chat etc.
            useCanvas attaches all mouse/touch listeners here directly. */}
        <canvas
          ref={previewCanvasRef}
          width={800}
          height={500}
          className={`absolute inset-0 w-full h-full ${isDrawer ? cursor() : "pointer-events-none"}`}
          style={{ touchAction:"none", aspectRatio:"8/5" }}
        />
      </div>

      {/* Toolbar — drawer only */}
      {isDrawer && (
        <div className="bg-game-card border border-game-border rounded-xl p-2 shrink-0
                        flex flex-wrap gap-2 items-center">

          {/* Colors */}
          <div className="flex flex-wrap gap-1">
            {COLORS.map(c => (
              <button key={c}
                onClick={() => setSettings(s => ({
                  ...s, color:c,
                  tool: s.tool==="eraser" ? "pen" : s.tool,
                }))}
                title={c}
                className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                  settings.color===c && settings.tool!=="eraser"
                    ? "border-white scale-110 shadow-lg" : "border-transparent"
                }`}
                style={{ backgroundColor:c }}
              />
            ))}
          </div>

          <div className="w-px h-6 bg-game-border hidden sm:block shrink-0" />

          {/* Brush sizes */}
          {/* Stroke width slider */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-gray-500 text-xs hidden sm:block">Size</span>
            <input
              type="range"
              min={1}
              max={50}
              value={settings.size}
              onChange={e => setSettings(prev => ({
                ...prev,
                size: Number(e.target.value),
                tool: prev.tool === "fill" || prev.tool === "eraser" || prev.tool === "eyedropper"
                  ? prev.tool : "pen",
              }))}
              className="w-20 sm:w-28 accent-game-accent cursor-pointer"
              title={`Brush size: ${settings.size}px`}
            />
            <span className="text-yellow-400 font-bold text-xs w-6 text-right">
              {settings.size}
            </span>
          </div>

          <div className="w-px h-6 bg-game-border hidden sm:block shrink-0" />

          {/* Tools */}
          <div className="flex gap-1 flex-wrap items-center">

            <button
              onClick={() => setSettings(s => ({ ...s, tool:"pen" }))}
              className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                settings.tool==="pen" ? "bg-gray-600 text-white" : "bg-game-border text-gray-300 hover:bg-gray-600/50"
              }`}
            >✏️ Pen</button>

            <button
              onClick={() => setSettings(s => ({ ...s, tool:"eraser", size:20 }))}
              className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                settings.tool==="eraser" ? "bg-game-accent text-white" : "bg-game-border text-gray-300 hover:bg-game-accent/50"
              }`}
            >🧹 Erase</button>

            <button
              onClick={() => setSettings(s => ({ ...s, tool:"fill" }))}
              className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                settings.tool==="fill" ? "bg-blue-600 text-white" : "bg-game-border text-gray-300 hover:bg-blue-600/50"
              }`}
            >🪣 Fill</button>

            <button
              onClick={() => setSettings(s => ({ ...s, tool:"eyedropper" }))}
              title="Pick color from canvas"
              className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                settings.tool==="eyedropper" ? "bg-teal-600 text-white" : "bg-game-border text-gray-300 hover:bg-teal-600/50"
              }`}
            >🩸 Pick</button>

            <div className="w-px h-5 bg-game-border shrink-0" />

            {/* Shape tools */}
            {(["line","rect","circle"] as ShapeType[]).map(shape => {
              const icons:Record<ShapeType,string> = { line:"╱ Line", rect:"▭ Rect", circle:"○ Circle" };
              return (
                <button key={shape}
                  onClick={() => setSettings(s => ({ ...s, tool:shape }))}
                  className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                    settings.tool===shape ? "bg-purple-600 text-white" : "bg-game-border text-gray-300 hover:bg-purple-600/50"
                  }`}
                >{icons[shape]}</button>
              );
            })}

            <div className="w-px h-5 bg-game-border shrink-0" />

            <button onClick={undoStroke} disabled={!canUndo} title="Undo (Ctrl+Z)"
              className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                canUndo ? "bg-game-border text-gray-300 hover:bg-yellow-600/50"
                        : "bg-game-border text-gray-600 cursor-not-allowed opacity-40"
              }`}
            >↩ Undo</button>

            <button onClick={redoStroke} disabled={!canRedo} title="Redo (Ctrl+Y)"
              className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                canRedo ? "bg-game-border text-gray-300 hover:bg-green-600/50"
                        : "bg-game-border text-gray-600 cursor-not-allowed opacity-40"
              }`}
            >↪ Redo</button>

            <button onClick={clearCanvas}
              className="px-2 py-1 rounded-lg text-xs font-bold bg-game-border text-gray-300 hover:bg-red-600/50 transition-all"
            >🗑️ Clear</button>

            <button
              onClick={() => saveDrawing(word ?? undefined)}
              title="Save drawing as PNG"
              className="px-2 py-1 rounded-lg text-xs font-bold bg-game-border text-gray-300 hover:bg-green-700/60 transition-all"
            >💾 Save</button>

          </div>

          {/* Brush preview dot + eyedropper hint */}
          <div className="ml-auto hidden sm:flex items-center gap-2 shrink-0">
            {settings.tool === "eyedropper" && (
              <span className="text-gray-400 text-xs italic">Click canvas to pick</span>
            )}
            {/* Preview dot scales with slider but capped at 40px visual */}
            <div style={{
              width:  Math.min(settings.size, 40),
              height: Math.min(settings.size, 40),
              minWidth: 6, minHeight: 6,
              borderRadius: "50%",
              border: "1.5px solid #6b7280",
              backgroundColor: settings.tool === "eraser" ? "#ffffff" : settings.color,
              transition: "all 0.1s",
            }}/>
          </div>

        </div>
      )}
    </div>
  );
}
