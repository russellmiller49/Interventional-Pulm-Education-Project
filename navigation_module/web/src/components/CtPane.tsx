import { useEffect, useMemo, useRef, useState, type DragEvent, type PointerEvent as ReactPointerEvent } from "react";
import {makeSlicePlane,patientToSlicePixel,slicePixelToPatient,orientationLabel,type SlicePlane} from '@bronchoscopy-core/ct';
import {makeFrame,transport,times,unit,vector} from '@bronchoscopy-core/frame';
import {rasToPatient} from '@bronchoscopy-core/devices';
import {useCtSlice} from '../ctWorker';
import type { AirwayEdge, CtMetadata, LoadedNoduleAsset, Vec3 } from "../types";
import {
  add,
  clamp,
  dot,
  type CtViewMode,
  normalize,
  type PlaneKind,
  indexToRas,
  projectRasToPlane,
  rasToIndex,
  scale,
  subtract
} from "../geometry";
import { getMessages, type Messages } from "../i18n";

interface HighlightEdge {
  edge: AirwayEdge;
  color: string;
  width: number;
}

export interface CandidateOverlay {
  edge: AirwayEdge;
  label: string;
  score: number;
  color: string;
}

export interface AirwayFrame {
  origin: Vec3;
  tangent: Vec3;
  normal: Vec3;
  binormal: Vec3;
}

export interface TargetSurveyOverlay {
  label: string;
  ras: Vec3;
  radiusMm?: number | null;
  active?: boolean;
}

interface PanOffset {
  x: number;
  y: number;
}

interface PanDragState {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startPan: PanOffset;
}

interface CtPaneProps {
  plane: PlaneKind;
  viewMode: CtViewMode;
  ct: CtMetadata;
  volume: Uint8Array;
  focusRas: Vec3;
  noduleRas: Vec3 | null;
  noduleAsset: LoadedNoduleAsset | null;
  routePaths: Vec3[][];
  scopeTracePath: Vec3[];
  airwayFrame: AirwayFrame;
  sliceOffset: number;
  sliceOffsetMin: number;
  sliceOffsetMax: number;
  airwaySliceDistanceScale?: number;
  showRoute: boolean;
  showScopeTrace: boolean;
  highlightEdges: HighlightEdge[];
  candidateOverlays: CandidateOverlay[];
  targetSurveyOverlays?: TargetSurveyOverlay[];
  zoom: number;
  onSliceScroll: (plane: PlaneKind, delta: number) => void;
  onSliceOffsetChange: (plane: PlaneKind, value: number) => void;
  onZoomChange: (delta: number) => void;
  onTargetDrop?: (ras: Vec3) => void;
  messages?: Messages["ctPane"];
}

const ZERO_PAN: PanOffset = { x: 0, y: 0 };
const MIN_PAN_ZOOM = 1.01;

export function CtPane({
  plane,
  viewMode,
  ct,
  volume,
  focusRas,
  noduleRas,
  noduleAsset,
  routePaths,
  scopeTracePath,
  airwayFrame,
  sliceOffset,
  sliceOffsetMin,
  sliceOffsetMax,
  airwaySliceDistanceScale = 2,
  showRoute,
  showScopeTrace,
  highlightEdges,
  candidateOverlays,
  targetSurveyOverlays = [],
  zoom,
  onSliceScroll,
  onSliceOffsetChange,
  onZoomChange,
  onTargetDrop,
  messages = getMessages("en").ctPane
}: CtPaneProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const canvasWrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawInfoRef = useRef<DrawInfo | null>(null);
  const panDragRef = useRef<PanDragState | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const [pan, setPan] = useState<PanOffset>(ZERO_PAN);
  const [panning, setPanning] = useState(false);
  const [fittedSize,setFittedSize]=useState({width:1,height:1});
  const canPan = zoom > MIN_PAN_ZOOM;
  const [windowHu,setWindowHu]=useState<[number,number]>(ct.windowHu);
  const [follow,setFollow]=useState(true),[heldFocus,setHeldFocus]=useState<Vec3>(focusRas),[heldFrame,setHeldFrame]=useState(airwayFrame);
  const activeFocus=follow?focusRas:heldFocus,activeFrame=follow?airwayFrame:heldFrame;
  const prepared=useMemo(()=>prepareSlice(plane,viewMode,ct,activeFocus,activeFrame,sliceOffset,airwaySliceDistanceScale),[plane,viewMode,ct,activeFocus[0],activeFocus[1],activeFocus[2],activeFrame,sliceOffset,airwaySliceDistanceScale]);
  const tip=useMemo(()=>rasToPatient(focusRas),[focusRas[0],focusRas[1],focusRas[2]]);
  const rendered=useCtSlice(ct,volume,prepared.slicePlane!,tip,windowHu,noduleAsset,noduleRas);


  useEffect(() => {
    const section = sectionRef.current;
    if (!section) {
      return;
    }
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (event.shiftKey || event.metaKey || event.ctrlKey) {
        onZoomChange(event.deltaY > 0 ? -0.15 : 0.15);
      } else {
        onSliceScroll(plane, event.deltaY > 0 ? 1 : -1);
      }
    };
    section.addEventListener("wheel", onWheel, { passive: false });
    return () => section.removeEventListener("wheel", onWheel);
  }, [plane, onSliceScroll, onZoomChange]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    if(!rendered)return;
    const drawInfo={...prepared,slicePlane:rendered.plane,width:rendered.plane.width,height:rendered.plane.height};
    canvas.width=drawInfo.width;canvas.height=drawInfo.height;
    canvas.dataset.slicePlaneLps=JSON.stringify(rendered.plane);
    const imageContext=canvas.getContext('2d');
    imageContext?.putImageData(new ImageData(new Uint8ClampedArray(rendered.rgba),drawInfo.width,drawInfo.height),0,0);
    drawInfoRef.current = drawInfo;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    const marker=patientToSlicePixel(rendered.plane,rasToPatient(focusRas));
    ctx.save();ctx.strokeStyle='#65e7f1';ctx.globalAlpha=Math.abs(marker.offPlaneMm)<2?0.8:0.3;ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(marker.x-8,marker.y);ctx.lineTo(marker.x+8,marker.y);ctx.moveTo(marker.x,marker.y-8);ctx.lineTo(marker.x,marker.y+8);ctx.stroke();ctx.restore();
    ctx.fillStyle='#d4e4ed';ctx.font='12px system-ui';ctx.textAlign='center';
    ctx.fillText(orientationLabel(times(rendered.plane.right,-1)),12,drawInfo.height/2);
    ctx.fillText(orientationLabel(rendered.plane.right),drawInfo.width-12,drawInfo.height/2);
    ctx.fillText(orientationLabel(times(rendered.plane.down,-1)),drawInfo.width/2,14);
    ctx.fillText(orientationLabel(rendered.plane.down),drawInfo.width/2,drawInfo.height-8);ctx.textAlign='start';
    if (showRoute) {
      routePaths.forEach((routePoints) => {
        drawPolyline(ctx, drawInfo, routePoints, "#4bd7ff", 1.8, 0.72);
      });
    }
    highlightEdges.forEach(({ edge, color, width }) => {
      drawPolyline(ctx, drawInfo, edge.pointsRas, color, width, 0.95);
    });
    if (showScopeTrace) {
      drawPolyline(ctx, drawInfo, scopeTracePath, "#29e47c", 2.6, 0.95);
    }
    candidateOverlays.forEach(({ edge, label, score, color }) => {
      drawPolyline(ctx, drawInfo, edge.pointsRas, color, 1.7, 0.72);
      drawEdgeLabel(ctx, drawInfo, edge, `${label} ${score.toFixed(2)}`, color);
    });
    if (targetSurveyOverlays.length) {
      drawTargetSurveyOverlays(ctx, drawInfo, targetSurveyOverlays);
    }
    if (!noduleAsset && noduleRas) {
      drawMarker(ctx, drawInfo, noduleRas, "#ff5b68", 6, messages.targetMarker);
    }
  }, [
    plane,
    viewMode,
    ct,
    volume,
    focusRas,
    noduleRas,
    noduleAsset,
    routePaths,
    scopeTracePath,
    airwayFrame,
    sliceOffset,
    airwaySliceDistanceScale,
    showRoute,
    showScopeTrace,
    highlightEdges,
    candidateOverlays,
    targetSurveyOverlays,
    messages,prepared,rendered
  ]);

  useEffect(() => {
    setPan((current) => clampPanOffset(current, canvasWrapRef.current, zoom));
    if (!canPan) {
      panDragRef.current = null;
      setPanning(false);
    }
  }, [canPan, zoom]);

  useEffect(() => {
    const wrap = canvasWrapRef.current;
    if (!wrap || typeof ResizeObserver === "undefined") {
      return;
    }
    const resize = () => {
      setPan((current) => clampPanOffset(current, wrap, zoom));
      const width=rendered?.plane.width??384,height=rendered?.plane.height??384;
      const factor=Math.min(wrap.clientWidth/width,wrap.clientHeight/height);
      setFittedSize({width:width*factor,height:height*factor});
    };
    const observer = new ResizeObserver(resize);
    observer.observe(wrap);
    resize();
    return () => observer.disconnect();
  }, [zoom,rendered?.plane.width,rendered?.plane.height]);

  const title = viewMode === "standard" ? messages.standardTitles[plane] : messages.airwayTitles[plane];
  const beginPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.target as Element | null;
    if (!canPan || event.button !== 0 || target?.closest(".slice-scrubber,.ct-knob-controls")) {
      return;
    }
    event.preventDefault();
    panDragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPan: clampPanOffset(pan, canvasWrapRef.current, zoom)
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setPanning(true);
  };
  const movePan = (event: ReactPointerEvent<HTMLDivElement>) => {
    const dragState = panDragRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }
    event.preventDefault();
    setPan(
      clampPanOffset(
        {
          x: dragState.startPan.x + event.clientX - dragState.startClientX,
          y: dragState.startPan.y + event.clientY - dragState.startClientY
        },
        canvasWrapRef.current,
        zoom
      )
    );
  };
  const endPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    const dragState = panDragRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }
    panDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setPanning(false);
  };
  const resetPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.target as Element | null;
    if (!canPan || target?.closest(".slice-scrubber,.ct-knob-controls")) {
      return;
    }
    setPan(ZERO_PAN);
  };
  const handleDragOver = (event: DragEvent<HTMLElement>) => {
    if (!onTargetDrop) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropActive(true);
  };
  const handleDragLeave = (event: DragEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setDropActive(false);
    }
  };
  const handleDrop = (event: DragEvent<HTMLElement>) => {
    if (!onTargetDrop) {
      return;
    }
    event.preventDefault();
    setDropActive(false);
    const ras = droppedCanvasPointToRas(event, canvasRef.current, drawInfoRef.current);
    if (ras) {
      onTargetDrop(ras);
    }
  };

  return (
    <section
      ref={sectionRef}
      className={`ct-pane ${dropActive ? "ct-pane-drop-active" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="pane-chrome">
        <span>{title}</span>
        <span className="ct-source-level">{rendered?.nativeRegions?'Source CT':rendered?.signed?'HU CT':'Preview'}</span>
        <span>{viewMode === "standard" ? standardSliceLabel(rendered?.plane??prepared.slicePlane!) : airwaySliceLabel(plane, sliceOffset*airwaySliceDistanceScale, messages)}</span>
      </div>
      <div
        ref={canvasWrapRef}
        className={`ct-canvas-wrap ${canPan ? "ct-canvas-wrap-pannable" : ""} ${panning ? "ct-canvas-wrap-panning" : ""}`}
        onPointerDown={beginPan}
        onPointerMove={movePan}
        onPointerUp={endPan}
        onPointerCancel={endPan}
        onDoubleClick={resetPan}
      >
        <div className="ct-knob-controls">
          <label><input type="checkbox" checked={follow} onChange={e=>{setFollow(e.target.checked);if(!e.target.checked){setHeldFocus(focusRas);setHeldFrame(airwayFrame);}}}/>Follow scope</label>
          <label>WL<input aria-label={`${title} window level`} type="number" step="20" value={Math.round((windowHu[0]+windowHu[1])/2)} onChange={e=>{const center=Number(e.target.value),width=windowHu[1]-windowHu[0];setWindowHu([center-width/2,center+width/2]);}}/></label>
          <label>WW<input aria-label={`${title} window width`} type="number" min="40" max="4000" step="50" value={Math.round(windowHu[1]-windowHu[0])} onChange={e=>{const center=(windowHu[0]+windowHu[1])/2,width=Math.max(40,Number(e.target.value));setWindowHu([center-width/2,center+width/2]);}}/></label>
        </div>
        <canvas ref={canvasRef} className="ct-canvas" style={{width:fittedSize.width,height:fittedSize.height,margin:'auto', transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }} />
        <label className="slice-scrubber">
          <input
            type="range"
            min={sliceOffsetMin}
            max={sliceOffsetMax}
            step={1}
            value={sliceOffset}
            aria-label={messages.slicePositionAria(title)}
            onChange={(event) => onSliceOffsetChange(plane, Number(event.currentTarget.value))}
          />
        </label>
      </div>
    </section>
  );
}

function clampPanOffset(offset: PanOffset, wrap: HTMLElement | null, zoom: number): PanOffset {
  if (!wrap || zoom <= MIN_PAN_ZOOM) {
    return ZERO_PAN;
  }
  const maxX = Math.max(0, (wrap.clientWidth * (zoom - 1)) / 2);
  const maxY = Math.max(0, (wrap.clientHeight * (zoom - 1)) / 2);
  return {
    x: clamp(offset.x, -maxX, maxX),
    y: clamp(offset.y, -maxY, maxY)
  };
}

type DrawInfo = {slicePlane?:SlicePlane} & (
  | {
      mode: "standard";
      plane: PlaneKind;
      ct: CtMetadata;
      sliceIndex: number;
      width: number;
      height: number;
    }
  | {
      mode: "airway";
      plane: PlaneKind;
      origin: Vec3;
      xAxis: Vec3;
      yAxis: Vec3;
      normal: Vec3;
      fovX: number;
      fovY: number;
      width: number;
      height: number;
    });

function prepareSlice(plane:PlaneKind,mode:CtViewMode,ct:CtMetadata,focus:Vec3,frame:AirwayFrame,offset:number,distanceScale:number):DrawInfo {
  if(mode==='standard'){
    const selected=rasToIndex(focus,ct),sliceIndex=Math.round(plane==='axial'?selected.k:plane==='coronal'?selected.j:selected.i);
    const spacing=plane==='axial'?ct.spacingXyzMm[2]:plane==='coronal'?ct.spacingXyzMm[1]:ct.spacingXyzMm[0];
    const slicePlane=makeSlicePlane(ct,plane,makeFrame(rasToPatient(focus),[0,0,-1]),1,[0,0],offset*spacing*(plane==='sagittal'?-1:1),384);
    return {mode:'standard',plane,ct,sliceIndex:sliceIndex+offset,width:slicePlane.width,height:slicePlane.height,slicePlane};
  }
  const axes=airwayPlaneAxes(plane,frame),origin=add(frame.origin,scale(axes.normal,offset*distanceScale));
  const fovX=plane==='axial'?42:132,fovY=plane==='axial'?42:96;
  const right=rasToPatient(axes.xAxis),down=times(rasToPatient(axes.yAxis),-1);
  const slicePlane:SlicePlane={axis:plane,center:rasToPatient(origin),right,down,normal:unit(vector(right,down)),widthMm:fovX,heightMm:fovY,width:384,height:Math.round(384*fovY/fovX)};
  return {mode:'airway',plane,origin,...axes,fovX,fovY,width:slicePlane.width,height:slicePlane.height,slicePlane};
}

function airwayPlaneAxes(plane: PlaneKind, frame: AirwayFrame) {
  if (plane === "axial") {
    return {
      xAxis: frame.normal,
      yAxis: frame.binormal,
      normal: frame.tangent
    };
  }
  if (plane === "coronal") {
    return {
      xAxis: frame.tangent,
      yAxis: frame.normal,
      normal: frame.binormal
    };
  }
  return {
    xAxis: frame.tangent,
    yAxis: frame.binormal,
    normal: frame.normal
  };
}

function drawPolyline(ctx: CanvasRenderingContext2D, info: DrawInfo, points: Vec3[], color: string, width: number, alpha: number) {
  if (points.length < 2) {
    return;
  }
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.globalAlpha = alpha;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  let started = false;
  points.forEach((point) => {
    const projected = projectPoint(point, info);
    if (!projected.visible) {
      started = false;
      return;
    }
    if (!started) {
      ctx.moveTo(projected.x, projected.y);
      started = true;
    } else {
      ctx.lineTo(projected.x, projected.y);
    }
  });
  ctx.stroke();
  ctx.restore();
}

function drawMarker(ctx: CanvasRenderingContext2D, info: DrawInfo, ras: Vec3, color: string, radius: number, label: string) {
  const projected = projectPoint(ras, info);
  if (!projected.inFrame || !projected.visible) {
    return;
  }
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.fillStyle = color;
  ctx.strokeStyle = "#050505";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(projected.x, projected.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.font = "11px Inter, system-ui, sans-serif";
  ctx.fillStyle = "#f5f7fb";
  ctx.shadowColor = "#000";
  ctx.shadowBlur = 4;
  ctx.fillText(label, projected.x + radius + 4, projected.y - radius - 2);
  ctx.restore();
}

function drawTargetSurveyOverlays(ctx: CanvasRenderingContext2D, info: DrawInfo, overlays: TargetSurveyOverlay[]) {
  if (info.mode !== "standard") {
    return;
  }
  ctx.save();
  ctx.font = "9px Inter, system-ui, sans-serif";
  ctx.textBaseline = "middle";
  overlays.forEach((overlay) => {
    const projected = projectPoint(overlay.ras, info);
    if (projected.x < -32 || projected.y < -32 || projected.x > info.width + 32 || projected.y > info.height + 32) {
      return;
    }
    const radius = targetSurveyRadiusPixels(info, overlay.radiusMm);
    ctx.globalAlpha = overlay.active ? 0.56 : 0.32;
    ctx.fillStyle = overlay.active ? "rgba(41, 228, 124, 0.24)" : "rgba(255, 91, 104, 0.22)";
    ctx.strokeStyle = overlay.active ? "#29e47c" : "#ff8290";
    ctx.lineWidth = overlay.active ? 1.8 : 1.1;
    ctx.beginPath();
    ctx.arc(projected.x, projected.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    const label = overlay.label;
    const labelWidth = Math.ceil(ctx.measureText(label).width) + 6;
    const labelHeight = 12;
    const labelX = clamp(projected.x + radius * 0.35, 2, info.width - labelWidth - 2);
    const labelY = clamp(projected.y - radius * 0.35 - labelHeight * 0.5, 2, info.height - labelHeight - 2);
    ctx.globalAlpha = overlay.active ? 0.96 : 0.78;
    ctx.fillStyle = overlay.active ? "#071710" : "#13080a";
    roundedRect(ctx, labelX, labelY, labelWidth, labelHeight, 3);
    ctx.fill();
    ctx.strokeStyle = overlay.active ? "#29e47c" : "#ff8290";
    ctx.lineWidth = 0.8;
    roundedRect(ctx, labelX + 0.5, labelY + 0.5, labelWidth - 1, labelHeight - 1, 3);
    ctx.stroke();
    ctx.fillStyle = overlay.active ? "#ceffdf" : "#ffd4d9";
    ctx.fillText(label, labelX + 3, labelY + labelHeight * 0.5 + 0.5);
  });
  ctx.restore();
}

function targetSurveyRadiusPixels(info: Extract<DrawInfo, { mode: "standard" }>, radiusMm: number | null | undefined) {
  if (!radiusMm || !Number.isFinite(radiusMm)) {
    return 5;
  }
  if(info.slicePlane)return clamp(radiusMm*info.width/info.slicePlane.widthMm,5,26);
  const spacing =
    info.plane === "axial"
      ? (info.ct.spacingXyzMm[0] + info.ct.spacingXyzMm[1]) * 0.5
      : info.plane === "coronal"
        ? (info.ct.spacingXyzMm[0] + info.ct.spacingXyzMm[2]) * 0.5
        : (info.ct.spacingXyzMm[1] + info.ct.spacingXyzMm[2]) * 0.5;
  return clamp(radiusMm / Math.max(spacing, 0.001), 5, 26);
}

function drawEdgeLabel(ctx: CanvasRenderingContext2D, info: DrawInfo, edge: AirwayEdge, label: string, color: string) {
  const point = pointAlong(edge.pointsRas, Math.min(32, Math.max(10, edge.lengthMm * 0.42)));
  const projected = projectPoint(point, info);
  if (!projected.inFrame || !projected.visible) {
    return;
  }
  ctx.save();
  ctx.font = "11px Inter, system-ui, sans-serif";
  const metrics = ctx.measureText(label);
  const width = Math.min(metrics.width + 12, 118);
  const height = 18;
  const x = Math.max(4, Math.min(projected.x + 7, info.width - width - 4));
  const y = Math.max(4, Math.min(projected.y - height - 5, info.height - height - 4));
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = "#081016";
  roundedRect(ctx, x, y, width, height, 5);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  roundedRect(ctx, x + 0.5, y + 0.5, width - 1, height - 1, 5);
  ctx.stroke();
  ctx.fillStyle = "#f4f7f8";
  ctx.fillText(label, x + 6, y + 12.5, width - 12);
  ctx.restore();
}

function pointAlong(points: Vec3[], distanceMm: number): Vec3 {
  if (!points.length) {
    return [0, 0, 0];
  }
  let travelled = 0;
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const next = points[i];
    const segment = Math.hypot(next[0] - prev[0], next[1] - prev[1], next[2] - prev[2]);
    if (travelled + segment >= distanceMm) {
      const t = (distanceMm - travelled) / Math.max(segment, 1e-6);
      return [prev[0] + (next[0] - prev[0]) * t, prev[1] + (next[1] - prev[1]) * t, prev[2] + (next[2] - prev[2]) * t];
    }
    travelled += segment;
  }
  return points[points.length - 1];
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function projectPoint(ras: Vec3, info: DrawInfo) {
  if(info.slicePlane){const p=patientToSlicePixel(info.slicePlane,rasToPatient(ras));return {...p,visible:Math.abs(p.offPlaneMm)<(info.mode==='standard'?4:7),inFrame:p.x>=0&&p.y>=0&&p.x<info.width&&p.y<info.height};}
  if (info.mode === "standard") {
    const projected = projectRasToPlane(ras, info.ct, info.plane);
    const depthDistance = Math.abs(projected.depth - info.sliceIndex);
    return {
      x: projected.x,
      y: projected.y,
      visible: depthDistance <= 4,
      inFrame: projected.x >= 0 && projected.y >= 0 && projected.x <= info.width && projected.y <= info.height
    };
  }
  const relative = subtract(ras, info.origin);
  const xMm = dot(relative, info.xAxis);
  const yMm = dot(relative, info.yAxis);
  const depthMm = dot(relative, info.normal);
  const x = (xMm / info.fovX + 0.5) * info.width;
  const y = (0.5 - yMm / info.fovY) * info.height;
  return {
    x,
    y,
    visible: Math.abs(depthMm) <= 7,
    inFrame: x >= 0 && y >= 0 && x <= info.width && y <= info.height
  };
}

function droppedCanvasPointToRas(event: DragEvent<HTMLElement>, canvas: HTMLCanvasElement | null, info: DrawInfo | null): Vec3 | null {
  if (!canvas || !info) {
    return null;
  }
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }
  const x = clamp(((event.clientX - rect.left) / rect.width) * canvas.width, 0, canvas.width - 1);
  const y = clamp(((event.clientY - rect.top) / rect.height) * canvas.height, 0, canvas.height - 1);
  return canvasPointToRas(info, x, y);
}

function canvasPointToRas(info: DrawInfo, x: number, y: number): Vec3 {
  if(info.slicePlane)return rasToPatient(slicePixelToPatient(info.slicePlane,x,y));
  if (info.mode === "airway") {
    const xMm = (x / Math.max(info.width - 1, 1) - 0.5) * info.fovX;
    const yMm = (0.5 - y / Math.max(info.height - 1, 1)) * info.fovY;
    return add(info.origin, add(scale(info.xAxis, xMm), scale(info.yAxis, yMm)));
  }

  const [sx, sy, sz] = info.ct.sizeXyz;
  const ix = clamp(x, 0, info.width - 1);
  const iy = clamp(y, 0, info.height - 1);
  if (info.plane === "axial") {
    return indexToRas({ i: clamp(ix, 0, sx - 1), j: clamp(iy, 0, sy - 1), k: info.sliceIndex }, info.ct);
  }
  if (info.plane === "coronal") {
    return indexToRas({ i: clamp(ix, 0, sx - 1), j: info.sliceIndex, k: clamp(sz - 1 - iy, 0, sz - 1) }, info.ct);
  }
  return indexToRas({ i: info.sliceIndex, j: clamp(ix, 0, sy - 1), k: clamp(sz - 1 - iy, 0, sz - 1) }, info.ct);
}

function standardSliceLabel(plane: SlicePlane) {
  const index=plane.axis==='axial'?2:plane.axis==='coronal'?1:0;
  return `${['L','P','S'][index]} ${plane.center[index].toFixed(1)} mm`;
}

function airwaySliceLabel(plane: PlaneKind, mm: number, messages: Messages["ctPane"]) {
  const suffix = mm === 0 ? "0 mm" : `${mm > 0 ? "+" : ""}${mm} mm`;
  if (plane === "axial") {
    return messages.airwayNormal(suffix);
  }
  return messages.airwayOffset(suffix);
}

export function buildAirwayFrame(routePoints: Vec3[], focusRas: Vec3): AirwayFrame {
  if (routePoints.length < 2) {
    return fallbackFrame(focusRas);
  }
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  routePoints.forEach((point, index) => {
    const d = Math.hypot(point[0] - focusRas[0], point[1] - focusRas[1], point[2] - focusRas[2]);
    if (d < bestDistance) {
      bestDistance = d;
      bestIndex = index;
    }
  });
  let frame=makeFrame(rasToPatient(routePoints[0]),rasToPatient(normalize(subtract(routePoints[1],routePoints[0]))));
  for(let i=1;i<=bestIndex;i++){
    const direction=normalize(subtract(routePoints[Math.min(routePoints.length-1,i+1)],routePoints[i-1]));
    frame=transport(frame,rasToPatient(routePoints[i]),rasToPatient(direction));
  }
  const tangent=rasToPatient(frame.forward),normal=rasToPatient(frame.up),binormal=rasToPatient(frame.right);
  return { origin: focusRas, tangent, normal, binormal };
}

function fallbackFrame(origin: Vec3): AirwayFrame {
  return {
    origin,
    tangent: [0, 0, -1],
    normal: [0, 1, 0],
    binormal: [1, 0, 0]
  };
}
