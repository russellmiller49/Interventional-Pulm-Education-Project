import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

import { EUS_GROUP_NAMES } from '@/features/eus-b-simulator/content';
import {
  paintEusOverlay,
  sectorGeometry,
  type EusAcousticFrame,
} from '@/features/eus-b-simulator/eusAcoustic';
import { EusHoverName } from '@/features/eus-b-simulator/EusHoverName';
import type { EusAcousticVolume } from '@/features/eus-b-simulator/types';
import type { EusSessionLabelColors } from '@/features/eus-b-simulator/useEusScopeSession';

/** How long a tapped name stays up on a touch screen, where there is no hover to end it. */
const TOUCH_NAME_MS = 2600;
/** Smallest size, in CSS pixels, the depth numbers drawn on the image may appear at. */
const MIN_TICK_TEXT_PX = 13;
/** How far one arrow key moves the crosshair, as a share of the image; Shift moves it further. */
const CROSS_STEP = 0.01;
const CROSS_STEP_LARGE = 0.05;
const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/** A place on the image: in the frame's own pixels, and as fractions of the image. */
export interface SectorPick {
  x: number;
  y: number;
  fraction: { x: number; y: number };
}

interface PointerAt {
  left: number;
  top: number;
  boxWidth: number;
  boxHeight: number;
  x: number;
  y: number;
}

interface EusGuidedSectorProps {
  volume: EusAcousticVolume;
  frame: EusAcousticFrame | null;
  renderError: string | null;
  labelColors: EusSessionLabelColors;
  /**
   * Whether anything in the image may be named. When false the image is plain grayscale: no
   * colors, no outline and no name under the pointer.
   */
  named: boolean;
  /** A structure to outline because it is pointed at elsewhere, such as in the legend. */
  highlightKey: string | null;
  /** Reports the named structure under the pointer, or null. */
  onPointStructure?: (key: string | null) => void;
  /** Driving keys pressed while the image has focus. */
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
  /** Whether the image takes keyboard focus for driving. */
  drivable: boolean;
  /**
   * Structures tinted in their color while names are withheld: the landmarks a learner has
   * already marked. Nothing else is tinted, and still nothing is named under the pointer.
   */
  tintKeys?: readonly string[];
  /**
   * When set, the image can be clicked: with the pointer, or with a crosshair moved by the arrow
   * keys and Enter or Space. It is told where.
   */
  onPick?: (at: SectorPick) => void;
  /** Drawn over the image, above both canvases. */
  children?: ReactNode;
}

/**
 * The ultrasound image of the guided lab. It draws the frame it is given and nothing else: the
 * worker, the scope and the task live in the workbench.
 */
export function EusGuidedSector({
  volume,
  frame,
  renderError,
  labelColors,
  named,
  highlightKey,
  onPointStructure,
  onKeyDown,
  drivable,
  tintKeys,
  onPick,
  children,
}: EusGuidedSectorProps) {
  const canvas = useRef<HTMLCanvasElement>(null),
    overlay = useRef<HTMLCanvasElement>(null),
    touchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pointer, setPointer] = useState<PointerAt | null>(null);
  // The keyboard's stand-in for the pointer, as fractions of the image. Shown once a key moves it.
  const [cross, setCross] = useState<{ x: number; y: number } | null>(null);
  const pickable = !!onPick;
  useEffect(() => {
    if (!pickable) setCross(null);
  }, [pickable]);
  // The size the image is shown at. It changes when the frame is resized, and when the lesson
  // page hides the lab and shows it again; the depth numbers are then drawn again to suit.
  const [shownWidth, setShownWidth] = useState(0);
  useEffect(() => {
    const element = canvas.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setShownWidth(Math.round(element.clientWidth)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

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
    // Depth marks down the proximal edge of the sector, in millimetres.
    const { halfAngle, radius, apexX, apexY } = sectorGeometry(
      frame.width,
      frame.height,
      frame.controls.sectorAngleDeg,
    );
    const scale = frame.width / 384;
    const shown = shownWidth || element.clientWidth || frame.width;
    const text = Math.max(11 * scale, (MIN_TICK_TEXT_PX * frame.width) / shown);
    context.font = `${Math.round(text)}px system-ui`;
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
      context.fillText(`${mm}`, x + 8 * scale, y + text / 3);
    }
    // The edge of the field of view, drawn faintly. A heart chamber or a great vessel can fill
    // the whole sector with echo-free blood; the outline shows the black is inside the image.
    const edgeX = Math.sin(halfAngle) * radius,
      edgeY = Math.cos(halfAngle) * radius;
    context.strokeStyle = 'rgba(118, 131, 141, 0.5)';
    context.beginPath();
    context.moveTo(apexX - edgeX, apexY + edgeY);
    context.lineTo(apexX, apexY);
    context.lineTo(apexX + edgeX, apexY + edgeY);
    context.arc(apexX, apexY, radius, Math.PI / 2 - halfAngle, Math.PI / 2 + halfAngle);
    context.stroke();
  }, [frame, shownWidth]);

  const labels = volume.metadata.labels;
  const labelIds = useMemo(() => new Map(labels.map((label) => [label.key, label.id])), [labels]);

  // Read from the current frame, so the name stays right while the picture changes under a
  // still pointer. Nothing is read at all while names are withheld.
  const pointed = useMemo(() => {
    if (!frame || !pointer || !named) return null;
    const raw = frame.labelImage[pointer.y * frame.width + pointer.x];
    return raw === 0 ? null : (labels[raw === 255 ? 0 : raw] ?? null);
  }, [frame, pointer, named, labels]);
  const pointedKey = pointed?.reportable ? pointed.key : null;

  useEffect(() => {
    onPointStructure?.(pointedKey);
  }, [pointedKey, onPointStructure]);
  useEffect(() => {
    if (!named) setPointer(null);
  }, [named]);
  useEffect(
    () => () => {
      if (touchTimer.current) clearTimeout(touchTimer.current);
    },
    [],
  );

  const outlinedKey = named ? (pointedKey ?? highlightKey) : null;
  const highlightId = outlinedKey ? (labelIds.get(outlinedKey) ?? null) : null;
  // With names withheld, only the structures listed are given a color.
  const tintList = named ? '' : (tintKeys ?? []).join(' ');
  const tintOnly = useMemo(() => {
    if (!tintList) return null;
    const ids = new Set(tintList.split(' ').map((key) => labelIds.get(key)));
    return labels.map((label) =>
      ids.has(label.id) ? (labelColors[label.id] ?? ([255, 255, 255] as [number, number, number])) : null,
    );
  }, [tintList, labelIds, labels, labelColors]);
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
      colors: tintOnly ?? labelColors,
      tint: named || !!tintOnly,
      activeId: null,
      highlightId,
      fillHighlight: true,
    });
    context.putImageData(image, 0, 0);
  }, [frame, named, labelColors, tintOnly, highlightId, volume]);

  const pickAt = (fx: number, fy: number) => {
    if (!frame || !onPick) return;
    const x = Math.min(frame.width - 1, Math.max(0, Math.floor(fx * frame.width))),
      y = Math.min(frame.height - 1, Math.max(0, Math.floor(fy * frame.height)));
    onPick({ x, y, fraction: { x: fx, y: fy } });
  };
  const crossKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const arrow = ARROWS[event.key];
    if (arrow) {
      event.preventDefault();
      const step = event.shiftKey ? CROSS_STEP_LARGE : CROSS_STEP;
      const within = (value: number) => Math.min(0.99, Math.max(0.01, value));
      // The first key shows the crosshair in the middle of the image; later ones move it.
      setCross((at) =>
        at ? { x: within(at.x + arrow[0] * step), y: within(at.y + arrow[1] * step) } : { x: 0.5, y: 0.5 },
      );
      return;
    }
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    if (cross) pickAt(cross.x, cross.y);
    else setCross({ x: 0.5, y: 0.5 });
  };

  const track = (event: React.PointerEvent<HTMLDivElement>) => {
    // The pointer takes over from the keyboard's crosshair.
    if (cross && event.type === 'pointermove') setCross(null);
    if (!frame || !named) return;
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

  const pointedColor = pointed ? labelColors[pointed.id] : null;
  const pointedKind =
    pointed && pointed.group !== 'background' ? EUS_GROUP_NAMES[pointed.group] : null;

  return (
    <div
      className={`eusg-image${named ? ' is-named' : ''}${pickable ? ' is-pickable' : ''}`}
      data-eusg-image
      tabIndex={drivable || pickable ? 0 : undefined}
      role="group"
      aria-label={
        pickable
          ? 'Ultrasound image. With the image focused, the arrow keys move a crosshair and Enter marks the point under it.'
          : drivable
            ? 'Ultrasound image. With the image focused, the arrow keys and brackets move the scope.'
            : 'Ultrasound image'
      }
      onKeyDown={pickable ? crossKey : onKeyDown}
      onClick={
        pickable
          ? (event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              if (!rect.width || !rect.height) return;
              setCross(null);
              pickAt(
                (event.clientX - rect.left) / rect.width,
                (event.clientY - rect.top) / rect.height,
              );
            }
          : undefined
      }
      onPointerMove={track}
      onPointerDown={track}
      onPointerLeave={(event) => {
        if (event.pointerType === 'mouse') setPointer(null);
      }}
    >
      <canvas ref={canvas} aria-label="Ultrasound image from the scope" />
      <canvas ref={overlay} aria-hidden="true" />
      <span className="eusg-mark eusg-mark--left">Distal</span>
      <span className="eusg-mark eusg-mark--right">Proximal</span>
      {!frame && (
        <div className="eusg-image-message" role="status">
          {renderError ?? 'Preparing the ultrasound image…'}
        </div>
      )}
      {frame && (
        <div className="eusg-readout">
          {frame.controls.frequencyMHz} MHz · {frame.controls.depthMm} mm ·{' '}
          {frame.controls.gainDb} dB
        </div>
      )}
      {children}
      {pickable && cross && (
        <span
          className="eusg-cross"
          aria-hidden="true"
          data-eusg-cross
          style={{ left: `${cross.x * 100}%`, top: `${cross.y * 100}%` }}
        />
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
        />
      )}
    </div>
  );
}
