import * as THREE from 'three';

import { pointAtS, tangentAtS, type SimulatorProbePose } from './pose';
import type { SimulatorCenterlinePolyline, SimulatorMeshAsset } from './types';

// Backward scan resolution along the centerline and the safety margin kept between the drivable
// end and the channel-surface terminus (the optical eye clamps need a little wall around them).
const SAMPLE_STEP_MM = 2;
const END_MARGIN_MM = 3;
const RAY_FAR_MM = 1000;

/**
 * Raycast-only mesh for the shared channel surface. Double-sided so wall crossings can be counted
 * from either side; never added to a scene, so it holds no GPU resources.
 */
export function buildChannelRaycastMesh(mesh: SimulatorMeshAsset): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(mesh.vertices.flat(), 3));
  geometry.setIndex(mesh.triangles.flat());
  return new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
}

function radialDirection(tangent: THREE.Vector3): THREE.Vector3 {
  const reference =
    Math.abs(tangent.dot(new THREE.Vector3(0, 1, 0))) < 0.9
      ? new THREE.Vector3(0, 1, 0)
      : new THREE.Vector3(1, 0, 0);
  return new THREE.Vector3().crossVectors(tangent, reference).normalize();
}

/**
 * True when the point sits inside the channel surface: a ray cast radially (perpendicular to the
 * local advance direction) crosses the wall an odd number of times. A radial ray is used instead
 * of an arbitrary one so a point inside an open-ended tube cannot escape through the tube mouth
 * without crossing a wall.
 */
export function isInsideChannel(
  channelMesh: THREE.Mesh,
  point: THREE.Vector3,
  tangent: THREE.Vector3,
): boolean {
  const raycaster = new THREE.Raycaster(point, radialDirection(tangent), 0, RAY_FAR_MM);
  const hits = raycaster.intersectObject(channelMesh, false);
  let crossings = 0;
  let lastDistance = -1;

  for (const hit of hits) {
    // Shared triangle edges can report the same crossing twice; count it once.
    if (hit.distance - lastDistance > 1e-6) {
      crossings += 1;
      lastDistance = hit.distance;
    }
  }

  return crossings % 2 === 1;
}

/**
 * Maximum drivable path parameter for a centerline: the asset centerlines can overrun the channel
 * surface's distal terminus by several millimeters, and poses past the surface render nothing in
 * the optical pane. Scans backward from the distal end for the last on-centerline sample that is
 * still inside the surface, then pulls back by a safety margin. Falls back to the full length when
 * no sample tests inside (fail open on unexpected assets).
 */
export function maxDrivableSMm(
  polyline: SimulatorCenterlinePolyline,
  channelMesh: THREE.Mesh,
): number {
  const total = polyline.total_length_mm;

  for (let s = total; s >= 0; s -= SAMPLE_STEP_MM) {
    if (isInsideChannel(channelMesh, pointAtS(polyline, s), tangentAtS(polyline, s))) {
      return s >= total ? total : Math.max(0, s - END_MARGIN_MM);
    }
  }

  return total;
}

// Acoustic coupling model: full contact when the transducer face is within FULL of the wall, no
// coupling beyond NONE. The face is probed with a small fan of rays around the scan axis (tilted
// in the flexion plane) so a tip pressed obliquely onto the wall still registers; each ray starts
// slightly behind the face so a wall already at distance ~0 is not missed.
const CONTACT_RAY_BACKOFF_MM = 2;
const CONTACT_FULL_DISTANCE_MM = 1.8;
const CONTACT_NONE_DISTANCE_MM = 8;
const CONTACT_FAN_ANGLES_DEG = [-70, -35, 0, 35, 70];

function smoothstep01(edge0: number, edge1: number, x: number): number {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
  return t * t * (3 - 2 * t);
}

/**
 * Acoustic contact quality of the transducer face in [0, 1]: 1 when the face is pressed against
 * the channel wall, falling to 0 as it floats free in the lumen (air gap — no coupling). Drives
 * how obscured the sector image is while driving and flexing.
 */
export function contactQualityForPose(pose: SimulatorProbePose, channelMesh: THREE.Mesh): number {
  const raycaster = new THREE.Raycaster();
  raycaster.far = CONTACT_RAY_BACKOFF_MM + CONTACT_NONE_DISTANCE_MM + 1;
  let nearestDistanceMm = Infinity;

  for (const angleDeg of CONTACT_FAN_ANGLES_DEG) {
    const angleRad = THREE.MathUtils.degToRad(angleDeg);
    const direction = pose.depthAxis
      .clone()
      .multiplyScalar(Math.cos(angleRad))
      .addScaledVector(pose.tangent, Math.sin(angleRad))
      .normalize();
    const origin = pose.position.clone().addScaledVector(direction, -CONTACT_RAY_BACKOFF_MM);
    raycaster.set(origin, direction);
    const hit = raycaster.intersectObject(channelMesh, false)[0];

    if (hit) {
      nearestDistanceMm = Math.min(nearestDistanceMm, hit.distance - CONTACT_RAY_BACKOFF_MM);
    }
  }

  if (!Number.isFinite(nearestDistanceMm)) {
    return 0;
  }

  return 1 - smoothstep01(CONTACT_FULL_DISTANCE_MM, CONTACT_NONE_DISTANCE_MM, nearestDistanceMm);
}

/**
 * Pull a pose whose position has been pushed through the channel wall (e.g. by the flexion tip
 * shift) back inside, keeping `clearanceMm` to the wall along the anchor-to-position segment —
 * the wall physically stops the tip. Returns the pose unchanged when it is already inside.
 */
export function clampPosePositionInsideChannel(
  pose: SimulatorProbePose,
  channelMesh: THREE.Mesh,
  clearanceMm = 1.2,
): SimulatorProbePose {
  const anchor = pose.centerlinePosition;

  if (!anchor) {
    return pose;
  }

  const offset = pose.position.clone().sub(anchor);
  const length = offset.length();

  if (length < 1e-4) {
    return pose;
  }

  const direction = offset.clone().multiplyScalar(1 / length);
  const raycaster = new THREE.Raycaster(anchor, direction, 0, length + clearanceMm);
  const hit = raycaster.intersectObject(channelMesh, false)[0];

  if (!hit) {
    return pose;
  }

  const maxLength = Math.max(0, hit.distance - clearanceMm);

  if (maxLength >= length) {
    return pose;
  }

  return { ...pose, position: anchor.clone().addScaledVector(direction, maxLength) };
}

// Steering: candidate branches must pass within JOIN of the current position, and are compared a
// short distance ahead, where real paths have begun to separate.
const STEER_JOIN_DISTANCE_MM = 5;
const STEER_LOOKAHEAD_STEPS_MM = [18, 32];
const STEER_MIN_DIVERGENCE_MM = 4;
const STEER_MIN_LATERAL_MM = 1.5;

/** Nearest path parameter on a centerline to a world-space point (coarse scan, then refined). */
export function nearestSOnPolyline(
  polyline: SimulatorCenterlinePolyline,
  point: THREE.Vector3,
): { sMm: number; distanceMm: number } {
  let bestS = 0;
  let bestDistance = Infinity;

  const scan = (from: number, to: number, step: number) => {
    for (let s = from; s <= to; s += step) {
      const distance = pointAtS(polyline, s).distanceTo(point);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestS = s;
      }
    }
  };

  scan(0, polyline.total_length_mm, 4);
  scan(Math.max(0, bestS - 4), Math.min(polyline.total_length_mm, bestS + 4), 0.5);
  return { sMm: bestS, distanceMm: bestDistance };
}

export interface SimulatorSteerResult {
  lineIndex: number;
  sMm: number;
}

/**
 * Pick the branch to follow when steering left or right at (or near) a bifurcation: among
 * centerlines passing through the current position, choose the one that diverges furthest toward
 * the steered side (screen left/right = the pose's lateral axis, so rolling the scope re-aims the
 * steering like a real instrument). Returns the branch and the matching path parameter on it, or
 * null when no branch splits off to that side.
 */
export function steerToAdjacentLine(
  polylines: SimulatorCenterlinePolyline[],
  currentPolyline: SimulatorCenterlinePolyline,
  sMm: number,
  pose: SimulatorProbePose,
  steerSign: 1 | -1,
): SimulatorSteerResult | null {
  const origin = pointAtS(currentPolyline, sMm);
  const lateral = pose.lateralAxis.clone().normalize();

  for (const lookaheadMm of STEER_LOOKAHEAD_STEPS_MM) {
    const currentAhead = pointAtS(currentPolyline, sMm + lookaheadMm);
    let best: (SimulatorSteerResult & { score: number }) | null = null;

    for (const candidate of polylines) {
      if (
        candidate.line_index === currentPolyline.line_index ||
        candidate.total_length_mm < lookaheadMm
      ) {
        continue;
      }

      const nearest = nearestSOnPolyline(candidate, origin);
      if (nearest.distanceMm > STEER_JOIN_DISTANCE_MM) {
        continue;
      }

      const candidateAhead = pointAtS(candidate, nearest.sMm + lookaheadMm);
      const offset = candidateAhead.clone().sub(currentAhead);
      if (offset.length() < STEER_MIN_DIVERGENCE_MM) {
        continue;
      }

      const score = offset.dot(lateral) * steerSign;
      if (score > STEER_MIN_LATERAL_MM && (!best || score > best.score)) {
        best = { lineIndex: candidate.line_index, sMm: nearest.sMm, score };
      }
    }

    if (best) {
      return { lineIndex: best.lineIndex, sMm: best.sMm };
    }
  }

  return null;
}
