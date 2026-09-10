import * as THREE from 'three';

import type {
  SimulatorCenterlinePolyline,
  SimulatorEndoscopeCamera,
  SimulatorObliquityAxis,
  SimulatorPreset,
  Vec3,
} from './types';

export interface SimulatorProbePose {
  position: THREE.Vector3;
  tangent: THREE.Vector3;
  depthAxis: THREE.Vector3;
  lateralAxis: THREE.Vector3;
  /**
   * Centerline point at the pose's path parameter, before the wall-contact radial offset is
   * applied to `position`. Guaranteed to lie inside the channel, so views can use it as a safe
   * anchor when clamping a camera eye back inside the lumen. Optional so hand-built poses keep
   * working.
   */
  centerlinePosition?: THREE.Vector3;
  /**
   * True when the pose sits at the active preset's station snap point (same centerline, within
   * 1mm of the preset's path parameter) — the moment the tip is pressed on the station contact.
   * Views use it to switch tip state (e.g. inflate the distal contact cap). Optional so
   * hand-built poses keep working.
   */
  atStationSnap?: boolean;
}

/**
 * Orthonormal scope pose frame with device-facing axis names: `shaftAxis` is the advance direction
 * (`tangent`), `depthAxis` points toward the scan side, `lateralAxis` is the in-image lateral.
 */
export interface SimulatorScopeFrame {
  position: THREE.Vector3;
  shaftAxis: THREE.Vector3;
  depthAxis: THREE.Vector3;
  lateralAxis: THREE.Vector3;
}

export function resolveScopeFrame(pose: SimulatorProbePose): SimulatorScopeFrame {
  return {
    position: pose.position.clone(),
    shaftAxis: pose.tangent.clone().normalize(),
    depthAxis: pose.depthAxis.clone().normalize(),
    lateralAxis: pose.lateralAxis.clone().normalize(),
  };
}

/**
 * Default device profile for the endoscopic optical camera (`bf_uc180f`). The manifest's
 * `endoscope_camera` record is the source of truth; this is only the fallback for manifests that
 * predate the calibration record, and matches the Phase-1 constants.
 */
export const DEFAULT_ENDOSCOPE_CAMERA: SimulatorEndoscopeCamera = {
  model: 'bf_uc180f',
  optical_axis_offset_deg: 30,
  obliquity_axis: 'depth_axis',
  fov_deg: 85,
  near_mm: 0.4,
  far_mm: 4000,
  eye_offset_mm: { shaft: 0, depth: 0, lateral: 0 },
};

/**
 * Merge a manifest `endoscope_camera` record over the default device profile. Manifests without
 * the record (or hand-edited ones missing fields) resolve to the Phase-1 defaults.
 */
export function resolveEndoscopeCameraCalibration(
  record?: Partial<SimulatorEndoscopeCamera> | null,
): SimulatorEndoscopeCamera {
  return {
    ...DEFAULT_ENDOSCOPE_CAMERA,
    ...(record ?? {}),
    eye_offset_mm: {
      ...DEFAULT_ENDOSCOPE_CAMERA.eye_offset_mm,
      ...(record?.eye_offset_mm ?? {}),
    },
  };
}

/** Unit vector for a named obliquity axis in the given scope frame. */
export function obliquityAxisDirection(
  frame: SimulatorScopeFrame,
  axis: SimulatorObliquityAxis,
): THREE.Vector3 {
  switch (axis) {
    case 'negative_depth_axis':
      return frame.depthAxis.clone().multiplyScalar(-1);
    case 'lateral_axis':
      return frame.lateralAxis.clone();
    case 'negative_lateral_axis':
      return frame.lateralAxis.clone().multiplyScalar(-1);
    case 'depth_axis':
    default:
      return frame.depthAxis.clone();
  }
}

/**
 * Optical view direction for a device-calibration record: the shaft axis rotated
 * `optical_axis_offset_deg` toward the calibrated obliquity axis. The axis choice (including its
 * sign) is calibratable — the scan side may need flipping after visual review against reference
 * video, so it is read from the record rather than hard-coded.
 */
export function resolveCalibratedOpticalAxis(
  frame: SimulatorScopeFrame,
  camera: SimulatorEndoscopeCamera,
): THREE.Vector3 {
  const theta = THREE.MathUtils.degToRad(camera.optical_axis_offset_deg);

  return frame.shaftAxis
    .clone()
    .multiplyScalar(Math.cos(theta))
    .add(obliquityAxisDirection(frame, camera.obliquity_axis).multiplyScalar(Math.sin(theta)))
    .normalize();
}

/**
 * Screen-up direction for the optical pane. On a forward-oblique tip the image is oriented with
 * "up" toward the calibrated obliquity (scan) side — the lens tilts that way, so the distal
 * transducer hardware ahead of it intrudes from the image bottom. Computed as the obliquity axis
 * projected perpendicular to the optical axis; falls back to the depth axis if the projection
 * degenerates (offset approaching 90 degrees).
 */
export function resolveOpticalImageUp(
  frame: SimulatorScopeFrame,
  camera: SimulatorEndoscopeCamera,
): THREE.Vector3 {
  const forward = resolveCalibratedOpticalAxis(frame, camera);
  const up = obliquityAxisDirection(frame, camera.obliquity_axis);
  up.addScaledVector(forward, -up.dot(forward));

  if (up.lengthSq() < 1e-8) {
    return frame.depthAxis.clone();
  }

  return up.normalize();
}

/**
 * Forward-oblique optical axis: the shaft axis rotated `offsetDeg` toward the scan side. Kept as a
 * convenience over `resolveCalibratedOpticalAxis` for callers that only vary the offset and the
 * depth-axis sign.
 */
export function resolveForwardObliqueOpticalAxis(
  frame: SimulatorScopeFrame,
  offsetDeg = 30,
  sign = 1,
): THREE.Vector3 {
  return resolveCalibratedOpticalAxis(frame, {
    ...DEFAULT_ENDOSCOPE_CAMERA,
    optical_axis_offset_deg: offsetDeg,
    obliquity_axis: sign >= 0 ? 'depth_axis' : 'negative_depth_axis',
  });
}

export function toVector(point: Vec3): THREE.Vector3 {
  return new THREE.Vector3(point[0], point[1], point[2]);
}

export function toTuple(vector: THREE.Vector3): Vec3 {
  return [vector.x, vector.y, vector.z];
}

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

export function pointAtS(polyline: SimulatorCenterlinePolyline, sMm: number): THREE.Vector3 {
  const points = polyline.points;
  const lengths = polyline.cumulative_lengths_mm;

  if (points.length === 0) {
    return new THREE.Vector3();
  }

  if (points.length === 1) {
    return toVector(points[0]);
  }

  const clamped = clamp(sMm, 0, polyline.total_length_mm);

  if (clamped <= 0) {
    return toVector(points[0]);
  }

  if (clamped >= polyline.total_length_mm) {
    return toVector(points[points.length - 1]);
  }

  let segmentIndex = 0;
  while (segmentIndex < lengths.length - 1 && lengths[segmentIndex + 1] < clamped) {
    segmentIndex += 1;
  }

  const startLength = lengths[segmentIndex] ?? 0;
  const endLength = lengths[segmentIndex + 1] ?? startLength;
  const t = endLength > startLength ? (clamped - startLength) / (endLength - startLength) : 0;

  return toVector(points[segmentIndex]).lerp(toVector(points[segmentIndex + 1]), t);
}

export function tangentAtS(polyline: SimulatorCenterlinePolyline, sMm: number): THREE.Vector3 {
  const windowMm = 5;
  const start = pointAtS(polyline, Math.max(0, sMm - windowMm));
  const end = pointAtS(polyline, Math.min(polyline.total_length_mm, sMm + windowMm));
  const tangent = end.sub(start);

  if (tangent.lengthSq() > 1e-8) {
    return tangent.normalize();
  }

  if (polyline.points.length >= 2) {
    return toVector(polyline.points[polyline.points.length - 1]).sub(toVector(polyline.points[0])).normalize();
  }

  return new THREE.Vector3(0, 1, 0);
}

function fallbackDepthAxis(tangent: THREE.Vector3): THREE.Vector3 {
  const candidates = [
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(0, 0, 1),
  ].sort((a, b) => Math.abs(a.dot(tangent)) - Math.abs(b.dot(tangent)));

  for (const candidate of candidates) {
    const projected = candidate.clone().sub(tangent.clone().multiplyScalar(candidate.dot(tangent)));

    if (projected.lengthSq() > 1e-8) {
      return projected.normalize();
    }
  }

  return new THREE.Vector3(0, 1, 0);
}

function normalizedVectorOrNull(point: Vec3 | null | undefined): THREE.Vector3 | null {
  if (!point) {
    return null;
  }

  const vector = toVector(point);
  return vector.lengthSq() > 1e-8 ? vector.normalize() : null;
}

// How far the distal tip translates toward the scan side at full 90-degree flexion — the chord of
// the scope's short bending section pressing the transducer onto the channel wall.
export const FLEXION_TIP_SHIFT_MM = 12;

export function computeSimulatorPose(
  polyline: SimulatorCenterlinePolyline,
  sMm: number,
  rollDeg: number,
  preset: SimulatorPreset,
  flexionDeg = 0,
): SimulatorProbePose {
  const centerlinePosition = pointAtS(polyline, sMm);
  let position = centerlinePosition.clone();
  let tangent = tangentAtS(polyline, sMm);
  const presetShaft = normalizedVectorOrNull(preset.shaft_axis);

  if (presetShaft && tangent.dot(presetShaft) < 0) {
    tangent.multiplyScalar(-1);
  }

  const atStationSnap = polyline.line_index === preset.line_index && Math.abs(sMm - preset.centerline_s_mm) <= 1;

  if (presetShaft && atStationSnap) {
    tangent = presetShaft;
  }

  if (polyline.line_index === preset.line_index) {
    const referenceCenterlinePosition = pointAtS(polyline, preset.centerline_s_mm);
    const radialOffset = toVector(preset.contact).sub(referenceCenterlinePosition);
    radialOffset.sub(tangent.clone().multiplyScalar(radialOffset.dot(tangent)));

    if (radialOffset.lengthSq() > 1e-8) {
      position = atStationSnap ? toVector(preset.contact) : centerlinePosition.clone().add(radialOffset);
    }
  }

  let depthAxis = normalizedVectorOrNull(preset.depth_axis) ?? toVector(preset.target).sub(position);
  depthAxis.sub(tangent.clone().multiplyScalar(depthAxis.dot(tangent)));

  if (depthAxis.lengthSq() <= 1e-8) {
    depthAxis = fallbackDepthAxis(tangent);
  } else {
    depthAxis.normalize();
  }

  if (toVector(preset.target).sub(position).dot(depthAxis) < 0) {
    depthAxis.multiplyScalar(-1);
  }

  depthAxis.applyAxisAngle(tangent, THREE.MathUtils.degToRad(rollDeg)).normalize();
  const lateralAxis = new THREE.Vector3().crossVectors(tangent, depthAxis).normalize();
  depthAxis = new THREE.Vector3().crossVectors(lateralAxis, tangent).normalize();

  // Tip flexion: the bending section rotates the distal frame about the lateral axis toward the
  // scan side and translates the tip toward the wall it is being pressed against. Applied after
  // roll, like the physical control order (rotate the shaft, then flex the lever).
  if (flexionDeg) {
    const flexRad = THREE.MathUtils.degToRad(clamp(flexionDeg, -90, 120));
    const cos = Math.cos(flexRad);
    const sin = Math.sin(flexRad);
    const preFlexTangent = tangent.clone();
    const preFlexDepthAxis = depthAxis.clone();
    tangent = preFlexTangent.clone().multiplyScalar(cos).addScaledVector(preFlexDepthAxis, sin).normalize();
    depthAxis = preFlexDepthAxis.clone().multiplyScalar(cos).addScaledVector(preFlexTangent, -sin).normalize();
    position = position.clone().addScaledVector(preFlexDepthAxis, sin * FLEXION_TIP_SHIFT_MM);
  }

  return { position, tangent, depthAxis, lateralAxis, centerlinePosition, atStationSnap };
}

export function cephalicImageAxis(pose: SimulatorProbePose): THREE.Vector3 {
  const webCephalicAxis = new THREE.Vector3(0, 1, 0);
  const axis = pose.tangent.clone().normalize();

  return axis.dot(webCephalicAxis) >= 0 ? axis : axis.multiplyScalar(-1);
}

export function sectorPlaneNormal(pose: SimulatorProbePose): THREE.Vector3 {
  const imageAxis = cephalicImageAxis(pose);
  return new THREE.Vector3().crossVectors(imageAxis, pose.depthAxis).normalize();
}

export function projectToSector(
  point: Vec3,
  pose: SimulatorProbePose,
  maxDepthMm: number,
  sectorAngleDeg: number,
  slabHalfThicknessMm = 4,
) {
  const offset = toVector(point).sub(pose.position);
  const imageAxis = cephalicImageAxis(pose);
  const planeNormal = sectorPlaneNormal(pose);
  const depthMm = offset.dot(pose.depthAxis);
  const lateralMm = offset.dot(imageAxis);
  const outOfPlaneMm = offset.dot(planeNormal);
  const halfWidth = Math.max(0, depthMm) * Math.tan(THREE.MathUtils.degToRad(sectorAngleDeg / 2));
  const inSectorPlane = depthMm >= 0 && depthMm <= maxDepthMm && Math.abs(lateralMm) <= halfWidth + 1e-6;
  const inSliceSlab = Math.abs(outOfPlaneMm) <= slabHalfThicknessMm;

  return { depthMm, lateralMm, outOfPlaneMm, visible: inSectorPlane && inSliceSlab };
}
