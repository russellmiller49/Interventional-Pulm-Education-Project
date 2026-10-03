import { DEFAULT_EUS_CONTROLS, renderEusFrame, sectorGeometry, type EusAcousticFrame } from './eusAcoustic';
import { computeEusPose } from './eusPose';
import type { EusAcousticVolume, EusCaseManifest, EusLandmarkPose, EusScopePath } from './types';

/** Share of the reference view's target area that counts as holding the target in the image. */
export const FIND_AREA_FRACTION = 0.4;
/** How long the target must stay in the image before the round ends. */
export const FIND_HOLD_MS = 1000;
/** Where every round begins: high in the esophagus, facing anterior. */
export const FIND_START = { sMm: 20, rollDeg: 0, flexDeg: 0 };

/** Area of one label in a frame, in mm² of the scan plane, so depth changes do not move the bar. */
export function structureAreaMm2(frame: EusAcousticFrame, labelId: number) {
  const structure = frame.structures.find((entry) => entry.id === labelId);
  if (!structure) return 0;
  const { radius } = sectorGeometry(frame.width, frame.height, frame.controls.sectorAngleDeg);
  return structure.count * (frame.controls.depthMm / radius) ** 2;
}

/** Target area in the calibrated reference view, rendered once when a round starts. */
export function referenceAreaMm2(
  volume: EusAcousticVolume,
  path: EusScopePath,
  manifest: EusCaseManifest,
  landmark: EusLandmarkPose,
  labelId: number,
) {
  const pose = computeEusPose(path, landmark);
  const frame = renderEusFrame(
    volume,
    { originLps: pose.originLps, depthAxisLps: pose.depthAxisLps, lateralAxisLps: pose.lateralAxisLps },
    {
      ...DEFAULT_EUS_CONTROLS,
      depthMm: manifest.probe.defaultDepthMm,
      sectorAngleDeg: manifest.probe.sectorAngleDeg,
    },
    192,
    192,
    96,
    160,
  );
  return structureAreaMm2(frame, labelId);
}

export function targetHeld(frame: EusAcousticFrame, labelId: number, referenceMm2: number) {
  return referenceMm2 > 0 && structureAreaMm2(frame, labelId) >= referenceMm2 * FIND_AREA_FRACTION;
}
