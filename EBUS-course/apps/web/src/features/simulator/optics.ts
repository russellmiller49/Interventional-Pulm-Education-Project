import * as THREE from 'three';

import {
  resolveCalibratedOpticalAxis,
  resolveOpticalImageUp,
  type SimulatorScopeFrame,
} from './pose';
import type { SimulatorEndoscopeCamera } from './types';

/**
 * Lens-model constants for the optical pane. `BronchoscopyView.tsx` injects these into its GLSL
 * (post shader + lumen material) via template strings, so the TS copies below are the single source
 * and stay unit-testable.
 *
 * Aperture radii are measured in image-height units (a radius of 1 touches the top and bottom
 * frame edges), which keeps the aperture circular at any aspect ratio.
 */
export const APERTURE_RADIUS = 0.98;
export const APERTURE_FEATHER = 0.07;
export const BARREL_K1 = 0.12;
export const BARREL_K2 = 0.04;
export const EDGE_BLUR_START_RADIUS = 0.55;
export const EDGE_BLUR_END_RADIUS = 1.05;
export const EDGE_BLUR_MAX_OFFSET_UV = 0.006;
export const HEADLIGHT_INNER_CONE_DEG = 16;
export const HEADLIGHT_OUTER_CONE_DEG = 50;
export const HEADLIGHT_FLOOR = 0.22;
/** Channel-wall opacity in see-through mode: low enough to read structures behind the wall,
 * high enough that the mucosa still shapes the image. */
export const WALL_SEE_THROUGH_ALPHA = 0.5;
/** Time constant of the distal contact cap's inflate/deflate ease. */
export const CAP_INFLATION_TAU_MS = 220;

/** Resolved lens-realism switches for the optical pane. Everything defaults off, so calibration
 * records without the flags render exactly as before. */
export interface SimulatorEndoscopeOptics {
  scopeTipOcclusion: boolean;
  contactCap: boolean;
  circularAperture: boolean;
  lensDistortion: boolean;
  headlightFalloff: boolean;
  /** Minimum camera-to-wall clearance along the optical axis; 0 disables the proximity clamp. */
  contactMinDistanceMm: number;
}

export function resolveEndoscopeOptics(camera: SimulatorEndoscopeCamera): SimulatorEndoscopeOptics {
  return {
    scopeTipOcclusion: camera.scope_tip_occlusion ?? false,
    contactCap: camera.contact_cap ?? false,
    circularAperture: camera.circular_aperture ?? false,
    lensDistortion: camera.lens_distortion ?? false,
    headlightFalloff: camera.headlight_falloff ?? false,
    contactMinDistanceMm: Math.max(0, camera.contact_min_distance_mm ?? 0),
  };
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge0 === edge1) {
    return x < edge0 ? 0 : 1;
  }

  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
  return t * t * (3 - 2 * t);
}

/**
 * Alpha of the circular aperture mask at normalized image coordinates (u, v in [0, 1], origin at
 * the lower-left corner): 1 inside the aperture, feathering to 0 at the calibrated radius.
 */
export function apertureMaskAlpha(
  u: number,
  v: number,
  aspect: number,
  radius = APERTURE_RADIUS,
  feather = APERTURE_FEATHER,
): number {
  const x = (u * 2 - 1) * aspect;
  const y = v * 2 - 1;
  return 1 - smoothstep(radius - feather, radius, Math.hypot(x, y));
}

/**
 * Brown–Conrady radial mapping from output-image coordinates to source-sample coordinates
 * (both u, v in [0, 1]). Positive coefficients push edge samples outward, which displays as mild
 * barrel distortion once the post shader samples the sharp frame through this mapping.
 */
export function barrelDistortUv(
  u: number,
  v: number,
  k1 = BARREL_K1,
  k2 = BARREL_K2,
): [number, number] {
  const x = u * 2 - 1;
  const y = v * 2 - 1;
  const r2 = x * x + y * y;
  const scale = 1 + k1 * r2 + k2 * r2 * r2;
  return [(x * scale + 1) / 2, (y * scale + 1) / 2];
}

/**
 * Cone gain of the camera headlight around the optical axis: 1 inside the inner cone, falling to 0
 * at the outer cone. `cosAngle` is the cosine of the angle between the optical axis and the
 * direction from the lens to the lit point.
 */
export function headlightConeGain(
  cosAngle: number,
  innerDeg = HEADLIGHT_INNER_CONE_DEG,
  outerDeg = HEADLIGHT_OUTER_CONE_DEG,
): number {
  const cosInner = Math.cos(THREE.MathUtils.degToRad(innerDeg));
  const cosOuter = Math.cos(THREE.MathUtils.degToRad(outerDeg));
  return smoothstep(cosOuter, cosInner, cosAngle);
}

/**
 * How far to pull the camera back along the optical axis so it keeps `clearanceMm` of free space
 * to the channel wall ahead. `distanceAheadMm` is the wall-hit distance measured from the desired
 * camera position (negative when the wall is already behind it); null means no wall within range.
 */
export function proximityPullbackMm(distanceAheadMm: number | null, clearanceMm: number): number {
  if (distanceAheadMm === null || clearanceMm <= 0) {
    return 0;
  }

  return Math.max(0, clearanceMm - distanceAheadMm);
}

/**
 * Clamped eye distance along the ray from the in-lumen anchor toward the desired camera position,
 * keeping `clearanceMm` of space to the channel wall. `wallHitDistanceMm` is the first wall hit
 * measured from the anchor (null when no wall is within range); `desiredDistanceMm` is where the
 * unclamped eye would sit. Keeps the optical camera inside the lumen even when the probe pose is
 * pressed into (or past) the channel wall.
 */
export function insideChannelEyeDistanceMm(
  wallHitDistanceMm: number | null,
  desiredDistanceMm: number,
  clearanceMm: number,
): number {
  if (wallHitDistanceMm === null || clearanceMm <= 0) {
    return desiredDistanceMm;
  }

  return Math.min(desiredDistanceMm, Math.max(0, wallHitDistanceMm - clearanceMm));
}

/**
 * One animation step of the distal contact cap's inflation state: an exponential approach from
 * `current` toward `target` (both in [0, 1]) over `dtMs` milliseconds with time constant `tauMs`.
 * Frame-rate independent, monotonic, and clamped to the target.
 */
export function approachInflation(
  current: number,
  target: number,
  dtMs: number,
  tauMs = CAP_INFLATION_TAU_MS,
): number {
  if (dtMs <= 0 || tauMs <= 0) {
    return current;
  }

  const blend = 1 - Math.exp(-dtMs / tauMs);
  const next = current + (target - current) * blend;
  return Math.min(Math.max(next, 0), 1);
}

/**
 * Screen-space direction (x right, y up, unit length) where the distal-tip hardware intrudes into
 * the optical view. The transducer sits ahead of the lens along the shaft, and the lens tilts away
 * from it toward the scan side, so the intrusion direction is the on-screen projection of the
 * shaft axis — the bottom of the frame under the "image up faces the scan side" orientation.
 * Constant for a given calibration record because the camera orientation is built from the same
 * scope frame every frame, so it is computed once against a canonical frame.
 */
export function distalTipScreenDirection(camera: SimulatorEndoscopeCamera): [number, number] {
  const frame: SimulatorScopeFrame = {
    position: new THREE.Vector3(),
    shaftAxis: new THREE.Vector3(0, 1, 0),
    depthAxis: new THREE.Vector3(0, 0, 1),
    lateralAxis: new THREE.Vector3(1, 0, 0),
  };
  // Mirror the render loop's camera setup: look along the calibrated optical axis with the
  // obliquity-side image-up, then express the shaft axis in that camera basis.
  const zLocal = resolveCalibratedOpticalAxis(frame, camera).multiplyScalar(-1);
  const upLocal = resolveOpticalImageUp(frame, camera);
  const xLocal = new THREE.Vector3().crossVectors(upLocal, zLocal).normalize();
  const yLocal = new THREE.Vector3().crossVectors(zLocal, xLocal).normalize();
  const x = frame.shaftAxis.dot(xLocal);
  const y = frame.shaftAxis.dot(yLocal);
  const length = Math.hypot(x, y);

  if (length < 1e-6) {
    return [0, -1];
  }

  return [x / length, y / length];
}
