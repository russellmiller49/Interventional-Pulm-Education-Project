import { useEffect, useMemo, useRef, useState } from 'react';
import type { AcousticPose } from '@bronchoscopy-core/acoustic';

import { EUS_GROUP_NAMES } from './content';
import {
  DEFAULT_EUS_CONTROLS,
  EUS_DEPTH_RANGE_MM,
  paintEusOverlay,
  sectorGeometry,
  type EusAcousticFrame,
} from './eusAcoustic';
import { EusHoverName } from './EusHoverName';
import type { EusAcousticVolume, EusStructure } from './types';

const FRAME_SIZE = 512;
/** How long a tapped name stays up on a touch screen, where there is no hover to end it. */
const TOUCH_NAME_MS = 2600;

export type EusLabelColors = Array<[number, number, number] | null>;

interface EusSectorViewProps {
  volume: EusAcousticVolume;
  pose: AcousticPose;
  sectorAngleDeg: number;
  depthMm: number;
  onDepthMm: (depthMm: number) => void;
  labelColors: EusLabelColors;
  structures: Map<string, EusStructure>;
  showColors: boolean;
  onShowColors: (show: boolean) => void;
  /** False while a find-the-target round is running: no colors, tissue names or structure list. */
  namingEnabled: boolean;
  activeStructure: string | null;
  onActiveStructure: (key: string | null) => void;
  /** Structure under the pointer in any view; it is outlined here when it is in the image. */
  hoverStructure: string | null;
  onHoverStructure: (key: string | null) => void;
  onFrame: (frame: EusAcousticFrame) => void;
  /** The grayscale canvas, shared so the 3D view can show the image on the scan plane. */
  onCanvas?: (canvas: HTMLCanvasElement | null) => void;
  /** Called after each new frame has been drawn on that canvas. */
  onFrameDrawn?: () => void;
}

interface PointerAt {
  /** Position inside the image box, in CSS pixels, for placing the name. */
  left: number;
  top: number;
  boxWidth: number;
  boxHeight: number;
  /** Position in frame pixels, for reading the label. */
  x: number;
  y: number;
}

export function EusSectorView({
  volume,
  pose,
  sectorAngleDeg,
  depthMm,
  onDepthMm,
  labelColors,
  structures,
  showColors,
  onShowColors,
  namingEnabled,
  activeStructure,
  onActiveStructure,
  hoverStructure,
  onHoverStructure,
  onFrame,
  onCanvas,
  onFrameDrawn,
}: EusSectorViewProps) {
  const canvas = useRef<HTMLCanvasElement>(null),
    overlay = useRef<HTMLCanvasElement>(null),
    worker = useRef<Worker | null>(null),
    sequence = useRef(0),
    scheduled = useRef<ReturnType<typeof setTimeout> | null>(null),
    touchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [gainDb, setGainDb] = useState(DEFAULT_EUS_CONTROLS.gainDb);
  const [frozen, setFrozen] = useState(false);
  const [frame, setFrame] = useState<EusAcousticFrame | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [pointer, setPointer] = useState<PointerAt | null>(null);

  const controls = useMemo(
    () => ({ ...DEFAULT_EUS_CONTROLS, depthMm, gainDb, sectorAngleDeg }),
    [depthMm, gainDb, sectorAngleDeg],
  );
  const desired = useRef({ pose, controls, frozen });
  useEffect(() => {
    desired.current = { pose, controls, frozen };
  }, [pose, controls, frozen]);
  const frameCallback = useRef(onFrame);
  useEffect(() => {
    frameCallback.current = onFrame;
  }, [onFrame]);

  useEffect(() => {
    onCanvas?.(canvas.current);
    return () => onCanvas?.(null);
  }, [onCanvas]);

  useEffect(() => {
    const instance = new Worker(new URL('./eusAcoustic.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.current = instance;
    instance.onmessage = (event: MessageEvent<{ id: number; frame: EusAcousticFrame }>) => {
      if (event.data.id !== sequence.current || desired.current.frozen) return;
      setFrame(event.data.frame);
      frameCallback.current(event.data.frame);
    };
    instance.onerror = () => setRenderError('Ultrasound rendering could not start. Reload to retry.');
    // The worker owns its own copy; the page keeps the volume for the overlays and the CT.
    const data = volume.data.slice();
    instance.postMessage({ type: 'init', volume: { ...volume, data } }, [data.buffer]);
    instance.postMessage({
      type: 'render',
      id: ++sequence.current,
      pose: desired.current.pose,
      controls: desired.current.controls,
      width: FRAME_SIZE,
      height: FRAME_SIZE,
    });
    return () => {
      instance.terminate();
      worker.current = null;
      if (scheduled.current) clearTimeout(scheduled.current);
      scheduled.current = null;
    };
  }, [volume]);

  useEffect(() => {
    if (!worker.current || frozen || scheduled.current) return;
    scheduled.current = setTimeout(() => {
      scheduled.current = null;
      if (desired.current.frozen) return;
      worker.current?.postMessage({
        type: 'render',
        id: ++sequence.current,
        pose: desired.current.pose,
        controls: desired.current.controls,
        width: FRAME_SIZE,
        height: FRAME_SIZE,
      });
    }, 33);
  }, [pose, controls, frozen]);

  useEffect(() => {
    const element = canvas.current;
    if (!frame || !element) return;
    element.width = frame.width;
    element.height = frame.height;
    const context = element.getContext('2d');
    if (!context) return;
    context.putImageData(
      new ImageData(new Uint8ClampedArray(frame.rgba), frame.width, frame.height),
      0,
      0,
    );
    const { halfAngle, radius, apexX, apexY } = sectorGeometry(
      frame.width,
      frame.height,
      frame.controls.sectorAngleDeg,
    );
    const scale = frame.width / 384;
    context.font = `${Math.round(11 * scale)}px system-ui`;
    context.fillStyle = '#dce3e8';
    context.strokeStyle = '#76838d';
    context.lineWidth = scale;
    for (let mm = 10; mm <= frame.controls.depthMm; mm += 10) {
      const r = (radius * mm) / frame.controls.depthMm,
        x = apexX + Math.sin(halfAngle) * r,
        y = apexY + Math.cos(halfAngle) * r;
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x + 6 * scale, y);
      context.stroke();
      context.fillText(`${mm}`, x + 8 * scale, y + 4 * scale);
    }
    onFrameDrawn?.();
  }, [frame, onFrameDrawn]);

  const labels = volume.metadata.labels;
  const labelIds = useMemo(() => new Map(labels.map((label) => [label.key, label.id])), [labels]);

  // What is under the pointer is read from the current frame, so it stays right while the scope
  // moves beneath a still pointer.
  const pointed = useMemo(() => {
    if (!frame || !pointer || !namingEnabled) return null;
    const raw = frame.labelImage[pointer.y * frame.width + pointer.x];
    // 0 is outside the sector; 255 is air inside it.
    return raw === 0 ? null : labels[raw === 255 ? 0 : raw];
  }, [frame, pointer, namingEnabled, labels]);
  const pointedKey = pointed?.reportable ? pointed.key : null;

  useEffect(() => {
    onHoverStructure(pointedKey);
  }, [pointedKey, onHoverStructure]);
  useEffect(
    () => () => {
      if (touchTimer.current) clearTimeout(touchTimer.current);
    },
    [],
  );

  const tinted = showColors && namingEnabled;
  // One outline at a time: the pointer wins, then a structure pointed at in another view, then
  // the structure chosen from the list.
  const pointedAnywhere = pointedKey ?? hoverStructure;
  const highlightKey = namingEnabled ? (pointedAnywhere ?? activeStructure) : null;
  const highlightId = highlightKey ? (labelIds.get(highlightKey) ?? null) : null;
  const activeId = activeStructure ? (labelIds.get(activeStructure) ?? null) : null;
  useEffect(() => {
    const element = overlay.current;
    if (!element || !frame) return;
    if (element.width !== frame.width || element.height !== frame.height) {
      element.width = frame.width;
      element.height = frame.height;
    }
    const context = element.getContext('2d');
    if (!context) return;
    const image = context.createImageData(frame.width, frame.height);
    paintEusOverlay(image.data, volume, frame, {
      colors: labelColors,
      tint: tinted,
      activeId,
      highlightId,
      // A structure being pointed at is filled; a standing selection is only outlined.
      fillHighlight: pointedAnywhere !== null,
    });
    context.putImageData(image, 0, 0);
  }, [frame, tinted, labelColors, activeId, highlightId, pointedAnywhere, volume]);

  const track = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!frame || !namingEnabled) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const left = event.clientX - rect.left,
      top = event.clientY - rect.top;
    const x = Math.floor((left / rect.width) * frame.width),
      y = Math.floor((top / rect.height) * frame.height);
    if (x < 0 || y < 0 || x >= frame.width || y >= frame.height) return setPointer(null);
    setPointer({ left, top, boxWidth: rect.width, boxHeight: rect.height, x, y });
    if (touchTimer.current) clearTimeout(touchTimer.current);
    touchTimer.current =
      event.pointerType === 'mouse' ? null : setTimeout(() => setPointer(null), TOUCH_NAME_MS);
  };

  const inView = useMemo(
    () =>
      frame
        ? [...frame.structures]
            .sort((a, b) => b.count - a.count)
            .map((structure) => labels[structure.id])
        : [],
    [frame, labels],
  );

  const pointedColor = pointed ? labelColors[pointed.id] : null;
  const pointedNote = pointed ? structures.get(pointed.key)?.note : undefined;
  const pointedKind =
    pointed && pointed.group !== 'background' ? EUS_GROUP_NAMES[pointed.group] : null;

  return (
    <section className="eus-pane eus-sector-pane" aria-label="Simulated EUS-B ultrasound">
      <header className="eus-pane-header">
        <div>
          <span className="eus-eyebrow">Ultrasound</span>
          <h2>{frozen ? 'Frozen image' : 'Live scan'}</h2>
        </div>
        <button
          className="eus-chip-button"
          type="button"
          aria-pressed={frozen}
          onClick={() => setFrozen(!frozen)}
        >
          {frozen ? 'Resume' : 'Freeze'}
        </button>
      </header>
      <div
        className={`eus-sector-image${pointedKey ? ' is-pointing' : ''}`}
        onPointerMove={track}
        onPointerDown={track}
        onPointerLeave={(event) => {
          if (event.pointerType === 'mouse') setPointer(null);
        }}
        onClick={() => {
          if (pointedKey) onActiveStructure(activeStructure === pointedKey ? null : pointedKey);
        }}
      >
        <canvas ref={canvas} aria-label="Simulated grayscale ultrasound image" />
        <canvas ref={overlay} aria-hidden="true" />
        <span className="eus-image-mark eus-image-mark--left">Distal</span>
        <span className="eus-image-mark eus-image-mark--right">Proximal</span>
        <span className="eus-image-badge">Simulated</span>
        {!frame && (
          <div className="eus-image-message" role="status">
            {renderError ?? 'Preparing the ultrasound image…'}
          </div>
        )}
        {frame && (
          <div className="eus-image-readout">
            {frozen ? 'Frozen' : `${frame.controls.frequencyMHz} MHz`} · {frame.controls.depthMm} mm
            · {frame.controls.gainDb} dB
          </div>
        )}
        {pointed && pointer && (
          <EusHoverName
            left={pointer.left}
            top={pointer.top}
            boxWidth={pointer.boxWidth}
            boxHeight={pointer.boxHeight}
            label={pointed.label}
            color={pointedColor && `rgb(${pointedColor.join(',')})`}
            kind={pointedKind}
            note={pointedNote}
          />
        )}
      </div>
      <p className="eus-pointer-readout" aria-live="polite">
        {namingEnabled
          ? pointed
            ? `Under the pointer: ${pointed.label}${pointedNote ? `. ${pointedNote}` : ''}`
            : 'Point at the image to name a structure. Click it to keep it outlined.'
          : 'Structure names are hidden while you search.'}
      </p>
      <div className="eus-image-controls">
        <label>
          Depth {depthMm} mm
          <input
            aria-label="Ultrasound depth"
            type="range"
            min={EUS_DEPTH_RANGE_MM[0]}
            max={EUS_DEPTH_RANGE_MM[1]}
            step={5}
            value={depthMm}
            disabled={frozen}
            onChange={(event) => onDepthMm(Number(event.target.value))}
          />
        </label>
        <label>
          Gain {gainDb} dB
          <input
            aria-label="Ultrasound gain"
            type="range"
            min={-15}
            max={15}
            step={1}
            value={gainDb}
            disabled={frozen}
            onChange={(event) => setGainDb(Number(event.target.value))}
          />
        </label>
        <label className="eus-check">
          <input
            type="checkbox"
            checked={tinted}
            disabled={!namingEnabled}
            onChange={(event) => onShowColors(event.target.checked)}
          />
          Color the structures
        </label>
      </div>
      {namingEnabled && (
        <div className="eus-in-view" aria-label="Structures in the image">
          <span className="eus-in-view__label">In the image</span>
          {inView.length === 0 && <span className="eus-muted">No segmented structure</span>}
          {inView.map((label) => {
            const color = labelColors[label.id];
            return (
              <button
                key={label.key}
                type="button"
                className="eus-structure-chip"
                aria-pressed={activeStructure === label.key}
                onClick={() => onActiveStructure(activeStructure === label.key ? null : label.key)}
                onPointerEnter={() => onHoverStructure(label.key)}
                onPointerLeave={() => onHoverStructure(null)}
              >
                <span
                  className="eus-swatch"
                  style={{ backgroundColor: color ? `rgb(${color.join(',')})` : '#94a3b8' }}
                />
                {label.label}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
