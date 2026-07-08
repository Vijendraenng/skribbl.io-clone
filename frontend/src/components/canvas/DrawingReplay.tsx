import React, { useEffect, useRef } from "react";
import type { ShapeType, StrokeEvent } from "../../types";

interface DrawingReplayProps {
  strokes: StrokeEvent[];
  durationMs?: number;
}

type ReplayUnit =
  | {
      type: "segment";
      from: { x: number; y: number };
      to: { x: number; y: number };
      color: string;
      size: number;
      tool: string;
    }
  | {
      type: "fill";
      x: number;
      y: number;
      color: string;
    }
  | {
      type: "shape";
      shapeType: ShapeType;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      color: string;
      size: number;
    };

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 500;

function drawShapeOnCtx(
  ctx: CanvasRenderingContext2D,
  shapeType: ShapeType,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  size: number,
) {
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = color;
  ctx.lineWidth = size;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();

  if (shapeType === "line") {
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  } else if (shapeType === "rect") {
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
  } else {
    const rx = Math.max(Math.abs(x2 - x1) / 2, 1);
    const ry = Math.max(Math.abs(y2 - y1) / 2, 1);
    ctx.ellipse((x1 + x2) / 2, (y1 + y2) / 2, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawSegment(
  ctx: CanvasRenderingContext2D,
  unit: Extract<ReplayUnit, { type: "segment" }>,
) {
  ctx.save();
  ctx.globalCompositeOperation =
    unit.tool === "eraser" ? "destination-out" : "source-over";
  ctx.strokeStyle = unit.tool === "eraser" ? "rgba(0,0,0,1)" : unit.color;
  ctx.lineWidth = unit.size;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(unit.from.x, unit.from.y);
  ctx.lineTo(unit.to.x, unit.to.y);
  ctx.stroke();
  ctx.restore();
}

function floodFill(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  sx: number,
  sy: number,
  fillColor: string,
) {
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;
  const width = canvas.width;
  const height = canvas.height;
  const x0 = Math.max(0, Math.min(Math.round(sx), width - 1));
  const y0 = Math.max(0, Math.min(Math.round(sy), height - 1));
  const targetIndex = (y0 * width + x0) * 4;
  const target = [
    data[targetIndex],
    data[targetIndex + 1],
    data[targetIndex + 2],
    data[targetIndex + 3],
  ];

  const swatch = document.createElement("canvas");
  swatch.width = 1;
  swatch.height = 1;
  const swatchCtx = swatch.getContext("2d");
  if (!swatchCtx) return;
  swatchCtx.fillStyle = fillColor;
  swatchCtx.fillRect(0, 0, 1, 1);
  const fill = swatchCtx.getImageData(0, 0, 1, 1).data;

  if (
    target[0] === fill[0] &&
    target[1] === fill[1] &&
    target[2] === fill[2] &&
    target[3] === fill[3]
  ) {
    return;
  }

  const tolerance = 30;
  const matches = (index: number) =>
    Math.abs(data[index] - target[0]) <= tolerance &&
    Math.abs(data[index + 1] - target[1]) <= tolerance &&
    Math.abs(data[index + 2] - target[2]) <= tolerance &&
    Math.abs(data[index + 3] - target[3]) <= tolerance;

  const stack = [x0 + y0 * width];
  const visited = new Uint8Array(width * height);

  while (stack.length) {
    const point = stack.pop();
    if (point === undefined || visited[point]) continue;
    visited[point] = 1;

    const index = point * 4;
    if (!matches(index)) continue;

    data[index] = fill[0];
    data[index + 1] = fill[1];
    data[index + 2] = fill[2];
    data[index + 3] = fill[3];

    const x = point % width;
    const y = Math.floor(point / width);
    if (x > 0) stack.push(point - 1);
    if (x < width - 1) stack.push(point + 1);
    if (y > 0) stack.push(point - width);
    if (y < height - 1) stack.push(point + width);
  }

  ctx.putImageData(image, 0, 0);
}

function buildReplayUnits(strokes: StrokeEvent[]): ReplayUnit[] {
  const units: ReplayUnit[] = [];
  let current:
    | { x: number; y: number; color: string; size: number; tool: string }
    | null = null;

  for (const stroke of strokes) {
    if (stroke.type === "draw_start") {
      current = {
        x: stroke.x ?? 0,
        y: stroke.y ?? 0,
        color: stroke.color ?? "#000000",
        size: stroke.size ?? 6,
        tool: stroke.tool ?? "pen",
      };
    } else if (stroke.type === "draw_move" && current) {
      const next = { x: stroke.x ?? current.x, y: stroke.y ?? current.y };
      units.push({
        type: "segment",
        from: { x: current.x, y: current.y },
        to: next,
        color: current.color,
        size: current.size,
        tool: current.tool,
      });
      current = { ...current, ...next };
    } else if (stroke.type === "draw_end") {
      current = null;
    } else if (stroke.type === "canvas_fill") {
      units.push({
        type: "fill",
        x: stroke.x,
        y: stroke.y,
        color: stroke.color,
      });
      current = null;
    } else if (stroke.type === "draw_shape") {
      units.push({
        type: "shape",
        shapeType: stroke.shapeType,
        x1: stroke.x1,
        y1: stroke.y1,
        x2: stroke.x2,
        y2: stroke.y2,
        color: stroke.color,
        size: stroke.size,
      });
      current = null;
    }
  }

  return units;
}

function clearCanvas(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
}

export default function DrawingReplay({
  strokes,
  durationMs = 5000,
}: DrawingReplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const units = buildReplayUnits(strokes);
    let frameId = 0;
    let unitIndex = 0;
    let startTime = 0;
    const unitDuration =
      units.length > 0 ? durationMs / units.length : durationMs;

    clearCanvas(ctx, canvas);

    const drawUnit = (unit: ReplayUnit) => {
      if (unit.type === "segment") {
        drawSegment(ctx, unit);
      } else if (unit.type === "fill") {
        floodFill(ctx, canvas, unit.x, unit.y, unit.color);
      } else {
        drawShapeOnCtx(
          ctx,
          unit.shapeType,
          unit.x1,
          unit.y1,
          unit.x2,
          unit.y2,
          unit.color,
          unit.size,
        );
      }
    };

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const targetIndex =
        units.length === 0
          ? 0
          : Math.min(
              units.length,
              Math.floor((timestamp - startTime) / unitDuration),
            );

      while (unitIndex < targetIndex) {
        drawUnit(units[unitIndex]);
        unitIndex += 1;
      }

      if (unitIndex < units.length) {
        frameId = requestAnimationFrame(animate);
      }
    };

    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [durationMs, strokes]);

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      className="block w-full bg-white"
      style={{ aspectRatio: "8/5" }}
    />
  );
}
