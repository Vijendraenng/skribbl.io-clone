import React, { useEffect, useRef, useCallback } from "react";

interface Stroke {
  type: string;
  x?: number;
  y?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  color?: string;
  size?: number;
  tool?: string;
  shapeType?: string;
}

interface Props {
  strokes: Stroke[];
  speed?: number;
  dataAttr?: string; // optional data-* attribute for external canvas access (e.g. save)
}

// Minimum delay between events in ms (at speed=1)
const BASE_MOVE_DELAY = 8; // ~120fps equivalent

export default function DrawingReplay({ strokes, speed = 3, dataAttr }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const strokeIdxRef = useRef(0);
  const lastPtRef = useRef<{ x: number; y: number } | null>(null);

  const delay = Math.max(1, Math.round(BASE_MOVE_DELAY / speed));

  const getCtx = useCallback((): CanvasRenderingContext2D | null => {
    const c = canvasRef.current;
    if (!c) return null;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    return ctx;
  }, []);

  const drawShape = useCallback((ctx: CanvasRenderingContext2D, s: Stroke) => {
    if (!s.shapeType) return;
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = s.color ?? "#000";
    ctx.lineWidth = s.size ?? 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    const { x1 = 0, y1 = 0, x2 = 0, y2 = 0 } = s;
    if (s.shapeType === "line") {
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    } else if (s.shapeType === "rect") {
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
    } else if (s.shapeType === "circle") {
      const rx = Math.abs(x2 - x1) / 2,
        ry = Math.abs(y2 - y1) / 2;
      ctx.ellipse(
        (x1 + x2) / 2,
        (y1 + y2) / 2,
        Math.max(rx, 1),
        Math.max(ry, 1),
        0,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    }
    ctx.restore();
  }, []);

  const floodFill = useCallback(
    (startX: number, startY: number, fillColor: string): void => {
      const canvas = canvasRef.current;
      const ctx = getCtx();
      if (!canvas || !ctx) return;
      const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = id.data,
        w = canvas.width,
        h = canvas.height;
      const sx = Math.max(0, Math.min(Math.round(startX), w - 1));
      const sy = Math.max(0, Math.min(Math.round(startY), h - 1));
      const ti = (sy * w + sx) * 4;
      const tr = d[ti],
        tg = d[ti + 1],
        tb = d[ti + 2],
        ta = d[ti + 3];
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
      if (tr === fr && tg === fg && tb === fb && ta === fa) return;
      const T = 30;
      const match = (i: number) =>
        Math.abs(d[i] - tr) <= T &&
        Math.abs(d[i + 1] - tg) <= T &&
        Math.abs(d[i + 2] - tb) <= T &&
        Math.abs(d[i + 3] - ta) <= T;
      const stack = [sx + sy * w];
      const vis = new Uint8Array(w * h);
      while (stack.length) {
        const p = stack.pop()!;
        if (vis[p]) continue;
        vis[p] = 1;
        const i = p * 4;
        if (!match(i)) continue;
        d[i] = fr;
        d[i + 1] = fg;
        d[i + 2] = fb;
        d[i + 3] = fa;
        const x = p % w,
          y = Math.floor(p / w);
        if (x > 0) stack.push(p - 1);
        if (x < w - 1) stack.push(p + 1);
        if (y > 0) stack.push(p - w);
        if (y < h - 1) stack.push(p + w);
      }
      ctx.putImageData(id, 0, 0);
    },
    [getCtx],
  );

  const playNext = useCallback(() => {
    const ctx = getCtx();
    const canvas = canvasRef.current;
    if (!ctx || !canvas || strokeIdxRef.current >= strokes.length) return;

    const s = strokes[strokeIdxRef.current++];

    if (s.type === "draw_start") {
      ctx.globalCompositeOperation =
        s.tool === "eraser" ? "destination-out" : "source-over";
      ctx.strokeStyle = s.color ?? "#000";
      ctx.lineWidth = s.size ?? 4;
      lastPtRef.current = { x: s.x ?? 0, y: s.y ?? 0 };
    } else if (s.type === "draw_move" && lastPtRef.current) {
      const nx = s.x ?? 0,
        ny = s.y ?? 0;
      ctx.beginPath();
      ctx.moveTo(lastPtRef.current.x, lastPtRef.current.y);
      ctx.lineTo(nx, ny);
      ctx.stroke();
      lastPtRef.current = { x: nx, y: ny };
    } else if (s.type === "draw_end") {
      lastPtRef.current = null;
    } else if (s.type === "canvas_fill") {
      floodFill(s.x ?? 0, s.y ?? 0, s.color ?? "#fff");
    } else if (s.type === "draw_shape") {
      drawShape(ctx, s);
    }

    if (strokeIdxRef.current < strokes.length) {
      timerRef.current = setTimeout(playNext, delay);
    }
  }, [strokes, delay, getCtx, floodFill, drawShape]);

  useEffect(() => {
    // Reset and start replay
    strokeIdxRef.current = 0;
    lastPtRef.current = null;

    // Clear canvas to white
    const ctx = getCtx();
    const c = canvasRef.current;
    if (ctx && c) {
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.restore();
    }

    if (strokes.length === 0) return;
    timerRef.current = setTimeout(playNext, delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [strokes, playNext, delay, getCtx]);

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={500}
      className="w-full rounded-lg bg-white"
      style={{ aspectRatio: "8/5" }}
      {...(dataAttr ? { [`data-${dataAttr}`]: "true" } : {})}
    />
  );
}
