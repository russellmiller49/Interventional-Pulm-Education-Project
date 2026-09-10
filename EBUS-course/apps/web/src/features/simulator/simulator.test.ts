import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { simulatorCaseAssetUrl, simulatorManifestUrl } from './paths';
import {
  airwayRegionAtPose,
  freeDrivePresetForLine,
  projectToAirway,
  resolveAirwayNavigationModel,
  standardAirwayRollDeg,
} from './airwayNavigation';
import {
  APERTURE_FEATHER,
  APERTURE_RADIUS,
  apertureMaskAlpha,
  approachInflation,
  barrelDistortUv,
  distalTipScreenDirection,
  headlightConeGain,
  HEADLIGHT_INNER_CONE_DEG,
  HEADLIGHT_OUTER_CONE_DEG,
  insideChannelEyeDistanceMm,
  proximityPullbackMm,
  resolveEndoscopeOptics,
} from './optics';
import {
  computeSimulatorPose,
  DEFAULT_ENDOSCOPE_CAMERA,
  pointAtS,
  projectToSector,
  resolveCalibratedOpticalAxis,
  resolveEndoscopeCameraCalibration,
  resolveForwardObliqueOpticalAxis,
  resolveOpticalImageUp,
  resolveScopeFrame,
  type SimulatorProbePose,
} from './pose';
import {
  resolveSimulatorSectorSource,
  shouldUseSnapshotSectorItems,
  simulatorSectorSourceLabel,
} from './sectorSource';
import {
  DEFAULT_SECTOR_STYLE,
  normalizeSectorStyle,
  resolveSectorStyle,
  sectorRenderPath,
} from './sectorStyle';
import {
  contourIsCloseable,
  hasUsableSectorContourGeometry,
  physicsSnapshotPlacement,
  sectorItemRendersOnCanvas,
} from './SectorView';
import { parseSimulatorPhysicsSnapshot, resolveSimulatorPhysicsSnapshotRef } from './useSimulatorCase';
import { resolveLockedAnatomyCameraView } from './AnatomyScene';
import {
  buildPlaneIntersectionRasterMask,
  buildPointCloudSectorItems,
  normalizeSimulatorPaneLayout,
  shouldShowVirtualBronchoscopyPane,
  simulatorBronchOverlayStructures,
  simulatorSceneStructureVisibilityItems,
} from './SimulatorPage';
import {
  buildChannelRaycastMesh,
  clampPosePositionInsideChannel,
  contactQualityForPose,
  isInsideChannel,
  maxDrivableSMm,
  nearestSOnPolyline,
  steerToAdjacentLine,
} from './channelExtent';
import { normalizeSimulatorStationId } from './stationIds';
import type {
  SimulatorCaseManifest,
  SimulatorCenterlinePolyline,
  SimulatorLoadedAssets,
  SimulatorMeshAsset,
  SimulatorPreset,
  SimulatorSectorItem,
  SimulatorSectorSnapshot,
  Vec2,
  Vec3,
} from './types';

function readSimulatorJson<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(process.cwd(), path), 'utf8')) as T;
}

function readCaseAsset<T>(assetPath: string): T {
  return readSimulatorJson<T>(`public/simulator/case-001/${assetPath}`);
}

function loadSimulatorFixture() {
  const manifest = readCaseAsset<SimulatorCaseManifest>('case_manifest.web.json');
  const assets: SimulatorLoadedAssets = {
    airway: readCaseAsset(manifest.assets.airway_mesh),
    centerlines: readCaseAsset(manifest.assets.centerlines),
    stations: Object.fromEntries(
      manifest.assets.stations.map((asset) => [asset.key, readCaseAsset(asset.asset)]),
    ),
    vessels: Object.fromEntries(
      manifest.assets.vessels.map((asset) => [asset.key, readCaseAsset(asset.asset)]),
    ),
  };

  return { assets, manifest };
}

function liveMaskedSectorItems(
  fixture: ReturnType<typeof loadSimulatorFixture>,
  presetKey: string,
  sOffsetMm: number,
  rollDeg = fixture.manifest.render_defaults.roll_deg,
) {
  const { assets, manifest } = fixture;
  const preset = manifest.presets.find((candidate) => candidate.preset_key === presetKey);
  expect(preset).toBeDefined();
  const polyline = assets.centerlines.polylines.find((candidate) => candidate.line_index === preset?.line_index);
  expect(polyline).toBeDefined();

  if (!preset || !polyline) {
    throw new Error(`Missing simulator fixture data for ${presetKey}`);
  }

  const movedSMm = preset.centerline_s_mm + sOffsetMm;
  const pose = computeSimulatorPose(polyline, movedSMm, rollDeg, preset);

  return buildPointCloudSectorItems({
    assets,
    caseData: manifest,
    lineIndex: polyline.line_index,
    pose,
    selectedPreset: preset,
    sMm: movedSMm,
  })
    .filter((item) => item.visible && item.rasterMask?.alpha.length);
}

function liveMaskedSectorIds(
  fixture: ReturnType<typeof loadSimulatorFixture>,
  presetKey: string,
  sOffsetMm: number,
  rollDeg = fixture.manifest.render_defaults.roll_deg,
) {
  return liveMaskedSectorItems(fixture, presetKey, sOffsetMm, rollDeg).map((item) => item.id);
}

function syntheticPlanePose(): SimulatorProbePose {
  return {
    position: new THREE.Vector3(0, 0, 0),
    tangent: new THREE.Vector3(0, 1, 0),
    depthAxis: new THREE.Vector3(0, 0, 1),
    lateralAxis: new THREE.Vector3(1, 0, 0),
  };
}

function sphereSurfacePoints(center: Vec3, radiusMm: number, rings = 16, segments = 32): Vec3[] {
  const points: Vec3[] = [];

  for (let ring = 1; ring < rings; ring += 1) {
    const phi = (ring / rings) * Math.PI;
    for (let segment = 0; segment < segments; segment += 1) {
      const theta = ((segment + 0.37) / segments) * Math.PI * 2;
      points.push([
        center[0] + radiusMm * Math.sin(phi) * Math.cos(theta),
        center[1] + radiusMm * Math.sin(phi) * Math.sin(theta),
        center[2] + radiusMm * Math.cos(phi),
      ]);
    }
  }

  return points;
}

function cylinderAlongYSurfacePoints({
  center,
  halfLengthMm,
  radiusMm,
  axialSamples = 20,
  radialSamples = 32,
}: {
  center: Vec3;
  halfLengthMm: number;
  radiusMm: number;
  axialSamples?: number;
  radialSamples?: number;
}): Vec3[] {
  const points: Vec3[] = [];

  for (let axial = 0; axial < axialSamples; axial += 1) {
    const y = center[1] - halfLengthMm + (2 * halfLengthMm * axial) / Math.max(axialSamples - 1, 1);
    for (let radial = 0; radial < radialSamples; radial += 1) {
      const theta = ((radial + 0.31) / radialSamples) * Math.PI * 2;
      points.push([
        center[0] + radiusMm * Math.cos(theta),
        y,
        center[2] + radiusMm * Math.sin(theta),
      ]);
    }
  }

  return points;
}

function pairedWallBandSurfacePoints({
  depthMm,
  halfBandGapMm,
  halfLengthMm,
  yHalfThicknessMm,
  samples = 18,
}: {
  depthMm: number;
  halfBandGapMm: number;
  halfLengthMm: number;
  yHalfThicknessMm: number;
  samples?: number;
}): Vec3[] {
  const points: Vec3[] = [];

  for (const z of [depthMm - halfBandGapMm, depthMm + halfBandGapMm]) {
    for (let index = 0; index < samples; index += 1) {
      const x = -halfLengthMm + (2 * halfLengthMm * index) / Math.max(samples - 1, 1);
      points.push([x, -yHalfThicknessMm, z]);
      points.push([x, yHalfThicknessMm, z]);
    }
  }

  return points;
}

function openDistalVesselSurfacePoints({
  bottomDepthMm,
  halfWidthMm,
  outOfPlaneHalfThicknessMm,
  topDepthMm,
  samples = 10,
}: {
  bottomDepthMm: number;
  halfWidthMm: number;
  outOfPlaneHalfThicknessMm: number;
  topDepthMm: number;
  samples?: number;
}): Vec3[] {
  const points: Vec3[] = [];
  const addPointPair = (lateralMm: number, depthMm: number) => {
    points.push([-outOfPlaneHalfThicknessMm, lateralMm, depthMm]);
    points.push([outOfPlaneHalfThicknessMm, lateralMm, depthMm]);
  };

  for (let index = 0; index < samples; index += 1) {
    const t = index / Math.max(samples - 1, 1);
    const z = topDepthMm + (bottomDepthMm - topDepthMm) * t;
    addPointPair(-halfWidthMm, z);
    addPointPair(halfWidthMm, z);
  }

  for (let index = 0; index < samples; index += 1) {
    const t = index / Math.max(samples - 1, 1);
    const x = -halfWidthMm + 2 * halfWidthMm * t;
    addPointPair(x, topDepthMm);
    addPointPair(x, bottomDepthMm);
  }

  return points;
}

function alphaPixelCount(alpha: number[] | Uint8Array) {
  let count = 0;
  for (const value of alpha) {
    if (value > 0) {
      count += 1;
    }
  }
  return count;
}

function sectorItemWithContours(contoursMm: Vec2[] | Vec2[][]): SimulatorSectorItem {
  const normalizedContours = Array.isArray(contoursMm[0]?.[0])
    ? contoursMm as Vec2[][]
    : [contoursMm as Vec2[]];

  return {
    id: 'test-structure',
    label: 'test structure',
    kind: 'vessel',
    color: '#ffffff',
    depthMm: 20,
    lateralMm: 0,
    visible: true,
    contoursMm: normalizedContours,
  };
}

describe('simulator static assets', () => {
  it('loads a manifest with precomputed station snap snapshots', () => {
    const manifest = readCaseAsset<SimulatorCaseManifest>('case_manifest.web.json');

    expect(manifest.presets.length).toBeGreaterThan(0);
    expect(Object.keys(manifest.sector_snapshots ?? {}).length).toBe(manifest.presets.length);
    expect(manifest.assets.scope_model?.asset).toContain('EBUS_tip.glb');
  });

  it('loads the simplified model trial manifest with mesh-derived point clouds and no snapshots', () => {
    const manifest = readCaseAsset<SimulatorCaseManifest>('case_manifest.simplified.web.json');
    const primaryModel = manifest.assets.clean_models?.find((model) => model.primary);
    const primaryModelPath = resolve(process.cwd(), `public/simulator/case-001/${primaryModel?.asset}`);

    expect(manifest.case_id).toContain('simplified');
    expect(primaryModel?.asset).toBe('models/simplified_sim_model.glb');
    expect(readFileSync(primaryModelPath).subarray(0, 4).toString()).toBe('glTF');
    expect(manifest.render_defaults.sector_realism).toBe('realistic');
    expect(Object.keys(manifest.sector_snapshots ?? {})).toHaveLength(0);
    // Physics snapshots are optional per-preset assets; every emitted ref must
    // resolve to a preset in this manifest (files are checked in the physics suite).
    expect(manifest.physics_snapshots).toBeDefined();
    const presetKeys = new Set(manifest.presets.map((preset) => preset.preset_key));
    for (const refKey of Object.keys(manifest.physics_snapshots ?? {})) {
      expect(presetKeys.has(refKey)).toBe(true);
    }
    expect(manifest.presets).toHaveLength(11);
    expect(manifest.assets.stations.map((asset) => asset.key)).toEqual(
      expect.arrayContaining(['station_2l', 'station_4r', 'station_7', 'station_10r', 'station_10l', 'station_11rs']),
    );
    expect(manifest.presets.map((preset) => preset.preset_key)).not.toContain('station_4r_node_b::default');
    expect(manifest.assets.stations.every((asset) => asset.asset.startsWith('geometry/simplified/stations/'))).toBe(true);
    expect(manifest.assets.vessels.every((asset) => asset.asset.startsWith('geometry/simplified/vessels/'))).toBe(true);
  });

  it('uses the simplified simulator manifest as the default app manifest', () => {
    expect(simulatorManifestUrl()).toMatch(
      /\/simulator\/case-001\/case_manifest\.simplified\.web\.json$/,
    );
  });

  it('uses the simplified point list to aim station snap presets', () => {
    const manifest = readCaseAsset<SimulatorCaseManifest>('case_manifest.simplified.web.json');
    const station4r = manifest.presets.find((preset) => preset.preset_key === 'station_4r_node_a::default');
    const station10l = manifest.presets.find((preset) => preset.preset_key === 'station_10l_node_a::default');

    expect(station4r?.station_asset).toBe('geometry/simplified/stations/station_4r_points.json');
    expect(station4r?.contact[0]).toBeCloseTo(-13.355912548975311, 5);
    expect(station4r?.contact[1]).toBeCloseTo(1239.0529931957165, 5);
    expect(station4r?.contact[2]).toBeCloseTo(171.51630648491516, 5);
    expect(station4r?.target[0]).toBeCloseTo(-16.0781483437477, 5);
    expect(station4r?.target[1]).toBeCloseTo(1234.3357423743225, 5);
    expect(station4r?.target[2]).toBeCloseTo(180.22746102818675, 5);
    expect(station4r?.target_lps[0]).toBeCloseTo(-16.0781483437477, 5);
    expect(station4r?.target_lps[1]).toBeCloseTo(-180.22746102818675, 5);
    expect(station4r?.target_lps[2]).toBeCloseTo(1234.3357423743225, 5);
    expect(station4r?.depth_axis?.length).toBe(3);
    expect(station10l?.station_asset).toBe('geometry/simplified/stations/station_10l_points.json');
  });

  it('lists simplified nodes and vessels for individual 3D visibility controls', () => {
    const manifest = readCaseAsset<SimulatorCaseManifest>('case_manifest.simplified.web.json');
    const items = simulatorSceneStructureVisibilityItems(manifest);

    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'station_4r', kind: 'node' }),
        expect.objectContaining({ id: 'station_10l', kind: 'node' }),
        expect.objectContaining({ id: 'aorta', kind: 'vessel' }),
        expect.objectContaining({ id: 'pulmonary_artery', kind: 'vessel' }),
      ]),
    );
  });

  it('builds base-aware URLs for static simulator assets', () => {
    expect(simulatorCaseAssetUrl('geometry/airway_mesh.json')).toMatch(
      /\/simulator\/case-001\/geometry\/airway_mesh\.json$/,
    );
  });

  it('keeps thin-plane snapshot masks for station 7 and 4L adjacent anatomy', () => {
    const station7 = readCaseAsset<SimulatorSectorSnapshot>('sector_snapshots/station_7_node_a__lms.json');
    const station4l = readCaseAsset<SimulatorSectorSnapshot>('sector_snapshots/station_4l_node_a__default.json');

    const station7MaskedIds = station7.response.sector.labels
      .filter((label) => label.visible && label.raster_mask?.alpha.length)
      .map((label) => label.id);
    const station4lMaskedIds = station4l.response.sector.labels
      .filter((label) => label.visible && label.raster_mask?.alpha.length)
      .map((label) => label.id);

    expect(station7MaskedIds).toEqual(expect.arrayContaining(['station_7', 'pulmonary_venous_system', 'left_atrium']));
    expect(station4lMaskedIds).toEqual(expect.arrayContaining(['station_4l', 'pulmonary_artery', 'aorta']));
  });

  it('keeps adjacent vessel cuts visible in the live sector after movement', () => {
    const fixture = loadSimulatorFixture();

    expect(liveMaskedSectorIds(fixture, 'station_4l_node_a::default', 5)).toEqual(
      expect.arrayContaining(['station_4l', 'pulmonary_artery', 'aorta']),
    );
    expect(liveMaskedSectorIds(fixture, 'station_7_node_a::lms', 2.5)).toEqual(
      expect.arrayContaining(['station_7', 'pulmonary_venous_system', 'left_atrium']),
    );
  });

  it('excludes nearby anatomy that stays entirely on one side of the live fan plane', () => {
    const fixture = loadSimulatorFixture();
    const maskedIds = liveMaskedSectorIds(fixture, 'station_10r_node_a::default', -15);

    expect(maskedIds).toContain('station_10r');
    expect(maskedIds).not.toContain('superior_vena_cava');
  });

  it('renders live sector masks from local fan-plane crossings instead of a thick slab projection', () => {
    const fixture = loadSimulatorFixture();
    const maskedItems = liveMaskedSectorItems(fixture, 'station_7_node_a::lms', 2.5);

    expect(maskedItems.map((item) => item.id)).toEqual(
      expect.arrayContaining(['station_7', 'pulmonary_venous_system', 'left_atrium']),
    );
    expect(maskedItems.every((item) => item.rasterMask?.source === 'browser_point_cloud_plane_contour')).toBe(true);
  });
});

describe('simulator plane-cut mask generator', () => {
  it('cuts a sphere into one smooth filled contour', () => {
    const result = buildPlaneIntersectionRasterMask({
      kind: 'node',
      maxDepthMm: 40,
      points: sphereSurfacePoints([0, 0, 22], 6),
      pose: syntheticPlanePose(),
      sectorAngleDeg: 70,
    });

    expect(result).not.toBeNull();
    expect(result?.rasterMask.source).toBe('browser_point_cloud_plane_contour');
    expect(result?.contoursMm).toHaveLength(1);
    expect(alphaPixelCount(result?.rasterMask.alpha ?? [])).toBeGreaterThan(900);
  });

  it('cuts a cylinder into one continuous vessel mask instead of point circles', () => {
    const result = buildPlaneIntersectionRasterMask({
      kind: 'vessel',
      maxDepthMm: 40,
      points: cylinderAlongYSurfacePoints({
        center: [0, 0, 24],
        halfLengthMm: 10,
        radiusMm: 4,
      }),
      pose: syntheticPlanePose(),
      sectorAngleDeg: 70,
    });

    expect(result).not.toBeNull();
    expect(result?.contoursMm).toHaveLength(1);
    expect(alphaPixelCount(result?.rasterMask.alpha ?? [])).toBeGreaterThan(1500);
  });

  it('unions paired wall bands from a broad vessel into one lumen contour', () => {
    const result = buildPlaneIntersectionRasterMask({
      kind: 'vessel',
      maxDepthMm: 50,
      points: pairedWallBandSurfacePoints({
        depthMm: 28,
        halfBandGapMm: 12,
        halfLengthMm: 13,
        yHalfThicknessMm: 2,
      }),
      pose: syntheticPlanePose(),
      sectorAngleDeg: 70,
    });

    expect(result).not.toBeNull();
    expect(result?.contoursMm).toHaveLength(1);
    expect(alphaPixelCount(result?.rasterMask.alpha ?? [])).toBeGreaterThan(2500);
  });

  it('clips a vessel crossing that exits the distal fan instead of closing it inside the field', () => {
    const result = buildPlaneIntersectionRasterMask({
      kind: 'vessel',
      maxDepthMm: 40,
      points: openDistalVesselSurfacePoints({
        bottomDepthMm: 52,
        halfWidthMm: 8,
        outOfPlaneHalfThicknessMm: 2,
        topDepthMm: 18,
      }),
      pose: syntheticPlanePose(),
      sectorAngleDeg: 70,
    });
    const maxContourDepthMm = Math.max(...(result?.contoursMm.flat().map((point) => point[1]) ?? [0]));

    expect(result).not.toBeNull();
    expect(result?.contoursMm).toHaveLength(1);
    expect(maxContourDepthMm).toBeGreaterThan(39.5);
  });

  it('keeps two adjacent cylinder cuts as separate contours when their plane intersections do not touch', () => {
    const leftCylinder = cylinderAlongYSurfacePoints({
      center: [0, -16, 24],
      halfLengthMm: 5,
      radiusMm: 4,
    });
    const rightCylinder = cylinderAlongYSurfacePoints({
      center: [0, 16, 24],
      halfLengthMm: 5,
      radiusMm: 4,
    });
    const result = buildPlaneIntersectionRasterMask({
      kind: 'vessel',
      maxDepthMm: 40,
      points: [...leftCylinder, ...rightCylinder],
      pose: syntheticPlanePose(),
      sectorAngleDeg: 70,
    });

    expect(result).not.toBeNull();
    expect(result?.contoursMm).toHaveLength(2);
  });
});

describe('simulator sector contour source selection', () => {
  it('treats explicitly closed mm-space contours as usable mask geometry', () => {
    const item = {
      ...sectorItemWithContours([[0, 20], [5, 24], [0, 28], [-5, 24]]),
      contourClosed: [true],
    };

    expect(hasUsableSectorContourGeometry(item)).toBe(true);
  });

  it('promotes explicitly open contours only when the closure chord is anatomically plausible', () => {
    const nearClosedOpenContour = Array.from({ length: 12 }, (_, index): Vec2 => [
      -6 + index,
      22 + Math.sin(index / 2) * 0.25,
    ]);
    const item = {
      ...sectorItemWithContours(nearClosedOpenContour),
      contourClosed: [false],
    };

    expect(contourIsCloseable(nearClosedOpenContour, false)).toBe(true);
    expect(hasUsableSectorContourGeometry(item)).toBe(true);
  });

  it('rejects arc-class open contours so raster or ellipse fallback handles them instead of banana fills', () => {
    const arcContour: Vec2[] = [
      [-6, 20],
      [-4, 24],
      [-1, 27],
      [3, 27],
      [6, 24],
      [7, 20],
    ];
    const item = {
      ...sectorItemWithContours(arcContour),
      contourClosed: [false],
    };

    expect(contourIsCloseable(arcContour, false)).toBe(false);
    expect(hasUsableSectorContourGeometry(item)).toBe(false);
  });

  it('does not treat untagged long open contours as usable unless they are geometrically closed', () => {
    const untaggedOpenContour = Array.from({ length: 12 }, (_, index): Vec2 => [
      -6 + index,
      20 + Math.sin(index / 3),
    ]);

    expect(hasUsableSectorContourGeometry(sectorItemWithContours(untaggedOpenContour))).toBe(false);
  });
});

describe('simulator station IDs', () => {
  it('normalizes split right interlobar station IDs without flattening them', () => {
    expect(normalizeSimulatorStationId('11ri')).toBe('11Ri');
    expect(normalizeSimulatorStationId('11RS')).toBe('11Rs');
    expect(normalizeSimulatorStationId('4r')).toBe('4R');
  });
});

describe('simulator anatomy scene camera', () => {
  it('restores the locked orbit camera state for free-drive movement', () => {
    const previousView = {
      position: new THREE.Vector3(1, 2, 3),
      target: new THREE.Vector3(4, 5, 6),
    };

    expect(resolveLockedAnatomyCameraView(true, previousView)).toBe(previousView);
    expect(resolveLockedAnatomyCameraView(false, previousView)).toBeNull();
    expect(resolveLockedAnatomyCameraView(true, null)).toBeNull();
  });
});

describe('simulator pose math', () => {
  const polyline: SimulatorCenterlinePolyline = {
    line_index: 1,
    points: [
      [0, 0, 0],
      [0, 10, 0],
    ],
    cumulative_lengths_mm: [0, 10],
    total_length_mm: 10,
  };

  it('interpolates centerline distance in millimeters', () => {
    expect(pointAtS(polyline, 4).toArray()).toEqual([0, 4, 0]);
  });

  it('computes an orthonormal probe pose at a station snap', () => {
    const preset: SimulatorPreset = {
      approach: 'default',
      centerline_s_mm: 5,
      contact: [0, 5, 0],
      contact_to_target_distance_mm: 10,
      label: 'Station 4R node A',
      line_index: 1,
      node: 'a',
      preset_id: 'station_4r_node_a',
      preset_key: 'station_4r_node_a::default',
      station: '4r',
      station_key: 'station_4r',
      target: [0, 5, 10],
      target_lps: [0, 0, 0],
      vessel_overlays: [],
    };
    const pose = computeSimulatorPose(polyline, 5, 0, preset);

    expect(pose.tangent.length()).toBeCloseTo(1, 5);
    expect(pose.depthAxis.length()).toBeCloseTo(1, 5);
    expect(pose.lateralAxis.length()).toBeCloseTo(1, 5);
    expect(Math.abs(pose.tangent.dot(pose.depthAxis))).toBeLessThan(1e-6);
  });

  it('carries the pre-offset centerline anchor alongside the wall-contact position', () => {
    const preset: SimulatorPreset = {
      approach: 'default',
      centerline_s_mm: 5,
      contact: [3, 5, 0],
      contact_to_target_distance_mm: 10,
      label: 'Station 4R node A',
      line_index: 1,
      node: 'a',
      preset_id: 'station_4r_node_a',
      preset_key: 'station_4r_node_a::default',
      station: '4r',
      station_key: 'station_4r',
      target: [3, 5, 10],
      target_lps: [0, 0, 0],
      vessel_overlays: [],
    };
    // Away from the snap point the radial contact offset still applies to the position, while the
    // centerline anchor stays on the polyline — the optical pane clamps its eye from there.
    const pose = computeSimulatorPose(polyline, 7, 0, preset);

    expect(pose.position.toArray()).toEqual([3, 7, 0]);
    expect(pose.centerlinePosition?.toArray()).toEqual([0, 7, 0]);
    // ...and flags the station snap only within 1mm of the preset's path parameter.
    expect(pose.atStationSnap).toBe(false);
    expect(computeSimulatorPose(polyline, 5, 0, preset).atStationSnap).toBe(true);
    expect(computeSimulatorPose(polyline, 5.8, 0, preset).atStationSnap).toBe(true);
  });

  it('rotates the frame toward the scan side and shifts the tip wall-ward under flexion', () => {
    const preset: SimulatorPreset = {
      approach: 'default',
      centerline_s_mm: 5,
      contact: [0, 5, 0],
      contact_to_target_distance_mm: 10,
      label: 'Station 4R node A',
      line_index: 1,
      node: 'a',
      preset_id: 'station_4r_node_a',
      preset_key: 'station_4r_node_a::default',
      station: '4r',
      station_key: 'station_4r',
      target: [0, 5, 10],
      target_lps: [0, 0, 0],
      vessel_overlays: [],
    };
    const neutral = computeSimulatorPose(polyline, 5, 0, preset, 0);
    const flexed = computeSimulatorPose(polyline, 5, 0, preset, 90);

    // At 90 degrees the advance direction has rotated onto the old scan axis...
    expect(flexed.tangent.dot(neutral.depthAxis)).toBeCloseTo(1, 5);
    expect(flexed.depthAxis.dot(neutral.tangent)).toBeCloseTo(-1, 5);
    // ...the frame stays orthonormal with an unchanged lateral axis...
    expect(Math.abs(flexed.tangent.dot(flexed.depthAxis))).toBeLessThan(1e-6);
    expect(flexed.lateralAxis.dot(neutral.lateralAxis)).toBeCloseTo(1, 5);
    // ...and the tip translated toward the wall it is pressing against.
    const shift = flexed.position.clone().sub(neutral.position);
    expect(shift.dot(neutral.depthAxis)).toBeCloseTo(12, 5);
  });

  it('drives centered on the centerline with the synthetic free-drive preset', () => {
    const freePreset = freeDrivePresetForLine(polyline);
    const pose = computeSimulatorPose(polyline, 7, 0, freePreset);

    // No wall-contact radial offset: the scope position IS the centerline point.
    expect(pose.position.toArray()).toEqual([0, 7, 0]);
    expect(pose.centerlinePosition?.toArray()).toEqual([0, 7, 0]);
    expect(freePreset.line_index).toBe(polyline.line_index);
    expect(pose.tangent.length()).toBeCloseTo(1, 5);
    expect(Math.abs(pose.tangent.dot(pose.depthAxis))).toBeLessThan(1e-6);
  });

  it('supports a complete 360 degree probe roll', () => {
    const preset: SimulatorPreset = {
      approach: 'default',
      centerline_s_mm: 5,
      contact: [0, 5, 0],
      contact_to_target_distance_mm: 10,
      label: 'Station 4R node A',
      line_index: 1,
      node: 'a',
      preset_id: 'station_4r_node_a',
      preset_key: 'station_4r_node_a::default',
      station: '4r',
      station_key: 'station_4r',
      target: [0, 5, 10],
      target_lps: [0, 0, 0],
      vessel_overlays: [],
    };
    const baseline = computeSimulatorPose(polyline, 5, 0, preset);
    const fullRotation = computeSimulatorPose(polyline, 5, 360, preset);
    const halfRotation = computeSimulatorPose(polyline, 5, 180, preset);

    baseline.depthAxis.toArray().forEach((value, index) => {
      expect(fullRotation.depthAxis.toArray()[index]).toBeCloseTo(value, 5);
    });
    baseline.lateralAxis.toArray().forEach((value, index) => {
      expect(fullRotation.lateralAxis.toArray()[index]).toBeCloseTo(value, 5);
    });
    expect(halfRotation.depthAxis.dot(baseline.depthAxis)).toBeCloseTo(-1, 5);
  });
});

describe('simulator channel drivable extent', () => {
  // Open-ended square tube along +Y from y=0 to y=tubeEndMm, 10mm half-width, no end caps —
  // the same open-tube topology as the shared channel surface.
  function tubeMeshAsset(tubeEndMm: number): SimulatorMeshAsset {
    const ring = [
      [10, 10],
      [10, -10],
      [-10, -10],
      [-10, 10],
    ];
    const vertices: Vec3[] = [
      ...ring.map(([x, z]) => [x, 0, z] as Vec3),
      ...ring.map(([x, z]) => [x, tubeEndMm, z] as Vec3),
    ];
    const triangles: Vec3[] = [];
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      triangles.push([i, j, 4 + j], [i, 4 + j, 4 + i]);
    }
    return { vertices, triangles };
  }

  const centerline: SimulatorCenterlinePolyline = {
    line_index: 1,
    points: [
      [0, 0, 0],
      [0, 60, 0],
    ],
    cumulative_lengths_mm: [0, 60],
    total_length_mm: 60,
  };

  it('classifies points inside and beyond an open-ended tube', () => {
    const mesh = buildChannelRaycastMesh(tubeMeshAsset(50));
    const tangent = new THREE.Vector3(0, 1, 0);

    expect(isInsideChannel(mesh, new THREE.Vector3(0, 25, 0), tangent)).toBe(true);
    expect(isInsideChannel(mesh, new THREE.Vector3(0, 55, 0), tangent)).toBe(false);
    expect(isInsideChannel(mesh, new THREE.Vector3(30, 25, 0), tangent)).toBe(false);
  });

  it('stops the drivable range short of a channel surface the centerline overruns', () => {
    const mesh = buildChannelRaycastMesh(tubeMeshAsset(50));
    const maxS = maxDrivableSMm(centerline, mesh);

    // The tube ends at 50mm; the last inside sample minus the safety margin lands just short.
    expect(maxS).toBeGreaterThanOrEqual(43);
    expect(maxS).toBeLessThanOrEqual(48);
  });

  it('keeps the full centerline drivable when the surface covers it', () => {
    const mesh = buildChannelRaycastMesh(tubeMeshAsset(80));
    expect(maxDrivableSMm(centerline, mesh)).toBe(60);
  });

  it('grades acoustic contact by transducer distance to the wall along the scan axis', () => {
    const mesh = buildChannelRaycastMesh(tubeMeshAsset(50));
    const poseAt = (z: number): SimulatorProbePose => ({
      position: new THREE.Vector3(0, 25, z),
      tangent: new THREE.Vector3(0, 1, 0),
      depthAxis: new THREE.Vector3(0, 0, 1),
      lateralAxis: new THREE.Vector3(1, 0, 0),
    });

    // Centered in the 10mm-half-width channel: 10mm air gap, no coupling.
    expect(contactQualityForPose(poseAt(0), mesh)).toBe(0);
    // Pressed to within 1mm of the wall: full coupling.
    expect(contactQualityForPose(poseAt(9), mesh)).toBe(1);
    // Partway: partial coupling.
    const partial = contactQualityForPose(poseAt(5), mesh);
    expect(partial).toBeGreaterThan(0);
    expect(partial).toBeLessThan(1);
  });

  it('registers contact for an obliquely flexed tip pressed on the wall', () => {
    const mesh = buildChannelRaycastMesh(tubeMeshAsset(50));
    const flex = THREE.MathUtils.degToRad(75);
    // 75-degree flexed frame: the scan axis points mostly retrograde, but the tip itself sits
    // 1.2mm off the +z wall — the probe fan must still read this as coupled.
    const flexedPose: SimulatorProbePose = {
      position: new THREE.Vector3(0, 25, 8.8),
      tangent: new THREE.Vector3(0, Math.cos(flex), Math.sin(flex)),
      depthAxis: new THREE.Vector3(0, -Math.sin(flex), Math.cos(flex)),
      lateralAxis: new THREE.Vector3(1, 0, 0),
    };

    expect(contactQualityForPose(flexedPose, mesh)).toBeGreaterThan(0.6);
  });

  it('stops a wall-crossing tip at the channel wall, leaving inside poses untouched', () => {
    const mesh = buildChannelRaycastMesh(tubeMeshAsset(50));
    const through: SimulatorProbePose = {
      position: new THREE.Vector3(0, 25, 14),
      tangent: new THREE.Vector3(0, 1, 0),
      depthAxis: new THREE.Vector3(0, 0, 1),
      lateralAxis: new THREE.Vector3(1, 0, 0),
      centerlinePosition: new THREE.Vector3(0, 25, 0),
    };

    expect(clampPosePositionInsideChannel(through, mesh).position.z).toBeCloseTo(8.8, 3);

    const inside = { ...through, position: new THREE.Vector3(0, 25, 4) };
    expect(clampPosePositionInsideChannel(inside, mesh).position.z).toBe(4);
  });

  it('steers onto the branch that diverges toward the steered side', () => {
    const branch: SimulatorCenterlinePolyline = {
      line_index: 2,
      points: [
        [0, 0, 0],
        [0, 30, 0],
        [14, 58, 0],
      ],
      cumulative_lengths_mm: [0, 30, 61.3],
      total_length_mm: 61.3,
    };
    const pose: SimulatorProbePose = {
      position: new THREE.Vector3(0, 20, 0),
      tangent: new THREE.Vector3(0, 1, 0),
      depthAxis: new THREE.Vector3(0, 0, 1),
      lateralAxis: new THREE.Vector3(1, 0, 0),
    };

    expect(nearestSOnPolyline(branch, new THREE.Vector3(0.5, 20, 0)).sMm).toBeCloseTo(20, 0);

    // The branch veers toward +lateral (screen right): steering right takes it...
    const right = steerToAdjacentLine([centerline, branch], centerline, 20, pose, 1);
    expect(right?.lineIndex).toBe(2);
    expect(right?.sMm).toBeCloseTo(20, 0);
    // ...steering left finds nothing on that side.
    expect(steerToAdjacentLine([centerline, branch], centerline, 20, pose, -1)).toBeNull();
    // From the branch, steering back left returns to the straight line.
    const back = steerToAdjacentLine([centerline, branch], branch, 20, pose, -1);
    expect(back?.lineIndex).toBe(1);
  });
});

describe('simulator anatomical airway navigation', () => {
  const manifest = readCaseAsset<SimulatorCaseManifest>('case_manifest.simplified.web.json');
  const centerlines = readCaseAsset<{ polylines: SimulatorCenterlinePolyline[] }>(
    manifest.assets.centerlines,
  ).polylines;
  const model = resolveAirwayNavigationModel(manifest, centerlines);
  const line = (lineIndex: number) => {
    const resolved = centerlines.find((candidate) => candidate.line_index === lineIndex);
    expect(resolved).toBeDefined();
    if (!resolved) {
      throw new Error(`Missing centerline ${lineIndex}`);
    }
    return resolved;
  };

  it('reduces the case to explicit left and right mainstem choices at the carina', () => {
    expect(model.leftLineIndex).toBe(1);
    expect(model.rightLineIndex).toBe(8);
    expect(model.carinaSMm).toBeGreaterThan(108);
    expect(model.carinaSMm).toBeLessThan(114);
  });

  it.each([
    { label: 'distal trachea', lineIndex: 1, sMm: 99, expectedRollDeg: 105 },
    { label: 'right mainstem', lineIndex: 8, sMm: 120, expectedRollDeg: 62 },
    { label: 'distal left mainstem', lineIndex: 1, sMm: 160, expectedRollDeg: -149 },
  ])('matches the supplied $label standard view', ({ lineIndex, sMm, expectedRollDeg }) => {
    const polyline = line(lineIndex);
    const preset = freeDrivePresetForLine(polyline);
    const unrolled = computeSimulatorPose(polyline, sMm, 0, preset);
    const rollDeg = standardAirwayRollDeg(model, polyline, sMm, unrolled);

    expect(rollDeg).toBeCloseTo(expectedRollDeg, 0);
  });

  it('keeps patient anterior at the top of the distal tracheal view', () => {
    const polyline = line(model.leftLineIndex);
    const preset = freeDrivePresetForLine(polyline);
    const sMm = 99;
    const unrolled = computeSimulatorPose(polyline, sMm, 0, preset);
    const oriented = computeSimulatorPose(
      polyline,
      sMm,
      standardAirwayRollDeg(model, polyline, sMm, unrolled),
      preset,
    );
    const anterior = new THREE.Vector3(0, 0, 1);
    anterior.addScaledVector(oriented.tangent, -anterior.dot(oriented.tangent)).normalize();

    expect(oriented.depthAxis.dot(anterior)).toBeGreaterThan(0.99);
  });

  it('uses manual scope roll to steer the ultrasound sector away from its standard angle', () => {
    const polyline = line(model.rightLineIndex);
    const preset = freeDrivePresetForLine(polyline);
    const sMm = 120;
    const unrolled = computeSimulatorPose(polyline, sMm, 0, preset);
    const standardRollDeg = standardAirwayRollDeg(model, polyline, sMm, unrolled);
    const standardPose = computeSimulatorPose(polyline, sMm, standardRollDeg, preset);
    const rolledPose = computeSimulatorPose(polyline, sMm, standardRollDeg + 20, preset);
    const pointInStandardFan = standardPose.position
      .clone()
      .addScaledVector(standardPose.depthAxis, 20)
      .toArray() as Vec3;
    const standardProjection = projectToSector(pointInStandardFan, standardPose, 40, 120);
    const rolledProjection = projectToSector(pointInStandardFan, rolledPose, 40, 120);

    expect(standardPose.depthAxis.angleTo(rolledPose.depthAxis)).toBeCloseTo(
      THREE.MathUtils.degToRad(20),
      5,
    );
    expect(standardPose.tangent.angleTo(rolledPose.tangent)).toBeCloseTo(0, 5);
    expect(standardProjection.outOfPlaneMm).toBeCloseTo(0, 5);
    expect(Math.abs(rolledProjection.outOfPlaneMm)).toBeGreaterThan(5);
  });

  it('changes airway by anatomy while preserving the shared carinal world position', () => {
    const left = line(model.leftLineIndex);
    const right = line(model.rightLineIndex);
    const selection = projectToAirway(centerlines, left, 99, model.rightLineIndex);

    expect(selection?.lineIndex).toBe(model.rightLineIndex);
    expect(selection).not.toBeNull();
    if (!selection) {
      return;
    }
    expect(pointAtS(right, selection.sMm).distanceTo(pointAtS(left, 99))).toBeLessThan(0.6);
    expect(airwayRegionAtPose(model, right, selection.sMm)).toBe('trachea');
    expect(airwayRegionAtPose(model, right, 120)).toBe('right-mainstem');
    expect(airwayRegionAtPose(model, left, 160)).toBe('left-mainstem');
  });
});

describe('simulator bronch see-through structures', () => {
  it('pairs manifest colors with loaded points and drops structures without points', () => {
    const caseData = {
      assets: {
        stations: [
          { key: 'station_7', label: 'Station 7 lymph node region', color: '#92c774' },
          { key: 'station_4r', label: 'Station 4R lymph node region', color: '#92c774' },
        ],
        vessels: [{ key: 'aorta', label: 'Aorta', color: '#d13f3f' }],
      },
    } as unknown as SimulatorCaseManifest;
    const assets = {
      stations: { station_7: { key: 'station_7', label: '', points: [[0, 0, 0]] } },
      vessels: {
        aorta: {
          key: 'aorta',
          label: '',
          points: [
            [1, 1, 1],
            [2, 2, 2],
          ],
        },
      },
    } as unknown as SimulatorLoadedAssets;

    expect(simulatorBronchOverlayStructures(caseData, assets)).toEqual([
      { key: 'station_7', kind: 'station', color: '#92c774', points: [[0, 0, 0]] },
      {
        key: 'aorta',
        kind: 'vessel',
        color: '#d13f3f',
        points: [
          [1, 1, 1],
          [2, 2, 2],
        ],
      },
    ]);
  });
});

describe('simulator forward-oblique optical axis', () => {
  const frame = resolveScopeFrame({
    position: new THREE.Vector3(1, 2, 3),
    tangent: new THREE.Vector3(0, 1, 0),
    depthAxis: new THREE.Vector3(0, 0, 1),
    lateralAxis: new THREE.Vector3(1, 0, 0),
  });

  it('returns a unit vector 30 degrees off the shaft axis', () => {
    const optical = resolveForwardObliqueOpticalAxis(frame, 30, 1);

    expect(optical.length()).toBeCloseTo(1, 6);
    expect(optical.dot(frame.shaftAxis)).toBeCloseTo(Math.cos(THREE.MathUtils.degToRad(30)), 6);
  });

  it('flips the scan side when the calibration sign flips', () => {
    const positive = resolveForwardObliqueOpticalAxis(frame, 30, 1);
    const negative = resolveForwardObliqueOpticalAxis(frame, 30, -1);
    const expectedDepthComponent = Math.sin(THREE.MathUtils.degToRad(30));

    expect(positive.dot(frame.depthAxis)).toBeCloseTo(expectedDepthComponent, 6);
    expect(negative.dot(frame.depthAxis)).toBeCloseTo(-expectedDepthComponent, 6);
    expect(negative.dot(frame.shaftAxis)).toBeCloseTo(positive.dot(frame.shaftAxis), 6);
  });
});

describe('simulator endoscope camera calibration', () => {
  const frame = resolveScopeFrame({
    position: new THREE.Vector3(1, 2, 3),
    tangent: new THREE.Vector3(0, 1, 0),
    depthAxis: new THREE.Vector3(0, 0, 1),
    lateralAxis: new THREE.Vector3(1, 0, 0),
  });

  it('resolves to the default device profile when the manifest record is absent', () => {
    expect(resolveEndoscopeCameraCalibration(undefined)).toEqual(DEFAULT_ENDOSCOPE_CAMERA);
    expect(resolveEndoscopeCameraCalibration(null)).toEqual(DEFAULT_ENDOSCOPE_CAMERA);
  });

  it('lets a manifest record override the defaults without dropping unset fields', () => {
    const calibration = resolveEndoscopeCameraCalibration({
      optical_axis_offset_deg: 20,
      obliquity_axis: 'negative_depth_axis',
    });

    expect(calibration.optical_axis_offset_deg).toBe(20);
    expect(calibration.obliquity_axis).toBe('negative_depth_axis');
    expect(calibration.fov_deg).toBe(DEFAULT_ENDOSCOPE_CAMERA.fov_deg);
    expect(calibration.eye_offset_mm).toEqual(DEFAULT_ENDOSCOPE_CAMERA.eye_offset_mm);
  });

  it('drives the optical axis offset and sign the same way as the Phase-1 helper', () => {
    const towardScanSide = resolveCalibratedOpticalAxis(
      frame,
      resolveEndoscopeCameraCalibration({ optical_axis_offset_deg: 30, obliquity_axis: 'depth_axis' }),
    );
    const awayFromScanSide = resolveCalibratedOpticalAxis(
      frame,
      resolveEndoscopeCameraCalibration({
        optical_axis_offset_deg: 30,
        obliquity_axis: 'negative_depth_axis',
      }),
    );

    resolveForwardObliqueOpticalAxis(frame, 30, 1)
      .toArray()
      .forEach((value, index) => {
        expect(towardScanSide.toArray()[index]).toBeCloseTo(value, 6);
      });
    resolveForwardObliqueOpticalAxis(frame, 30, -1)
      .toArray()
      .forEach((value, index) => {
        expect(awayFromScanSide.toArray()[index]).toBeCloseTo(value, 6);
      });
  });

  it('rotates toward the lateral axis when the obliquity axis is lateral', () => {
    const lateral = resolveCalibratedOpticalAxis(
      frame,
      resolveEndoscopeCameraCalibration({ optical_axis_offset_deg: 30, obliquity_axis: 'lateral_axis' }),
    );
    const expectedSin = Math.sin(THREE.MathUtils.degToRad(30));

    expect(lateral.dot(frame.lateralAxis)).toBeCloseTo(expectedSin, 6);
    expect(lateral.dot(frame.depthAxis)).toBeCloseTo(0, 6);
  });

  it('is emitted into the simplified web manifest with the default profile', () => {
    const manifest = readCaseAsset<SimulatorCaseManifest>('case_manifest.simplified.web.json');

    expect(manifest.endoscope_camera).toBeDefined();
    expect(manifest.endoscope_camera?.model).toBe('bf_uc180f');
    expect(manifest.endoscope_camera?.optical_axis_offset_deg).toBe(30);
    expect(manifest.ultrasound_probe?.sector_angle_deg).toBe(
      manifest.render_defaults.sector_angle_deg,
    );
    expect(manifest.ultrasound_probe?.displayed_range_mm).toBe(manifest.render_defaults.max_depth_mm);
    // The reference device's optics sit proximal enough that the tip hardware stays out of frame.
    expect(manifest.endoscope_camera?.scope_tip_occlusion).toBe(false);
    expect(manifest.endoscope_camera?.circular_aperture).toBe(true);
    expect(manifest.endoscope_camera?.lens_distortion).toBe(true);
    expect(manifest.endoscope_camera?.headlight_falloff).toBe(true);
    // The device carries a distal contact cap; the optical pane inflates it at station snaps.
    expect(manifest.endoscope_camera?.contact_cap).toBe(true);
    expect(manifest.endoscope_camera?.contact_min_distance_mm).toBeGreaterThan(0);
    // The lens sits proximal to the transducer along the shaft (ultrasound distal to the camera).
    expect(manifest.endoscope_camera?.eye_offset_mm.shaft).toBeLessThan(0);
  });
});

describe('simulator endoscope lens optics', () => {
  it('keeps every lens effect off when the calibration record has no flags', () => {
    expect(resolveEndoscopeOptics(resolveEndoscopeCameraCalibration(undefined))).toEqual({
      scopeTipOcclusion: false,
      contactCap: false,
      circularAperture: false,
      lensDistortion: false,
      headlightFalloff: false,
      contactMinDistanceMm: 0,
    });
  });

  it('reads the lens flags and proximity clearance from the calibration record', () => {
    const optics = resolveEndoscopeOptics(
      resolveEndoscopeCameraCalibration({
        scope_tip_occlusion: true,
        circular_aperture: true,
        lens_distortion: true,
        headlight_falloff: true,
        contact_min_distance_mm: 1.5,
      }),
    );

    expect(optics.scopeTipOcclusion).toBe(true);
    expect(optics.circularAperture).toBe(true);
    expect(optics.lensDistortion).toBe(true);
    expect(optics.headlightFalloff).toBe(true);
    expect(optics.contactCap).toBe(false);
    expect(optics.contactMinDistanceMm).toBe(1.5);
  });

  it('passes the aperture mask at the frame center and closes it past the calibrated radius', () => {
    expect(apertureMaskAlpha(0.5, 0.5, 16 / 9)).toBe(1);
    // Inside the feather band the mask is fully open.
    expect(apertureMaskAlpha(0.5, 0.5 + (APERTURE_RADIUS - APERTURE_FEATHER) / 2, 16 / 9)).toBe(1);
    // Halfway through the feather band it is half open.
    expect(
      apertureMaskAlpha(0.5, 0.5 + (APERTURE_RADIUS - APERTURE_FEATHER / 2) / 2, 16 / 9),
    ).toBeCloseTo(0.5, 6);
    // The side edges of a widescreen frame and the frame corners fall outside the aperture.
    expect(apertureMaskAlpha(0, 0.5, 16 / 9)).toBe(0);
    expect(apertureMaskAlpha(1, 1, 1)).toBe(0);
  });

  it('measures the aperture in image-height units so it stays circular at any aspect ratio', () => {
    expect(apertureMaskAlpha(0.5, 0.95, 16 / 9)).toBeCloseTo(apertureMaskAlpha(0.5, 0.95, 1), 6);
    expect(apertureMaskAlpha(0.5, 0.95, 16 / 9)).toBeCloseTo(apertureMaskAlpha(0.5, 0.95, 4 / 3), 6);
  });

  it('maps the distortion center to itself and pushes edge samples outward', () => {
    expect(barrelDistortUv(0.5, 0.5)).toEqual([0.5, 0.5]);

    const [edgeU, edgeV] = barrelDistortUv(1, 0.5);
    expect(edgeU).toBeGreaterThan(1);
    expect(edgeV).toBeCloseTo(0.5, 9);
  });

  it('applies a radially symmetric, monotonically growing distortion', () => {
    const [leftU] = barrelDistortUv(0.25, 0.5);
    const [rightU] = barrelDistortUv(0.75, 0.5);
    expect(leftU).toBeCloseTo(1 - rightU, 9);

    const innerOffset = barrelDistortUv(0.6, 0.5)[0] - 0.6;
    const outerOffset = barrelDistortUv(0.9, 0.5)[0] - 0.9;
    expect(outerOffset).toBeGreaterThan(innerOffset);
  });

  it('matches the Brown-Conrady mapping for explicit coefficients', () => {
    // x = 0.5, r^2 = 0.25, scale = 1 + 0.2 * 0.25 = 1.05 → x' = 0.525.
    const [u, v] = barrelDistortUv(0.75, 0.5, 0.2, 0);
    expect(u).toBeCloseTo(0.7625, 9);
    expect(v).toBeCloseTo(0.5, 9);
  });

  it('keeps the headlight full inside the inner cone and dark past the outer cone', () => {
    expect(headlightConeGain(1)).toBe(1);
    expect(headlightConeGain(Math.cos(THREE.MathUtils.degToRad(HEADLIGHT_INNER_CONE_DEG)))).toBe(1);
    expect(headlightConeGain(Math.cos(THREE.MathUtils.degToRad(HEADLIGHT_OUTER_CONE_DEG)))).toBe(0);
    expect(headlightConeGain(0)).toBe(0);

    const midDeg = (HEADLIGHT_INNER_CONE_DEG + HEADLIGHT_OUTER_CONE_DEG) / 2;
    const midGain = headlightConeGain(Math.cos(THREE.MathUtils.degToRad(midDeg)));
    expect(midGain).toBeGreaterThan(0);
    expect(midGain).toBeLessThan(1);
  });

  it('pulls the camera back only when the wall ahead is inside the clearance', () => {
    expect(proximityPullbackMm(null, 1.5)).toBe(0);
    expect(proximityPullbackMm(5, 1.5)).toBe(0);
    expect(proximityPullbackMm(1.5, 1.5)).toBe(0);
    expect(proximityPullbackMm(0.4, 1.5)).toBeCloseTo(1.1, 9);
    // A wall already behind the desired camera position pushes it back past the wall.
    expect(proximityPullbackMm(-0.5, 1.5)).toBeCloseTo(2, 9);
    expect(proximityPullbackMm(0.4, 0)).toBe(0);
  });

  it('places the distal-tip hardware at the bottom of the frame for any obliquity side', () => {
    // Image-up faces the scan side, so the transducer ahead of the lens always reads at the
    // frame bottom — including when the calibrated scan-side sign flips.
    for (const axis of [
      'depth_axis',
      'negative_depth_axis',
      'lateral_axis',
      'negative_lateral_axis',
    ] as const) {
      const direction = distalTipScreenDirection(
        resolveEndoscopeCameraCalibration({ obliquity_axis: axis }),
      );
      expect(Math.hypot(direction[0], direction[1])).toBeCloseTo(1, 6);
      expect(direction[0]).toBeCloseTo(0, 6);
      expect(direction[1]).toBeCloseTo(-1, 6);
    }
  });

  it('clamps the eye inside the channel wall with the calibrated clearance', () => {
    // No wall within range or clamp disabled: the desired eye stands.
    expect(insideChannelEyeDistanceMm(null, 8, 1.5)).toBe(8);
    expect(insideChannelEyeDistanceMm(6, 8, 0)).toBe(8);
    // Wall between anchor and eye: clamp to the clearance inside the hit.
    expect(insideChannelEyeDistanceMm(6, 8, 1.5)).toBeCloseTo(4.5, 9);
    // Wall just past the eye but inside the clearance still pulls the eye in.
    expect(insideChannelEyeDistanceMm(8.5, 8, 1.5)).toBeCloseTo(7, 9);
    // Wall closer to the anchor than the clearance: fall back to the anchor, never negative.
    expect(insideChannelEyeDistanceMm(1, 8, 1.5)).toBe(0);
    // Wall comfortably beyond the eye: no clamp.
    expect(insideChannelEyeDistanceMm(20, 8, 1.5)).toBe(8);
  });

  it('eases the contact cap inflation toward its target without overshoot', () => {
    // No time elapsed: unchanged.
    expect(approachInflation(0.4, 1, 0)).toBe(0.4);
    // Approaches monotonically...
    const step = approachInflation(0, 1, 100);
    expect(step).toBeGreaterThan(0);
    expect(step).toBeLessThan(1);
    expect(approachInflation(step, 1, 100)).toBeGreaterThan(step);
    // ...reaches the target after a long step, in both directions, staying clamped.
    expect(approachInflation(0, 1, 10_000)).toBeCloseTo(1, 3);
    expect(approachInflation(1, 0, 10_000)).toBeCloseTo(0, 3);
  });

  it('orients image-up toward the calibrated scan side, perpendicular to the optical axis', () => {
    const frame = resolveScopeFrame({
      position: new THREE.Vector3(),
      tangent: new THREE.Vector3(0, 1, 0),
      depthAxis: new THREE.Vector3(0, 0, 1),
      lateralAxis: new THREE.Vector3(1, 0, 0),
    });
    const calibration = resolveEndoscopeCameraCalibration({ obliquity_axis: 'depth_axis' });
    const forward = resolveCalibratedOpticalAxis(frame, calibration);
    const up = resolveOpticalImageUp(frame, calibration);

    expect(up.length()).toBeCloseTo(1, 6);
    expect(up.dot(forward)).toBeCloseTo(0, 6);
    // Up leans toward the scan side...
    expect(up.dot(frame.depthAxis)).toBeGreaterThan(0);
    // ...so the shaft direction (and the distal hardware along it) projects below the horizon.
    expect(frame.shaftAxis.dot(up)).toBeLessThan(0);
  });
});

describe('simulator sector source selection', () => {
  it('uses the precomputed snapshot only at the exact station snap pose', () => {
    const source = resolveSimulatorSectorSource({
      atSnapshotPose: true,
      hasCurrentSnapshot: true,
      snapshotStatus: 'ready',
    });

    expect(source).toBe('precomputed_volume_snapshot');
    expect(shouldUseSnapshotSectorItems(source)).toBe(true);
    expect(simulatorSectorSourceLabel(source)).toBe('Snapshot sector');
  });

  it('switches to a live point-cloud sector after exploratory movement', () => {
    const source = resolveSimulatorSectorSource({
      atSnapshotPose: false,
      hasCurrentSnapshot: true,
      snapshotStatus: 'ready',
    });

    expect(source).toBe('point_cloud_sector');
    expect(shouldUseSnapshotSectorItems(source)).toBe(false);
    expect(simulatorSectorSourceLabel(source)).toBe('Live sector');
  });

  it('uses the live point-cloud sector when no snapshot is available', () => {
    const source = resolveSimulatorSectorSource({
      atSnapshotPose: false,
      hasCurrentSnapshot: false,
      snapshotStatus: 'missing',
    });

    expect(source).toBe('point_cloud_sector');
    expect(shouldUseSnapshotSectorItems(source)).toBe(false);
  });
});

describe('simulator pane layout', () => {
  it('accepts the two known layouts', () => {
    expect(normalizeSimulatorPaneLayout('grid')).toBe('grid');
    expect(normalizeSimulatorPaneLayout('focus')).toBe('focus');
  });

  it('falls back to the tri-view grid for unknown or missing persisted values', () => {
    expect(normalizeSimulatorPaneLayout('mosaic')).toBe('grid');
    expect(normalizeSimulatorPaneLayout(42)).toBe('grid');
    expect(normalizeSimulatorPaneLayout(null)).toBe('grid');
    expect(normalizeSimulatorPaneLayout(undefined)).toBe('grid');
  });
});

describe('simulator virtual bronchoscopy visibility', () => {
  it('shows the virtual pane when the embedding route enables the updated simulator', () => {
    expect(
      shouldShowVirtualBronchoscopyPane({
        showVirtualBronchoscopy: true,
      }),
    ).toBe(true);
  });

  it('keeps the virtual pane hidden when the embedding route does not enable it', () => {
    expect(
      shouldShowVirtualBronchoscopyPane({
        showVirtualBronchoscopy: false,
      }),
    ).toBe(false);
  });
});

describe('sector style resolver', () => {
  it('defaults to realistic when no source provides a style', () => {
    expect(DEFAULT_SECTOR_STYLE).toBe('realistic');
    expect(resolveSectorStyle({})).toBe('realistic');
  });

  it('prefers URL over localStorage, manifest, and default', () => {
    expect(
      resolveSectorStyle({ urlValue: 'classic', storedValue: 'physics', manifestValue: 'realistic' }),
    ).toBe('classic');
  });

  it('prefers localStorage over manifest when no URL value is set', () => {
    expect(resolveSectorStyle({ storedValue: 'physics', manifestValue: 'classic' })).toBe('physics');
  });

  it('prefers manifest over the default when URL and localStorage are unset', () => {
    expect(resolveSectorStyle({ manifestValue: 'classic' })).toBe('classic');
  });

  it('falls through unknown values to the next precedence level', () => {
    expect(
      resolveSectorStyle({ urlValue: 'watercolor', storedValue: 'classic', manifestValue: 'realistic' }),
    ).toBe('classic');
    expect(resolveSectorStyle({ urlValue: 'watercolor', storedValue: 42, manifestValue: 'classic' })).toBe('classic');
    expect(resolveSectorStyle({ urlValue: 'watercolor', storedValue: null, manifestValue: undefined })).toBe('realistic');
  });

  it('normalizes case and whitespace but rejects unknown strings', () => {
    expect(normalizeSectorStyle(' Physics ')).toBe('physics');
    expect(normalizeSectorStyle('CLASSIC')).toBe('classic');
    expect(normalizeSectorStyle('watercolor')).toBeNull();
    expect(normalizeSectorStyle(1)).toBeNull();
    expect(normalizeSectorStyle(undefined)).toBeNull();
  });

  it('renders physics through the realistic path until a snapshot is loaded', () => {
    expect(sectorRenderPath('physics')).toBe('realistic');
    expect(sectorRenderPath('physics', false)).toBe('realistic');
    expect(sectorRenderPath('physics', true)).toBe('physics');
    expect(sectorRenderPath('realistic', true)).toBe('realistic');
    expect(sectorRenderPath('classic', true)).toBe('classic');
  });
});

describe('simulator physics snapshots', () => {
  const physicsSidecarPayload = {
    schema_version: 1,
    preset_key: 'station_4r_node_a::default',
    image: 'physics_snapshots/station_4r_node_a__default.png',
    metadata: {
      engine: 'physics',
      engine_version: 'physics-v1',
      model: 'bf_uc180f',
      video_axis_offset_deg: 30,
      sector_angle_deg: 60,
      max_depth_mm: 40,
      roll_deg: 0,
      contact: [0, 0, 0],
      shaft_axis: [0, 1, 0],
      depth_axis: [0, 0, 1],
      lateral_axis: [1, 0, 0],
    },
    labels: [],
  };
  const physicsManifest = {
    physics_snapshots: {
      'station_4r_node_a::default': 'physics_snapshots/station_4r_node_a__default.json',
    },
  } as unknown as SimulatorCaseManifest;

  it('resolves a preset to its physics snapshot sidecar reference', () => {
    expect(resolveSimulatorPhysicsSnapshotRef(physicsManifest, 'station_4r_node_a::default')).toBe(
      'physics_snapshots/station_4r_node_a__default.json',
    );
    expect(resolveSimulatorPhysicsSnapshotRef(physicsManifest, 'station_7_node_a::default')).toBeNull();
    expect(resolveSimulatorPhysicsSnapshotRef(null, 'station_4r_node_a::default')).toBeNull();
    expect(resolveSimulatorPhysicsSnapshotRef(physicsManifest, null)).toBeNull();
  });

  it('parses a well-formed sidecar into its PNG reference and physics metadata', () => {
    const parsed = parseSimulatorPhysicsSnapshot(physicsSidecarPayload);

    expect(parsed?.image).toBe('physics_snapshots/station_4r_node_a__default.png');
    expect(parsed?.metadata.engine).toBe('physics');
    expect(parsed?.metadata.max_depth_mm).toBe(40);
    expect(parsed?.metadata.sector_angle_deg).toBe(60);
  });

  it('rejects malformed sidecars so the sector falls back to the realistic render', () => {
    expect(parseSimulatorPhysicsSnapshot(null)).toBeNull();
    expect(parseSimulatorPhysicsSnapshot('nope')).toBeNull();
    expect(parseSimulatorPhysicsSnapshot({})).toBeNull();
    expect(parseSimulatorPhysicsSnapshot({ ...physicsSidecarPayload, image: '' })).toBeNull();
    expect(
      parseSimulatorPhysicsSnapshot({
        ...physicsSidecarPayload,
        metadata: { ...physicsSidecarPayload.metadata, engine: 'localizer' },
      }),
    ).toBeNull();
    expect(
      parseSimulatorPhysicsSnapshot({
        ...physicsSidecarPayload,
        metadata: { ...physicsSidecarPayload.metadata, max_depth_mm: Number.NaN },
      }),
    ).toBeNull();
  });

  it('keeps canvas-backed items transparent in SVG so hover labels composite over the image', () => {
    expect(sectorItemRendersOnCanvas('physics', true)).toBe(true);
    expect(sectorItemRendersOnCanvas('realistic', true)).toBe(true);
    expect(sectorItemRendersOnCanvas('physics', false)).toBe(false);
    expect(sectorItemRendersOnCanvas('classic', true)).toBe(false);
  });

  it('resolves every generated snapshot ref to a parseable sidecar and an existing PNG', () => {
    const manifest = readCaseAsset<SimulatorCaseManifest>('case_manifest.simplified.web.json');

    for (const [presetKey, ref] of Object.entries(manifest.physics_snapshots ?? {})) {
      const sidecar = parseSimulatorPhysicsSnapshot(readCaseAsset<unknown>(ref));

      expect(sidecar).not.toBeNull();
      expect(sidecar?.preset_key).toBe(presetKey);
      expect(sidecar?.metadata.engine_version).toBe('physics-v1');
      expect(() =>
        readFileSync(resolve(process.cwd(), `public/simulator/case-001/${sidecar?.image}`)),
      ).not.toThrow();
    }
  });

  it('places a matching snapshot across the full label fan and scales shallower depths', () => {
    const renderDefaults = { max_depth_mm: 40, sector_angle_deg: 60 };
    const full = physicsSnapshotPlacement(100, { max_depth_mm: 40, sector_angle_deg: 60 }, renderDefaults);

    // With matching depth/angle the image spans the same region the SVG labels use:
    // apex at y=8, depth span 82, lateral span ±39 around center.
    expect(full.y).toBeCloseTo(8, 6);
    expect(full.height).toBeCloseTo(82, 6);
    expect(full.x).toBeCloseTo(11, 6);
    expect(full.width).toBeCloseTo(78, 6);

    const shallow = physicsSnapshotPlacement(100, { max_depth_mm: 20, sector_angle_deg: 60 }, renderDefaults);
    expect(shallow.height).toBeCloseTo(41, 6);
    expect(shallow.width).toBeCloseTo(39, 6);
    expect(shallow.x + shallow.width / 2).toBeCloseTo(50, 6);
  });
});
