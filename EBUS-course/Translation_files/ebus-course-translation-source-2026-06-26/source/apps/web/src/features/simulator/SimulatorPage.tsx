import { useEffect, useMemo, useState } from 'react';

import { useLearnerProgress } from '@/lib/progress';

import { AnatomyScene } from './AnatomyScene';
import { BronchoscopyView } from './BronchoscopyView';
import { clamp, computeSimulatorPose, projectToSector, type SimulatorProbePose } from './pose';
import { SectorView } from './SectorView';
import { resolveSimulatorSectorSource, shouldUseSnapshotSectorItems, simulatorSectorSourceLabel } from './sectorSource';
import { formatSimulatorStation } from './stationIds';
import './simulator.css';
import type {
  SimulatorCaseManifest,
  SimulatorLayerState,
  SimulatorLoadedAssets,
  SimulatorPreset,
  SimulatorSectorItem,
  SimulatorSectorRasterMask,
  SimulatorVolumeSectorLabel,
  Vec2,
  Vec3,
} from './types';
import { useSimulatorCase, useSimulatorSectorSnapshot } from './useSimulatorCase';

const SIMULATOR_STATE_STORAGE_KEY = 'socal-ebus-prep:simulator-state:v2';
const SNAP_TARGET_SLAB_HALF_THICKNESS_MM = 18;
const LIVE_KNN_NEIGHBORS = 10;
const LIVE_MINIMUM_CROSSING_POINTS = {
  node: 5,
  vessel: 6,
} as const;
const LIVE_PLANE_INTERSECTION_EPSILON_MM = {
  node: 0.5,
  vessel: 0.5,
} as const;
const LIVE_CLUSTER_RADIUS_MM = {
  node: 7,
  vessel: 9.5,
} as const;
const LIVE_VESSEL_WALL_CLUSTER_DEPTH_GAP_MM = 30;
const LIVE_VESSEL_WALL_CLUSTER_LATERAL_GAP_MM = 14;
const LIVE_VESSEL_WALL_CLUSTER_OVERLAP_RATIO = 0.45;
const LIVE_VESSEL_SECTOR_CLIP_MARGIN_MM = 18;
const LIVE_MIN_GRAPH_EDGE_MM = {
  node: 4,
  vessel: 4.5,
} as const;
const LIVE_MAX_GRAPH_EDGE_MM = {
  node: 12,
  vessel: 14,
} as const;
const LIVE_RASTER_MASK_SIZE = 320;
const LIVE_DEBUG_POINT_LIMIT = 650;
const ROLL_MIN_DEG = -180;
const ROLL_MAX_DEG = 180;

const DEFAULT_LAYERS: SimulatorLayerState = {
  airway: true,
  vessels: true,
  heart: true,
  nodes: false,
  stations: true,
  context: false,
  centerline: false,
  fan: true,
  cutPlane: false,
};

const SIMULATOR_LAYER_LABELS: Record<keyof SimulatorLayerState, string> = {
  airway: 'airway',
  vessels: 'vessels',
  heart: 'heart',
  nodes: 'nodes',
  stations: 'Lymph nodes',
  context: 'context',
  centerline: 'centerline',
  fan: 'fan',
  cutPlane: 'cut plane',
};

const VIEWABLE_LAYER_KEYS: Array<keyof SimulatorLayerState> = [
  'airway',
  'vessels',
  'heart',
  'stations',
  'context',
  'fan',
  'cutPlane',
];

interface PersistedSimulatorState {
  hiddenSceneStructureIds?: string[];
  layers?: Partial<SimulatorLayerState>;
  lineIndex?: number;
  lockSceneView?: boolean;
  rollDeg?: number;
  sMm?: number;
  selectedKey?: string;
  teachingView?: boolean;
}

interface SceneStructureVisibilityItem {
  color: string;
  id: string;
  kind: 'node' | 'vessel';
  label: string;
}

function readPersistedState(): PersistedSimulatorState | null {
  try {
    const raw = window.localStorage.getItem(SIMULATOR_STATE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PersistedSimulatorState) : null;
  } catch {
    return null;
  }
}

function writePersistedState(value: PersistedSimulatorState) {
  try {
    window.localStorage.setItem(SIMULATOR_STATE_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Local persistence is a convenience for the module, not a runtime requirement.
  }
}

function isPublicTrainingSimulatorMode() {
  if (typeof window === 'undefined') {
    return false;
  }

  const params = new URLSearchParams(window.location.search);
  return params.get('publicTraining') === '1' && params.get('publicScope') !== 'tnm';
}

function normalizeSimulatorLayers(layers: Partial<SimulatorLayerState> | null | undefined): SimulatorLayerState {
  return {
    ...DEFAULT_LAYERS,
    ...(layers ?? {}),
    nodes: false,
    centerline: false,
  };
}

function normalizeHiddenSceneStructureIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(new Set(value.filter((item): item is string => typeof item === 'string' && item.length > 0)));
}

export function simulatorSceneStructureVisibilityItems(caseData: SimulatorCaseManifest): SceneStructureVisibilityItem[] {
  const nodeItems = caseData.assets.stations.map((station) => ({
    color: caseData.color_map.lymph_node ?? station.color,
    id: station.key,
    kind: 'node' as const,
    label: station.label.replace(/\s+region$/i, ''),
  }));
  const vesselItems = caseData.assets.vessels.map((vessel) => ({
    color: vessel.color,
    id: vessel.key,
    kind: 'vessel' as const,
    label: vessel.label,
  }));

  return [...nodeItems, ...vesselItems];
}

function clampProbeRollDeg(value: number): number {
  return clamp(value, ROLL_MIN_DEG, ROLL_MAX_DEG);
}

function volumeLabelToSectorItem(label: SimulatorVolumeSectorLabel): SimulatorSectorItem {
  return {
    id: label.id,
    label: label.label,
    kind: label.kind,
    color: label.color,
    depthMm: label.depth_mm,
    lateralMm: label.lateral_mm,
    visible: label.visible,
    depthExtentMm: label.depth_extent_mm,
    lateralExtentMm: label.lateral_extent_mm,
    majorAxisMm: label.major_axis_mm,
    minorAxisMm: label.minor_axis_mm,
    majorAxisVectorMm: label.major_axis_vector_mm,
    aspectRatio: label.aspect_ratio,
    contoursMm: label.contours_mm,
    contourCount: label.contour_count,
    contourSource: label.contour_source,
    contourClosed: label.contour_closed,
    hasClosedContour: label.has_closed_contour,
    rasterMask: label.raster_mask,
  };
}

interface ProjectedSectorPoint {
  depthMm: number;
  lateralMm: number;
  outOfPlaneMm: number;
}

interface PlaneSample extends ProjectedSectorPoint {
  source: Vec3;
  inFan: boolean;
}

interface PlaneCrossingPoint {
  point: Vec3;
  depthMm: number;
  lateralMm: number;
  sectorClipped?: boolean;
}

interface CrossingClusterBounds {
  maxDepthMm: number;
  maxLateralMm: number;
  minDepthMm: number;
  minLateralMm: number;
}

interface PointCloudGraphEdge {
  a: number;
  b: number;
  distanceSq: number;
}

interface PlaneIntersectionMaskResult {
  rasterMask: SimulatorSectorRasterMask;
  contoursMm: Vec2[][];
  hullsMm: Vec2[][];
  crossingPointsMm: Vec2[];
  rawPointsMm: Vec2[];
}

function rasterCoordinatesForProjectedPoint(
  point: Pick<ProjectedSectorPoint, 'depthMm' | 'lateralMm'>,
  width: number,
  height: number,
  maxDepthMm: number,
  sectorAngleDeg: number,
) {
  if (point.depthMm <= 0.5) {
    return null;
  }

  const halfWidthMm = Math.max(
    point.depthMm * Math.tan((sectorAngleDeg * Math.PI) / 360),
    0.5,
  );
  const x = ((point.lateralMm / halfWidthMm + 1) / 2) * (width - 1);
  const y = (point.depthMm / maxDepthMm) * (height - 1);

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  return { x, y };
}

function sectorHalfWidthMm(depthMm: number, sectorAngleDeg: number) {
  return Math.max(depthMm, 0) * Math.tan((sectorAngleDeg * Math.PI) / 360);
}

function clipProjectedPointToSectorBoundary(
  point: Pick<ProjectedSectorPoint, 'depthMm' | 'lateralMm'>,
  maxDepthMm: number,
  sectorAngleDeg: number,
): Pick<ProjectedSectorPoint, 'depthMm' | 'lateralMm'> | null {
  const depthMm = clamp(point.depthMm, 0.5, maxDepthMm);
  const halfWidthMm = sectorHalfWidthMm(depthMm, sectorAngleDeg);
  const lateralMm = clamp(point.lateralMm, -halfWidthMm, halfWidthMm);
  const gapMm = Math.hypot(point.depthMm - depthMm, point.lateralMm - lateralMm);

  if (gapMm > LIVE_VESSEL_SECTOR_CLIP_MARGIN_MM) {
    return null;
  }

  if (point.depthMm < 0.5 - LIVE_VESSEL_SECTOR_CLIP_MARGIN_MM) {
    return null;
  }

  return { depthMm, lateralMm };
}

function convexHull(points: Vec2[]): Vec2[] {
  if (points.length <= 2) {
    return points;
  }

  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (origin: Vec2, a: Vec2, b: Vec2) =>
    (a[0] - origin[0]) * (b[1] - origin[1]) - (a[1] - origin[1]) * (b[0] - origin[0]);
  const lower: Vec2[] = [];
  const upper: Vec2[] = [];

  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) {
      lower.pop();
    }
    lower.push(point);
  }

  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    const point = sorted[index];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) {
      upper.pop();
    }
    upper.push(point);
  }

  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

function squaredDistance3(a: Vec3, b: Vec3) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return dx * dx + dy * dy + dz * dz;
}

function interpolateVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

function median(values: number[]) {
  if (!values.length) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function dedupeVec2(points: Vec2[], precisionMm = 0.08) {
  const seen = new Set<string>();
  const deduped: Vec2[] = [];

  for (const point of points) {
    const key = `${Math.round(point[0] / precisionMm)}:${Math.round(point[1] / precisionMm)}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(point);
  }

  return deduped;
}

function closeContour(points: Vec2[]): Vec2[] {
  if (points.length < 3) {
    return points;
  }

  const first = points[0];
  const last = points[points.length - 1];
  if (Math.hypot(first[0] - last[0], first[1] - last[1]) <= 1e-6) {
    return points;
  }

  return [...points, first];
}

function polygonArea(points: Vec2[]) {
  if (points.length < 3) {
    return 0;
  }

  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    area += current[0] * next[1] - next[0] * current[1];
  }

  return Math.abs(area) / 2;
}

function sampleDebugPoints(points: Vec2[], limit = LIVE_DEBUG_POINT_LIMIT) {
  if (points.length <= limit) {
    return points;
  }

  const step = points.length / limit;
  const sampled: Vec2[] = [];

  for (let index = 0; index < limit; index += 1) {
    sampled.push(points[Math.floor(index * step)]);
  }

  return sampled;
}

function buildKnnGraph(points: Vec3[], kind: 'node' | 'vessel'): PointCloudGraphEdge[] {
  const edgeMap = new Map<string, PointCloudGraphEdge>();
  const nearestDistances: number[] = [];

  for (let index = 0; index < points.length; index += 1) {
    const nearest: Array<{ index: number; distanceSq: number }> = [];

    for (let candidate = 0; candidate < points.length; candidate += 1) {
      if (candidate === index) {
        continue;
      }

      const distanceSq = squaredDistance3(points[index], points[candidate]);
      if (distanceSq <= 1e-8) {
        continue;
      }

      const insertionIndex = nearest.findIndex((entry) => distanceSq < entry.distanceSq);
      if (insertionIndex === -1) {
        if (nearest.length < LIVE_KNN_NEIGHBORS) {
          nearest.push({ index: candidate, distanceSq });
        }
      } else {
        nearest.splice(insertionIndex, 0, { index: candidate, distanceSq });
        if (nearest.length > LIVE_KNN_NEIGHBORS) {
          nearest.pop();
        }
      }
    }

    if (nearest.length > 0) {
      nearestDistances.push(Math.sqrt(nearest[0].distanceSq));
    }

    for (const neighbor of nearest) {
      const a = Math.min(index, neighbor.index);
      const b = Math.max(index, neighbor.index);
      const key = `${a}:${b}`;

      if (!edgeMap.has(key)) {
        edgeMap.set(key, { a, b, distanceSq: neighbor.distanceSq });
      }
    }
  }

  const medianNearestDistanceMm = median(nearestDistances);
  const adaptiveMaxEdgeMm = clamp(
    medianNearestDistanceMm * 4.5,
    LIVE_MIN_GRAPH_EDGE_MM[kind],
    LIVE_MAX_GRAPH_EDGE_MM[kind],
  );
  const maxDistanceSq = adaptiveMaxEdgeMm * adaptiveMaxEdgeMm;

  return Array.from(edgeMap.values()).filter((edge) => edge.distanceSq <= maxDistanceSq);
}

function clusterCrossingPoints(points: PlaneCrossingPoint[], kind: 'node' | 'vessel') {
  if (!points.length) {
    return [];
  }

  const radius = LIVE_CLUSTER_RADIUS_MM[kind];
  const radiusSq = radius * radius;
  const visited = new Uint8Array(points.length);
  const clusters: PlaneCrossingPoint[][] = [];

  for (let index = 0; index < points.length; index += 1) {
    if (visited[index]) {
      continue;
    }

    const cluster: PlaneCrossingPoint[] = [];
    const stack = [index];
    visited[index] = 1;

    while (stack.length > 0) {
      const currentIndex = stack.pop()!;
      const current = points[currentIndex];
      cluster.push(current);

      for (let candidate = 0; candidate < points.length; candidate += 1) {
        if (visited[candidate]) {
          continue;
        }

        const next = points[candidate];
        const dx = current.lateralMm - next.lateralMm;
        const dy = current.depthMm - next.depthMm;

        if (dx * dx + dy * dy > radiusSq) {
          continue;
        }

        visited[candidate] = 1;
        stack.push(candidate);
      }
    }

    clusters.push(cluster);
  }

  return clusters;
}

function crossingClusterBounds(cluster: PlaneCrossingPoint[]): CrossingClusterBounds {
  let minLateralMm = Number.POSITIVE_INFINITY;
  let maxLateralMm = Number.NEGATIVE_INFINITY;
  let minDepthMm = Number.POSITIVE_INFINITY;
  let maxDepthMm = Number.NEGATIVE_INFINITY;

  for (const point of cluster) {
    minLateralMm = Math.min(minLateralMm, point.lateralMm);
    maxLateralMm = Math.max(maxLateralMm, point.lateralMm);
    minDepthMm = Math.min(minDepthMm, point.depthMm);
    maxDepthMm = Math.max(maxDepthMm, point.depthMm);
  }

  return { maxDepthMm, maxLateralMm, minDepthMm, minLateralMm };
}

function intervalGap(minA: number, maxA: number, minB: number, maxB: number) {
  return Math.max(0, Math.max(minB - maxA, minA - maxB));
}

function intervalOverlapRatio(minA: number, maxA: number, minB: number, maxB: number) {
  const overlap = Math.min(maxA, maxB) - Math.max(minA, minB);
  const smallestSpan = Math.min(maxA - minA, maxB - minB);

  if (smallestSpan <= 1e-6) {
    return overlap >= -1e-6 ? 1 : 0;
  }

  return Math.max(0, overlap) / smallestSpan;
}

function vesselClustersShouldMerge(a: PlaneCrossingPoint[], b: PlaneCrossingPoint[]) {
  const boundsA = crossingClusterBounds(a);
  const boundsB = crossingClusterBounds(b);
  const lateralOverlapRatio = intervalOverlapRatio(
    boundsA.minLateralMm,
    boundsA.maxLateralMm,
    boundsB.minLateralMm,
    boundsB.maxLateralMm,
  );
  const depthOverlapRatio = intervalOverlapRatio(
    boundsA.minDepthMm,
    boundsA.maxDepthMm,
    boundsB.minDepthMm,
    boundsB.maxDepthMm,
  );
  const lateralGapMm = intervalGap(
    boundsA.minLateralMm,
    boundsA.maxLateralMm,
    boundsB.minLateralMm,
    boundsB.maxLateralMm,
  );
  const depthGapMm = intervalGap(
    boundsA.minDepthMm,
    boundsA.maxDepthMm,
    boundsB.minDepthMm,
    boundsB.maxDepthMm,
  );
  const pairedAnteriorPosteriorWalls =
    lateralOverlapRatio >= LIVE_VESSEL_WALL_CLUSTER_OVERLAP_RATIO &&
    depthGapMm <= LIVE_VESSEL_WALL_CLUSTER_DEPTH_GAP_MM;
  const pairedLateralWalls =
    depthOverlapRatio >= LIVE_VESSEL_WALL_CLUSTER_OVERLAP_RATIO &&
    lateralGapMm <= LIVE_VESSEL_WALL_CLUSTER_LATERAL_GAP_MM;

  return pairedAnteriorPosteriorWalls || pairedLateralWalls;
}

function mergeVesselWallClusters(clusters: PlaneCrossingPoint[][]) {
  const merged = clusters.map((cluster) => [...cluster]);
  let changed = true;

  while (changed) {
    changed = false;

    for (let index = 0; index < merged.length; index += 1) {
      for (let candidate = index + 1; candidate < merged.length; candidate += 1) {
        if (!vesselClustersShouldMerge(merged[index], merged[candidate])) {
          continue;
        }

        merged[index] = [...merged[index], ...merged[candidate]];
        merged.splice(candidate, 1);
        changed = true;
        break;
      }

      if (changed) {
        break;
      }
    }
  }

  return merged;
}

function ellipseContourFromCluster(points: Vec2[], kind: 'node' | 'vessel'): Vec2[] {
  const center = points.reduce<Vec2>(
    (sum, point) => [sum[0] + point[0], sum[1] + point[1]],
    [0, 0],
  );
  center[0] /= Math.max(points.length, 1);
  center[1] /= Math.max(points.length, 1);

  let cxx = 0;
  let cxy = 0;
  let cyy = 0;
  for (const point of points) {
    const dx = point[0] - center[0];
    const dy = point[1] - center[1];
    cxx += dx * dx;
    cxy += dx * dy;
    cyy += dy * dy;
  }
  cxx /= Math.max(points.length, 1);
  cxy /= Math.max(points.length, 1);
  cyy /= Math.max(points.length, 1);

  const trace = cxx + cyy;
  const delta = Math.sqrt(Math.max(0, ((cxx - cyy) / 2) ** 2 + cxy * cxy));
  const lambdaMajor = Math.max(trace / 2 + delta, 0);
  const lambdaMinor = Math.max(trace / 2 - delta, 0);
  const angle = Math.abs(cxy) > 1e-6 || Math.abs(lambdaMajor - cxx) > 1e-6
    ? Math.atan2(lambdaMajor - cxx, cxy)
    : 0;
  const fallbackMajor = kind === 'vessel' ? 7 : 8;
  const fallbackMinor = kind === 'vessel' ? 4 : 6;
  const major = Math.max(Math.sqrt(lambdaMajor) * 2.7, fallbackMajor);
  const minor = Math.max(Math.sqrt(lambdaMinor) * 2.7, fallbackMinor);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const contour: Vec2[] = [];

  for (let index = 0; index < 36; index += 1) {
    const theta = (index / 36) * Math.PI * 2;
    const x = Math.cos(theta) * major * 0.5;
    const y = Math.sin(theta) * minor * 0.5;
    contour.push([
      center[0] + x * cos - y * sin,
      center[1] + x * sin + y * cos,
    ]);
  }

  return contour;
}

function smoothClosedContour(points: Vec2[], iterations = 2): Vec2[] {
  let current = points;

  for (let pass = 0; pass < iterations; pass += 1) {
    if (current.length < 3) {
      return current;
    }

    const next: Vec2[] = [];
    for (let index = 0; index < current.length; index += 1) {
      const point = current[index];
      const following = current[(index + 1) % current.length];
      next.push([
        point[0] * 0.75 + following[0] * 0.25,
        point[1] * 0.75 + following[1] * 0.25,
      ]);
      next.push([
        point[0] * 0.25 + following[0] * 0.75,
        point[1] * 0.25 + following[1] * 0.75,
      ]);
    }

    current = next;
  }

  return current;
}

function contourFromCluster(cluster: PlaneCrossingPoint[], kind: 'node' | 'vessel') {
  const points = dedupeVec2(cluster.map((point) => [point.lateralMm, point.depthMm]));
  const sparse = points.length < 3;
  const hull = sparse ? ellipseContourFromCluster(points, kind) : convexHull(points);
  const stableHull = polygonArea(hull) < 2 ? ellipseContourFromCluster(points, kind) : hull;
  const contour = smoothClosedContour(stableHull, kind === 'vessel' ? 2 : 3);

  return {
    hull: closeContour(stableHull),
    contour: closeContour(contour),
  };
}

function rasterizePolygonIntoAlpha(
  alpha: Uint8Array,
  width: number,
  height: number,
  polygon: Array<{ x: number; y: number }>,
) {
  if (polygon.length < 3) {
    return;
  }

  const minY = Math.max(0, Math.floor(Math.min(...polygon.map((point) => point.y))));
  const maxY = Math.min(height - 1, Math.ceil(Math.max(...polygon.map((point) => point.y))));

  for (let y = minY; y <= maxY; y += 1) {
    const scanY = y + 0.5;
    const intersections: number[] = [];

    for (let index = 0; index < polygon.length; index += 1) {
      const current = polygon[index];
      const next = polygon[(index + 1) % polygon.length];

      if ((current.y <= scanY && next.y > scanY) || (next.y <= scanY && current.y > scanY)) {
        const t = (scanY - current.y) / (next.y - current.y);
        intersections.push(current.x + (next.x - current.x) * t);
      }
    }

    intersections.sort((a, b) => a - b);
    for (let index = 0; index < intersections.length - 1; index += 2) {
      const startX = Math.max(0, Math.ceil(intersections[index]));
      const endX = Math.min(width - 1, Math.floor(intersections[index + 1]));

      for (let x = startX; x <= endX; x += 1) {
        alpha[y * width + x] = 255;
      }
    }
  }
}

function rasterizeContours(
  contoursMm: Vec2[][],
  {
    maxDepthMm,
    sectorAngleDeg,
  }: {
    maxDepthMm: number;
    sectorAngleDeg: number;
  },
) {
  const width = LIVE_RASTER_MASK_SIZE;
  const height = LIVE_RASTER_MASK_SIZE;
  const alpha = new Uint8Array(width * height);

  for (const contour of contoursMm) {
    const polygon = contour
      .map((point) => rasterCoordinatesForProjectedPoint(
        { lateralMm: point[0], depthMm: point[1] },
        width,
        height,
        maxDepthMm,
        sectorAngleDeg,
      ))
      .filter((point): point is { x: number; y: number } => Boolean(point));

    if (polygon.length < 3) {
      continue;
    }

    rasterizePolygonIntoAlpha(alpha, width, height, polygon);
  }

  return {
    alpha,
    height,
    width,
  };
}

export function buildPlaneIntersectionRasterMask({
  kind,
  maxDepthMm,
  points,
  pose,
  sectorAngleDeg,
}: {
  kind: 'node' | 'vessel';
  maxDepthMm: number;
  points: Vec3[];
  pose: SimulatorProbePose;
  sectorAngleDeg: number;
}): PlaneIntersectionMaskResult | null {
  if (points.length < 4) {
    return null;
  }

  const samples: PlaneSample[] = points.map((point) => {
    const projection = projectToSector(point, pose, maxDepthMm, sectorAngleDeg, Number.POSITIVE_INFINITY);
    return {
      source: point,
      depthMm: projection.depthMm,
      lateralMm: projection.lateralMm,
      outOfPlaneMm: projection.outOfPlaneMm,
      inFan: projection.visible,
    };
  });
  const rawPointsMm = sampleDebugPoints(
    samples
      .filter((sample) => sample.inFan)
      .map((sample) => [sample.lateralMm, sample.depthMm]),
  );
  const graphEdges = buildKnnGraph(points, kind);
  const epsilon = LIVE_PLANE_INTERSECTION_EPSILON_MM[kind];
  const crossingPoints: PlaneCrossingPoint[] = [];

  for (const edge of graphEdges) {
    const a = samples[edge.a];
    const b = samples[edge.b];
    const crossesPlane =
      (a.outOfPlaneMm <= -epsilon && b.outOfPlaneMm >= epsilon) ||
      (b.outOfPlaneMm <= -epsilon && a.outOfPlaneMm >= epsilon) ||
      (a.outOfPlaneMm * b.outOfPlaneMm <= 0 &&
        (Math.abs(a.outOfPlaneMm) > epsilon || Math.abs(b.outOfPlaneMm) > epsilon));

    if (!crossesPlane) {
      continue;
    }

    const denominator = a.outOfPlaneMm - b.outOfPlaneMm;
    if (Math.abs(denominator) <= 1e-6) {
      continue;
    }

    const t = clamp(a.outOfPlaneMm / denominator, 0, 1);
    const crossing = interpolateVec3(a.source, b.source, t);
    const projection = projectToSector(crossing, pose, maxDepthMm, sectorAngleDeg, Number.POSITIVE_INFINITY);
    const sectorPoint = projection.visible
      ? { depthMm: projection.depthMm, lateralMm: projection.lateralMm, sectorClipped: false }
      : kind === 'vessel'
        ? clipProjectedPointToSectorBoundary(projection, maxDepthMm, sectorAngleDeg)
        : null;

    if (!sectorPoint) {
      continue;
    }

    crossingPoints.push({
      point: crossing,
      depthMm: sectorPoint.depthMm,
      lateralMm: sectorPoint.lateralMm,
      sectorClipped: !projection.visible,
    });
  }

  if (crossingPoints.length < LIVE_MINIMUM_CROSSING_POINTS[kind]) {
    return null;
  }

  const rawClusters = clusterCrossingPoints(crossingPoints, kind)
    .filter((cluster) => cluster.length >= 2 && cluster.some((point) => !point.sectorClipped));
  const clusters = kind === 'vessel' ? mergeVesselWallClusters(rawClusters) : rawClusters;
  const contoursMm: Vec2[][] = [];
  const hullsMm: Vec2[][] = [];

  for (const cluster of clusters) {
    const { contour, hull } = contourFromCluster(cluster, kind);

    if (contour.length < 4 || polygonArea(contour) <= 0.5) {
      continue;
    }

    contoursMm.push(contour);
    hullsMm.push(hull);
  }

  if (!contoursMm.length) {
    return null;
  }

  const rasterized = rasterizeContours(contoursMm, { maxDepthMm, sectorAngleDeg });
  const alpha = Array.from(rasterized.alpha);

  if (!alpha.some((value) => value > 0)) {
    return null;
  }

  const crossingPointsMm = sampleDebugPoints(
    crossingPoints.map((point) => [point.lateralMm, point.depthMm]),
  );

  return {
    contoursMm,
    crossingPointsMm,
    hullsMm,
    rawPointsMm,
    rasterMask: {
      width: rasterized.width,
      height: rasterized.height,
      alpha,
      source: 'browser_point_cloud_plane_contour',
      depth_samples: rasterized.height,
      lateral_samples: rasterized.width,
      debug: {
        rawPointsMm,
        crossingPointsMm,
        hullsMm,
        finalContoursMm: contoursMm,
      },
    },
  };
}

function projectedPointCloudSectorItem({
  color,
  kind,
  label,
  id,
  maxDepthMm,
  points,
  pose,
  sectorAngleDeg,
}: {
  color: string;
  kind: 'node' | 'vessel';
  label: string;
  id: string;
  maxDepthMm: number;
  points: Vec3[];
  pose: SimulatorProbePose;
  sectorAngleDeg: number;
}): SimulatorSectorItem | null {
  const planeMask = buildPlaneIntersectionRasterMask({
    kind,
    maxDepthMm,
    points,
    pose,
    sectorAngleDeg,
  });

  if (!planeMask) {
    return null;
  }

  const contourPoints = planeMask.contoursMm.flat();
  const lateralValues = contourPoints.map((point) => point[0]);
  const depthValues = contourPoints.map((point) => point[1]);
  const meanLateral = lateralValues.reduce((sum, value) => sum + value, 0) / contourPoints.length;
  const meanDepth = depthValues.reduce((sum, value) => sum + value, 0) / contourPoints.length;
  const lateralExtentMm: [number, number] = [Math.min(...lateralValues), Math.max(...lateralValues)];
  const depthExtentMm: [number, number] = [Math.min(...depthValues), Math.max(...depthValues)];

  return {
    id,
    label,
    kind,
    color,
    depthMm: meanDepth,
    lateralMm: meanLateral,
    visible: true,
    depthExtentMm,
    lateralExtentMm,
    contoursMm: planeMask.contoursMm,
    contourCount: planeMask.contoursMm.length,
    contourSource: 'browser_point_cloud_plane_contour',
    contourClosed: planeMask.contoursMm.map(() => true),
    hasClosedContour: planeMask.contoursMm.length > 0,
    rasterMask: planeMask.rasterMask,
  };
}

function isAtSnapshotPose(
  preset: SimulatorPreset,
  activeLineIndex: number,
  sMm: number,
  rollDeg: number,
  caseData: SimulatorCaseManifest,
) {
  return (
    activeLineIndex === preset.line_index &&
    Math.abs(sMm - preset.centerline_s_mm) <= 1 &&
    Math.abs(rollDeg - caseData.render_defaults.roll_deg) <= 0.1
  );
}

export function buildPointCloudSectorItems({
  assets,
  caseData,
  lineIndex,
  pose,
  selectedPreset,
  sMm,
}: {
  assets: SimulatorLoadedAssets;
  caseData: SimulatorCaseManifest;
  lineIndex: number;
  pose: SimulatorProbePose;
  selectedPreset: SimulatorPreset | null;
  sMm: number;
}): SimulatorSectorItem[] {
  const maxDepth = caseData.render_defaults.max_depth_mm;
  const sectorAngle = caseData.render_defaults.sector_angle_deg;
  const items: SimulatorSectorItem[] = [
    {
      id: 'airway_wall',
      label: 'airway wall',
      kind: 'airway',
      color: caseData.color_map.airway ?? '#22c7c9',
      depthMm: 2,
      lateralMm: 0,
      visible: true,
    },
    {
      id: 'contact_region',
      label: 'contact region',
      kind: 'contact',
      color: '#f5e166',
      depthMm: 0,
      lateralMm: 0,
      visible: true,
    },
  ];

  for (const station of caseData.assets.stations) {
    const stationPoints = assets.stations[station.key]?.points ?? [];
    if (!stationPoints.length) {
      continue;
    }

    const item = projectedPointCloudSectorItem({
      color: caseData.color_map.lymph_node ?? station.color,
      id: station.key,
      kind: 'node',
      label: station.label.replace(' region', ''),
      maxDepthMm: maxDepth,
      points: stationPoints,
      pose,
      sectorAngleDeg: sectorAngle,
    });

    if (!item) {
      continue;
    }

    items.push(item);
  }

  const atStationSnap =
    selectedPreset !== null &&
    lineIndex === selectedPreset.line_index &&
    Math.abs(sMm - selectedPreset.centerline_s_mm) <= 1;

  if (selectedPreset && atStationSnap && !items.some((item) => item.kind === 'node')) {
    const nodeProjection = projectToSector(
      selectedPreset.target,
      pose,
      maxDepth,
      sectorAngle,
      SNAP_TARGET_SLAB_HALF_THICKNESS_MM,
    );

    if (nodeProjection.visible) {
      items.push({
        id: selectedPreset.station_key,
        label: 'lymph node',
        kind: 'node',
        color: caseData.color_map.lymph_node ?? '#93c56f',
        ...nodeProjection,
      });
    }
  }

  for (const listed of caseData.assets.vessels) {
    const vessel = assets.vessels[listed.key];

    if (!vessel) {
      continue;
    }

    const item = projectedPointCloudSectorItem({
      color: listed.color,
      id: listed.key,
      kind: 'vessel',
      label: listed.label,
      maxDepthMm: maxDepth,
      points: vessel.points,
      pose,
      sectorAngleDeg: sectorAngle,
    });

    if (!item) {
      continue;
    }

    items.push(item);
  }

  return items.sort((a, b) => {
    const order = { airway: 0, contact: 1, node: 2, vessel: 3 };
    return order[a.kind] - order[b.kind] || a.depthMm - b.depthMm || a.label.localeCompare(b.label);
  });
}

export function SimulatorPage({ showVirtualBronchoscopy = false }: { showVirtualBronchoscopy?: boolean }) {
  const { setModuleProgress } = useLearnerProgress();
  const { assets, caseData, error } = useSimulatorCase();
  const publicTrainingMode = useMemo(() => isPublicTrainingSimulatorMode(), []);
  const showVirtualBronchoscopyPane = showVirtualBronchoscopy && !publicTrainingMode;
  const [selectedKey, setSelectedKey] = useState('');
  const [lineIndex, setLineIndex] = useState<number | null>(null);
  const [sMm, setSMm] = useState(0);
  const [rollDeg, setRollDeg] = useState(0);
  const [layers, setLayers] = useState<SimulatorLayerState>(DEFAULT_LAYERS);
  const [teachingView, setTeachingView] = useState(true);
  const [activeStructure, setActiveStructure] = useState<string | null>(null);
  const [hiddenSceneStructureIds, setHiddenSceneStructureIds] = useState<string[]>([]);
  const [lockSceneView, setLockSceneView] = useState(false);
  const [simulatorStateInitialized, setSimulatorStateInitialized] = useState(false);

  const selectedPreset = useMemo(() => {
    if (!caseData?.presets.length) {
      return null;
    }

    return caseData.presets.find((preset) => preset.preset_key === selectedKey) ?? null;
  }, [caseData, selectedKey]);

  const navigationPreset = useMemo(() => selectedPreset ?? caseData?.presets[0] ?? null, [caseData, selectedPreset]);

  const { snapshot, status: snapshotStatus } = useSimulatorSectorSnapshot(caseData, selectedPreset?.preset_key ?? null);

  useEffect(() => {
    if (!caseData || simulatorStateInitialized || !caseData.presets.length) {
      return;
    }

    const first = caseData.presets[0];
    const publicStartLineIndex = caseData.navigation.primary_line_index ?? first.line_index;

    if (publicTrainingMode) {
      setSelectedKey('');
      setLineIndex(publicStartLineIndex);
      setSMm(0);
      setRollDeg(clampProbeRollDeg(caseData.render_defaults.roll_deg));
      setLayers(normalizeSimulatorLayers(undefined));
      setTeachingView(true);
      setHiddenSceneStructureIds([]);
      setLockSceneView(true);
      setActiveStructure(null);
      setSimulatorStateInitialized(true);
      return;
    }

    const persisted = readPersistedState();
    const persistedPreset = caseData.presets.find((preset) => preset.preset_key === persisted?.selectedKey);
    const firstPreset = persistedPreset ?? first;
    setSelectedKey(firstPreset.preset_key);
    setLineIndex(typeof persisted?.lineIndex === 'number' ? persisted.lineIndex : firstPreset.line_index);
    setSMm(typeof persisted?.sMm === 'number' ? persisted.sMm : firstPreset.centerline_s_mm);
    setRollDeg(
      typeof persisted?.rollDeg === 'number'
        ? clampProbeRollDeg(persisted.rollDeg)
        : clampProbeRollDeg(caseData.render_defaults.roll_deg),
    );
    setLayers(normalizeSimulatorLayers(persisted?.layers));
    setTeachingView(typeof persisted?.teachingView === 'boolean' ? persisted.teachingView : true);
    setHiddenSceneStructureIds(normalizeHiddenSceneStructureIds(persisted?.hiddenSceneStructureIds));
    setLockSceneView(typeof persisted?.lockSceneView === 'boolean' ? persisted.lockSceneView : false);
    setSimulatorStateInitialized(true);
  }, [caseData, publicTrainingMode, simulatorStateInitialized]);

  useEffect(() => {
    if (publicTrainingMode || !simulatorStateInitialized || !selectedPreset) {
      return;
    }

    writePersistedState({
      hiddenSceneStructureIds,
      layers,
      lineIndex: lineIndex ?? selectedPreset.line_index,
      lockSceneView,
      rollDeg,
      sMm,
      selectedKey: selectedPreset.preset_key,
      teachingView,
    });
  }, [
    hiddenSceneStructureIds,
    layers,
    lineIndex,
    lockSceneView,
    publicTrainingMode,
    rollDeg,
    sMm,
    selectedPreset,
    simulatorStateInitialized,
    teachingView,
  ]);

  useEffect(() => {
    if (caseData) {
      setModuleProgress('simulator', 35);
    }
  }, [caseData, setModuleProgress]);

  const activePolyline = useMemo(() => {
    if (!assets?.centerlines.polylines.length || !navigationPreset) {
      return null;
    }

    const resolvedLineIndex = lineIndex ?? navigationPreset.line_index;

    return (
      assets.centerlines.polylines.find((polyline) => polyline.line_index === resolvedLineIndex) ??
      assets.centerlines.polylines.find((polyline) => polyline.line_index === navigationPreset.line_index) ??
      assets.centerlines.polylines[0]
    );
  }, [assets, lineIndex, navigationPreset]);

  const pose = useMemo(() => {
    if (!activePolyline || !navigationPreset) {
      return null;
    }

    return computeSimulatorPose(activePolyline, sMm, rollDeg, navigationPreset);
  }, [activePolyline, navigationPreset, rollDeg, sMm]);

  const cameraPose = useMemo(() => {
    if (!activePolyline || !navigationPreset) {
      return null;
    }

    return computeSimulatorPose(activePolyline, sMm, 0, navigationPreset);
  }, [activePolyline, navigationPreset, sMm]);

  const hasCurrentSnapshot = Boolean(selectedPreset && snapshot?.preset_key === selectedPreset.preset_key);
  const atSnapshotPose = Boolean(
    caseData &&
      selectedPreset &&
      activePolyline &&
      hasCurrentSnapshot &&
      isAtSnapshotPose(selectedPreset, activePolyline.line_index, sMm, rollDeg, caseData),
  );
  const sectorSource = resolveSimulatorSectorSource({
    atSnapshotPose,
    hasCurrentSnapshot,
    snapshotStatus,
  });

  const sectorItems = useMemo<SimulatorSectorItem[]>(() => {
    if (!caseData || !assets || !pose || !navigationPreset || !activePolyline) {
      return [];
    }

    const baseItems: SimulatorSectorItem[] = [
      {
        id: 'airway_wall',
        label: 'airway wall',
        kind: 'airway',
        color: caseData.color_map.airway ?? '#22c7c9',
        depthMm: 2,
        lateralMm: 0,
        visible: true,
      },
      {
        id: 'contact_region',
        label: 'contact region',
        kind: 'contact',
        color: '#f5e166',
        depthMm: 0,
        lateralMm: 0,
        visible: true,
      },
    ];

    if (selectedPreset && shouldUseSnapshotSectorItems(sectorSource) && snapshot?.preset_key === selectedPreset.preset_key) {
      return [
        ...baseItems,
        ...snapshot.response.sector.labels.map(volumeLabelToSectorItem),
      ].sort((a, b) => {
        const order = { airway: 0, contact: 1, node: 2, vessel: 3 };
        return order[a.kind] - order[b.kind] || a.depthMm - b.depthMm || a.label.localeCompare(b.label);
      });
    }

    return buildPointCloudSectorItems({
      assets,
      caseData,
      lineIndex: activePolyline.line_index,
      pose,
      selectedPreset,
      sMm,
    });
  }, [activePolyline, assets, caseData, navigationPreset, pose, sectorSource, selectedPreset, sMm, snapshot]);

  const intersectedStructureIds = useMemo(() => {
    return new Set(
      sectorItems
        .filter((item) => item.visible && (item.kind === 'node' || item.kind === 'vessel'))
        .map((item) => item.id),
    );
  }, [sectorItems]);
  const sceneStructureVisibilityItems = useMemo(() => {
    if (!caseData) {
      return [];
    }

    return simulatorSceneStructureVisibilityItems(caseData);
  }, [caseData]);
  const hiddenSceneStructureSet = useMemo(() => new Set(hiddenSceneStructureIds), [hiddenSceneStructureIds]);
  const sceneVisibleCount = sceneStructureVisibilityItems
    .filter((item) => !hiddenSceneStructureSet.has(item.id))
    .length;

  useEffect(() => {
    if (!sceneStructureVisibilityItems.length) {
      return;
    }

    const validIds = new Set(sceneStructureVisibilityItems.map((item) => item.id));
    setHiddenSceneStructureIds((current) => current.filter((id) => validIds.has(id)));
  }, [sceneStructureVisibilityItems]);

  if (error) {
    return (
      <main className="simulator-load-shell">
        <section className="simulator-load-panel">
          <h1>EBUS Simulator</h1>
          <p>{error}</p>
        </section>
      </main>
    );
  }

  if (!caseData || !assets || !navigationPreset || !activePolyline || !pose || !cameraPose) {
    return (
      <main className="simulator-load-shell">
        <section className="simulator-load-panel">
          <h1>EBUS Simulator</h1>
          <p>Loading static case geometry...</p>
        </section>
      </main>
    );
  }

  const snapToPreset = (preset: SimulatorPreset) => {
    setSelectedKey(preset.preset_key);
    setLineIndex(preset.line_index);
    setSMm(preset.centerline_s_mm);
    setRollDeg(clampProbeRollDeg(caseData.render_defaults.roll_deg));
    setActiveStructure(preset.station_key);
    setModuleProgress('simulator', 55);
  };

  const updateLayer = (key: keyof SimulatorLayerState) => {
    setLayers((current) => ({ ...current, [key]: !current[key] }));
  };
  const updateSceneStructureVisibility = (id: string, visible: boolean) => {
    setHiddenSceneStructureIds((current) => {
      const next = new Set(current);

      if (visible) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return Array.from(next);
    });
  };
  const showAllSceneStructures = () => setHiddenSceneStructureIds([]);

  return (
    <div className="simulator-page">
      <section className="simulator-intro">
        <div>
          <div className="eyebrow">Static training simulator</div>
          <h1>EBUS Anatomy Correlation Simulator</h1>
          <p>
            Move along a guided airway centerline, snap to curated nodal targets, and correlate the external anatomy view
            with a labeled EBUS-style sector.
          </p>
        </div>
        <aside>
          Simulated anatomy and EBUS-style views are for orientation training only. They are not clinically validated
          diagnostic images.
        </aside>
      </section>

      <section className="simulator-topbar">
        <div>
          <span className="eyebrow">{caseData.case_id}</span>
          <h2>{selectedPreset ? `Station ${formatSimulatorStation(selectedPreset.station)}` : 'Free airway drive'}</h2>
        </div>
        <div className="simulator-status-strip">
          <span>{selectedPreset?.approach ?? 'No station selected'}</span>
          <span>{Math.round(sMm)} mm</span>
          <span>{simulatorSectorSourceLabel(sectorSource)}</span>
        </div>
      </section>

      <section className="simulator-control-rail" aria-label="Simulator controls">
        <label>
          <span>Station snap</span>
          <select
            value={selectedPreset?.preset_key ?? ''}
            onChange={(event) => {
              if (!event.target.value) {
                setSelectedKey('');
                setLineIndex(caseData.navigation.primary_line_index ?? navigationPreset.line_index);
                setSMm(0);
                setRollDeg(clampProbeRollDeg(caseData.render_defaults.roll_deg));
                setActiveStructure(null);
                setModuleProgress('simulator', 45);
                return;
              }

              const preset = caseData.presets.find((candidate) => candidate.preset_key === event.target.value);
              if (preset) {
                snapToPreset(preset);
              }
            }}
          >
            {publicTrainingMode ? <option value="">Free drive - no station snap</option> : null}
            {caseData.presets.map((preset) => (
              <option key={preset.preset_key} value={preset.preset_key}>
                {preset.label}
              </option>
            ))}
          </select>
        </label>
        <label className="simulator-wide-control">
          <span>Advance / retract</span>
          <input
            max={activePolyline.total_length_mm}
            min={0}
            onChange={(event) => {
              setSMm(Number(event.target.value));
              setModuleProgress('simulator', 45);
            }}
            step={0.5}
            type="range"
            value={Math.min(Math.max(sMm, 0), activePolyline.total_length_mm)}
          />
        </label>
        <label>
          <span>Roll ({Math.round(rollDeg)} deg)</span>
          <input
            max={ROLL_MAX_DEG}
            min={ROLL_MIN_DEG}
            onChange={(event) => {
              setRollDeg(clampProbeRollDeg(Number(event.target.value)));
              setModuleProgress('simulator', 45);
            }}
            step={1}
            type="range"
            value={clampProbeRollDeg(rollDeg)}
          />
        </label>
        <div className="simulator-layer-toggles" aria-label="Anatomy layers">
          <label>
            <input checked={teachingView} onChange={() => setTeachingView((current) => !current)} type="checkbox" />
            <span>teaching</span>
          </label>
          <label>
            <input checked={lockSceneView} onChange={() => setLockSceneView((current) => !current)} type="checkbox" />
            <span>lock view</span>
          </label>
          {VIEWABLE_LAYER_KEYS.map((key) => (
            <label key={key}>
              <input checked={layers[key]} onChange={() => updateLayer(key)} type="checkbox" />
              <span>{SIMULATOR_LAYER_LABELS[key]}</span>
            </label>
          ))}
        </div>
      </section>

      <div className={`simulator-workspace${showVirtualBronchoscopyPane ? ' simulator-workspace--virtual' : ''}`}>
        <section className="simulator-scene-pane" aria-label="External anatomy view">
          <div className="simulator-pane-header">
            <div>
              <span className="eyebrow">External anatomy</span>
              <h2>Scope, airway, vessels, lymph nodes, and fan</h2>
            </div>
            <div className="simulator-scene-actions">
              <details className="simulator-structure-dropdown">
                <summary>
                  <span>3D structures</span>
                  <span>{sceneVisibleCount}/{sceneStructureVisibilityItems.length}</span>
                </summary>
                <div className="simulator-structure-dropdown__menu">
                  <div className="simulator-structure-dropdown__actions">
                    <span>Visible in 3D</span>
                    <button type="button" onClick={showAllSceneStructures}>
                      Show all
                    </button>
                  </div>
                  {(['node', 'vessel'] as const).map((kind) => {
                    const groupItems = sceneStructureVisibilityItems.filter((item) => item.kind === kind);

                    if (!groupItems.length) {
                      return null;
                    }

                    return (
                      <div className="simulator-structure-dropdown__group" key={kind}>
                        <div className="simulator-structure-dropdown__group-label">
                          {kind === 'node' ? 'Lymph nodes' : 'Vessels'}
                        </div>
                        {groupItems.map((item) => (
                          <label className="simulator-structure-dropdown__row" key={item.id}>
                            <input
                              checked={!hiddenSceneStructureSet.has(item.id)}
                              onChange={(event) => updateSceneStructureVisibility(item.id, event.target.checked)}
                              type="checkbox"
                            />
                            <span className="simulator-swatch" style={{ backgroundColor: item.color }} />
                            <span>{item.label}</span>
                          </label>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </details>
              <button
                className="simulator-button"
                disabled={!selectedPreset}
                onClick={() => {
                  if (selectedPreset) {
                    snapToPreset(selectedPreset);
                  }
                }}
                type="button"
              >
                Snap
              </button>
            </div>
          </div>
          <AnatomyScene
            activeStructure={null}
            assets={assets}
            cameraPose={cameraPose}
            caseData={caseData}
            hiddenStructureIds={hiddenSceneStructureSet}
            intersectedStructureIds={intersectedStructureIds}
            layers={layers}
            lockView={lockSceneView}
            pose={pose}
            selectedPreset={selectedPreset}
            teachingView={teachingView}
          />
        </section>

        {showVirtualBronchoscopyPane ? (
          <section className="simulator-scene-pane" aria-label="Virtual bronchoscopy view">
            <div className="simulator-pane-header">
              <div>
                <span className="eyebrow">Virtual bronchoscopy</span>
                <h2>Endoluminal view from the scope tip</h2>
              </div>
              <div className="simulator-status-strip">
                <span>{Math.round(sMm)} mm</span>
              </div>
            </div>
            <BronchoscopyView pose={pose} assets={assets} />
          </section>
        ) : null}

        <SectorView
          activeStructure={activeStructure}
          caseData={caseData}
          items={sectorItems}
          selectedPreset={selectedPreset}
          setActiveStructure={setActiveStructure}
          source={sectorSource}
        />
      </div>
    </div>
  );
}
