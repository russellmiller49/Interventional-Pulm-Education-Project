import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Point3 } from '@bronchoscopy-core/frame';

import { EUS_PAINTED_CT_NOTE } from './content';
import { eusLabelAt, sectorGeometry } from './eusAcoustic';
import type { EusPose } from './eusPose';
import type { EusLabelColors } from './EusSectorView';
import type { EusAcousticVolume, EusCtVolume } from './types';

const IMAGE_SIZE = 448;

export type EusCtPlane = 'scan' | 'axial' | 'coronal' | 'sagittal';
type Axis = 0 | 1 | 2;

/**
 * The three orthogonal planes, in patient LPS axes (0 left, 1 posterior, 2 superior). Each is
 * drawn the way it is read: the patient's left on the image's right in axial and coronal slices,
 * anterior on the left in sagittal ones, and superior at the top.
 */
const ORTHOGONAL: Record<
  Exclude<EusCtPlane, 'scan'>,
  { across: Axis; down: Axis; fixed: Axis; superiorUp: boolean; marks: [string, string, string, string] }
> = {
  axial: { across: 0, down: 1, fixed: 2, superiorUp: false, marks: ['R', 'L', 'A', 'P'] },
  coronal: { across: 0, down: 2, fixed: 1, superiorUp: true, marks: ['R', 'L', 'S', 'I'] },
  sagittal: { across: 1, down: 2, fixed: 0, superiorUp: true, marks: ['A', 'P', 'S', 'I'] },
};

const PLANES: Array<{ key: EusCtPlane; label: string; title: string; caption: string }> = [
  {
    key: 'scan',
    label: 'Scan plane',
    title: 'CT in the scan plane',
    caption: 'The same plane and sector as the ultrasound image, cut from the CT.',
  },
  {
    key: 'axial',
    label: 'Axial',
    title: 'Axial CT at the transducer',
    caption:
      'The yellow dot is the transducer. The blue shape is the ultrasound sector projected onto this slice: a line when the scan plane is vertical.',
  },
  {
    key: 'coronal',
    label: 'Coronal',
    title: 'Coronal CT at the transducer',
    caption:
      'The slice passes through the transducer (yellow dot). The yellow line is the scope, and the blue shape is the ultrasound sector projected onto this slice.',
  },
  {
    key: 'sagittal',
    label: 'Sagittal',
    title: 'Sagittal CT at the transducer',
    caption:
      'The slice passes through the transducer (yellow dot). The yellow line is the scope, and the blue shape is the ultrasound sector projected onto this slice.',
  },
];

/** Trilinear sample of the windowed CT crop; 0 (black) outside it. */
export function sampleCt(ct: EusCtVolume, x: number, y: number, z: number) {
  const { sizeXyz, spacingXyzMm, originLps } = ct.asset;
  const vx = (x - originLps[0]) / spacingXyzMm[0],
    vy = (y - originLps[1]) / spacingXyzMm[1],
    vz = (z - originLps[2]) / spacingXyzMm[2];
  if (vx < 0 || vy < 0 || vz < 0 || vx > sizeXyz[0] - 1 || vy > sizeXyz[1] - 1 || vz > sizeXyz[2] - 1)
    return 0;
  const ix = Math.min(Math.floor(vx), sizeXyz[0] - 2),
    iy = Math.min(Math.floor(vy), sizeXyz[1] - 2),
    iz = Math.min(Math.floor(vz), sizeXyz[2] - 2),
    fx = vx - ix,
    fy = vy - iy,
    fz = vz - iz;
  const nx = sizeXyz[0],
    slice = nx * sizeXyz[1],
    base = iz * slice + iy * nx + ix,
    d = ct.data;
  const near =
    (d[base] * (1 - fx) + d[base + 1] * fx) * (1 - fy) +
    (d[base + nx] * (1 - fx) + d[base + nx + 1] * fx) * fy;
  const far =
    (d[base + slice] * (1 - fx) + d[base + slice + 1] * fx) * (1 - fy) +
    (d[base + slice + nx] * (1 - fx) + d[base + slice + nx + 1] * fx) * fy;
  return near * (1 - fz) + far * fz;
}

/**
 * The part of the CT an orthogonal slice shows, in millimetres along its two image axes.
 *
 * Axial slices show the whole crop. Coronal and sagittal slices show a square window that keeps
 * the transducer in view as the scope travels, because the crop is much taller than it is wide.
 */
export function orthogonalWindow(
  ct: EusCtVolume,
  plane: Exclude<EusCtPlane, 'scan'>,
  transducerLps: Point3,
) {
  const { sizeXyz, spacingXyzMm, originLps } = ct.asset;
  const { across, down, superiorUp } = ORTHOGONAL[plane];
  const extent = (axis: Axis) => (sizeXyz[axis] - 1) * spacingXyzMm[axis];
  const acrossMm = extent(across);
  if (!superiorUp)
    return { acrossFrom: originLps[across], acrossMm, downFrom: originLps[down], downMm: extent(down) };
  const downMm = Math.min(acrossMm, extent(down));
  const downFrom = Math.min(
    Math.max(transducerLps[down] - downMm / 2, originLps[down]),
    originLps[down] + extent(down) - downMm,
  );
  return { acrossFrom: originLps[across], acrossMm, downFrom, downMm };
}

function tint(
  data: Uint8ClampedArray,
  offset: number,
  gray: number,
  color: [number, number, number] | null,
  strength = 0.45,
) {
  if (color) {
    data[offset] = gray * (1 - strength) + color[0] * strength;
    data[offset + 1] = gray * (1 - strength) + color[1] * strength;
    data[offset + 2] = gray * (1 - strength) + color[2] * strength;
  } else {
    data[offset] = gray;
    data[offset + 1] = gray;
    data[offset + 2] = gray;
  }
  data[offset + 3] = 255;
}

interface EusCtViewProps {
  ct: EusCtVolume | null;
  /** Set when the CT could not be loaded. */
  loadError: string | null;
  volume: EusAcousticVolume;
  pose: EusPose;
  /** Scope shaft from the top of the path to the transducer. */
  shaftLps: Point3[];
  depthMm: number;
  sectorAngleDeg: number;
  labelColors: EusLabelColors;
  showColors: boolean;
  /** Label of the structure pointed at or chosen in another view; tinted even with colors off. */
  highlightId: number | null;
  /** How strongly it is tinted: more while it is being pointed at than as a standing selection. */
  highlightStrength: number;
  plane: EusCtPlane;
  onPlane: (plane: EusCtPlane) => void;
  /** The control that swaps this pane between the endoscope and the CT. */
  viewSwitch: ReactNode;
}

export function EusCtView({
  ct,
  loadError,
  volume,
  pose,
  shaftLps,
  depthMm,
  sectorAngleDeg,
  labelColors,
  showColors,
  highlightId,
  highlightStrength,
  plane,
  onPlane,
  viewSwitch,
}: EusCtViewProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  // True while the image on screen includes a node the case build painted into the CT.
  const [paintedShown, setPaintedShown] = useState(false);
  const paintedIds = useMemo(() => {
    const keys = new Set(ct?.asset.paintedStructures ?? []);
    return new Set(
      volume.metadata.labels.filter((label) => keys.has(label.key)).map((label) => label.id),
    );
  }, [ct, volume]);

  useEffect(() => {
    const element = canvas.current;
    if (!element || !ct) return;
    const context = element.getContext('2d');
    if (!context) return;
    const volumeCt = ct;
    const origin = pose.originLps,
      depth = pose.depthAxisLps,
      lateral = pose.lateralAxisLps;
    let painted = false;
    const paint = (data: Uint8ClampedArray, offset: number, x: number, y: number, z: number) => {
      const gray = sampleCt(volumeCt, x, y, z);
      const id =
        showColors || highlightId !== null || paintedIds.size ? eusLabelAt(volume, x, y, z) : -1;
      if (paintedIds.has(id)) painted = true;
      if (id === highlightId)
        tint(data, offset, gray, labelColors[id] ?? [255, 255, 255], highlightStrength);
      else tint(data, offset, gray, showColors ? labelColors[id] : null);
    };

    if (plane === 'scan') {
      // The CT resliced in the ultrasound plane, drawn with the same sector layout.
      element.width = IMAGE_SIZE;
      element.height = IMAGE_SIZE;
      const image = context.createImageData(IMAGE_SIZE, IMAGE_SIZE);
      const { halfAngle, radius, apexX, apexY } = sectorGeometry(
        IMAGE_SIZE,
        IMAGE_SIZE,
        sectorAngleDeg,
      );
      for (let y = 0; y < IMAGE_SIZE; y++)
        for (let x = 0; x < IMAGE_SIZE; x++) {
          const offset = (y * IMAGE_SIZE + x) * 4,
            px = x - apexX,
            py = y - apexY,
            angle = Math.atan2(px, py),
            distance = Math.hypot(px, py) / radius;
          image.data[offset + 3] = 255;
          if (py < 0 || distance > 1 || Math.abs(angle) > halfAngle) continue;
          const r = distance * depthMm,
            c = Math.cos(angle) * r,
            s = Math.sin(angle) * r;
          paint(
            image.data,
            offset,
            origin[0] + depth[0] * c + lateral[0] * s,
            origin[1] + depth[1] * c + lateral[1] * s,
            origin[2] + depth[2] * c + lateral[2] * s,
          );
        }
      context.putImageData(image, 0, 0);
      setPaintedShown(painted);
      return;
    }

    // An orthogonal slice through the transducer.
    const { across, down, fixed, superiorUp, marks } = ORTHOGONAL[plane];
    const { acrossFrom, acrossMm, downFrom, downMm } = orthogonalWindow(volumeCt, plane, origin);
    const width = IMAGE_SIZE,
      height = Math.round((IMAGE_SIZE * downMm) / acrossMm);
    element.width = width;
    element.height = height;
    const image = context.createImageData(width, height);
    const point: Point3 = [origin[0], origin[1], origin[2]];
    for (let y = 0; y < height; y++) {
      const along = (y / (height - 1)) * downMm;
      point[down] = superiorUp ? downFrom + downMm - along : downFrom + along;
      for (let x = 0; x < width; x++) {
        point[across] = acrossFrom + (x / (width - 1)) * acrossMm;
        point[fixed] = origin[fixed];
        paint(image.data, (y * width + x) * 4, point[0], point[1], point[2]);
      }
    }
    context.putImageData(image, 0, 0);
    setPaintedShown(painted);
    const toPixel = (at: Point3): [number, number] => {
      const along = (at[down] - downFrom) / downMm;
      return [
        ((at[across] - acrossFrom) / acrossMm) * (width - 1),
        (superiorUp ? 1 - along : along) * (height - 1),
      ];
    };
    if (superiorUp && shaftLps.length > 1) {
      // The scope's course, projected onto the slice.
      context.beginPath();
      shaftLps.forEach((at, index) =>
        index ? context.lineTo(...toPixel(at)) : context.moveTo(...toPixel(at)),
      );
      context.strokeStyle = 'rgba(255, 209, 102, 0.85)';
      context.lineWidth = 2.5;
      context.lineJoin = 'round';
      context.stroke();
    }
    // The sector projected onto this slice. Where the scan plane is edge-on it is a line.
    const half = (sectorAngleDeg * Math.PI) / 360;
    context.beginPath();
    context.moveTo(...toPixel(origin));
    for (let step = 0; step <= 16; step++) {
      const angle = -half + (2 * half * step) / 16,
        c = Math.cos(angle) * depthMm,
        s = Math.sin(angle) * depthMm;
      context.lineTo(
        ...toPixel([
          origin[0] + depth[0] * c + lateral[0] * s,
          origin[1] + depth[1] * c + lateral[1] * s,
          origin[2] + depth[2] * c + lateral[2] * s,
        ]),
      );
    }
    context.closePath();
    context.fillStyle = 'rgba(127, 227, 255, 0.16)';
    context.strokeStyle = 'rgba(127, 227, 255, 0.85)';
    context.lineWidth = 1.5;
    context.fill();
    context.stroke();
    const [ox, oy] = toPixel(origin);
    context.beginPath();
    context.arc(ox, oy, 4.5, 0, Math.PI * 2);
    context.fillStyle = '#ffd166';
    context.fill();
    context.font = '600 13px system-ui';
    context.fillStyle = '#dce3e8';
    context.fillText(marks[0], 8, height / 2);
    context.fillText(marks[1], width - 17, height / 2);
    context.fillText(marks[2], width / 2 - 4, 17);
    context.fillText(marks[3], width / 2 - 4, height - 9);
  }, [
    ct,
    volume,
    pose,
    shaftLps,
    depthMm,
    sectorAngleDeg,
    labelColors,
    showColors,
    highlightId,
    highlightStrength,
    plane,
    paintedIds,
  ]);

  const shown = PLANES.find((entry) => entry.key === plane)!;
  return (
    <section className="eus-pane eus-ct-pane" aria-label="CT correlate">
      <header className="eus-pane-header">
        <div>
          <span className="eus-eyebrow">CT correlate</span>
          <h2>{shown.title}</h2>
        </div>
        {viewSwitch}
      </header>
      <div className="eus-segmented eus-ct-planes" role="group" aria-label="CT plane">
        {PLANES.map((entry) => (
          <button
            key={entry.key}
            type="button"
            aria-pressed={plane === entry.key}
            onClick={() => onPlane(entry.key)}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <div className={`eus-ct-image eus-ct-image--${plane}`}>
        <canvas ref={canvas} aria-label={shown.title} />
        {plane === 'scan' && (
          <>
            <span className="eus-image-mark eus-image-mark--left">Distal</span>
            <span className="eus-image-mark eus-image-mark--right">Proximal</span>
          </>
        )}
        {!ct && (
          <div className="eus-image-message" role={loadError ? 'alert' : 'status'}>
            {loadError ? 'The CT could not be loaded. Reload the page to retry.' : 'Loading the CT…'}
          </div>
        )}
      </div>
      <p className="eus-pane-caption">{shown.caption}</p>
      {ct && paintedShown && <p className="eus-note">{EUS_PAINTED_CT_NOTE}</p>}
    </section>
  );
}
