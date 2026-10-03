import { useEffect, useRef, useState } from 'react';
import type { Point3 } from '@bronchoscopy-core/frame';

import { eusLabelAt, sectorGeometry } from './eusAcoustic';
import type { EusPose } from './eusPose';
import type { EusLabelColors } from './EusSectorView';
import type { EusAcousticVolume, EusCtVolume } from './types';

const PLANE_SIZE = 384;
const AXIAL_WIDTH = 384;

type CtMode = 'plane' | 'axial';

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

function tint(data: Uint8ClampedArray, offset: number, gray: number, color: [number, number, number] | null) {
  if (color) {
    data[offset] = gray * 0.55 + color[0] * 0.45;
    data[offset + 1] = gray * 0.55 + color[1] * 0.45;
    data[offset + 2] = gray * 0.55 + color[2] * 0.45;
  } else {
    data[offset] = gray;
    data[offset + 1] = gray;
    data[offset + 2] = gray;
  }
  data[offset + 3] = 255;
}

interface EusCtViewProps {
  ct: EusCtVolume | null;
  volume: EusAcousticVolume;
  pose: EusPose;
  depthMm: number;
  sectorAngleDeg: number;
  labelColors: EusLabelColors;
  showColors: boolean;
}

export function EusCtView({
  ct,
  volume,
  pose,
  depthMm,
  sectorAngleDeg,
  labelColors,
  showColors,
}: EusCtViewProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<CtMode>('plane');

  useEffect(() => {
    const element = canvas.current;
    if (!element || !ct) return;
    const context = element.getContext('2d');
    if (!context) return;
    const origin = pose.originLps,
      depth = pose.depthAxisLps,
      lateral = pose.lateralAxisLps;

    if (mode === 'plane') {
      // The CT resliced in the ultrasound plane, drawn with the same sector layout.
      element.width = PLANE_SIZE;
      element.height = PLANE_SIZE;
      const image = context.createImageData(PLANE_SIZE, PLANE_SIZE);
      const { halfAngle, radius, apexX, apexY } = sectorGeometry(PLANE_SIZE, PLANE_SIZE, sectorAngleDeg);
      for (let y = 0; y < PLANE_SIZE; y++)
        for (let x = 0; x < PLANE_SIZE; x++) {
          const offset = (y * PLANE_SIZE + x) * 4,
            px = x - apexX,
            py = y - apexY,
            angle = Math.atan2(px, py),
            distance = Math.hypot(px, py) / radius;
          image.data[offset + 3] = 255;
          if (py < 0 || distance > 1 || Math.abs(angle) > halfAngle) continue;
          const r = distance * depthMm,
            c = Math.cos(angle) * r,
            s = Math.sin(angle) * r;
          const lx = origin[0] + depth[0] * c + lateral[0] * s,
            ly = origin[1] + depth[1] * c + lateral[1] * s,
            lz = origin[2] + depth[2] * c + lateral[2] * s;
          const color = showColors ? labelColors[eusLabelAt(volume, lx, ly, lz)] : null;
          tint(image.data, offset, sampleCt(ct, lx, ly, lz), color);
        }
      context.putImageData(image, 0, 0);
      return;
    }

    // Axial slice at the transducer, radiological orientation: patient's left on image right.
    const { sizeXyz, spacingXyzMm, originLps } = ct.asset;
    const extentL = (sizeXyz[0] - 1) * spacingXyzMm[0],
      extentP = (sizeXyz[1] - 1) * spacingXyzMm[1];
    const width = AXIAL_WIDTH,
      height = Math.round((AXIAL_WIDTH * extentP) / extentL);
    element.width = width;
    element.height = height;
    const image = context.createImageData(width, height);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const lx = originLps[0] + (x / (width - 1)) * extentL,
          ly = originLps[1] + (y / (height - 1)) * extentP;
        const color = showColors ? labelColors[eusLabelAt(volume, lx, ly, origin[2])] : null;
        tint(image.data, (y * width + x) * 4, sampleCt(ct, lx, ly, origin[2]), color);
      }
    context.putImageData(image, 0, 0);
    const toPixel = (point: Point3): [number, number] => [
      ((point[0] - originLps[0]) / extentL) * (width - 1),
      ((point[1] - originLps[1]) / extentP) * (height - 1),
    ];
    // The sector projected onto this slice. Where the scan plane is near vertical it is a line.
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
          origin[2],
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
    context.arc(ox, oy, 4, 0, Math.PI * 2);
    context.fillStyle = '#ffd166';
    context.fill();
    context.font = '600 12px system-ui';
    context.fillStyle = '#dce3e8';
    context.fillText('R', 8, height / 2);
    context.fillText('L', width - 16, height / 2);
    context.fillText('A', width / 2 - 4, 16);
    context.fillText('P', width / 2 - 4, height - 8);
  }, [ct, volume, pose, depthMm, sectorAngleDeg, labelColors, showColors, mode]);

  return (
    <section className="eus-pane eus-ct-pane" aria-label="CT correlate">
      <header className="eus-pane-header">
        <div>
          <span className="eus-eyebrow">CT correlate</span>
          <h2>{mode === 'plane' ? 'CT in the scan plane' : 'Axial CT at the transducer'}</h2>
        </div>
        <div className="eus-segmented" role="group" aria-label="CT view">
          <button type="button" aria-pressed={mode === 'plane'} onClick={() => setMode('plane')}>
            Scan plane
          </button>
          <button type="button" aria-pressed={mode === 'axial'} onClick={() => setMode('axial')}>
            Axial
          </button>
        </div>
      </header>
      <div className={`eus-ct-image eus-ct-image--${mode}`}>
        <canvas
          ref={canvas}
          aria-label={
            mode === 'plane'
              ? 'CT resliced in the ultrasound scan plane'
              : 'Axial CT slice at the transducer with the scan plane marked'
          }
        />
        {mode === 'plane' && (
          <>
            <span className="eus-image-mark eus-image-mark--left">Distal</span>
            <span className="eus-image-mark eus-image-mark--right">Proximal</span>
          </>
        )}
        {!ct && (
          <div className="eus-image-message" role="status">
            Loading the CT…
          </div>
        )}
      </div>
      <p className="eus-pane-caption">
        {mode === 'plane'
          ? 'The same plane and sector as the ultrasound image, cut from the CT.'
          : 'The yellow dot is the transducer. The blue shape is the ultrasound sector projected onto this slice: a line when the scan plane is vertical.'}
      </p>
    </section>
  );
}
