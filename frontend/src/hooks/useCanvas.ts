import { useRef, useEffect, useCallback, useState } from "react";
import { getSocket } from "../utils/socket";
import type { DrawSettings, ShapeType } from "../types";

// ─── Pure shape renderer — no side effects, safe to call from anywhere ────────
export function drawShapeOnCtx(
  ctx: CanvasRenderingContext2D,
  shapeType: ShapeType,
  x1: number, y1: number, x2: number, y2: number,
  color: string, size: number
): void {
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = color;
  ctx.lineWidth   = size;
  ctx.lineCap     = "round";
  ctx.lineJoin    = "round";
  ctx.beginPath();
  if (shapeType === "line") {
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  } else if (shapeType === "rect") {
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
  } else if (shapeType === "circle") {
    const rx = Math.abs(x2 - x1) / 2;
    const ry = Math.abs(y2 - y1) / 2;
    ctx.ellipse((x1+x2)/2, (y1+y2)/2, Math.max(rx, 1), Math.max(ry, 1), 0, 0, Math.PI*2);
    ctx.stroke();
  }
  ctx.restore();
}

const isShapeTool = (t: string): t is ShapeType =>
  t === "line" || t === "rect" || t === "circle";

// ─── Flood fill — self-contained, works on any canvas element ────────────────
function doFloodFill(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, sx: number, sy: number, fillColor: string): void {
  // Ensure white background (transparent pixels → white)
  const sample = ctx.getImageData(0, 0, 1, 1).data;
  if (sample[3] === 0) {
    ctx.save(); ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.restore();
  }

  const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = id.data, w = canvas.width, h = canvas.height;
  const x0 = Math.max(0, Math.min(Math.round(sx), w-1));
  const y0 = Math.max(0, Math.min(Math.round(sy), h-1));
  const ti  = (y0*w+x0)*4;
  const tr=d[ti], tg=d[ti+1], tb=d[ti+2], ta=d[ti+3];

  const tmp = document.createElement("canvas"); tmp.width=tmp.height=1;
  const tc  = tmp.getContext("2d")!;
  tc.fillStyle = fillColor; tc.fillRect(0,0,1,1);
  const fd = tc.getImageData(0,0,1,1).data;
  const fr=fd[0], fg=fd[1], fb=fd[2], fa=fd[3];
  if (tr===fr && tg===fg && tb===fb && ta===fa) return;

  const T = 30;
  const match = (i: number) =>
    Math.abs(d[i]-tr)<=T && Math.abs(d[i+1]-tg)<=T &&
    Math.abs(d[i+2]-tb)<=T && Math.abs(d[i+3]-ta)<=T;

  const stack: number[] = [x0+y0*w];
  const vis = new Uint8Array(w*h);
  while (stack.length) {
    const p = stack.pop()!; if (vis[p]) continue; vis[p]=1;
    const i = p*4; if (!match(i)) continue;
    d[i]=fr; d[i+1]=fg; d[i+2]=fb; d[i+3]=fa;
    const x=p%w, y=Math.floor(p/w);
    if(x>0)stack.push(p-1); if(x<w-1)stack.push(p+1);
    if(y>0)stack.push(p-w); if(y<h-1)stack.push(p+w);
  }
  ctx.putImageData(id, 0, 0);
}

// ─── Replay strokes onto a canvas from scratch ────────────────────────────────
function doReplayStrokes(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, strokes: any[]): void {
  // Clear to white
  ctx.save(); ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.restore();

  let cur: { x:number; y:number; color:string; size:number; tool:string } | null = null;
  ctx.lineCap = "round"; ctx.lineJoin = "round";

  for (const s of strokes) {
    if (s.type === "draw_start") {
      cur = { x:s.x??0, y:s.y??0, color:s.color??"#000000", size:s.size??6, tool:s.tool??"pen" };
    } else if (s.type === "draw_move" && cur) {
      const nx=s.x??0, ny=s.y??0;
      ctx.globalCompositeOperation = cur.tool==="eraser" ? "destination-out" : "source-over";
      ctx.strokeStyle = cur.tool==="eraser" ? "rgba(0,0,0,1)" : cur.color;
      ctx.lineWidth   = cur.size;
      ctx.beginPath(); ctx.moveTo(cur.x, cur.y); ctx.lineTo(nx, ny); ctx.stroke();
      cur = { x:nx, y:ny, color:cur.color, size:cur.size, tool:cur.tool };
    } else if (s.type === "draw_end") {
      cur = null;
    } else if (s.type === "canvas_fill") {
      doFloodFill(canvas, ctx, s.x, s.y, s.color);
    } else if (s.type === "draw_shape") {
      drawShapeOnCtx(ctx, s.shapeType, s.x1, s.y1, s.x2, s.y2, s.color, s.size);
    }
  }
}

// ─── Main hook ────────────────────────────────────────────────────────────────
export function useCanvas({ isDrawer }: { isDrawer: boolean }) {
  const canvasRef        = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef     = useRef(false);
  const lastPointRef     = useRef<{ x:number; y:number } | null>(null);
  const shapeStartRef    = useRef<{ x:number; y:number } | null>(null);
  const pendingMovesRef  = useRef<{ x:number; y:number }[]>([]);
  const flushTimerRef    = useRef<number | null>(null);
  // Track remote drawer's current stroke (for non-drawers)
  const remoteStrokeRef  = useRef<{ x:number; y:number; color:string; size:number; tool:string } | null>(null);

  // Settings ref — read inside event handlers without re-registering
  const settingsRef = useRef<DrawSettings>({ color:"#000000", size:6, tool:"pen" });
  const [settings, setSettings] = useState<DrawSettings>(settingsRef.current);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  // isDrawer ref — remote handlers read this without needing to be re-registered
  const isDrawerRef = useRef(isDrawer);
  useEffect(() => { isDrawerRef.current = isDrawer; }, [isDrawer]);

  // Undo/redo counters updated immediately — no server round-trip for button state
  const undoCountRef = useRef(0);
  const redoCountRef = useRef(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const syncButtons = useCallback(():void=>{
    setCanUndo(undoCountRef.current > 0);
    setCanRedo(redoCountRef.current > 0);
  }, []);
  const resetCounts = useCallback(():void=>{
    undoCountRef.current=0; redoCountRef.current=0; syncButtons();
  }, [syncButtons]);

  // ── Canvas helpers ───────────────────────────────────────────────────────────
  const getCtx = useCallback(():CanvasRenderingContext2D|null=>{
    const c=canvasRef.current; if(!c) return null;
    const ctx=c.getContext("2d"); if(!ctx) return null;
    ctx.lineCap="round"; ctx.lineJoin="round"; return ctx;
  }, []);

  const getPreviewCtx = useCallback(():CanvasRenderingContext2D|null=>{
    const c=previewCanvasRef.current; if(!c) return null;
    return c.getContext("2d");
  }, []);

  const clearPreview = useCallback(():void=>{
    const pctx=getPreviewCtx(); const pc=previewCanvasRef.current;
    if(pctx&&pc) pctx.clearRect(0,0,pc.width,pc.height);
  }, [getPreviewCtx]);

  const fillWhite = useCallback(():void=>{
    const ctx=getCtx(); const c=canvasRef.current; if(!ctx||!c) return;
    ctx.save(); ctx.globalCompositeOperation="source-over";
    ctx.fillStyle="#ffffff"; ctx.fillRect(0,0,c.width,c.height); ctx.restore();
  }, [getCtx]);

  // ── Canvas coordinate helper — always uses main canvas bounding rect ─────────
  const getPoint = useCallback((e:MouseEvent|Touch):{x:number;y:number}=>{
    const c=canvasRef.current!; const r=c.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (c.width  / r.width),
      y: (e.clientY - r.top)  * (c.height / r.height),
    };
  }, []);

  const flushMoves = useCallback(():void=>{
    const moves=pendingMovesRef.current; if(!moves.length) return;
    pendingMovesRef.current=[];
    moves.forEach(pt=>getSocket().emit("draw_move",{x:pt.x,y:pt.y}));
  }, []);

  // ── Drawer input events — overlay canvas is sole event surface ───────────────
  useEffect(()=>{
    if(!isDrawer) return;
    const eventCanvas=previewCanvasRef.current;
    const mainCanvas =canvasRef.current;
    if(!eventCanvas||!mainCanvas) return;
    eventCanvas.style.pointerEvents="auto";

    const onStart=(e:MouseEvent|TouchEvent):void=>{
      e.preventDefault();
      const s=settingsRef.current;
      const pt=e instanceof MouseEvent ? getPoint(e) : getPoint((e as TouchEvent).touches[0]);

      if(s.tool==="eyedropper"){
        const ctx=getCtx(); const c=canvasRef.current;
        if(ctx&&c){
          const px=Math.max(0,Math.min(Math.round(pt.x),c.width-1));
          const py=Math.max(0,Math.min(Math.round(pt.y),c.height-1));
          const [r,g,b]=ctx.getImageData(px,py,1,1).data;
          const hex="#"+[r,g,b].map(v=>v.toString(16).padStart(2,"0")).join("");
          setSettings(prev=>({...prev,color:hex,tool:"pen"}));
        }
        return;
      }

      if(s.tool==="fill"){
        const canvas=canvasRef.current; const ctx=getCtx();
        if(canvas&&ctx){ doFloodFill(canvas,ctx,pt.x,pt.y,s.color); }
        undoCountRef.current++; redoCountRef.current=0; syncButtons();
        getSocket().emit("canvas_fill",{x:pt.x,y:pt.y,color:s.color});
        return;
      }

      if(isShapeTool(s.tool)){
        shapeStartRef.current=pt; isDrawingRef.current=true; return;
      }

      // Pen / eraser
      const canvas=canvasRef.current; const ctx=getCtx();
      if(canvas&&ctx){
        const sample=ctx.getImageData(0,0,1,1).data;
        if(sample[3]===0){ ctx.save(); ctx.globalCompositeOperation="source-over"; ctx.fillStyle="#ffffff"; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.restore(); }
      }
      isDrawingRef.current=true; lastPointRef.current=pt;
      getSocket().emit("draw_start",{x:pt.x,y:pt.y,color:s.color,size:s.size,tool:s.tool});
    };

    const onMove=(e:MouseEvent|TouchEvent):void=>{
      e.preventDefault();
      if(!isDrawingRef.current) return;
      const s=settingsRef.current;
      const pt=e instanceof MouseEvent ? getPoint(e) : getPoint((e as TouchEvent).touches[0]);

      if(isShapeTool(s.tool)&&shapeStartRef.current){
        const pctx=getPreviewCtx(); const pc=previewCanvasRef.current;
        if(pctx&&pc){
          pctx.clearRect(0,0,pc.width,pc.height);
          drawShapeOnCtx(pctx,s.tool as ShapeType,
            shapeStartRef.current.x,shapeStartRef.current.y,pt.x,pt.y,s.color,s.size);
        }
        return;
      }

      if(!lastPointRef.current||s.tool==="fill") return;
      const ctx=getCtx(); if(!ctx) return;
      ctx.globalCompositeOperation=s.tool==="eraser"?"destination-out":"source-over";
      ctx.strokeStyle=s.tool==="eraser"?"rgba(0,0,0,1)":s.color;
      ctx.lineWidth=s.size;
      ctx.beginPath(); ctx.moveTo(lastPointRef.current.x,lastPointRef.current.y);
      ctx.lineTo(pt.x,pt.y); ctx.stroke();
      lastPointRef.current=pt;
      pendingMovesRef.current.push(pt);
      if(!flushTimerRef.current){
        flushTimerRef.current=window.setTimeout(()=>{ flushMoves(); flushTimerRef.current=null; },16);
      }
    };

    const onEnd=(e:MouseEvent|TouchEvent):void=>{
      e.preventDefault();
      if(!isDrawingRef.current) return;
      const s=settingsRef.current;
      const pt=e instanceof MouseEvent ? getPoint(e) : getPoint((e as TouchEvent).touches[0]);

      if(isShapeTool(s.tool)&&shapeStartRef.current){
        clearPreview();
        const ctx=getCtx();
        if(ctx) drawShapeOnCtx(ctx,s.tool as ShapeType,
          shapeStartRef.current.x,shapeStartRef.current.y,pt.x,pt.y,s.color,s.size);
        getSocket().emit("draw_shape",{
          shapeType:s.tool,
          x1:shapeStartRef.current.x,y1:shapeStartRef.current.y,
          x2:pt.x,y2:pt.y,color:s.color,size:s.size,
        });
        shapeStartRef.current=null; isDrawingRef.current=false;
        undoCountRef.current++; redoCountRef.current=0; syncButtons();
        return;
      }

      isDrawingRef.current=false; lastPointRef.current=null;
      if(flushTimerRef.current){ clearTimeout(flushTimerRef.current); flushTimerRef.current=null; flushMoves(); }
      getSocket().emit("draw_end",{});
      undoCountRef.current++; redoCountRef.current=0; syncButtons();
    };

    eventCanvas.addEventListener("mousedown",  onStart);
    eventCanvas.addEventListener("mousemove",  onMove);
    eventCanvas.addEventListener("mouseup",    onEnd);
    eventCanvas.addEventListener("mouseleave", onEnd);
    eventCanvas.addEventListener("touchstart", onStart,{passive:false});
    eventCanvas.addEventListener("touchmove",  onMove, {passive:false});
    eventCanvas.addEventListener("touchend",   onEnd,  {passive:false});
    return ()=>{
      eventCanvas.removeEventListener("mousedown",  onStart);
      eventCanvas.removeEventListener("mousemove",  onMove);
      eventCanvas.removeEventListener("mouseup",    onEnd);
      eventCanvas.removeEventListener("mouseleave", onEnd);
      eventCanvas.removeEventListener("touchstart", onStart);
      eventCanvas.removeEventListener("touchmove",  onMove);
      eventCanvas.removeEventListener("touchend",   onEnd);
    };
  },[isDrawer,getPoint,getCtx,getPreviewCtx,clearPreview,flushMoves,syncButtons]);

  // ── Remote events — registers ONCE, uses refs for current values ─────────────
  // KEY: all drawing functions are MODULE-LEVEL (doFloodFill, doReplayStrokes,
  // drawShapeOnCtx) so they're never stale. Canvas elements accessed via refs.
  useEffect(()=>{
    const socket=getSocket();

    const onDrawData=(data:{type:string;x?:number;y?:number;color?:string;size?:number;tool?:string}):void=>{
      // Drawer renders locally — skip remote echo
      if(isDrawerRef.current) return;
      const canvas=canvasRef.current; const ctx=canvas?.getContext("2d");
      if(!canvas||!ctx){ ctx?.restore(); return; }
      ctx.lineCap="round"; ctx.lineJoin="round";

      if(data.type==="draw_start"){
        // Ensure white background on first stroke
        const s=ctx.getImageData(0,0,1,1).data;
        if(s[3]===0){ ctx.save(); ctx.globalCompositeOperation="source-over"; ctx.fillStyle="#ffffff"; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.restore(); }
        remoteStrokeRef.current={x:data.x??0,y:data.y??0,color:data.color??"#000000",size:data.size??6,tool:data.tool??"pen"};
      } else if(data.type==="draw_move"){
        const cur=remoteStrokeRef.current;
        if(!cur){
          // Missed draw_start — request full canvas sync
          getSocket().emit("get_room_state",{},(res:any)=>{
            if(res?.strokes&&canvas){
              const ctx2=canvas.getContext("2d");
              if(ctx2) doReplayStrokes(canvas,ctx2,res.strokes);
            }
          });
          return;
        }
        const nx=data.x??0, ny=data.y??0;
        ctx.globalCompositeOperation=cur.tool==="eraser"?"destination-out":"source-over";
        ctx.strokeStyle=cur.tool==="eraser"?"rgba(0,0,0,1)":cur.color;
        ctx.lineWidth=cur.size;
        ctx.beginPath(); ctx.moveTo(cur.x,cur.y); ctx.lineTo(nx,ny); ctx.stroke();
        remoteStrokeRef.current={x:nx,y:ny,color:cur.color,size:cur.size,tool:cur.tool};
      } else if(data.type==="draw_end"){
        remoteStrokeRef.current=null;
      }
    };

    // Fill: received by non-drawers (server uses broadcastExcept for drawer)
    const onFill=({x,y,color}:{x:number;y:number;color:string}):void=>{
      if(isDrawerRef.current) return; // drawer applied locally
      const canvas=canvasRef.current; const ctx=canvas?.getContext("2d");
      if(canvas&&ctx) doFloodFill(canvas,ctx,x,y,color);
    };

    // Shape: received by non-drawers (server uses broadcastExcept for drawer)
    const onShape=(data:{shapeType:ShapeType;x1:number;y1:number;x2:number;y2:number;color:string;size:number}):void=>{
      if(isDrawerRef.current) return; // drawer drew it locally on mouse-up
      const canvas=canvasRef.current; const ctx=canvas?.getContext("2d");
      if(ctx) drawShapeOnCtx(ctx,data.shapeType,data.x1,data.y1,data.x2,data.y2,data.color,data.size);
    };

    // Canvas cleared: everyone gets this
    const onCanvasCleared=():void=>{
      const canvas=canvasRef.current; const ctx=canvas?.getContext("2d");
      if(canvas&&ctx){
        ctx.save(); ctx.globalCompositeOperation="source-over";
        ctx.fillStyle="#ffffff"; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.restore();
      }
      resetCounts();
    };

    // Undo/redo: ALL clients replay from server's stroke history
    const onDrawUndone=({strokes,canUndo:cu,canRedo:cr}:{strokes:any[];canUndo:boolean;canRedo:boolean}):void=>{
      const canvas=canvasRef.current; const ctx=canvas?.getContext("2d");
      if(canvas&&ctx) doReplayStrokes(canvas,ctx,strokes);
      if(!cu) undoCountRef.current=0;
      if(!cr) redoCountRef.current=0;
      syncButtons();
    };

    const onDrawRedone=({strokes,canUndo:cu,canRedo:cr}:{strokes:any[];canUndo:boolean;canRedo:boolean}):void=>{
      const canvas=canvasRef.current; const ctx=canvas?.getContext("2d");
      if(canvas&&ctx) doReplayStrokes(canvas,ctx,strokes);
      if(!cu) undoCountRef.current=0;
      if(!cr) redoCountRef.current=0;
      syncButtons();
    };

    // Round start: clear canvas for everyone
    const onRoundStart=():void=>{
      const canvas=canvasRef.current; const ctx=canvas?.getContext("2d");
      if(canvas&&ctx){
        ctx.save(); ctx.globalCompositeOperation="source-over";
        ctx.fillStyle="#ffffff"; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.restore();
      }
      remoteStrokeRef.current=null; resetCounts();
    };

    socket.on("draw_data",      onDrawData);
    socket.on("canvas_fill",    onFill);
    socket.on("draw_shape",     onShape);
    socket.on("canvas_cleared", onCanvasCleared);
    socket.on("draw_undone",    onDrawUndone);
    socket.on("draw_redone",    onDrawRedone);
    socket.on("round_start",    onRoundStart);

    return ()=>{
      socket.off("draw_data",      onDrawData);
      socket.off("canvas_fill",    onFill);
      socket.off("draw_shape",     onShape);
      socket.off("canvas_cleared", onCanvasCleared);
      socket.off("draw_undone",    onDrawUndone);
      socket.off("draw_redone",    onDrawRedone);
      socket.off("round_start",    onRoundStart);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]); // Mounts once — all canvas access via refs, all helpers are module-level

  // ── Actions ───────────────────────────────────────────────────────────────────
  const clearCanvas=useCallback(():void=>{
    fillWhite(); clearPreview(); resetCounts(); getSocket().emit("canvas_clear");
  },[fillWhite,clearPreview,resetCounts]);

  const undoStroke=useCallback(():void=>{
    if(undoCountRef.current===0) return;
    undoCountRef.current--; redoCountRef.current++; syncButtons();
    getSocket().emit("draw_undo");
  },[syncButtons]);

  const redoStroke=useCallback(():void=>{
    if(redoCountRef.current===0) return;
    redoCountRef.current--; undoCountRef.current++; syncButtons();
    getSocket().emit("draw_redo");
  },[syncButtons]);

  const saveDrawing=useCallback((word?:string):void=>{
    const src=canvasRef.current; if(!src) return;
    const out=document.createElement("canvas");
    const lh=word?36:0; out.width=src.width; out.height=src.height+lh;
    const ctx=out.getContext("2d")!;
    ctx.fillStyle="#ffffff"; ctx.fillRect(0,0,out.width,out.height);
    ctx.drawImage(src,0,0);
    if(word){
      ctx.fillStyle="#1a1a2e"; ctx.fillRect(0,src.height,out.width,lh);
      ctx.fillStyle="#e94560"; ctx.font="bold 18px 'Segoe UI',sans-serif";
      ctx.textAlign="center"; ctx.textBaseline="middle";
      ctx.fillText(`\u270F\uFE0F "${word}" \u2014 Skribbl Clone`,out.width/2,src.height+lh/2);
    }
    const a=document.createElement("a");
    a.download=word?`skribbl-${word.replace(/\s+/g,"_")}.png`:"skribbl-drawing.png";
    a.href=out.toDataURL("image/png"); a.click();
  },[]);

  return { canvasRef, previewCanvasRef, settings, setSettings, clearCanvas, undoStroke, redoStroke, canUndo, canRedo, saveDrawing };
}