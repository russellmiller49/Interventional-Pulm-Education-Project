import { minus, plus, rotate, scalar, times, unit, vector, type Point3 } from '@bronchoscopy-core/frame';

import type { EusScopePath, EusScopeState } from './types';

export const ROLL_MIN_DEG = -180;
export const ROLL_MAX_DEG = 180;
export const FLEX_MIN_DEG = -45;
export const FLEX_MAX_DEG = 45;

export interface EusPose {
  /** Path point at the current insertion depth, inside the lumen. */
  centerLps: Point3;
  /** Transducer face: the path point moved onto the wall the transducer faces. */
  originLps: Point3;
  /** Distal shaft direction after tip angulation. */
  shaftAxisLps: Point3;
  /** Center beam direction. */
  depthAxisLps: Point3;
  /** Image-right direction: toward the operator (proximal), the side the needle would enter from. */
  lateralAxisLps: Point3;
  /** Normal of the scan plane. */
  planeNormalLps: Point3;
  contactMm: number;
  region: 'esophagus' | 'stomach';
}

export const clamp = (value: number, low: number, high: number) =>
  Math.min(Math.max(value, low), high);

/** Roll wrapped into (-180, 180], so the control never shows 190 for what is -170. */
export function normalizeRollDeg(rollDeg: number) {
  const wrapped = ((((rollDeg + 180) % 360) + 360) % 360) - 180;
  return wrapped === -180 ? 180 : wrapped;
}

function mix(a: Point3, b: Point3, t: number): Point3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function sampleIndex(path: EusScopePath, sMm: number) {
  const position = clamp(sMm, 0, path.totalLengthMm) / path.stepMm;
  const lower = Math.min(Math.floor(position), path.pointsLps.length - 1);
  const upper = Math.min(lower + 1, path.pointsLps.length - 1);
  return { lower, upper, t: position - lower };
}

/** Path-to-contact distance, interpolated along the path and around the roll circle. */
export function wallContactMm(path: EusScopePath, sMm: number, rollDeg: number) {
  const { lower, upper, t } = sampleIndex(path, sMm);
  const steps = path.wallMm[0].length;
  const position = ((((rollDeg % 360) + 360) % 360) / path.wallStepDeg) % steps;
  const a = Math.floor(position) % steps;
  const b = (a + 1) % steps;
  const f = position - Math.floor(position);
  const at = (row: number) => path.wallMm[row][a] * (1 - f) + path.wallMm[row][b] * f;
  return at(lower) * (1 - t) + at(upper) * t;
}

/**
 * Scope pose for an insertion depth, shaft rotation and tip angulation.
 *
 * Roll follows the EBUS simulator: a positive angle turns the transducer clockwise as the operator
 * sees it, looking along the insertion direction. In a supine patient that is from anterior toward
 * the patient's right. Zero roll is the transported reference axis, which faces anterior at the
 * top of the esophagus and stays twist-free along the path.
 */
export function computeEusPose(path: EusScopePath, state: EusScopeState): EusPose {
  const sMm = clamp(state.sMm, 0, path.totalLengthMm);
  const { lower, upper, t } = sampleIndex(path, sMm);
  const centerLps = mix(path.pointsLps[lower], path.pointsLps[upper], t);
  const tangent = unit(mix(path.tangentsLps[lower], path.tangentsLps[upper], t));
  const blended = mix(path.refAxesLps[lower], path.refAxesLps[upper], t);
  const reference = unit(minus(blended, times(tangent, scalar(blended, tangent))));
  const facing = unit(rotate(reference, tangent, (state.rollDeg * Math.PI) / 180));
  const contactMm = wallContactMm(path, sMm, state.rollDeg);
  const originLps = plus(centerLps, times(facing, contactMm));

  // Tip angulation turns the distal frame within the scan plane, about the transducer face.
  const flex = (clamp(state.flexDeg, FLEX_MIN_DEG, FLEX_MAX_DEG) * Math.PI) / 180;
  const shaftAxisLps = unit(plus(times(tangent, Math.cos(flex)), times(facing, Math.sin(flex))));
  const depthAxisLps = unit(minus(times(facing, Math.cos(flex)), times(tangent, Math.sin(flex))));
  const lateralAxisLps = times(shaftAxisLps, -1);

  return {
    centerLps,
    originLps,
    shaftAxisLps,
    depthAxisLps,
    lateralAxisLps,
    planeNormalLps: unit(vector(depthAxisLps, lateralAxisLps)),
    contactMm,
    region: sMm > path.gejSMm ? 'stomach' : 'esophagus',
  };
}

const FACING_TERMS: Array<[string, string]> = [
  ['left', 'right'],
  ['posterior', 'anterior'],
  ['cranial', 'caudal'],
];

/**
 * Plain anatomical description of where the center beam points, from the pose itself rather than
 * the roll number, so it stays true once the path turns into the stomach.
 */
export function describeFacing(depthAxisLps: Point3): string {
  const parts = depthAxisLps
    .map((value, axis) => ({ value, term: FACING_TERMS[axis][value >= 0 ? 0 : 1] }))
    .filter((part) => Math.abs(part.value) >= 0.38)
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  return parts.map((part) => part.term).join(', ');
}

/** Estimated scope depth at the incisors. The offset is a stated estimate in the case manifest. */
export function insertionDepthCm(sMm: number, incisorOffsetMm: number) {
  return (sMm + incisorOffsetMm) / 10;
}

/** Length of distal shaft that bends off the path to bring the transducer onto the wall. */
const SHAFT_BEND_MM = 28;

/** Path point at an insertion depth, in the middle of the lumen. */
export function pathCenterAt(path: EusScopePath, sMm: number): Point3 {
  const { lower, upper, t } = sampleIndex(path, sMm);
  return mix(path.pointsLps[lower], path.pointsLps[upper], t);
}

/**
 * Point on the scope shaft `atMm` along the path, for a scope whose transducer is at `sMm`. The
 * shaft follows the path and bends onto the wall over its last few centimetres.
 */
export function scopeShaftPointAt(path: EusScopePath, pose: EusPose, sMm: number, atMm: number): Point3 {
  const end = clamp(sMm, 0, path.totalLengthMm);
  const blend = clamp(1 - (end - atMm) / SHAFT_BEND_MM, 0, 1);
  return plus(
    pathCenterAt(path, atMm),
    times(minus(pose.originLps, pose.centerLps), blend * blend * (3 - 2 * blend)),
  );
}

/** Scope shaft polyline from the top of the path to the transducer, bending onto the wall. */
export function scopeShaftPolyline(path: EusScopePath, pose: EusPose, sMm: number): Point3[] {
  const points: Point3[] = [];
  const end = clamp(sMm, 0, path.totalLengthMm);
  for (let at = 0; at < end; at += 4) points.push(scopeShaftPointAt(path, pose, sMm, at));
  points.push(scopeShaftPointAt(path, pose, sMm, end));
  return points;
}
