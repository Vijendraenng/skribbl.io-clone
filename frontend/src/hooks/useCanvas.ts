import { useRef, useEffect, useCallback, useState } from "react";
import { getSocket } from "../utils/socket";
import type { DrawSettings } from "../types";

interface StrokeState { x: number; y: number; color: string; size: number; tool: string; }

interface UseCanvasProps { isDrawer: boolean; }

export function useCanvas({ isDrawer }: UseCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const pendingMovesRef = useRef<{ x: number; y: number }[]>([]);
  const flushTimerRef = useRef<number | null>(null);
  const remoteStrokeRef = useRef<StrokeState | null>(null);

  const [settings, setSettings] = useState<DrawSettings>({ color: "#1a1a2e", size: 6, tool: "pen" });

  const getContext = useCallback((): CanvasRenderingContext2D | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    return ctx;
  }, []);

  const drawSegment = useCallback((
    from: { x: number; y: number }, to: { x: number; y: number },
    color: string, size: number, tool: string
  ): void => {
    const ctx = getContext();
    if (!ctx) return;
    ctx.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";
    ctx.strokeStyle = color; ctx.lineWidth = size;
    ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
  }, [getContext]);

  // ─── Flood fill (bucket) ──────────────────────────────────────────────
  const floodFill = useCallback((startX: number, startY: number, fillColor: string): void => {
    const canvas = canvasRef.current;
    const ctx = getContext();
    if (!canvas || !ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const width = canvas.width;
    const height = canvas.height;

    const idx = (x: number, y: number) => (y * width + x) * 4;
    const sx = Math.round(startX), sy = Math.round(startY);
    const ti = idx(sx, sy);
    const tr = data[ti], tg = data[ti + 1], tb = data[ti + 2], ta = data[ti + 3];

    // Parse fill color
    const tmp = document.createElement("canvas");
    tmp.width = tmp.height = 1;
    const tc = tmp.getContext("2d")!;
    tc.fillStyle = fillColor;
    tc.fillRect(0, 0, 1, 1);
    const fd = tc.getImageData(0, 0, 1, 1).data;
    const [fr, fg, fb, fa] = [fd[0], fd[1], fd[2], fd[3]];

    // Don't fill if same color
    if (tr === fr && tg === fg && tb === fb && ta === fa) return;

    const matches = (i: number) =>
      Math.abs(data[i] - tr) < 32 && Math.abs(data[i + 1] - tg) < 32 &&
      Math.abs(data[i + 2] - tb) < 32 && Math.abs(data[i + 3] - ta) < 32;

    const stack: [number, number][] = [[sx, sy]];
    const visited = new Uint8Array(width * height);

    while (stack.length > 0) {
      const [x, y] = stack.pop()!;
      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      const vi = y * width + x;
      if (visited[vi]) continue;
      visited[vi] = 1;
      const i = vi * 4;
      if (!matches(i)) continue;
      data[i] = fr; data[i + 1] = fg; data[i + 2] = fb; data[i + 3] = fa;
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }

    ctx.putImageData(imageData, 0, 0);
  }, [getContext]);

  const getCanvasPoint = useCallback((e: MouseEvent | Touch): { x: number; y: number } => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  }, []);

  const flushMoves = useCallback((): void => {
    const moves = pendingMovesRef.current;
    if (!moves.length) return;
    pendingMovesRef.current = [];
    moves.forEach(pt => getSocket().emit("draw_move", { x: pt.x, y: pt.y }));
  }, []);

  // ─── Drawer events ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isDrawer) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onStart = (e: MouseEvent | TouchEvent): void => {
      e.preventDefault();
      const point = e instanceof MouseEvent ? getCanvasPoint(e) : getCanvasPoint((e as TouchEvent).touches[0]);

      if (settings.tool === "fill") {
        floodFill(point.x, point.y, settings.color);
        getSocket().emit("canvas_fill", { x: point.x, y: point.y, color: settings.color });
        return;
      }

      isDrawingRef.current = true;
      lastPointRef.current = point;
      getSocket().emit("draw_start", { x: point.x, y: point.y, color: settings.color, size: settings.size, tool: settings.tool });
    };

    const onMove = (e: MouseEvent | TouchEvent): void => {
      e.preventDefault();
      if (!isDrawingRef.current || !lastPointRef.current || settings.tool === "fill") return;
      const point = e instanceof MouseEvent ? getCanvasPoint(e) : getCanvasPoint((e as TouchEvent).touches[0]);
      drawSegment(lastPointRef.current, point, settings.tool === "eraser" ? "rgba(0,0,0,1)" : settings.color, settings.size, settings.tool);
      lastPointRef.current = point;
      pendingMovesRef.current.push(point);
      if (!flushTimerRef.current) {
        flushTimerRef.current = window.setTimeout(() => { flushMoves(); flushTimerRef.current = null; }, 16);
      }
    };

    const onEnd = (e: MouseEvent | TouchEvent): void => {
      e.preventDefault();
      if (!isDrawingRef.current) return;
      isDrawingRef.current = false; lastPointRef.current = null;
      if (flushTimerRef.current) { clearTimeout(flushTimerRef.current); flushTimerRef.current = null; flushMoves(); }
      getSocket().emit("draw_end", {});
    };

    canvas.addEventListener("mousedown", onStart);
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseup", onEnd);
    canvas.addEventListener("mouseleave", onEnd);
    canvas.addEventListener("touchstart", onStart, { passive: false });
    canvas.addEventListener("touchmove", onMove, { passive: false });
    canvas.addEventListener("touchend", onEnd, { passive: false });
    return () => {
      canvas.removeEventListener("mousedown", onStart);
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mouseup", onEnd);
      canvas.removeEventListener("mouseleave", onEnd);
      canvas.removeEventListener("touchstart", onStart);
      canvas.removeEventListener("touchmove", onMove);
      canvas.removeEventListener("touchend", onEnd);
    };
  }, [isDrawer, settings, drawSegment, getCanvasPoint, flushMoves, floodFill]);

  // ─── Remote drawing ───────────────────────────────────────────────────
  useEffect(() => {
    if (isDrawer) return;
    const socket = getSocket();

    const onDrawData = (data: { type: string; x?: number; y?: number; color?: string; size?: number; tool?: string }): void => {
      if (data.type === "draw_start") {
        remoteStrokeRef.current = { x: data.x ?? 0, y: data.y ?? 0, color: data.color ?? "#000", size: data.size ?? 6, tool: data.tool ?? "pen" };
      } else if (data.type === "draw_move") {
        const cur = remoteStrokeRef.current; if (!cur) return;
        const nx = data.x ?? 0, ny = data.y ?? 0;
        drawSegment({ x: cur.x, y: cur.y }, { x: nx, y: ny }, cur.tool === "eraser" ? "rgba(0,0,0,1)" : cur.color, cur.size, cur.tool);
        remoteStrokeRef.current = { x: nx, y: ny, color: cur.color, size: cur.size, tool: cur.tool };
      } else if (data.type === "draw_end") {
        remoteStrokeRef.current = null;
      }
    };

    const onFill = ({ x, y, color }: { x: number; y: number; color: string }): void => {
      floodFill(x, y, color);
    };

    const onCanvasCleared = (): void => {
      const ctx = getContext(); const canvas = canvasRef.current;
      if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    const replayStrokes = (strokes: any[]): void => {
      const ctx = getContext(); const canvas = canvasRef.current;
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let cur: StrokeState | null = null;
      for (const s of strokes) {
        if (s.type === "draw_start") cur = { x: s.x ?? 0, y: s.y ?? 0, color: s.color ?? "#000", size: s.size ?? 6, tool: s.tool ?? "pen" };
        else if (s.type === "draw_move" && cur !== null) {
          const nx: number = s.x ?? 0, ny: number = s.y ?? 0;
          drawSegment({ x: cur.x, y: cur.y }, { x: nx, y: ny }, cur.tool === "eraser" ? "rgba(0,0,0,1)" : cur.color, cur.size, cur.tool);
          cur = { x: nx, y: ny, color: cur.color, size: cur.size, tool: cur.tool };
        } else if (s.type === "draw_end") cur = null;
        else if (s.type === "canvas_fill") floodFill(s.x, s.y, s.color);
      }
    };

    socket.on("draw_data", onDrawData);
    socket.on("canvas_fill", onFill);
    socket.on("canvas_cleared", onCanvasCleared);
    socket.on("draw_undone", ({ strokes }: { strokes: any[] }) => replayStrokes(strokes));
    return () => {
      socket.off("draw_data", onDrawData);
      socket.off("canvas_fill", onFill);
      socket.off("canvas_cleared", onCanvasCleared);
      socket.off("draw_undone");
    };
  }, [isDrawer, drawSegment, getContext, floodFill]);

  useEffect(() => {
    const socket = getSocket();
    const onRoundStart = (): void => {
      const ctx = getContext(); const canvas = canvasRef.current;
      if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
      remoteStrokeRef.current = null;
    };
    socket.on("round_start", onRoundStart);
    return () => { socket.off("round_start", onRoundStart); };
  }, [getContext]);

  const clearCanvas = useCallback((): void => {
    const ctx = getContext(); const canvas = canvasRef.current;
    if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
    getSocket().emit("canvas_clear");
  }, [getContext]);

  const undoStroke = useCallback((): void => { getSocket().emit("draw_undo"); }, []);

  return { canvasRef, settings, setSettings, clearCanvas, undoStroke };
}