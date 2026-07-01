import { useRef, useEffect, useCallback, useState } from "react";
import { getSocket } from "../utils/socket";
import type { DrawSettings } from "../types";

interface StrokeState {
  x: number;
  y: number;
  color: string;
  size: number;
  tool: string;
}
interface UseCanvasProps {
  isDrawer: boolean;
}

export function useCanvas({ isDrawer }: UseCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const pendingMovesRef = useRef<{ x: number; y: number }[]>([]);
  const flushTimerRef = useRef<number | null>(null);
  const remoteStrokeRef = useRef<StrokeState | null>(null);

  // Keep a ref to latest settings so socket callbacks always see current values
  // without being in deps (avoids re-registering listeners on every color change)
  const settingsRef = useRef<DrawSettings>({
    color: "#000000",
    size: 6,
    tool: "pen",
  });

  const [settings, setSettings] = useState<DrawSettings>(settingsRef.current);

  // Sync settingsRef whenever settings state changes
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // ─── Canvas context ─────────────────────────────────────────────────
  const getContext = useCallback((): CanvasRenderingContext2D | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    return ctx;
  }, []);

  // ─── Ensure canvas is white (called before any pixel read) ──────────
  const ensureWhiteBackground = useCallback((): void => {
    const ctx = getContext();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    // Only fill if canvas is still all-transparent (fresh canvas)
    const sample = ctx.getImageData(0, 0, 1, 1).data;
    if (sample[3] === 0) {
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
  }, [getContext]);

  // ─── Draw a segment ─────────────────────────────────────────────────
  const drawSegment = useCallback(
    (
      from: { x: number; y: number },
      to: { x: number; y: number },
      color: string,
      size: number,
      tool: string,
    ): void => {
      const ctx = getContext();
      if (!ctx) return;
      ctx.globalCompositeOperation =
        tool === "eraser" ? "destination-out" : "source-over";
      ctx.strokeStyle = color;
      ctx.lineWidth = size;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    },
    [getContext],
  );

  // ─── Flood fill ─────────────────────────────────────────────────────
  const floodFill = useCallback(
    (startX: number, startY: number, fillColor: string): void => {
      const canvas = canvasRef.current;
      const ctx = getContext();
      if (!canvas || !ctx) return;

      // Ensure white background so empty pixels read as white, not transparent
      ensureWhiteBackground();

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const width = canvas.width;
      const height = canvas.height;

      const sx = Math.max(0, Math.min(Math.round(startX), width - 1));
      const sy = Math.max(0, Math.min(Math.round(startY), height - 1));
      const ti = (sy * width + sx) * 4;

      // Read target color — after ensureWhiteBackground, transparent = white
      const tr = data[ti];
      const tg = data[ti + 1];
      const tb = data[ti + 2];
      const ta = data[ti + 3];

      // Parse fill colour via off-screen 1×1 canvas
      const tmp = document.createElement("canvas");
      tmp.width = tmp.height = 1;
      const tc = tmp.getContext("2d")!;
      tc.fillStyle = fillColor;
      tc.fillRect(0, 0, 1, 1);
      const fd = tc.getImageData(0, 0, 1, 1).data;
      const fr = fd[0],
        fg = fd[1],
        fb = fd[2],
        fa = fd[3];

      // Nothing to do if target and fill are the same
      if (tr === fr && tg === fg && tb === fb && ta === fa) return;

      // Tolerance-based match — handles anti-aliased edges
      const TOL = 30;
      const matches = (i: number): boolean =>
        Math.abs(data[i] - tr) <= TOL &&
        Math.abs(data[i + 1] - tg) <= TOL &&
        Math.abs(data[i + 2] - tb) <= TOL &&
        Math.abs(data[i + 3] - ta) <= TOL;

      const stack: number[] = [sx + sy * width]; // flat index instead of [x,y] pair
      const visited = new Uint8Array(width * height);

      while (stack.length > 0) {
        const pos = stack.pop()!;
        if (visited[pos]) continue;
        visited[pos] = 1;
        const i = pos * 4;
        if (!matches(i)) continue;

        // Paint pixel
        data[i] = fr;
        data[i + 1] = fg;
        data[i + 2] = fb;
        data[i + 3] = fa;

        const x = pos % width;
        const y = Math.floor(pos / width);
        if (x > 0) stack.push(pos - 1);
        if (x < width - 1) stack.push(pos + 1);
        if (y > 0) stack.push(pos - width);
        if (y < height - 1) stack.push(pos + width);
      }

      ctx.putImageData(imageData, 0, 0);
    },
    [getContext, ensureWhiteBackground],
  );

  // ─── Replay full stroke history ──────────────────────────────────────
  const replayStrokes = useCallback(
    (strokes: any[]): void => {
      const ctx = getContext();
      const canvas = canvasRef.current;
      if (!ctx || !canvas) return;

      // White base
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();

      let cur: StrokeState | null = null;
      for (const s of strokes) {
        if (s.type === "draw_start") {
          cur = {
            x: s.x ?? 0,
            y: s.y ?? 0,
            color: s.color ?? "#000",
            size: s.size ?? 6,
            tool: s.tool ?? "pen",
          };
        } else if (s.type === "draw_move" && cur !== null) {
          const nx = s.x ?? 0,
            ny = s.y ?? 0;
          drawSegment(
            { x: cur.x, y: cur.y },
            { x: nx, y: ny },
            cur.tool === "eraser" ? "rgba(0,0,0,1)" : cur.color,
            cur.size,
            cur.tool,
          );
          cur = {
            x: nx,
            y: ny,
            color: cur.color,
            size: cur.size,
            tool: cur.tool,
          };
        } else if (s.type === "draw_end") {
          cur = null;
        } else if (s.type === "canvas_fill") {
          floodFill(s.x, s.y, s.color);
        }
      }
    },
    [getContext, drawSegment, floodFill],
  );

  // ─── Canvas point helper ────────────────────────────────────────────
  const getCanvasPoint = useCallback(
    (e: MouseEvent | Touch): { x: number; y: number } => {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) * (canvas.width / rect.width),
        y: (e.clientY - rect.top) * (canvas.height / rect.height),
      };
    },
    [],
  );

  // ─── Flush batched moves ────────────────────────────────────────────
  const flushMoves = useCallback((): void => {
    const moves = pendingMovesRef.current;
    if (!moves.length) return;
    pendingMovesRef.current = [];
    moves.forEach((pt) => getSocket().emit("draw_move", { x: pt.x, y: pt.y }));
  }, []);

  // ─── Drawer: input events ─────────────────────────────────────────────
  // Uses settingsRef (not settings) so this effect only re-runs when
  // isDrawer changes — NOT on every color/size/tool change.
  useEffect(() => {
    if (!isDrawer) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onStart = (e: MouseEvent | TouchEvent): void => {
      e.preventDefault();
      const s = settingsRef.current;
      const point =
        e instanceof MouseEvent
          ? getCanvasPoint(e)
          : getCanvasPoint((e as TouchEvent).touches[0]);

      if (s.tool === "fill") {
        floodFill(point.x, point.y, s.color);
        getSocket().emit("canvas_fill", {
          x: point.x,
          y: point.y,
          color: s.color,
        });
        return;
      }
      ensureWhiteBackground();
      isDrawingRef.current = true;
      lastPointRef.current = point;
      getSocket().emit("draw_start", {
        x: point.x,
        y: point.y,
        color: s.color,
        size: s.size,
        tool: s.tool,
      });
    };

    const onMove = (e: MouseEvent | TouchEvent): void => {
      e.preventDefault();
      if (!isDrawingRef.current || !lastPointRef.current) return;
      const s = settingsRef.current;
      if (s.tool === "fill") return;
      const point =
        e instanceof MouseEvent
          ? getCanvasPoint(e)
          : getCanvasPoint((e as TouchEvent).touches[0]);
      drawSegment(
        lastPointRef.current,
        point,
        s.tool === "eraser" ? "rgba(0,0,0,1)" : s.color,
        s.size,
        s.tool,
      );
      lastPointRef.current = point;
      pendingMovesRef.current.push(point);
      if (!flushTimerRef.current) {
        flushTimerRef.current = window.setTimeout(() => {
          flushMoves();
          flushTimerRef.current = null;
        }, 16);
      }
    };

    const onEnd = (e: MouseEvent | TouchEvent): void => {
      e.preventDefault();
      if (!isDrawingRef.current) return;
      isDrawingRef.current = false;
      lastPointRef.current = null;
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
        flushMoves();
      }
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
    // Only re-run when isDrawer changes — settingsRef handles live settings
  }, [
    isDrawer,
    getCanvasPoint,
    drawSegment,
    flushMoves,
    floodFill,
    ensureWhiteBackground,
  ]); // eslint-disable-line

  // ─── Remote events: stable effect, never re-registers on color change ─
  // drawSegment / floodFill / replayStrokes are stable useCallbacks that
  // only depend on getContext — which never changes. So this effect mounts
  // once and stays mounted for the entire game session.
  useEffect(() => {
    const socket = getSocket();

    const onDrawData = (data: {
      type: string;
      x?: number;
      y?: number;
      color?: string;
      size?: number;
      tool?: string;
    }): void => {
      if (isDrawer) return; // drawer renders locally
      if (data.type === "draw_start") {
        ensureWhiteBackground();
        remoteStrokeRef.current = {
          x: data.x ?? 0,
          y: data.y ?? 0,
          color: data.color ?? "#000",
          size: data.size ?? 6,
          tool: data.tool ?? "pen",
        };
      } else if (data.type === "draw_move") {
        const cur = remoteStrokeRef.current;
        if (!cur) return;
        const nx = data.x ?? 0,
          ny = data.y ?? 0;
        drawSegment(
          { x: cur.x, y: cur.y },
          { x: nx, y: ny },
          cur.tool === "eraser" ? "rgba(0,0,0,1)" : cur.color,
          cur.size,
          cur.tool,
        );
        remoteStrokeRef.current = {
          x: nx,
          y: ny,
          color: cur.color,
          size: cur.size,
          tool: cur.tool,
        };
      } else if (data.type === "draw_end") {
        remoteStrokeRef.current = null;
      }
    };

    const onFill = ({
      x,
      y,
      color,
    }: {
      x: number;
      y: number;
      color: string;
    }): void => {
      floodFill(x, y, color);
    };

    const onCanvasCleared = (): void => {
      const ctx = getContext();
      const canvas = canvasRef.current;
      if (!ctx || !canvas) return;
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    };

    const onDrawUndone = ({ strokes }: { strokes: any[] }): void => {
      replayStrokes(strokes);
    };

    const onRoundStart = (): void => {
      const ctx = getContext();
      const canvas = canvasRef.current;
      if (!ctx || !canvas) return;
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
      remoteStrokeRef.current = null;
    };

    socket.on("draw_data", onDrawData);
    socket.on("canvas_fill", onFill);
    socket.on("canvas_cleared", onCanvasCleared);
    socket.on("draw_undone", onDrawUndone);
    socket.on("round_start", onRoundStart);

    return () => {
      socket.off("draw_data", onDrawData);
      socket.off("canvas_fill", onFill);
      socket.off("canvas_cleared", onCanvasCleared);
      socket.off("draw_undone", onDrawUndone);
      socket.off("round_start", onRoundStart);
    };
    // Stable deps: getContext never changes; drawSegment/floodFill/replayStrokes
    // are pure functions of getContext. isDrawer can change when the round rotates.
  }, [
    isDrawer,
    getContext,
    drawSegment,
    floodFill,
    replayStrokes,
    ensureWhiteBackground,
  ]);

  // ─── Drawer actions ──────────────────────────────────────────────────
  const clearCanvas = useCallback((): void => {
    const ctx = getContext();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    getSocket().emit("canvas_clear");
  }, [getContext]);

  const undoStroke = useCallback((): void => {
    getSocket().emit("draw_undo");
  }, []);

  return { canvasRef, settings, setSettings, clearCanvas, undoStroke };
}
