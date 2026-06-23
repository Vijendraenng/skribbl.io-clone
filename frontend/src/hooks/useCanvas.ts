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

  const [settings, setSettings] = useState<DrawSettings>({
    color: "#1a1a2e",
    size: 6,
    tool: "pen",
  });

  const getContext = useCallback((): CanvasRenderingContext2D | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    return ctx;
  }, []);

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

  const getCanvasPoint = useCallback(
    (e: MouseEvent | Touch): { x: number; y: number } => {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    },
    [],
  );

  const flushMoves = useCallback((): void => {
    const moves = pendingMovesRef.current;
    if (moves.length === 0) return;
    pendingMovesRef.current = [];
    moves.forEach((pt) => {
      getSocket().emit("draw_move", { x: pt.x, y: pt.y });
    });
  }, []);

  // ─── Drawer mouse/touch events ────────────────────────────────────────

  useEffect(() => {
    if (!isDrawer) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onStart = (e: MouseEvent | TouchEvent): void => {
      e.preventDefault();
      isDrawingRef.current = true;
      const point =
        e instanceof MouseEvent
          ? getCanvasPoint(e)
          : getCanvasPoint((e as TouchEvent).touches[0]);
      lastPointRef.current = point;
      getSocket().emit("draw_start", {
        x: point.x,
        y: point.y,
        color: settings.color,
        size: settings.size,
        tool: settings.tool,
      });
    };

    const onMove = (e: MouseEvent | TouchEvent): void => {
      e.preventDefault();
      if (!isDrawingRef.current || !lastPointRef.current) return;
      const point =
        e instanceof MouseEvent
          ? getCanvasPoint(e)
          : getCanvasPoint((e as TouchEvent).touches[0]);
      drawSegment(
        lastPointRef.current,
        point,
        settings.tool === "eraser" ? "rgba(0,0,0,1)" : settings.color,
        settings.size,
        settings.tool,
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
  }, [isDrawer, settings, drawSegment, getCanvasPoint, flushMoves]);

  // ─── Remote drawing events (non-drawers) ─────────────────────────────

  useEffect(() => {
    if (isDrawer) return;
    const socket = getSocket();

    const onDrawData = (data: {
      type: string;
      x?: number;
      y?: number;
      color?: string;
      size?: number;
      tool?: string;
    }): void => {
      if (data.type === "draw_start") {
        const s: StrokeState = {
          x: data.x ?? 0,
          y: data.y ?? 0,
          color: data.color ?? "#000000",
          size: data.size ?? 6,
          tool: data.tool ?? "pen",
        };
        remoteStrokeRef.current = s;
      } else if (data.type === "draw_move") {
        const cur = remoteStrokeRef.current;
        if (!cur) return;
        const nx = data.x ?? 0;
        const ny = data.y ?? 0;
        drawSegment(
          { x: cur.x, y: cur.y },
          { x: nx, y: ny },
          cur.tool === "eraser" ? "rgba(0,0,0,1)" : cur.color,
          cur.size,
          cur.tool,
        );
        const next: StrokeState = {
          x: nx,
          y: ny,
          color: cur.color,
          size: cur.size,
          tool: cur.tool,
        };
        remoteStrokeRef.current = next;
      } else if (data.type === "draw_end") {
        remoteStrokeRef.current = null;
      }
    };

    const onCanvasCleared = (): void => {
      const ctx = getContext();
      const canvas = canvasRef.current;
      if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    const replayStrokes = (strokes: any[]): void => {
      const ctx = getContext();
      const canvas = canvasRef.current;
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let cur: StrokeState | null = null;
      for (const s of strokes) {
        if (s.type === "draw_start") {
          cur = {
            x: s.x ?? 0,
            y: s.y ?? 0,
            color: s.color ?? "#000000",
            size: s.size ?? 6,
            tool: s.tool ?? "pen",
          };
        } else if (s.type === "draw_move" && cur !== null) {
          const nx: number = s.x ?? 0;
          const ny: number = s.y ?? 0;
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
        }
      }
    };

    const onDrawUndone = ({ strokes }: { strokes: any[] }): void =>
      replayStrokes(strokes);

    socket.on("draw_data", onDrawData);
    socket.on("canvas_cleared", onCanvasCleared);
    socket.on("draw_undone", onDrawUndone);

    return () => {
      socket.off("draw_data", onDrawData);
      socket.off("canvas_cleared", onCanvasCleared);
      socket.off("draw_undone", onDrawUndone);
    };
  }, [isDrawer, drawSegment, getContext]);

  // ─── Clear canvas on round start ─────────────────────────────────────

  useEffect(() => {
    const socket = getSocket();
    const onRoundStart = (): void => {
      const ctx = getContext();
      const canvas = canvasRef.current;
      if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
      remoteStrokeRef.current = null;
    };
    socket.on("round_start", onRoundStart);
    return () => {
      socket.off("round_start", onRoundStart);
    };
  }, [getContext]);

  // ─── Drawer tool actions ──────────────────────────────────────────────

  const clearCanvas = useCallback((): void => {
    const ctx = getContext();
    const canvas = canvasRef.current;
    if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
    getSocket().emit("canvas_clear");
  }, [getContext]);

  const undoStroke = useCallback((): void => {
    getSocket().emit("draw_undo");
  }, []);

  return { canvasRef, settings, setSettings, clearCanvas, undoStroke };
}
