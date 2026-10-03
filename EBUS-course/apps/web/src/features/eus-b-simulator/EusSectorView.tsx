import { useEffect, useMemo, useRef, useState } from 'react';
import type { AcousticPose } from '@bronchoscopy-core/acoustic';

import {
  DEFAULT_EUS_CONTROLS,
  EUS_DEPTH_RANGE_MM,
  sectorGeometry,
  type EusAcousticFrame,
} from './eusAcoustic';
import type { EusAcousticVolume } from './types';

const FRAME_SIZE = 384;

export type EusLabelColors = Array<[number, number, number] | null>;

interface EusSectorViewProps {
  volume: EusAcousticVolume;
  pose: AcousticPose;
  sectorAngleDeg: number;
  depthMm: number;
  onDepthMm: (depthMm: number) => void;
  labelColors: EusLabelColors;
  showColors: boolean;
  onShowColors: (show: boolean) => void;
  /** False while a find-the-target round is running: no colors, tissue names or structure list. */
  namingEnabled: boolean;
  activeStructure: string | null;
  onActiveStructure: (key: string | null) => void;
  onFrame: (frame: EusAcousticFrame) => void;
}

export function EusSectorView({
  volume,
  pose,
  sectorAngleDeg,
  depthMm,
  onDepthMm,
  labelColors,
  showColors,
  onShowColors,
  namingEnabled,
  activeStructure,
  onActiveStructure,
  onFrame,
}: EusSectorViewProps) {
  const canvas = useRef<HTMLCanvasElement>(null),
    overlay = useRef<HTMLCanvasElement>(null),
    worker = useRef<Worker | null>(null),
    sequence = useRef(0),
    scheduled = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [gainDb, setGainDb] = useState(DEFAULT_EUS_CONTROLS.gainDb);
  const [frozen, setFrozen] = useState(false);
  const [frame, setFrame] = useState<EusAcousticFrame | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [pointerLabel, setPointerLabel] = useState<string | null>(null);

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
    // The worker owns its own copy; the page keeps the volume for the CT and find-mode checks.
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
    context.font = '11px system-ui';
    context.fillStyle = '#dce3e8';
    context.strokeStyle = '#76838d';
    context.lineWidth = 1;
    for (let mm = 10; mm <= frame.controls.depthMm; mm += 10) {
      const r = (radius * mm) / frame.controls.depthMm,
        x = apexX + Math.sin(halfAngle) * r,
        y = apexY + Math.cos(halfAngle) * r;
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x + 6, y);
      context.stroke();
      context.fillText(`${mm}`, x + 8, y + 4);
    }
  }, [frame]);

  const tinted = showColors && namingEnabled;
  useEffect(() => {
    const element = overlay.current;
    if (!element || !frame) return;
    element.width = frame.width;
    element.height = frame.height;
    const context = element.getContext('2d');
    if (!context) return;
    context.clearRect(0, 0, frame.width, frame.height);
    if (!tinted) return;
    const image = context.createImageData(frame.width, frame.height);
    const labels = volume.metadata.labels;
    for (let i = 0; i < frame.labelImage.length; i++) {
      const id = frame.labelImage[i],
        color = labelColors[id];
      if (!color) continue;
      const p = i * 4;
      image.data[p] = color[0];
      image.data[p + 1] = color[1];
      image.data[p + 2] = color[2];
      image.data[p + 3] = labels[id].key === activeStructure ? 150 : 78;
    }
    context.putImageData(image, 0, 0);
  }, [frame, tinted, labelColors, activeStructure, volume]);

  const nameAt = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!frame || !namingEnabled || !canvas.current) return;
    const rect = canvas.current.getBoundingClientRect();
    const x = Math.floor(((event.clientX - rect.left) / rect.width) * frame.width),
      y = Math.floor(((event.clientY - rect.top) / rect.height) * frame.height);
    if (x < 0 || y < 0 || x >= frame.width || y >= frame.height) return setPointerLabel(null);
    const raw = frame.labelImage[y * frame.width + x];
    // 0 is outside the sector; 255 is air inside it.
    setPointerLabel(raw === 0 ? null : volume.metadata.labels[raw === 255 ? 0 : raw].label);
  };

  const inView = useMemo(
    () =>
      frame
        ? [...frame.structures]
            .sort((a, b) => b.count - a.count)
            .map((structure) => volume.metadata.labels[structure.id])
        : [],
    [frame, volume],
  );

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
        className="eus-sector-image"
        onPointerMove={nameAt}
        onPointerLeave={() => setPointerLabel(null)}
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
      </div>
      <p className="eus-pointer-readout" aria-live="polite">
        {namingEnabled
          ? pointerLabel
            ? `Under the pointer: ${pointerLabel}`
            : 'Point at the image to name the tissue.'
          : 'Tissue names are hidden while you search.'}
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
