import { useEffect, useMemo, useRef, useState } from 'react';

import { useCourseShellText } from '@/i18n/courseShell';
import { useLearnerProgress } from '@/lib/progress';

import { AnatomyScene } from './AnatomyScene';
import {
  airwayRegionAtPose,
  airwaySideForLine,
  freeDrivePresetForLine,
  normalizeAirwayRollDeg,
  projectToAirway,
  resolveAirwayNavigationModel,
  standardAirwayRollDeg,
  type SimulatorAirwaySide,
} from './airwayNavigation';
import { BronchoscopyView, type SimulatorBronchOverlayStructure } from './BronchoscopyView';
import {
  buildChannelRaycastMesh,
  clampPosePositionInsideChannel,
  contactQualityForPose,
  constrainedPathAdvance,
  maxDrivableSMm,
} from './channelExtent';
import { clamp, computeSimulatorPose, projectToSector, type SimulatorProbePose } from './pose';
import { QuestHud } from './QuestHud';
import {
  beginQuest,
  buildQuestTargets,
  completeQuestTarget,
  markQuestHintUsed,
  QUEST_HOLD_MS,
  questTargetImaged,
  readQuestBestScore,
  skipQuestTarget,
  writeQuestBestScore,
  type QuestState,
} from './questMode';
import { ContinuousSectorView } from './ContinuousSectorView';
import { acousticSectorItems, useAcousticVolume } from './acousticAdapter';
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
import { useScopeTrackerInput, type ScopeTrackerFrameHandlers } from './useScopeTrackerInput';
import { useSimulatorCase, useSimulatorSectorSnapshot } from './useSimulatorCase';

const SIMULATOR_STATE_STORAGE_KEY = 'socal-ebus-prep:simulator-state:v2';
const HARDWARE_SCOPE_STORAGE_KEY = 'socal-ebus-prep:hardware-scope:v1';
// Physical lever -1..1 maps onto the EBUS scope's asymmetric articulation range.
const HARDWARE_FLEX_UP_MAX_DEG = 90;
const HARDWARE_FLEX_DOWN_MAX_DEG = 30;
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
// Hold-to-advance glide: frame-time-based speed with a gentle ramp, so driving reads as
// continuous motion instead of fixed millimeter pops.
const ADVANCE_TAP_STEP_MM = 0.8;
const ADVANCE_START_SPEED_MM_PER_S = 10;
const ADVANCE_MAX_SPEED_MM_PER_S = 30;
const ADVANCE_RAMP_MM_PER_S2 = 24;
// Keep a dragged drive pad at least this far inside the workspace edges.
const DRIVE_PAD_EDGE_MARGIN_PX = 6;

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

type SimulatorPrimaryPane = 'anatomy' | 'bronch' | 'sector';

const SIMULATOR_PRIMARY_PANES: readonly SimulatorPrimaryPane[] = ['anatomy', 'bronch', 'sector'];

/** 'grid' shows all three renditions side by side at equal size; 'focus' gives one pane the
 * large slot with the other two stacked beside it. */
export type SimulatorPaneLayout = 'grid' | 'focus';

const SIMULATOR_PANE_LAYOUTS: readonly SimulatorPaneLayout[] = ['grid', 'focus'];

export function normalizeSimulatorPaneLayout(value: unknown): SimulatorPaneLayout {
  return SIMULATOR_PANE_LAYOUTS.includes(value as SimulatorPaneLayout)
    ? (value as SimulatorPaneLayout)
    : 'grid';
}

interface PersistedSimulatorState {
  flexionDeg?: number;
  hiddenSceneStructureIds?: string[];
  layers?: Partial<SimulatorLayerState>;
  drivePadPosition?: { x: number; y: number };
  lineIndex?: number;
  lockSceneView?: boolean;
  paneLayout?: string;
  primaryPane?: string;
  /** Manual adjustment around the automatically stabilized airway view. */
  rollTrimDeg?: number;
  /** Legacy v2 field; intentionally ignored so old raw-roll state cannot mask the new default. */
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

export function shouldShowVirtualBronchoscopyPane({
  showVirtualBronchoscopy,
}: {
  showVirtualBronchoscopy: boolean;
}) {
  return showVirtualBronchoscopy;
}

function normalizeSimulatorLayers(layers: Partial<SimulatorLayerState> | null | undefined): SimulatorLayerState {
  return {
    ...DEFAULT_LAYERS,
    ...(layers ?? {}),
    nodes: false,
    centerline: false,
  };
}

function normalizeDrivePadPosition(value: unknown): { x: number; y: number } | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const { x, y } = value as { x?: unknown; y?: unknown };
  return typeof x === 'number' && Number.isFinite(x) && typeof y === 'number' && Number.isFinite(y)
    ? { x: Math.max(0, x), y: Math.max(0, y) }
    : null;
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

function localizeSimulatorStructureLabel(label: string, t: (source: string) => string) {
  return t(label.replace(/\s+region$/i, ''));
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

interface KnnGraphBase {
  edges: PointCloudGraphEdge[];
  medianNearestDistanceMm: number;
}

/**
 * The neighbor search is O(n²) over a point cloud but depends only on the points, not the probe
 * pose — cache it per cloud so scrubbing the scope only pays the cheap per-kind edge filter.
 */
const knnGraphBaseCache = new WeakMap<Vec3[], KnnGraphBase>();

function knnGraphBase(points: Vec3[]): KnnGraphBase {
  const cached = knnGraphBaseCache.get(points);

  if (cached) {
    return cached;
  }

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

  const base: KnnGraphBase = {
    edges: Array.from(edgeMap.values()),
    medianNearestDistanceMm: median(nearestDistances),
  };
  knnGraphBaseCache.set(points, base);
  return base;
}

function buildKnnGraph(points: Vec3[], kind: 'node' | 'vessel'): PointCloudGraphEdge[] {
  const { edges, medianNearestDistanceMm } = knnGraphBase(points);
  const adaptiveMaxEdgeMm = clamp(
    medianNearestDistanceMm * 4.5,
    LIVE_MIN_GRAPH_EDGE_MM[kind],
    LIVE_MAX_GRAPH_EDGE_MM[kind],
  );
  const maxDistanceSq = adaptiveMaxEdgeMm * adaptiveMaxEdgeMm;

  return edges.filter((edge) => edge.distanceSq <= maxDistanceSq);
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
  const alpha = rasterized.alpha;

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

/**
 * Structures shown behind the semi-transparent channel wall in the optical pane's see-through
 * mode: every station region and flow channel with loaded points, carrying the same colors the
 * external anatomy view uses so the two panes read consistently.
 */
export function simulatorBronchOverlayStructures(
  caseData: SimulatorCaseManifest,
  assets: SimulatorLoadedAssets,
): SimulatorBronchOverlayStructure[] {
  const stations = caseData.assets.stations.map((station) => ({
    key: station.key,
    kind: 'station' as const,
    color: station.color,
    points: assets.stations[station.key]?.points ?? [],
  }));
  const vessels = caseData.assets.vessels.map((vessel) => ({
    key: vessel.key,
    kind: 'vessel' as const,
    color: vessel.color,
    points: assets.vessels[vessel.key]?.points ?? [],
  }));

  return [...stations, ...vessels].filter((structure) => structure.points.length > 0);
}

export function SimulatorPage({ showVirtualBronchoscopy = false }: { showVirtualBronchoscopy?: boolean }) {
  const t = useCourseShellText();
  const { setModuleProgress } = useLearnerProgress();
  const { assets, caseData, error } = useSimulatorCase();
  const acoustic=useAcousticVolume(caseData);
  const publicTrainingMode = useMemo(() => isPublicTrainingSimulatorMode(), []);
  const showVirtualBronchoscopyPane = shouldShowVirtualBronchoscopyPane({
    showVirtualBronchoscopy,
  });
  const [selectedKey, setSelectedKey] = useState('');
  const [lineIndex, setLineIndex] = useState<number | null>(null);
  const [sMm, setSMm] = useState(0);
  const [rollTrimDeg, setRollTrimDeg] = useState(0);
  const [flexionDeg, setFlexionDeg] = useState(0);
  const [layers, setLayers] = useState<SimulatorLayerState>(DEFAULT_LAYERS);
  const [teachingView, setTeachingView] = useState(true);
  const [activeStructure, setActiveStructure] = useState<string | null>(null);
  const [hiddenSceneStructureIds, setHiddenSceneStructureIds] = useState<string[]>([]);
  const [lockSceneView, setLockSceneView] = useState(false);
  const [simulatorStateInitialized, setSimulatorStateInitialized] = useState(false);
  const [bronchSeeThrough, setBronchSeeThrough] = useState(false);
  const [bronchBalloonInflated, setBronchBalloonInflated] = useState(false);
  // Which pane occupies the large slot of the focus layout; the other two stack beside it.
  const [primaryPane, setPrimaryPane] = useState<SimulatorPrimaryPane>('bronch');
  // Tri-view grid (all renditions full-frame at once) vs. the one-large-slot focus layout.
  const [paneLayout, setPaneLayout] = useState<SimulatorPaneLayout>('grid');
  // Animation-frame id for the drive pad's hold-to-advance glide.
  const advanceHoldRef = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (advanceHoldRef.current !== null) {
        window.cancelAnimationFrame(advanceHoldRef.current);
      }
    },
    [],
  );

  // Draggable drive pad: the pad can be moved anywhere over the workspace (wide layouts only —
  // the stacked layout keeps it sticky). Drags mutate the style directly and commit to state
  // (and persistence) on release, so the page never re-renders per pointer move.
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const drivePadRef = useRef<HTMLDivElement | null>(null);
  const drivePadDragRef = useRef<{ pointerId: number; offsetX: number; offsetY: number; lastX?: number; lastY?: number } | null>(null);
  const [drivePadPosition, setDrivePadPosition] = useState<{ x: number; y: number } | null>(null);
  // Layout switches can shrink the workspace; keep a custom pad position inside it.
  useEffect(() => {
    const workspace = workspaceRef.current;

    if (!workspace || !drivePadPosition) {
      return;
    }

    const clampPadIntoWorkspace = () => {
      const pad = drivePadRef.current;

      if (!pad) {
        return;
      }

      const workspaceRect = workspace.getBoundingClientRect();
      const padRect = pad.getBoundingClientRect();
      setDrivePadPosition((current) => {
        if (!current) {
          return current;
        }

        const x = clamp(
          current.x,
          DRIVE_PAD_EDGE_MARGIN_PX,
          Math.max(DRIVE_PAD_EDGE_MARGIN_PX, workspaceRect.width - padRect.width - DRIVE_PAD_EDGE_MARGIN_PX),
        );
        const y = clamp(
          current.y,
          DRIVE_PAD_EDGE_MARGIN_PX,
          Math.max(DRIVE_PAD_EDGE_MARGIN_PX, workspaceRect.height - padRect.height - DRIVE_PAD_EDGE_MARGIN_PX),
        );
        return x === current.x && y === current.y ? current : { x, y };
      });
    };
    const observer = new ResizeObserver(clampPadIntoWorkspace);
    observer.observe(workspace);
    return () => observer.disconnect();
  }, [drivePadPosition]);

  // Physical scope tracker (USB HID). Handlers are assigned below, after the drive
  // helpers they reuse are defined; the hook reads them through the ref per frame.
  const [hardwareScopeEnabled, setHardwareScopeEnabled] = useState(
    () => window.localStorage.getItem(HARDWARE_SCOPE_STORAGE_KEY) !== 'off',
  );
  const scopeHandlersRef = useRef<ScopeTrackerFrameHandlers | null>(null);
  const scopeProgressMarkedRef = useRef(false);
  const scopeTracker = useScopeTrackerInput(hardwareScopeEnabled, scopeHandlersRef);
  useEffect(() => {
    window.localStorage.setItem(HARDWARE_SCOPE_STORAGE_KEY, hardwareScopeEnabled ? 'on' : 'off');
  }, [hardwareScopeEnabled]);

  const selectedPreset = useMemo(() => {
    if (!caseData?.presets.length) {
      return null;
    }

    return caseData.presets.find((preset) => preset.preset_key === selectedKey) ?? null;
  }, [caseData, selectedKey]);

  const fallbackPreset = useMemo(() => caseData?.presets[0] ?? null, [caseData]);

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
      setRollTrimDeg(0);
      setFlexionDeg(0);
      setLayers(normalizeSimulatorLayers(undefined));
      setTeachingView(true);
      setHiddenSceneStructureIds([]);
      setLockSceneView(true);
      setActiveStructure(null);
      setSimulatorStateInitialized(true);
      return;
    }

    const persisted = readPersistedState();
    // An empty persisted key means the session ended in free drive; restore it rather than
    // falling back to a station.
    const persistedFreeDrive = persisted?.selectedKey === '';
    const persistedPreset = caseData.presets.find((preset) => preset.preset_key === persisted?.selectedKey);
    const firstPreset = persistedPreset ?? first;
    setSelectedKey(persistedFreeDrive ? '' : firstPreset.preset_key);
    setLineIndex(
      typeof persisted?.lineIndex === 'number'
        ? persisted.lineIndex
        : persistedFreeDrive
          ? publicStartLineIndex
          : firstPreset.line_index,
    );
    setSMm(
      typeof persisted?.sMm === 'number' ? persisted.sMm : persistedFreeDrive ? 0 : firstPreset.centerline_s_mm,
    );
    setRollTrimDeg(
      typeof persisted?.rollTrimDeg === 'number'
        ? clampProbeRollDeg(persisted.rollTrimDeg)
        : 0,
    );
    setFlexionDeg(typeof persisted?.flexionDeg === 'number' ? clamp(persisted.flexionDeg, -30, 90) : 0);
    setLayers(normalizeSimulatorLayers(persisted?.layers));
    setTeachingView(typeof persisted?.teachingView === 'boolean' ? persisted.teachingView : true);
    setHiddenSceneStructureIds(normalizeHiddenSceneStructureIds(persisted?.hiddenSceneStructureIds));
    setLockSceneView(typeof persisted?.lockSceneView === 'boolean' ? persisted.lockSceneView : false);
    if (SIMULATOR_PRIMARY_PANES.includes(persisted?.primaryPane as SimulatorPrimaryPane)) {
      setPrimaryPane(persisted?.primaryPane as SimulatorPrimaryPane);
    }
    setPaneLayout(normalizeSimulatorPaneLayout(persisted?.paneLayout));
    setDrivePadPosition(normalizeDrivePadPosition(persisted?.drivePadPosition));
    setSimulatorStateInitialized(true);
  }, [caseData, publicTrainingMode, simulatorStateInitialized]);

  useEffect(() => {
    if (publicTrainingMode || !simulatorStateInitialized) {
      return;
    }

    // An empty selectedKey persists free drive; lineIndex keeps the driven branch across reloads.
    const persistedLineIndex = lineIndex ?? selectedPreset?.line_index ?? fallbackPreset?.line_index;
    writePersistedState({
      ...(drivePadPosition ? { drivePadPosition } : {}),
      flexionDeg,
      hiddenSceneStructureIds,
      layers,
      ...(typeof persistedLineIndex === 'number' ? { lineIndex: persistedLineIndex } : {}),
      lockSceneView,
      paneLayout,
      primaryPane,
      rollTrimDeg,
      sMm,
      selectedKey: selectedPreset?.preset_key ?? '',
      teachingView,
    });
  }, [
    drivePadPosition,
    fallbackPreset,
    flexionDeg,
    hiddenSceneStructureIds,
    layers,
    lineIndex,
    lockSceneView,
    paneLayout,
    primaryPane,
    publicTrainingMode,
    rollTrimDeg,
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
    const anchorPreset = selectedPreset ?? fallbackPreset;

    if (!assets?.centerlines.polylines.length || !anchorPreset) {
      return null;
    }

    const resolvedLineIndex = lineIndex ?? anchorPreset.line_index;

    return (
      assets.centerlines.polylines.find((polyline) => polyline.line_index === resolvedLineIndex) ??
      assets.centerlines.polylines.find((polyline) => polyline.line_index === anchorPreset.line_index) ??
      assets.centerlines.polylines[0]
    );
  }, [assets, fallbackPreset, lineIndex, selectedPreset]);

  const airwayNavigationModel = useMemo(
    () =>
      caseData && assets
        ? resolveAirwayNavigationModel(caseData, assets.centerlines.polylines)
        : null,
    [assets, caseData],
  );

  // With a station selected, its preset drives the pose (wall contact + target aim). In free
  // drive a synthetic centered preset keeps the scope on the centerline of the active branch.
  const navigationPreset = useMemo(() => {
    if (selectedPreset) {
      return selectedPreset;
    }

    return activePolyline ? freeDrivePresetForLine(activePolyline) : fallbackPreset;
  }, [activePolyline, fallbackPreset, selectedPreset]);

  // The asset centerlines can overrun the channel surface's distal end by a few millimeters;
  // driving there puts the scope outside the model, so the advance rail stops at the surface.
  const channelRaycastMesh = useMemo(
    () => (assets ? buildChannelRaycastMesh(assets.airway) : null),
    [assets],
  );
  const maxAdvanceMm = useMemo(() => {
    if (!activePolyline) {
      return 0;
    }

    return channelRaycastMesh
      ? maxDrivableSMm(activePolyline, channelRaycastMesh)
      : activePolyline.total_length_mm;
  }, [activePolyline, channelRaycastMesh]);

  useEffect(() => {
    if (sMm > maxAdvanceMm) {
      setSMm(maxAdvanceMm);
    }
  }, [maxAdvanceMm, sMm]);

  const bronchOverlayStructures = useMemo(
    () => (caseData && assets ? simulatorBronchOverlayStructures(caseData, assets) : []),
    [assets, caseData],
  );

  // Free-drive branch labels: the primary line reads as the main airway; other centerlines are
  // named by the approach and stations of the presets that use them (e.g. "RMS — 11Ri, 11Rs, 7"),
  // so trainees pick branches by anatomy rather than line numbers.
  const branchLabels = useMemo(() => {
    const labels = new Map<number, string>();

    if (!caseData) {
      return labels;
    }

    const presetsByLine = new Map<number, SimulatorPreset[]>();
    for (const preset of caseData.presets) {
      const group = presetsByLine.get(preset.line_index) ?? [];
      group.push(preset);
      presetsByLine.set(preset.line_index, group);
    }

    for (const [index, group] of presetsByLine) {
      const approaches = [...new Set(group.map((preset) => preset.approach))].filter(
        (approach) => approach !== 'default',
      );
      const stations = [...new Set(group.map((preset) => formatSimulatorStation(preset.station)))].sort();
      const stationText = `${stations.slice(0, 4).join(', ')}${stations.length > 4 ? '…' : ''}`;

      if (index === caseData.navigation.primary_line_index) {
        labels.set(index, 'Main airway');
      } else if (approaches.length) {
        labels.set(index, `${approaches.map((approach) => approach.toUpperCase()).join('/')} — ${stationText}`);
      } else {
        labels.set(index, stationText);
      }
    }

    // The primary line is the main airway even when no preset references it.
    const primaryLineIndex = caseData.navigation.primary_line_index;
    if (typeof primaryLineIndex === 'number' && !labels.has(primaryLineIndex)) {
      labels.set(primaryLineIndex, 'Main airway');
    }

    return labels;
  }, [caseData]);

  // Build an unrolled reference frame first. Free drive uses it to calculate an anatomically
  // stabilized camera/probe roll; station snaps retain their calibrated snapshot roll.
  const cameraPose = useMemo(() => {
    if (!activePolyline || !navigationPreset) {
      return null;
    }

    return computeSimulatorPose(activePolyline, sMm, 0, navigationPreset);
  }, [activePolyline, navigationPreset, sMm]);

  const standardRollDeg = useMemo(() => {
    if (selectedPreset) {
      return caseData?.render_defaults.roll_deg ?? 0;
    }

    if (!airwayNavigationModel || !activePolyline || !cameraPose) {
      return 0;
    }

    return standardAirwayRollDeg(
      airwayNavigationModel,
      activePolyline,
      sMm,
      cameraPose,
    );
  }, [activePolyline, airwayNavigationModel, cameraPose, caseData, sMm, selectedPreset]);

  const rollDeg = normalizeAirwayRollDeg(standardRollDeg + rollTrimDeg);

  const pose = useMemo(() => {
    if (!activePolyline || !navigationPreset) {
      return null;
    }

    const raw = computeSimulatorPose(activePolyline, sMm, rollDeg, navigationPreset, flexionDeg);

    // The flexion tip shift is unconstrained in the pose model; the channel wall stops it here.
    // Un-flexed poses (calibrated station contacts) pass through untouched.
    return channelRaycastMesh ? clampPosePositionInsideChannel(raw, channelRaycastMesh,.2) : raw;
  }, [activePolyline, channelRaycastMesh, flexionDeg, navigationPreset, rollDeg, sMm]);

  // Acoustic coupling of the transducer face: pressed against the wall (station poses, flexed
  // free drive) reads 1; centered in the lumen with an air gap reads 0 and veils the sector.
  const sectorContactQuality = useMemo(() => {
    if (!pose || !channelRaycastMesh) {
      return 1;
    }

    return contactQualityForPose(pose, channelRaycastMesh);
  }, [channelRaycastMesh, pose]);

  const hasCurrentSnapshot = Boolean(selectedPreset && snapshot?.preset_key === selectedPreset.preset_key);
  const atSnapshotPose = Boolean(
    caseData &&
      selectedPreset &&
      activePolyline &&
      hasCurrentSnapshot &&
      // Snapshots are captured un-flexed; any flexion moves the live pose off the snapshot.
      flexionDeg === 0 &&
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

    if(caseData.assets.acoustic_volume) return acoustic.volume ? [...baseItems,...acousticSectorItems(acoustic.volume,pose,caseData)] : baseItems;

    return buildPointCloudSectorItems({
      assets,
      caseData,
      lineIndex: activePolyline.line_index,
      pose,
      selectedPreset,
      sMm,
    });
  }, [activePolyline, assets, caseData, navigationPreset, pose, sectorSource, selectedPreset, sMm, snapshot,acoustic.volume]);

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

  // --- Station Quest: the optional gamified drill. Pure rules live in questMode.ts; these hooks
  // run the clocks, the capture hold, and the celebration/beacon props for the anatomy scene.
  const [quest, setQuest] = useState<QuestState | null>(null);
  const [questCountdown, setQuestCountdown] = useState<number | null>(null);
  const [questHintActive, setQuestHintActive] = useState(false);
  const [questHoldProgress, setQuestHoldProgress] = useState(0);
  const [questElapsedMs, setQuestElapsedMs] = useState(0);
  const [questCelebration, setQuestCelebration] = useState<{ nonce: number; position: Vec3 } | null>(null);
  // Best score BEFORE the current run — the summary compares against it, so it only refreshes
  // when a new run starts (writeQuestBestScore persists improvements immediately).
  const [questBestScore, setQuestBestScore] = useState<number | null>(null);
  const questStartMsRef = useRef(0);
  const questTargetStartMsRef = useRef(0);
  const questCelebrationNonceRef = useRef(0);
  const questBestRecordedRef = useRef(false);

  const questActive = Boolean(quest?.status === 'active' && questCountdown === null);
  const activeQuestTarget = quest?.status === 'active' ? quest.targets[quest.currentIndex] ?? null : null;
  const questTargetRef = useRef(activeQuestTarget);
  questTargetRef.current = activeQuestTarget;
  const questDetected = Boolean(
    questActive &&
      activeQuestTarget &&
      questTargetImaged({
        contactQuality: sectorContactQuality,
        intersectedStructureIds,
        stationKey: activeQuestTarget.stationKey,
        stationSnapActive: Boolean(selectedPreset),
      }),
  );
  const questBeacon = useMemo(
    () => (questHintActive && activeQuestTarget ? { position: activeQuestTarget.position } : null),
    [questHintActive, activeQuestTarget],
  );

  useEffect(() => {
    if (caseData) {
      setQuestBestScore(readQuestBestScore(caseData.case_id));
    }
  }, [caseData]);

  // Pre-run countdown 3 → 2 → 1 → GO; the clocks arm when GO clears.
  useEffect(() => {
    if (questCountdown === null) {
      return;
    }

    if (questCountdown === 0) {
      const id = window.setTimeout(() => {
        const now = performance.now();
        questStartMsRef.current = now;
        questTargetStartMsRef.current = now;
        setQuestElapsedMs(0);
        setQuestCountdown(null);
      }, 650);
      return () => window.clearTimeout(id);
    }

    const id = window.setTimeout(() => setQuestCountdown(questCountdown - 1), 850);
    return () => window.clearTimeout(id);
  }, [questCountdown]);

  useEffect(() => {
    if (!questActive) {
      return;
    }

    const id = window.setInterval(() => setQuestElapsedMs(performance.now() - questStartMsRef.current), 250);
    return () => window.clearInterval(id);
  }, [questActive]);

  // Capture hold: while the target stays imaged the ring fills; a full hold banks the target,
  // fires the 3D burst at it, and advances the quest. Losing the image resets the ring.
  const activeQuestTargetKey = activeQuestTarget?.stationKey ?? null;
  useEffect(() => {
    if (!questDetected || !activeQuestTargetKey) {
      setQuestHoldProgress(0);
      return;
    }

    const startedAt = performance.now();
    const id = window.setInterval(() => {
      const progress = Math.min((performance.now() - startedAt) / QUEST_HOLD_MS, 1);
      setQuestHoldProgress(progress);

      if (progress < 1) {
        return;
      }

      window.clearInterval(id);
      const captured = questTargetRef.current;
      const capturedElapsedMs = performance.now() - questTargetStartMsRef.current;
      questTargetStartMsRef.current = performance.now();
      setQuestHoldProgress(0);
      setQuestHintActive(false);
      if (captured) {
        questCelebrationNonceRef.current += 1;
        setQuestCelebration({ nonce: questCelebrationNonceRef.current, position: captured.position });
      }
      setQuestElapsedMs(performance.now() - questStartMsRef.current);
      setQuest((current) =>
        current && current.status === 'active' ? completeQuestTarget(current, capturedElapsedMs) : current,
      );
    }, 80);

    return () => window.clearInterval(id);
  }, [questDetected, activeQuestTargetKey]);

  // A finished run persists an improved best score once and bumps module progress.
  useEffect(() => {
    if (!caseData || quest?.status !== 'complete' || questBestRecordedRef.current) {
      return;
    }

    questBestRecordedRef.current = true;
    if (quest.score > 0 && (questBestScore === null || quest.score > questBestScore)) {
      writeQuestBestScore(caseData.case_id, quest.score);
    }
    setModuleProgress('simulator', 75);
  }, [caseData, quest, questBestScore, setModuleProgress]);

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

  if (
    !caseData ||
    !assets ||
    !navigationPreset ||
    !activePolyline ||
    !airwayNavigationModel ||
    !pose ||
    !cameraPose
  ) {
    return (
      <main className="simulator-load-shell">
        <section className="simulator-load-panel">
          <h1>{t('EBUS Simulator')}</h1>
          <p>{t('Loading static case geometry...')}</p>
        </section>
      </main>
    );
  }

  const airwayRegion = airwayRegionAtPose(airwayNavigationModel, activePolyline, sMm);
  const airwaySide = airwaySideForLine(airwayNavigationModel, activePolyline);
  const airwayRegionLabel =
    airwayRegion === 'trachea'
      ? t('Trachea')
      : airwayRegion === 'right-mainstem'
        ? t('Right mainstem')
        : t('Left mainstem');
  const standardViewActive = Math.abs(rollTrimDeg) < 0.5;

  const snapToPreset = (preset: SimulatorPreset) => {
    setSelectedKey(preset.preset_key);
    setLineIndex(preset.line_index);
    setSMm(preset.centerline_s_mm);
    setRollTrimDeg(0);
    // Station presets are calibrated contact poses; the tip arrives there un-flexed.
    setFlexionDeg(0);
    setActiveStructure(preset.station_key);
    setModuleProgress('simulator', 55);
  };

  // Station Quest handlers. Starting releases any station snap (the quest is a free-drive
  // exercise — snapping to the answer would be a teleport) but keeps the scope where it is.
  const startStationQuest = () => {
    const targets = buildQuestTargets(caseData.presets);

    if (!targets.length) {
      return;
    }

    setSelectedKey('');
    setLineIndex(activePolyline.line_index);
    setRollTrimDeg(0);
    setActiveStructure(null);
    setQuestBestScore(readQuestBestScore(caseData.case_id));
    questBestRecordedRef.current = false;
    setQuest(beginQuest(targets));
    setQuestCountdown(3);
    setQuestHintActive(false);
    setQuestHoldProgress(0);
    setQuestElapsedMs(0);
    setQuestCelebration(null);
    setModuleProgress('simulator', 45);
  };
  const endStationQuest = () => {
    setQuest(null);
    setQuestCountdown(null);
    setQuestHintActive(false);
    setQuestHoldProgress(0);
    setQuestCelebration(null);
  };
  const useStationQuestHint = () => {
    setQuestHintActive(true);
    setQuest((current) => (current ? markQuestHintUsed(current) : current));
  };
  const skipStationQuestTarget = () => {
    const skippedElapsedMs = performance.now() - questTargetStartMsRef.current;
    questTargetStartMsRef.current = performance.now();
    setQuestHintActive(false);
    setQuestHoldProgress(0);
    setQuest((current) =>
      current && current.status === 'active' ? skipQuestTarget(current, skippedElapsedMs) : current,
    );
  };

  const selectAirway = (side: SimulatorAirwaySide) => {
    const targetLineIndex =
      side === 'right'
        ? airwayNavigationModel.rightLineIndex
        : airwayNavigationModel.leftLineIndex;
    const result = projectToAirway(
      assets.centerlines.polylines,
      activePolyline,
      sMm,
      targetLineIndex,
    );

    if (result) {
      setSelectedKey('');
      setLineIndex(result.lineIndex);
      setSMm(result.sMm);
      setRollTrimDeg(0);
      setActiveStructure(null);
      setModuleProgress('simulator', 45);
    }
  };

  // Drive-pad advance keys: a tap nudges once; holding glides — an animation-frame loop advances
  // by speed·dt with a gentle ramp, so motion is continuous and frame-rate independent. Pointer
  // events only, so a tap does not double-fire through click. Keyboard handlers mirror the same
  // press/hold behavior for Enter and Space. (The ref and cleanup effect live with the other
  // hooks, above the loading early-return.)
  const stopAdvanceHold = () => {
    if (advanceHoldRef.current !== null) {
      window.cancelAnimationFrame(advanceHoldRef.current);
      advanceHoldRef.current = null;
    }
  };
  const constrainAdvance=(current:number,requested:number)=>{
    const target=clamp(requested,0,maxAdvanceMm);
    if(!channelRaycastMesh||!activePolyline||!navigationPreset)return current;
    return constrainedPathAdvance(current,target,s=>clampPosePositionInsideChannel(computeSimulatorPose(activePolyline,s,rollDeg,navigationPreset,flexionDeg),channelRaycastMesh,.2),channelRaycastMesh);
  };
  const startAdvanceHold = (direction: 1 | -1) => {
    stopAdvanceHold();
    setSMm((current) => constrainAdvance(current,current + direction * ADVANCE_TAP_STEP_MM));
    setModuleProgress('simulator', 45);
    let lastMs = performance.now();
    let speedMmPerS = ADVANCE_START_SPEED_MM_PER_S;
    const glide = (nowMs: number) => {
      // Clamp dt so a throttled/hidden tab never teleports the scope on the next frame.
      const dt = Math.min(Math.max(nowMs - lastMs, 0) / 1000, 0.05);
      lastMs = nowMs;
      speedMmPerS = Math.min(speedMmPerS + ADVANCE_RAMP_MM_PER_S2 * dt, ADVANCE_MAX_SPEED_MM_PER_S);
      setSMm((current) => constrainAdvance(current,current + direction * speedMmPerS * dt));
      advanceHoldRef.current = window.requestAnimationFrame(glide);
    };
    advanceHoldRef.current = window.requestAnimationFrame(glide);
  };
  const advanceHoldProps = (direction: 1 | -1) => ({
    onPointerDown: () => startAdvanceHold(direction),
    onPointerUp: stopAdvanceHold,
    onPointerLeave: stopAdvanceHold,
    onPointerCancel: stopAdvanceHold,
    onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (!event.repeat && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        startAdvanceHold(direction);
      }
    },
    onKeyUp: (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        stopAdvanceHold();
      }
    },
    onBlur: stopAdvanceHold,
  });

  // Drive-pad dragging: presses on the pad's own controls never start a drag; everywhere else
  // grabs the pad. Position is workspace-relative and clamped inside it.
  const onDrivePadPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    // The stacked (narrow) layout keeps the pad sticky in flow — no dragging there. Checked live
    // rather than via state so a missed media-change event can never strand the feature.
    if (
      !window.matchMedia('(min-width: 1081px)').matches ||
      (event.target as HTMLElement).closest('button, input, label, details, summary, select')
    ) {
      return;
    }

    const pad = drivePadRef.current;

    if (!pad || !workspaceRef.current) {
      return;
    }

    const padRect = pad.getBoundingClientRect();
    drivePadDragRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - padRect.left,
      offsetY: event.clientY - padRect.top,
    };
    try {
      pad.setPointerCapture(event.pointerId);
    } catch {
      // Capture keeps fast drags attached to the pad but is not required for the drag to work.
    }
    pad.classList.add('simulator-drive-pad--dragging');
  };
  const onDrivePadPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = drivePadDragRef.current;
    const pad = drivePadRef.current;
    const workspace = workspaceRef.current;

    if (!drag || drag.pointerId !== event.pointerId || !pad || !workspace) {
      return;
    }

    const workspaceRect = workspace.getBoundingClientRect();
    const padRect = pad.getBoundingClientRect();
    const x = clamp(
      event.clientX - workspaceRect.left - drag.offsetX,
      DRIVE_PAD_EDGE_MARGIN_PX,
      Math.max(DRIVE_PAD_EDGE_MARGIN_PX, workspaceRect.width - padRect.width - DRIVE_PAD_EDGE_MARGIN_PX),
    );
    const y = clamp(
      event.clientY - workspaceRect.top - drag.offsetY,
      DRIVE_PAD_EDGE_MARGIN_PX,
      Math.max(DRIVE_PAD_EDGE_MARGIN_PX, workspaceRect.height - padRect.height - DRIVE_PAD_EDGE_MARGIN_PX),
    );
    pad.style.left = `${x}px`;
    pad.style.top = `${y}px`;
    pad.style.bottom = 'auto';
    pad.style.right = 'auto';
    drag.lastX = x;
    drag.lastY = y;
  };
  const onDrivePadPointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = drivePadDragRef.current;

    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    drivePadDragRef.current = null;
    const pad = drivePadRef.current;
    pad?.classList.remove('simulator-drive-pad--dragging');
    if (typeof drag.lastX === 'number' && typeof drag.lastY === 'number') {
      setDrivePadPosition({ x: drag.lastX, y: drag.lastY });
    }
  };

  // Latest-ref handlers for the physical scope tracker: reassigned every render so the
  // rAF poll loop (useScopeTrackerInput) always sees fresh state and helpers.
  scopeHandlersRef.current = {
    onFrame: (frame, deltas) => {
      const markProgress = () => {
        if (!scopeProgressMarkedRef.current) {
          scopeProgressMarkedRef.current = true;
          setModuleProgress('simulator', 45);
        }
      };

      if (Math.abs(deltas.dDepthMm) > 0.01) {
        setSMm((current) => {
          const next = constrainAdvance(current,current + deltas.dDepthMm);
          return Math.abs(next - current) < 0.02 ? current : next;
        });
        markProgress();
      }

      const dRollDeg = (deltas.dRollRad * 180) / Math.PI;
      if (Math.abs(dRollDeg) > 0.02) {
        setRollTrimDeg((current) => {
          const next = clampProbeRollDeg(current + dRollDeg);
          return Math.abs(next - current) < 0.02 ? current : next;
        });
        markProgress();
      }

      const targetFlexionDeg =
        frame.flexion >= 0
          ? frame.flexion * HARDWARE_FLEX_UP_MAX_DEG
          : frame.flexion * HARDWARE_FLEX_DOWN_MAX_DEG;
      setFlexionDeg((current) => (Math.abs(targetFlexionDeg - current) < 0.25 ? current : targetFlexionDeg));

      if (frame.pressed.a) {
        setBronchBalloonInflated((value) => !value);
      }
      if (frame.pressed.b) {
        setBronchSeeThrough((value) => !value);
      }
      if (frame.pressed.c) {
        selectAirway('left');
      }
      if (frame.pressed.d) {
        selectAirway('right');
      }
    },
    onDisconnect: () => {
      scopeProgressMarkedRef.current = false;
    },
  };

  // Layout switches: Enlarge promotes a pane into the focus layout's large slot; "All views"
  // returns to the tri-view grid where every rendition is full-frame.
  const focusPane = (pane: SimulatorPrimaryPane) => {
    setPrimaryPane(pane);
    setPaneLayout('focus');
  };
  const showAllPanes = () => setPaneLayout('grid');
  const paneEnlargeHandler = (pane: SimulatorPrimaryPane) =>
    showVirtualBronchoscopyPane && (paneLayout === 'grid' || primaryPane !== pane)
      ? () => focusPane(pane)
      : null;
  const paneShowAllHandler = (pane: SimulatorPrimaryPane) =>
    showVirtualBronchoscopyPane && paneLayout === 'focus' && primaryPane === pane ? showAllPanes : null;
  const anatomyEnlarge = paneEnlargeHandler('anatomy');
  const anatomyShowAll = paneShowAllHandler('anatomy');
  const bronchEnlarge = paneEnlargeHandler('bronch');
  const bronchShowAll = paneShowAllHandler('bronch');
  // Side panes of the focus layout render with trimmed chrome so the image keeps the slot.
  const paneCompact = (pane: SimulatorPrimaryPane) =>
    showVirtualBronchoscopyPane && paneLayout === 'focus' && primaryPane !== pane;

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
          <div className="eyebrow">{t('Interactive EBUS simulator')}</div>
          <h1>{t('EBUS Anatomy Correlation Simulator')}</h1>
          <p>
            {t(
              'Navigate the airway, rotate and flex the scope to scan, and correlate live ultrasound with the surrounding anatomy. Use station views to learn the landmarks and station quests to practice.',
            )}
          </p>
        </div>
        <aside>
          {t(
            'Simulated anatomy and EBUS-style views are for orientation training only. They are not clinically validated diagnostic images.',
          )}
        </aside>
      </section>

      <section className="simulator-topbar">
        <div>
          <span className="eyebrow">{t(caseData.case_id)}</span>
          <h2>{selectedPreset ? `${t('Station')} ${formatSimulatorStation(selectedPreset.station)}` : t('Free airway drive')}</h2>
        </div>
        <div className="simulator-status-strip">
          {!quest ? (
            <button className="simulator-button simulator-quest-launch" onClick={startStationQuest} type="button">
              <span aria-hidden="true">🎯</span> {t('Station quest')}
            </button>
          ) : null}
          <span>{selectedPreset?.approach ?? airwayRegionLabel}</span>
          <span>{Math.round(sMm)} mm</span>
          <span>{t(simulatorSectorSourceLabel(sectorSource))}</span>
        </div>
      </section>

      <section className="simulator-control-rail" aria-label={t('Simulator controls')}>
        <label>
          <span>{t('Station snap')}</span>
          <select
            disabled={quest?.status === 'active'}
            title={quest?.status === 'active' ? t('Station snap is disabled during a quest') : undefined}
            value={selectedPreset?.preset_key ?? ''}
            onChange={(event) => {
              if (!event.target.value) {
                // Release the station snap but keep the scope where it is, so free drive
                // continues from the current position on the current branch.
                setSelectedKey('');
                setLineIndex(activePolyline.line_index);
                setRollTrimDeg(0);
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
            <option value="">{t('Free drive - no station snap')}</option>
            {caseData.presets.map((preset) => (
              <option key={preset.preset_key} value={preset.preset_key}>
                {preset.label}
              </option>
            ))}
          </select>
        </label>
        <label className="simulator-hardware-control">
          <span>{t('Hardware scope')}</span>
          <span className="simulator-hardware-control__row">
            <input
              checked={hardwareScopeEnabled}
              onChange={(event) => setHardwareScopeEnabled(event.target.checked)}
              type="checkbox"
            />
            <span
              className={`simulator-hardware-chip ${
                scopeTracker.connected ? 'simulator-hardware-chip--connected' : ''
              } ${scopeTracker.lowQuality ? 'simulator-hardware-chip--warning' : ''}`}
              title={
                scopeTracker.lowQuality
                  ? t('Low optical tracking quality - replace the wiper ring or wipe the scope cord')
                  : (scopeTracker.deviceId ??
                    t('Physical scope tracker drives advance, roll, and flexion when connected'))
              }
            >
              {hardwareScopeEnabled
                ? scopeTracker.connected
                  ? scopeTracker.lowQuality
                    ? t('Check tracking')
                    : t('Scope connected')
                  : t('No scope')
                : t('Off')}
            </span>
          </span>
        </label>
        <div className="simulator-layer-toggles" aria-label={t('Anatomy layers')}>
          <label>
            <input checked={teachingView} onChange={() => setTeachingView((current) => !current)} type="checkbox" />
            <span>{t('teaching')}</span>
          </label>
          <label>
            <input checked={lockSceneView} onChange={() => setLockSceneView((current) => !current)} type="checkbox" />
            <span>{t('lock view')}</span>
          </label>
          {VIEWABLE_LAYER_KEYS.map((key) => (
            <label key={key}>
              <input checked={layers[key]} onChange={() => updateLayer(key)} type="checkbox" />
              <span>{t(SIMULATOR_LAYER_LABELS[key])}</span>
            </label>
          ))}
        </div>
      </section>

      <div
        className={`simulator-workspace${showVirtualBronchoscopyPane ? ' simulator-workspace--virtual' : ''}`}
        data-layout={paneLayout}
        data-primary={primaryPane}
        ref={workspaceRef}
      >
        <section
          className={`simulator-scene-pane${paneCompact('anatomy') ? ' simulator-pane--compact' : ''}`}
          aria-label={t('External anatomy view')}
        >
          <div className="simulator-pane-header">
            <div>
              <span className="eyebrow">{t('External anatomy')}</span>
              <h2>{t('Scope, airway, vessels, lymph nodes, and fan')}</h2>
            </div>
            <div className="simulator-scene-actions">
              {anatomyEnlarge ? (
                <button className="simulator-sector-style-toggle" onClick={anatomyEnlarge} type="button">
                  {t('Enlarge')}
                </button>
              ) : null}
              {anatomyShowAll ? (
                <button className="simulator-sector-style-toggle" onClick={anatomyShowAll} type="button">
                  {t('All views')}
                </button>
              ) : null}
              <details className="simulator-structure-dropdown">
                <summary>
                  <span>{t('3D structures')}</span>
                  <span>{sceneVisibleCount}/{sceneStructureVisibilityItems.length}</span>
                </summary>
                <div className="simulator-structure-dropdown__menu">
                  <div className="simulator-structure-dropdown__actions">
                    <span>{t('Visible in 3D')}</span>
                    <button type="button" onClick={showAllSceneStructures}>
                      {t('Show all')}
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
                          {kind === 'node' ? t('Lymph nodes') : t('Vessels')}
                        </div>
                        {groupItems.map((item) => (
                          <label className="simulator-structure-dropdown__row" key={item.id}>
                            <input
                              checked={!hiddenSceneStructureSet.has(item.id)}
                              onChange={(event) => updateSceneStructureVisibility(item.id, event.target.checked)}
                              type="checkbox"
                            />
                            <span className="simulator-swatch" style={{ backgroundColor: item.color }} />
                            <span>{localizeSimulatorStructureLabel(item.label, t)}</span>
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
                {t('Snap')}
              </button>
            </div>
          </div>
          <AnatomyScene
            activeStructure={null}
            assets={assets}
            cameraPose={cameraPose}
            caseData={caseData}
            celebration={questCelebration}
            hiddenStructureIds={hiddenSceneStructureSet}
            intersectedStructureIds={intersectedStructureIds}
            layers={layers}
            lockView={lockSceneView}
            pose={pose}
            questBeacon={questBeacon}
            selectedPreset={selectedPreset}
            teachingView={teachingView}
          />
        </section>

        {showVirtualBronchoscopyPane ? (
          <section
            className={`simulator-scene-pane simulator-bronch-pane${paneCompact('bronch') ? ' simulator-pane--compact' : ''}`}
            aria-label={t('Virtual bronchoscopy view')}
          >
            <div className="simulator-pane-header">
              <div>
                <span className="eyebrow">{t('Virtual bronchoscopy')}</span>
                <h2>{t('Endoluminal view from the scope tip')}</h2>
              </div>
              <div className="simulator-status-strip">
                {bronchEnlarge ? (
                  <button className="simulator-sector-style-toggle" onClick={bronchEnlarge} type="button">
                    {t('Enlarge')}
                  </button>
                ) : null}
                {bronchShowAll ? (
                  <button className="simulator-sector-style-toggle" onClick={bronchShowAll} type="button">
                    {t('All views')}
                  </button>
                ) : null}
                <button
                  aria-pressed={bronchBalloonInflated}
                  className="simulator-sector-style-toggle"
                  onClick={() => setBronchBalloonInflated((value) => !value)}
                  type="button"
                >
                  {t('Balloon')}
                </button>
                <button
                  aria-pressed={bronchSeeThrough}
                  className="simulator-sector-style-toggle"
                  onClick={() => setBronchSeeThrough((value) => !value)}
                  type="button"
                >
                  {t('See-through')}
                </button>
                <span>{Math.round(sMm)} mm</span>
              </div>
            </div>
            <BronchoscopyView
              assets={assets}
              balloonInflated={bronchBalloonInflated}
              camera={caseData.endoscope_camera}
              caseData={caseData}
              focusStationKey={selectedPreset?.station_key ?? null}
              pose={pose}
              seeThroughWall={bronchSeeThrough}
              structures={bronchOverlayStructures}
            />
          </section>
        ) : null}

        {caseData.assets.acoustic_volume ? <ContinuousSectorView caseData={caseData} volume={acoustic.volume} error={acoustic.error} pose={pose} contactQuality={sectorContactQuality} compact={paneCompact('sector')} assessment={questActive&&!questHintActive} onEnlarge={paneEnlargeHandler('sector')} onShowAll={paneShowAllHandler('sector')} selectedPreset={selectedPreset} activeStructure={activeStructure} setActiveStructure={setActiveStructure}/> : (
        <SectorView
          pose={pose}
          activeStructure={activeStructure}
          caseData={caseData}
          compact={paneCompact('sector')}
          contactQuality={sectorContactQuality}
          items={sectorItems}
          onEnlarge={paneEnlargeHandler('sector')}
          onShowAll={paneShowAllHandler('sector')}
          selectedPreset={selectedPreset}
          setActiveStructure={setActiveStructure}
          source={sectorSource}
        />
        )}
        <div
          className="simulator-drive-pad"
          data-airway-region={airwayRegion}
          data-effective-roll-deg={rollDeg.toFixed(2)}
          data-line-index={activePolyline.line_index}
          data-roll-trim-deg={rollTrimDeg.toFixed(2)}
          data-s-mm={sMm.toFixed(2)}
          data-standard-roll-deg={standardRollDeg.toFixed(2)}
          role="group"
          aria-label={t('Airway navigation')}
          onPointerCancel={onDrivePadPointerEnd}
          onPointerDown={onDrivePadPointerDown}
          onPointerMove={onDrivePadPointerMove}
          onPointerUp={onDrivePadPointerEnd}
          ref={drivePadRef}
          style={
            drivePadPosition
              ? { left: drivePadPosition.x, top: drivePadPosition.y, bottom: 'auto', right: 'auto' }
              : undefined
          }
          title={t('Drag to move the drive pad')}
        >
          <div className="simulator-drive-pad__readout">
            <span aria-hidden="true" className="simulator-drive-pad__grip">
              ⠿
            </span>
            <span className="simulator-drive-pad__status">
              <strong>{t('Airway navigation')}</strong>
              <span>
                {airwayRegionLabel} · {Math.round(sMm)} mm ·{' '}
                {standardViewActive
                  ? t('Standard orientation')
                  : `${t('View rotated')} ${rollTrimDeg > 0 ? '+' : ''}${Math.round(rollTrimDeg)}°`}
              </span>
            </span>
          </div>
          <div className="simulator-drive-pad__airways" aria-label={t('Choose airway')}>
            <button
              aria-pressed={!selectedPreset && airwaySide === 'left'}
              className="simulator-drive-pad__airway"
              onClick={() => selectAirway('left')}
              type="button"
            >
              <span aria-hidden="true">L</span>
              {t('Left mainstem')}
            </button>
            <button
              aria-pressed={!selectedPreset && airwaySide === 'right'}
              className="simulator-drive-pad__airway"
              onClick={() => selectAirway('right')}
              type="button"
            >
              <span aria-hidden="true">R</span>
              {t('Right mainstem')}
            </button>
          </div>
          <div className="simulator-drive-pad__motion">
            <button
              className="simulator-drive-pad__key"
              type="button"
              {...advanceHoldProps(-1)}
            >
              {t('Withdraw')}
            </button>
            <button
              className="simulator-drive-pad__key simulator-drive-pad__key--primary"
              type="button"
              {...advanceHoldProps(1)}
            >
              {t('Advance')}
            </button>
          </div>
          <label className="simulator-drive-pad__flex">
            <span>{t('Flex tip')}</span>
            <input
              aria-label={t('Flex tip')}
              max={90}
              min={-30}
              onChange={(event) => {
                setFlexionDeg(Number(event.target.value));
                setModuleProgress('simulator', 45);
              }}
              step={1}
              type="range"
              value={flexionDeg}
            />
          </label>
          <div className="simulator-drive-pad__roll">
            <div className="simulator-drive-pad__roll-heading">
              <span>
                <strong>{t('EBUS scope roll')}</strong>
                <small id="simulator-scope-roll-help">
                  {t('Rotates the ultrasound scan plane around the airway')}
                </small>
              </span>
              <output>
                {standardViewActive
                  ? t('Standard')
                  : `${rollTrimDeg > 0 ? '+' : ''}${Math.round(rollTrimDeg)}°`}
              </output>
            </div>
            <div className="simulator-drive-pad__roll-controls">
              <button
                aria-label={t('Roll counterclockwise')}
                className="simulator-drive-pad__roll-step"
                onClick={() => {
                  setRollTrimDeg((current) => clampProbeRollDeg(current - 10));
                  setModuleProgress('simulator', 45);
                }}
                title={t('Roll counterclockwise')}
                type="button"
              >
                ↶
              </button>
              <input
                aria-describedby="simulator-scope-roll-help"
                aria-label={t('EBUS scope roll')}
                aria-valuetext={
                  standardViewActive
                    ? t('Standard')
                    : `${rollTrimDeg > 0 ? '+' : ''}${Math.round(rollTrimDeg)}°`
                }
                max={ROLL_MAX_DEG}
                min={ROLL_MIN_DEG}
                onChange={(event) => {
                  setRollTrimDeg(clampProbeRollDeg(Number(event.target.value)));
                  setModuleProgress('simulator', 45);
                }}
                step={1}
                type="range"
                value={clampProbeRollDeg(rollTrimDeg)}
              />
              <button
                aria-label={t('Roll clockwise')}
                className="simulator-drive-pad__roll-step"
                onClick={() => {
                  setRollTrimDeg((current) => clampProbeRollDeg(current + 10));
                  setModuleProgress('simulator', 45);
                }}
                title={t('Roll clockwise')}
                type="button"
              >
                ↷
              </button>
              <button
                aria-label={t('Reset standard view')}
                className="simulator-drive-pad__reset"
                disabled={standardViewActive}
                onClick={() => setRollTrimDeg(0)}
                title={t('Reset standard view')}
                type="button"
              >
                ↺ {t('Standard')}
              </button>
            </div>
          </div>
        </div>
        {quest ? (
          <QuestHud
            bestScore={questBestScore}
            branchHint={activeQuestTarget ? branchLabels.get(activeQuestTarget.lineIndex) ?? null : null}
            countdown={questCountdown}
            detected={questDetected}
            elapsedMs={questElapsedMs}
            hintActive={questHintActive}
            holdProgress={questHoldProgress}
            onDone={endStationQuest}
            onHint={useStationQuestHint}
            onQuit={endStationQuest}
            onRestart={startStationQuest}
            onSkip={skipStationQuestTarget}
            state={quest}
          />
        ) : null}
      </div>
    </div>
  );
}
