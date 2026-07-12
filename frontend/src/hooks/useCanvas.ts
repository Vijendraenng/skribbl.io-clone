import { useRef, useEffect, useCallback, useState } from "react";
import { getSocket } from "../utils/socket";
import type { DrawSettings, ShapeType } from "../types";

// ─── Pure shape renderer ────────────────────────────────────────────────────
function drawShapeOnCtx(
  ctx: CanvasRenderingContext2D,
  shapeType: ShapeType,
  x1: number, y1: number, x2: number, y2: number,
  color: string, size: number
): void {
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = color;
  ctx.lineWidth = size;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  if (shapeType === "line") {
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  } else if (shapeType === "rect") {
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
  } else if (shapeType === "circle") {
    const rx = Math.abs(x2 - x1) / 2, ry = Math.abs(y2 - y1) / 2;
    ctx.ellipse((x1+x2)/2, (y1+y2)/2, Math.max(rx,1), Math.max(ry,1), 0, 0, Math.PI*2);
    ctx.stroke();
  }
  ctx.restore();
}

const isShapeTool = (t: string): t is ShapeType =>
  t === "line" || t === "rect" || t === "circle";

// ─── Hook ───────────────────────────────────────────────────────────────────
export function useCanvas({ isDrawer }: { isDrawer: boolean }) {
  const canvasRef        = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef     = useRef(false);
  const lastPointRef     = useRef<{ x: number; y: number } | null>(null);
  const shapeStartRef    = useRef<{ x: number; y: number } | null>(null);
  const pendingMovesRef  = useRef<{ x: number; y: number }[]>([]);
  const flushTimerRef    = useRef<number | null>(null);
  const remoteStrokeRef  = useRef<{x:number;y:number;color:string;size:number;tool:string}|null>(null);

  const settingsRef = useRef<DrawSettings>({ color: "#000000", size: 6, tool: "pen" });
  const [settings, setSettings] = useState<DrawSettings>(settingsRef.current);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  const undoCountRef = useRef(0);
  const redoCountRef = useRef(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const syncButtons = useCallback(() => {
    setCanUndo(undoCountRef.current > 0);
    setCanRedo(redoCountRef.current > 0);
  }, []);

  const resetCounts = useCallback(() => {
    undoCountRef.current = 0; redoCountRef.current = 0; syncButtons();
  }, [syncButtons]);

  // ── Context helpers ──────────────────────────────────────────────────────
  const getCtx = useCallback((): CanvasRenderingContext2D | null => {
    const c = canvasRef.current; if (!c) return null;
    const ctx = c.getContext("2d"); if (!ctx) return null;
    ctx.lineCap = "round"; ctx.lineJoin = "round"; return ctx;
  }, []);

  const getPreviewCtx = useCallback((): CanvasRenderingContext2D | null => {
    const c = previewCanvasRef.current; if (!c) return null;
    return c.getContext("2d");
  }, []);

  const clearPreview = useCallback((): void => {
    const pctx = getPreviewCtx(); const pc = previewCanvasRef.current;
    if (pctx && pc) pctx.clearRect(0, 0, pc.width, pc.height);
  }, [getPreviewCtx]);

  const ensureWhite = useCallback((): void => {
    const ctx = getCtx(); const c = canvasRef.current; if (!ctx || !c) return;
    if (ctx.getImageData(0, 0, 1, 1).data[3] === 0) {
      ctx.save(); ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, c.width, c.height); ctx.restore();
    }
  }, [getCtx]);

  const drawSegment = useCallback((
    from: {x:number;y:number}, to: {x:number;y:number},
    color: string, size: number, tool: string
  ): void => {
    const ctx = getCtx(); if (!ctx) return;
    ctx.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";
    ctx.strokeStyle = color; ctx.lineWidth = size;
    ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
  }, [getCtx]);

  const floodFill = useCallback((sx: number, sy: number, fillColor: string): void => {
    const canvas = canvasRef.current; const ctx = getCtx();
    if (!canvas || !ctx) return;
    ensureWhite();
    const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = id.data, w = canvas.width, h = canvas.height;
    const x0 = Math.max(0, Math.min(Math.round(sx), w-1));
    const y0 = Math.max(0, Math.min(Math.round(sy), h-1));
    const ti = (y0*w+x0)*4;
    const tr=d[ti],tg=d[ti+1],tb=d[ti+2],ta=d[ti+3];
    const tmp = document.createElement("canvas"); tmp.width=tmp.height=1;
    const tc=tmp.getContext("2d")!; tc.fillStyle=fillColor; tc.fillRect(0,0,1,1);
    const fd=tc.getImageData(0,0,1,1).data;
    const fr=fd[0],fg=fd[1],fb=fd[2],fa=fd[3];
    if (tr===fr&&tg===fg&&tb===fb&&ta===fa) return;
    const T=30;
    const match=(i:number)=>Math.abs(d[i]-tr)<=T&&Math.abs(d[i+1]-tg)<=T&&Math.abs(d[i+2]-tb)<=T&&Math.abs(d[i+3]-ta)<=T;
    const stack=[x0+y0*w]; const vis=new Uint8Array(w*h);
    while (stack.length) {
      const p=stack.pop()!; if (vis[p]) continue; vis[p]=1;
      const i=p*4; if (!match(i)) continue;
      d[i]=fr;d[i+1]=fg;d[i+2]=fb;d[i+3]=fa;
      const x=p%w,y=Math.floor(p/w);
      if(x>0)stack.push(p-1); if(x<w-1)stack.push(p+1);
      if(y>0)stack.push(p-w); if(y<h-1)stack.push(p+w);
    }
    ctx.putImageData(id, 0, 0);
  }, [getCtx, ensureWhite]);

  const replayStrokes = useCallback((strokes: any[]): void => {
    const ctx=getCtx(); const c=canvasRef.current; if (!ctx||!c) return;
    ctx.save(); ctx.globalCompositeOperation="source-over";
    ctx.fillStyle="#ffffff"; ctx.fillRect(0,0,c.width,c.height); ctx.restore();
    let cur:{x:number;y:number;color:string;size:number;tool:string}|null=null;
    for (const s of strokes) {
      if (s.type==="draw_start") {
        cur={x:s.x??0,y:s.y??0,color:s.color??"#000",size:s.size??6,tool:s.tool??"pen"};
      } else if (s.type==="draw_move"&&cur) {
        const nx=s.x??0,ny=s.y??0;
        drawSegment({x:cur.x,y:cur.y},{x:nx,y:ny},
          cur.tool==="eraser"?"rgba(0,0,0,1)":cur.color,cur.size,cur.tool);
        cur={x:nx,y:ny,color:cur.color,size:cur.size,tool:cur.tool};
      } else if (s.type==="draw_end") {
        cur=null;
      } else if (s.type==="canvas_fill") {
        floodFill(s.x,s.y,s.color);
      } else if (s.type==="draw_shape") {
        drawShapeOnCtx(ctx,s.shapeType,s.x1,s.y1,s.x2,s.y2,s.color,s.size);
      }
    }
  }, [getCtx, drawSegment, floodFill]);

  // ── Canvas coordinate helper — works for BOTH canvases ──────────────────
  // Always uses mainCanvas dimensions for coordinate mapping
  const getPoint = useCallback((e: MouseEvent|Touch): {x:number;y:number} => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (c.width  / r.width),
      y: (e.clientY - r.top)  * (c.height / r.height),
    };
  }, []);

  const flushMoves = useCallback((): void => {
    const moves = pendingMovesRef.current; if (!moves.length) return;
    pendingMovesRef.current = [];
    moves.forEach(pt => getSocket().emit("draw_move", { x:pt.x, y:pt.y }));
  }, []);

  // ── Drawer input events ──────────────────────────────────────────────────
  // KEY FIX: listeners are registered on BOTH canvases via a wrapper div ref,
  // but we use a simpler approach — register on the OVERLAY canvas always,
  // use mainCanvas bounding rect for coordinate mapping.
  // This way shape tools work (overlay on top) AND pen/eraser work (no canvas below blocks them).
  useEffect(() => {
    if (!isDrawer) return;

    // Use the preview canvas as the single event surface.
    // It sits on top of the main canvas and covers it completely.
    // When NOT a shape tool, it's transparent so visually shows main canvas.
    const eventCanvas = previewCanvasRef.current;
    const mainCanvas  = canvasRef.current;
    if (!eventCanvas || !mainCanvas) return;

    // Make overlay always capture pointer events for the drawer
    eventCanvas.style.pointerEvents = "auto";

    const onStart = (e: MouseEvent|TouchEvent): void => {
      e.preventDefault();
      const s = settingsRef.current;
      const pt = e instanceof MouseEvent ? getPoint(e) : getPoint((e as TouchEvent).touches[0]);

      if (s.tool === "eyedropper") {
        // Read the pixel color at click point from the MAIN canvas
        const ctx = getCtx();
        const c   = canvasRef.current;
        if (ctx && c) {
          // Ensure white background so transparent pixels read as white
          ensureWhite();
          const px = Math.max(0, Math.min(Math.round(pt.x), c.width  - 1));
          const py = Math.max(0, Math.min(Math.round(pt.y), c.height - 1));
          const [r, g, b] = ctx.getImageData(px, py, 1, 1).data;
          // Convert to hex
          const hex = "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("");
          // Switch to pen with picked color
          setSettings(prev => ({ ...prev, color: hex, tool: "pen" }));
        }
        return;
      }

      if (s.tool === "fill") {
        floodFill(pt.x, pt.y, s.color);
        undoCountRef.current++; redoCountRef.current=0; syncButtons();
        getSocket().emit("canvas_fill", { x:pt.x, y:pt.y, color:s.color });
        return;
      }

      if (isShapeTool(s.tool)) {
        shapeStartRef.current = pt;
        isDrawingRef.current  = true;
        return;
      }

      // Pen / eraser
      ensureWhite();
      isDrawingRef.current  = true;
      lastPointRef.current  = pt;
      getSocket().emit("draw_start", { x:pt.x, y:pt.y, color:s.color, size:s.size, tool:s.tool });
    };

    const onMove = (e: MouseEvent|TouchEvent): void => {
      e.preventDefault();
      if (!isDrawingRef.current) return;
      const s = settingsRef.current;
      const pt = e instanceof MouseEvent ? getPoint(e) : getPoint((e as TouchEvent).touches[0]);

      if (isShapeTool(s.tool) && shapeStartRef.current) {
        const pctx = getPreviewCtx(); const pc = previewCanvasRef.current;
        if (pctx && pc) {
          pctx.clearRect(0, 0, pc.width, pc.height);
          drawShapeOnCtx(pctx, s.tool as ShapeType,
            shapeStartRef.current.x, shapeStartRef.current.y, pt.x, pt.y,
            s.color, s.size);
        }
        return;
      }

      if (!lastPointRef.current || s.tool === "fill") return;
      drawSegment(lastPointRef.current, pt,
        s.tool === "eraser" ? "rgba(0,0,0,1)" : s.color, s.size, s.tool);
      lastPointRef.current = pt;
      pendingMovesRef.current.push(pt);
      if (!flushTimerRef.current) {
        flushTimerRef.current = window.setTimeout(() => { flushMoves(); flushTimerRef.current=null; }, 16);
      }
    };

    const onEnd = (e: MouseEvent|TouchEvent): void => {
      e.preventDefault();
      if (!isDrawingRef.current) return;
      const s = settingsRef.current;
      const pt = e instanceof MouseEvent ? getPoint(e) : getPoint((e as TouchEvent).touches[0]);

      if (isShapeTool(s.tool) && shapeStartRef.current) {
        clearPreview();
        const ctx = getCtx();
        if (ctx) drawShapeOnCtx(ctx, s.tool as ShapeType,
          shapeStartRef.current.x, shapeStartRef.current.y, pt.x, pt.y, s.color, s.size);
        getSocket().emit("draw_shape", {
          shapeType: s.tool,
          x1:shapeStartRef.current.x, y1:shapeStartRef.current.y,
          x2:pt.x, y2:pt.y, color:s.color, size:s.size,
        });
        shapeStartRef.current = null; isDrawingRef.current = false;
        undoCountRef.current++; redoCountRef.current=0; syncButtons();
        return;
      }

      isDrawingRef.current  = false;
      lastPointRef.current  = null;
      if (flushTimerRef.current) { clearTimeout(flushTimerRef.current); flushTimerRef.current=null; flushMoves(); }
      getSocket().emit("draw_end", {});
      undoCountRef.current++; redoCountRef.current=0; syncButtons();
    };

    eventCanvas.addEventListener("mousedown",  onStart);
    eventCanvas.addEventListener("mousemove",  onMove);
    eventCanvas.addEventListener("mouseup",    onEnd);
    eventCanvas.addEventListener("mouseleave", onEnd);
    eventCanvas.addEventListener("touchstart", onStart, { passive:false });
    eventCanvas.addEventListener("touchmove",  onMove,  { passive:false });
    eventCanvas.addEventListener("touchend",   onEnd,   { passive:false });
    return () => {
      eventCanvas.removeEventListener("mousedown",  onStart);
      eventCanvas.removeEventListener("mousemove",  onMove);
      eventCanvas.removeEventListener("mouseup",    onEnd);
      eventCanvas.removeEventListener("mouseleave", onEnd);
      eventCanvas.removeEventListener("touchstart", onStart);
      eventCanvas.removeEventListener("touchmove",  onMove);
      eventCanvas.removeEventListener("touchend",   onEnd);
    };
  }, [isDrawer, getPoint, getCtx, getPreviewCtx, clearPreview, drawSegment,
      flushMoves, floodFill, ensureWhite, syncButtons]);

  // ── Remote events (stable — no re-register on settings change) ──────────
  useEffect(() => {
    const socket = getSocket();

    const onDrawData = (data: {type:string;x?:number;y?:number;color?:string;size?:number;tool?:string}): void => {
      if (isDrawer) return;
      if (data.type === "draw_start") {
        ensureWhite();
        remoteStrokeRef.current = {x:data.x??0,y:data.y??0,color:data.color??"#000",size:data.size??6,tool:data.tool??"pen"};
      } else if (data.type === "draw_move") {
        const cur = remoteStrokeRef.current; if (!cur) return;
        const nx=data.x??0, ny=data.y??0;
        drawSegment({x:cur.x,y:cur.y},{x:nx,y:ny},
          cur.tool==="eraser"?"rgba(0,0,0,1)":cur.color,cur.size,cur.tool);
        remoteStrokeRef.current={x:nx,y:ny,color:cur.color,size:cur.size,tool:cur.tool};
      } else if (data.type === "draw_end") {
        remoteStrokeRef.current = null;
      }
    };

    const onFill = ({x,y,color}:{x:number;y:number;color:string}): void => {
      floodFill(x, y, color);
    };

    const onShape = (data:{shapeType:ShapeType;x1:number;y1:number;x2:number;y2:number;color:string;size:number}): void => {
      const ctx = getCtx(); if (!ctx) return;
      drawShapeOnCtx(ctx,data.shapeType,data.x1,data.y1,data.x2,data.y2,data.color,data.size);
    };

    const onCanvasCleared = (): void => {
      const ctx=getCtx(); const c=canvasRef.current; if (!ctx||!c) return;
      ctx.save(); ctx.globalCompositeOperation="source-over";
      ctx.fillStyle="#ffffff"; ctx.fillRect(0,0,c.width,c.height); ctx.restore();
      resetCounts();
    };

    const onDrawUndone = ({strokes,canUndo:cu,canRedo:cr}:{strokes:any[];canUndo:boolean;canRedo:boolean}): void => {
      replayStrokes(strokes);
      undoCountRef.current = cu ? undoCountRef.current : 0;
      redoCountRef.current = cr ? redoCountRef.current : 0;
      syncButtons();
    };

    const onDrawRedone = ({strokes,canUndo:cu,canRedo:cr}:{strokes:any[];canUndo:boolean;canRedo:boolean}): void => {
      replayStrokes(strokes);
      undoCountRef.current = cu ? undoCountRef.current : 0;
      redoCountRef.current = cr ? redoCountRef.current : 0;
      syncButtons();
    };

    const onRoundStart = (): void => {
      const ctx=getCtx(); const c=canvasRef.current; if (!ctx||!c) return;
      ctx.save(); ctx.globalCompositeOperation="source-over";
      ctx.fillStyle="#ffffff"; ctx.fillRect(0,0,c.width,c.height); ctx.restore();
      remoteStrokeRef.current=null; resetCounts();
    };

    socket.on("draw_data",      onDrawData);
    socket.on("canvas_fill",    onFill);
    socket.on("draw_shape",     onShape);
    socket.on("canvas_cleared", onCanvasCleared);
    socket.on("draw_undone",    onDrawUndone);
    socket.on("draw_redone",    onDrawRedone);
    socket.on("round_start",    onRoundStart);
    return () => {
      socket.off("draw_data",      onDrawData);
      socket.off("canvas_fill",    onFill);
      socket.off("draw_shape",     onShape);
      socket.off("canvas_cleared", onCanvasCleared);
      socket.off("draw_undone",    onDrawUndone);
      socket.off("draw_redone",    onDrawRedone);
      socket.off("round_start",    onRoundStart);
    };
  }, [isDrawer, getCtx, drawSegment, floodFill, replayStrokes, ensureWhite, resetCounts, syncButtons]);

  // ── Actions ──────────────────────────────────────────────────────────────
  const clearCanvas = useCallback((): void => {
    const ctx=getCtx(); const c=canvasRef.current; if (!ctx||!c) return;
    ctx.save(); ctx.globalCompositeOperation="source-over";
    ctx.fillStyle="#ffffff"; ctx.fillRect(0,0,c.width,c.height); ctx.restore();
    clearPreview(); resetCounts(); getSocket().emit("canvas_clear");
  }, [getCtx, clearPreview, resetCounts]);

  const undoStroke = useCallback((): void => {
    if (undoCountRef.current === 0) return;
    undoCountRef.current--; redoCountRef.current++; syncButtons();
    getSocket().emit("draw_undo");
  }, [syncButtons]);

  const redoStroke = useCallback((): void => {
    if (redoCountRef.current === 0) return;
    redoCountRef.current--; undoCountRef.current++; syncButtons();
    getSocket().emit("draw_redo");
  }, [syncButtons]);

  // Save canvas as PNG — composites white background + main canvas + optional word label
  const saveDrawing = useCallback((word?: string): void => {
    const src = canvasRef.current;
    if (!src) return;

    // Create an off-screen canvas so we can add a label without touching the game canvas
    const out = document.createElement("canvas");
    const labelHeight = word ? 36 : 0;
    out.width  = src.width;
    out.height = src.height + labelHeight;

    const ctx = out.getContext("2d")!;

    // White background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, out.width, out.height);

    // Copy drawing
    ctx.drawImage(src, 0, 0);

    // Word label bar at the bottom
    if (word) {
      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(0, src.height, out.width, labelHeight);
      ctx.fillStyle = "#e94560";
      ctx.font = "bold 18px 'Segoe UI', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`✏️ "${word}"  —  Skribbl Clone`, out.width / 2, src.height + labelHeight / 2);
    }

    // Trigger download
    const link = document.createElement("a");
    link.download = word ? `skribbl-${word.replace(/\s+/g, "_")}.png` : "skribbl-drawing.png";
    link.href = out.toDataURL("image/png");
    link.click();
  }, []);

  return { canvasRef, previewCanvasRef, settings, setSettings, clearCanvas, undoStroke, redoStroke, canUndo, canRedo, saveDrawing };
}