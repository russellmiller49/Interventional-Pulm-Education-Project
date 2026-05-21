import {
  buildRoutePath,
  canvasPointToLps,
  findNearestAirwayPoint,
  lpsToCtIndex,
  projectLpsToDetector,
  sampleRoutePath,
} from './interaction'
import type { AirwayGraph, CtVolumePreview, FluoroConfig } from './types'

const ct: CtVolumePreview = {
  rawUrl: '/ct.raw',
  sizeXyz: [100, 80, 60],
  originalSizeXyz: [200, 160, 120],
  stride: [2, 2, 2],
  spacingXyzMm: [1, 2, 3],
  originLps: [-50, -80, -120],
  directionLps: [1, 0, 0, 0, 1, 0],
  windowHu: [-1000, 350],
}

const graph: AirwayGraph = {
  schema: 'fluoroview_airway_graph/v1',
  units: 'mm',
  coordinateSystem: 'LPS',
  rootNodeId: 0,
  carinaNodeId: 1,
  carinaLpsMm: [0, 0, -10],
  terminalNodeIds: [3],
  nodes: [
    {
      id: 0,
      lps: [0, 0, 0],
      kind: 'root',
      degree: 1,
      rootDistanceMm: 0,
      parentNodeId: null,
      parentEdgeId: null,
      childEdgeIds: [0],
    },
    {
      id: 1,
      lps: [0, 0, -10],
      kind: 'carina',
      degree: 2,
      rootDistanceMm: 10,
      parentNodeId: 0,
      parentEdgeId: 0,
      childEdgeIds: [1],
    },
    {
      id: 2,
      lps: [5, 0, -20],
      kind: 'internal',
      degree: 2,
      rootDistanceMm: 21.2,
      parentNodeId: 1,
      parentEdgeId: 1,
      childEdgeIds: [2],
    },
    {
      id: 3,
      lps: [10, 0, -30],
      kind: 'terminal',
      degree: 1,
      rootDistanceMm: 32.4,
      parentNodeId: 2,
      parentEdgeId: 2,
      childEdgeIds: [],
    },
  ],
  edges: [
    {
      id: 0,
      sourceCurve: 'Network curve (0)',
      startNodeId: 0,
      endNodeId: 1,
      lengthMm: 10,
      radiusMm: 7,
      pointsLps: [
        [0, 0, 0],
        [0, 0, -10],
      ],
    },
    {
      id: 1,
      sourceCurve: 'Network curve (1)',
      startNodeId: 1,
      endNodeId: 2,
      lengthMm: 11.2,
      radiusMm: 5,
      pointsLps: [
        [0, 0, -10],
        [5, 0, -20],
      ],
    },
    {
      id: 2,
      sourceCurve: 'Network curve (2)',
      startNodeId: 2,
      endNodeId: 3,
      lengthMm: 11.2,
      radiusMm: 3,
      pointsLps: [
        [5, 0, -20],
        [10, 0, -30],
      ],
    },
  ],
}

test('lpsToCtIndex converts LPS coordinates into preview volume index space', () => {
  expect(lpsToCtIndex([-40, -60, -90], ct)).toEqual([10, 10, 10])
})

test('canvasPointToLps maps CT canvas clicks to the selected plane', () => {
  expect(canvasPointToLps(50, 40, 100, 80, 'axial', 10, ct)).toEqual([-0.5, -1, -90])
  expect(canvasPointToLps(50, 40, 100, 80, 'coronal', 10, ct)).toEqual([-0.5, -60, -31.5])
})

test('findNearestAirwayPoint snaps to airway graph within radius', () => {
  const snap = findNearestAirwayPoint(graph, [4.8, 0.5, -20.2], 5)
  expect(snap?.edgeId).toBe(1)
  expect(snap?.routeTerminalNodeId).toBe(3)
  expect(snap?.distanceMm).toBeLessThan(1)
})

test('buildRoutePath and sampleRoutePath interpolate scope progress', () => {
  const route = buildRoutePath(graph, 3)
  expect(route.points).toHaveLength(4)
  const sample = sampleRoutePath(route, 1)
  expect(sample.point).toEqual([10, 0, -30])
  expect(sample.distanceMm).toBeCloseTo(route.lengthMm)
})

test('projectLpsToDetector keeps the calibrated carina near the target detector point', () => {
  const config: FluoroConfig = {
    units: 'mm',
    coordinateSystem: 'LPS',
    isocenter_mm: [0, 0, 0],
    source_to_isocenter_mm: 600,
    source_to_detector_mm: 1200,
    detector_pixels: [1000, 1000],
    pixel_pitch_mm: 0.3,
    default_view: { rao_lao_deg: 0, cranial_caudal_deg: 0 },
    overlay_calibration: {
      method: 'centerline-carina',
      carina_lps_mm: [0, 0, -10],
      target_detector_percent: [50, 45],
    },
  }
  expect(projectLpsToDetector([0, 0, -10], config, 0, 0).point).toEqual([50, 45])
})
