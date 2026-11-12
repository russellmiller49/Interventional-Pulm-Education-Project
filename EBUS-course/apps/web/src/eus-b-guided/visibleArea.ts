import type { AcousticControls, AcousticPose } from '@bronchoscopy-core/acoustic';

import {
  DEFAULT_EUS_CONTROLS,
  eusLabelAt,
  sectorGeometry,
  type EusAcousticFrame,
} from '@/features/eus-b-simulator/eusAcoustic';
import { computeEusPose } from '@/features/eus-b-simulator/eusPose';
import type {
  EusAcousticVolume,
  EusCaseManifest,
  EusScopePath,
  EusScopeState,
} from '@/features/eus-b-simulator/types';

/** What the area check reads from a frame: the label under each pixel and how it was drawn. */
export type LabelFrame = Pick<EusAcousticFrame, 'labelImage' | 'width' | 'height' | 'controls'>;

/** Reference views are measured on the small frame the simulator's own find rule uses. */
export const REFERENCE_FRAME_SIZE = 192;

/**
 * Labels the beam does not pass: air in any lumen, and bone. Read from the case's own label
 * table, by tissue class, so a rebuilt case cannot leave this list behind.
 */
export function blockingLabelIds(volume: EusAcousticVolume): number[] {
  return volume.metadata.labels
    .filter((label) => label.medium === 'air' || label.medium === 'bone')
    .map((label) => label.id);
}

/**
 * Area of one structure that the beam actually reaches, in mm² of the scan plane.
 *
 * The simulator's find rule counts every pixel of the structure in the sector, including tissue
 * that lies behind air or bone and so cannot be seen. Here each beam is followed out from the
 * transducer and the count stops at the first air or bone it meets. Where nothing blocks the
 * beam the two measures are the same.
 */
export function visibleAreaMm2(
  frame: LabelFrame,
  labelId: number,
  blockingIds: readonly number[],
): number {
  const { labelImage, width, height, controls } = frame;
  const { halfAngle, radius, apexX, apexY } = sectorGeometry(
    width,
    height,
    controls.sectorAngleDeg,
  );
  // One bin per pixel of arc at the far edge of the sector.
  const bins = Math.max(8, Math.ceil(2 * halfAngle * radius));
  const binOf = (angle: number) =>
    Math.min(bins - 1, Math.max(0, Math.floor(((angle + halfAngle) / (2 * halfAngle)) * bins)));
  // In the label image 0 is outside the sector and 255 stands for label 0 inside it.
  const blocking = new Uint8Array(256);
  for (const id of blockingIds) blocking[id === 0 ? 255 : id] = 1;
  const target = labelId === 0 ? 255 : labelId;

  // Nearest blocking tissue along each beam direction. A near pixel spans several directions.
  const blockedFrom = new Float32Array(bins).fill(Infinity);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const raw = labelImage[y * width + x];
      if (raw === 0 || !blocking[raw]) continue;
      const px = x - apexX,
        py = y - apexY,
        distance = Math.hypot(px, py),
        angle = Math.atan2(px, py),
        halfWidth = distance > 0.5 ? 0.5 / distance : halfAngle;
      const near = Math.max(0, distance - 0.5);
      for (let bin = binOf(angle - halfWidth); bin <= binOf(angle + halfWidth); bin++)
        if (near < blockedFrom[bin]) blockedFrom[bin] = near;
    }

  let count = 0;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      if (labelImage[y * width + x] !== target) continue;
      const px = x - apexX,
        py = y - apexY;
      if (Math.hypot(px, py) < blockedFrom[binOf(Math.atan2(px, py))]) count++;
    }
  return count * (controls.depthMm / radius) ** 2;
}

/**
 * The label under every pixel of the image for a transducer position, without drawing the image.
 * It is the same label pass the renderer makes, so the two agree pixel for pixel.
 */
export function labelFrame(
  volume: EusAcousticVolume,
  pose: AcousticPose,
  controls: AcousticControls,
  width = REFERENCE_FRAME_SIZE,
  height = REFERENCE_FRAME_SIZE,
): LabelFrame {
  const { halfAngle, radius, apexX, apexY } = sectorGeometry(
    width,
    height,
    controls.sectorAngleDeg,
  );
  const labelImage = new Uint8Array(width * height),
    mmPerPixel = controls.depthMm / radius,
    origin = pose.originLps,
    depthAxis = pose.depthAxisLps,
    lateralAxis = pose.lateralAxisLps;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const px = x - apexX,
        py = y - apexY;
      if (py < 0 || Math.hypot(px, py) / radius > 1 || Math.abs(Math.atan2(px, py)) > halfAngle)
        continue;
      const along = py * mmPerPixel,
        across = px * mmPerPixel;
      const id = eusLabelAt(
        volume,
        origin[0] + depthAxis[0] * along + lateralAxis[0] * across,
        origin[1] + depthAxis[1] * along + lateralAxis[1] * across,
        origin[2] + depthAxis[2] * along + lateralAxis[2] * across,
      );
      labelImage[y * width + x] = id === 0 ? 255 : id;
    }
  return { labelImage, width, height, controls };
}

/** The label image for a scope position at the case's default depth. */
export function labelFrameAt(
  volume: EusAcousticVolume,
  path: EusScopePath,
  manifest: EusCaseManifest,
  scope: EusScopeState,
  size = REFERENCE_FRAME_SIZE,
): LabelFrame {
  const pose = computeEusPose(path, scope);
  return labelFrame(
    volume,
    {
      originLps: pose.originLps,
      depthAxisLps: pose.depthAxisLps,
      lateralAxisLps: pose.lateralAxisLps,
    },
    {
      ...DEFAULT_EUS_CONTROLS,
      depthMm: manifest.probe.defaultDepthMm,
      sectorAngleDeg: manifest.probe.sectorAngleDeg,
    },
    size,
    size,
  );
}

/** Area of a target the beam reaches in its own reference view, at the default depth. */
export function referenceVisibleAreaMm2(
  volume: EusAcousticVolume,
  path: EusScopePath,
  manifest: EusCaseManifest,
  referencePose: EusScopeState,
  labelId: number,
  blockingIds: readonly number[] = blockingLabelIds(volume),
): number {
  return visibleAreaMm2(
    labelFrameAt(volume, path, manifest, referencePose),
    labelId,
    blockingIds,
  );
}

/** Target area the beam reaches in a frame, over its area in the reference view. */
export function targetAreaRatio(
  frame: LabelFrame,
  labelId: number,
  referenceMm2: number,
  blockingIds: readonly number[],
): number {
  if (!(referenceMm2 > 0)) return 0;
  return visibleAreaMm2(frame, labelId, blockingIds) / referenceMm2;
}

/** Named structures in a frame with their share of the image, largest first. */
export function structuresInView(
  frame: Pick<EusAcousticFrame, 'labelImage' | 'structures'>,
  volume: EusAcousticVolume,
  limit = 12,
): { key: string; fraction: number }[] {
  let sector = 0;
  for (let i = 0; i < frame.labelImage.length; i++) if (frame.labelImage[i] !== 0) sector++;
  if (sector === 0) return [];
  return [...frame.structures]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((entry) => ({
      key: volume.metadata.labels[entry.id].key,
      fraction: Math.min(1, entry.count / sector),
    }));
}
