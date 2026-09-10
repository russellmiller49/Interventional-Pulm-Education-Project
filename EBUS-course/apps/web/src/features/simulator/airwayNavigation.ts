import * as THREE from 'three';

import { nearestSOnPolyline } from './channelExtent';
import { pointAtS, type SimulatorProbePose } from './pose';
import type {
  SimulatorCaseManifest,
  SimulatorCenterlinePolyline,
  SimulatorPreset,
} from './types';

export type SimulatorAirwaySide = 'left' | 'right';
export type SimulatorAirwayRegion = 'trachea' | 'left-mainstem' | 'right-mainstem';

export interface SimulatorAirwayNavigationModel {
  carinaSMm: number;
  leftLineIndex: number;
  rightLineIndex: number;
}

export interface SimulatorAirwaySelection {
  distanceMm: number;
  lineIndex: number;
  sMm: number;
}

// Web case coordinates are x=left, y=superior, z=anterior. These small view offsets were
// calibrated against the supplied reference views after the patient-anterior direction is put
// at the top of the optical frame. The mainstem offsets produce the familiar RUL/bronchus
// intermedius and LUL/LLL arrangements without making the learner manage a raw roll angle.
const WEB_ANTERIOR = new THREE.Vector3(0, 0, 1);
const TRACHEA_REFERENCE_S_MM = 99;
const STANDARD_VIEW_OFFSET_DEG = {
  trachea: 3,
  leftMainstem: -47,
  rightMainstem: 46,
} as const;
const MAINSTEM_REFERENCE_S_MM = {
  left: 160,
  right: 120,
} as const;

function clamp01(value: number) {
  return Math.min(Math.max(value, 0), 1);
}

function smoothstep01(value: number) {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

export function normalizeAirwayRollDeg(value: number): number {
  const wrapped = ((value + 180) % 360 + 360) % 360 - 180;
  return Object.is(wrapped, -0) ? 0 : wrapped;
}

/**
 * Synthetic navigation preset for free drive on a centerline. The contact point remains on the
 * centerline, so the scope travels in the lumen instead of inheriting a station-wall offset.
 */
export function freeDrivePresetForLine(polyline: SimulatorCenterlinePolyline): SimulatorPreset {
  const origin = polyline.points[0] ?? [0, 0, 0];
  const distalEnd = polyline.points[polyline.points.length - 1] ?? origin;

  return {
    approach: 'free_drive',
    centerline_s_mm: 0,
    contact: origin,
    contact_to_target_distance_mm: 0,
    label: 'Free drive',
    line_index: polyline.line_index,
    node: '',
    preset_id: 'free_drive',
    preset_key: `free_drive::${polyline.line_index}`,
    station: '',
    station_key: '',
    target: distalEnd,
    target_lps: [0, 0, 0],
    vessel_overlays: [],
  };
}

function lineByIndex(
  polylines: SimulatorCenterlinePolyline[],
  lineIndex: number,
): SimulatorCenterlinePolyline | null {
  return polylines.find((polyline) => polyline.line_index === lineIndex) ?? null;
}

function fallbackRightLine(
  polylines: SimulatorCenterlinePolyline[],
  leftLine: SimulatorCenterlinePolyline,
) {
  const rootX = leftLine.points[0]?.[0] ?? 0;

  return (
    [...polylines]
      .filter((polyline) => polyline.total_length_mm >= 20)
      .sort(
        (a, b) =>
          (a.points[a.points.length - 1]?.[0] ?? rootX) -
          (b.points[b.points.length - 1]?.[0] ?? rootX),
      )[0] ??
    leftLine
  );
}

/** Locate the first meaningful separation between the canonical left and right root-to-leaf paths. */
export function findCarinaSMm(
  leftLine: SimulatorCenterlinePolyline,
  rightLine: SimulatorCenterlinePolyline,
  divergenceMm = 3,
): number {
  const maximum = Math.min(leftLine.total_length_mm, rightLine.total_length_mm);

  for (let sMm = 0; sMm <= maximum; sMm += 0.5) {
    if (pointAtS(leftLine, sMm).distanceTo(pointAtS(rightLine, sMm)) >= divergenceMm) {
      return sMm;
    }
  }

  return maximum;
}

/** Resolve the two learner-facing carinal choices without exposing raw centerline indices. */
export function resolveAirwayNavigationModel(
  caseData: SimulatorCaseManifest,
  polylines: SimulatorCenterlinePolyline[],
): SimulatorAirwayNavigationModel {
  const leftLine =
    lineByIndex(polylines, caseData.navigation.primary_line_index) ?? polylines[0];

  if (!leftLine) {
    return { carinaSMm: 0, leftLineIndex: 0, rightLineIndex: 0 };
  }

  const rmsPreset = caseData.presets.find(
    (preset) => preset.approach.trim().toLowerCase() === 'rms',
  );
  const rightLine =
    (rmsPreset ? lineByIndex(polylines, rmsPreset.line_index) : null) ??
    fallbackRightLine(polylines, leftLine);

  return {
    carinaSMm: findCarinaSMm(leftLine, rightLine),
    leftLineIndex: leftLine.line_index,
    rightLineIndex: rightLine.line_index,
  };
}

/**
 * Map the current world-space scope position onto an explicitly chosen airway. This avoids the
 * old same-slice jump, which could teleport the scope when the two paths had already diverged.
 */
export function projectToAirway(
  polylines: SimulatorCenterlinePolyline[],
  currentLine: SimulatorCenterlinePolyline,
  currentSMm: number,
  targetLineIndex: number,
): SimulatorAirwaySelection | null {
  const targetLine = lineByIndex(polylines, targetLineIndex);

  if (!targetLine) {
    return null;
  }

  const nearest = nearestSOnPolyline(targetLine, pointAtS(currentLine, currentSMm));
  return { lineIndex: targetLine.line_index, sMm: nearest.sMm, distanceMm: nearest.distanceMm };
}

export function airwaySideForLine(
  model: SimulatorAirwayNavigationModel,
  polyline: SimulatorCenterlinePolyline,
): SimulatorAirwaySide {
  if (polyline.line_index === model.rightLineIndex) {
    return 'right';
  }
  if (polyline.line_index === model.leftLineIndex) {
    return 'left';
  }

  // Every exported route starts at the trachea. In web coordinates, a negative endpoint delta
  // travels toward the patient's right and a positive delta toward the patient's left.
  const rootX = polyline.points[0]?.[0] ?? 0;
  const distalX = polyline.points[polyline.points.length - 1]?.[0] ?? rootX;
  return distalX < rootX ? 'right' : 'left';
}

export function airwayRegionAtPose(
  model: SimulatorAirwayNavigationModel,
  polyline: SimulatorCenterlinePolyline,
  sMm: number,
): SimulatorAirwayRegion {
  if (sMm < model.carinaSMm) {
    return 'trachea';
  }

  return airwaySideForLine(model, polyline) === 'right' ? 'right-mainstem' : 'left-mainstem';
}

/** Roll needed to place the patient's anterior direction at the top of an unflexed scope frame. */
export function anteriorUpRollDeg(unrolledPose: SimulatorProbePose): number {
  const shaft = unrolledPose.tangent.clone().normalize();
  const anterior = WEB_ANTERIOR.clone().addScaledVector(shaft, -WEB_ANTERIOR.dot(shaft));

  if (anterior.lengthSq() < 1e-8) {
    return 0;
  }

  anterior.normalize();
  return normalizeAirwayRollDeg(
    THREE.MathUtils.radToDeg(
      Math.atan2(
        anterior.dot(unrolledPose.lateralAxis),
        anterior.dot(unrolledPose.depthAxis),
      ),
    ),
  );
}

/**
 * Standard learner view: anterior-up in the trachea, then a smooth transition to the conventional
 * mainstem layouts from the supplied clinical reference views. The result remains position-aware
 * instead of assigning one brittle roll value to an entire curved route.
 */
export function standardAirwayRollDeg(
  model: SimulatorAirwayNavigationModel,
  polyline: SimulatorCenterlinePolyline,
  sMm: number,
  unrolledPose: SimulatorProbePose,
): number {
  const side = airwaySideForLine(model, polyline);
  const targetSMm = MAINSTEM_REFERENCE_S_MM[side];
  const targetOffset =
    side === 'right'
      ? STANDARD_VIEW_OFFSET_DEG.rightMainstem
      : STANDARD_VIEW_OFFSET_DEG.leftMainstem;
  const transition = smoothstep01(
    (sMm - TRACHEA_REFERENCE_S_MM) / Math.max(targetSMm - TRACHEA_REFERENCE_S_MM, 1),
  );
  const offset =
    STANDARD_VIEW_OFFSET_DEG.trachea +
    (targetOffset - STANDARD_VIEW_OFFSET_DEG.trachea) * transition;

  return normalizeAirwayRollDeg(anteriorUpRollDeg(unrolledPose) + offset);
}
