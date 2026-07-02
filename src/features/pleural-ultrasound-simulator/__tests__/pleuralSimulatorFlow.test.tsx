import { fireEvent, render, screen } from '@testing-library/react'

import { PleuralUltrasoundSimulator } from '../components/PleuralUltrasoundSimulator'

// The 3D stack is exercised only when WebGL exists; jsdom uses the SVG surface
// map, so the R3F/drei modules are stubbed to keep this suite hermetic.
jest.mock('@react-three/fiber', () => ({
  Canvas: () => null,
  useFrame: () => undefined,
}))
jest.mock('@react-three/drei', () => ({
  OrbitControls: () => null,
  useGLTF: () => ({ scene: { traverse: () => undefined } }),
}))

const probeDefaults = {
  lateralMm: 35,
  posteriorMm: 68,
  craniocaudalMm: 35,
  tiltDeg: 0,
  rotationDeg: 0,
  depthCm: 7,
  gain: 1,
  dynamicRangeDb: 56,
  sectorAngleDeg: 60,
  needleAngleDeg: 0,
}

const atlasMetrics = {
  maxFluidPocketMm: 48,
  meanFluidPocketMm: 34,
  fluidBeamFraction: 0.56,
  ribShadowBeamFraction: 0.14,
  diaphragmSeen: true,
  lungSeen: true,
  solidOrganSeen: false,
  centralNeedle: {
    ribHit: false,
    diaphragmHit: false,
    solidOrganHit: false,
    lungHit: false,
    fluidRunMm: 36,
    firstFluidDepthMm: 28,
    safeWindow: true,
  },
}

const legacyManifest = {
  id: 'pleural-effusion-001',
  name: 'Test pleural case',
  description: 'Synthetic component-flow fixture.',
  safetyLabel: 'Educational simulation only; not for diagnosis, treatment, or procedure guidance.',
  meshUrl: '/test-assets/case.glb',
  probeModelUrl: '/test-assets/ultrasound-probe.glb',
  labelmapUrl: '/test-assets/case.labelmap.uint8.bin',
  labelmapFormat: 'uint8-single-label',
  labels: {
    '0': 'background',
    '1': 'skin',
    '4': 'rib',
    '7': 'pleuralFluid',
    '10': 'diaphragm',
    '11': 'liver',
    '12': 'spleen',
  },
  labelCounts: {},
  labelBoundsLpsMm: {
    skin: { min: [0, 60, 0], max: [70, 70, 70], voxels: 100 },
    rib: { min: [5, 55, 5], max: [65, 62, 65], voxels: 80 },
    pleuralFluid: { min: [10, 20, 10], max: [60, 50, 60], voxels: 400 },
    diaphragm: { min: [5, 10, 5], max: [65, 18, 65], voxels: 60 },
    liver: { min: [10, 0, 10], max: [60, 12, 60], voxels: 90 },
  },
  source: {
    segmentationFileName: 'test.seg.nrrd',
    meshFileName: 'test.glb',
    originalSegmentationFormat: 'Slicer 4D .seg.nrrd',
    sourceSizeXyz: [8, 8, 8],
    sourceLayerCount: 1,
    sourceSpace: 'left-posterior-superior',
    sourcePolicy: 'test fixture',
  },
  volume: {
    sizeXyz: [8, 8, 8],
    sourceSizeXyz: [8, 8, 8],
    strideXyz: [1, 1, 1],
    spacingXyzMm: [10, 10, 10],
    originLpsMm: [0, 0, 0],
    coordinateSystem: 'LPS',
  },
  probeDefaults,
  frameAtlas: {
    selectionTolerance: {},
    entries: [
      {
        id: 'best-window',
        label: 'Best window',
        description: 'Reviewed teaching frame at the default pose.',
        imageUrl: '/test-assets/frame-atlas/best-window.svg',
        probe: probeDefaults,
        metrics: atlasMetrics,
        groundTruthPattern: 'simpleAnechoic',
        generator: { source: 'manual-curated', name: 'Synthetic test atlas', version: '1' },
        reviewStatus: 'reviewed',
        educationalUse: 'Synthetic educational frame only.',
        tags: ['best-window'],
      },
    ],
  },
  objectives: [
    'Find the largest fluid pocket.',
    'Avoid hazards along the projected trajectory.',
    'Classify the effusion pattern.',
  ],
  groundTruthPattern: 'simpleAnechoic',
}

function mockCaseFetch() {
  const fetchMock = jest.fn(async (url: string) => {
    if (url.includes('case.json')) {
      return { ok: true, json: async () => legacyManifest }
    }
    if (url.includes('labelmap')) {
      return { ok: true, arrayBuffer: async () => new Uint8Array(8 * 8 * 8).buffer }
    }
    return { ok: false, status: 404 }
  })
  ;(globalThis as { fetch?: unknown }).fetch = fetchMock
  return fetchMock
}

describe('pleural simulator component flow', () => {
  it('loads the case, shows the disclaimer, reviewed frame, and dual panes', async () => {
    mockCaseFetch()
    render(<PleuralUltrasoundSimulator />)

    expect(await screen.findByText('Educational simulation only')).toBeInTheDocument()

    // Reviewed atlas frame is displayed, not the placeholder and never a raw render.
    expect(await screen.findByAltText(/synthetic teaching frame/i)).toBeInTheDocument()
    expect(screen.queryByText('No reviewed frame at this pose')).not.toBeInTheDocument()

    // Left pane: 3D scene falls back to the surface map in jsdom + probe controls.
    expect(screen.getByLabelText('Projected access window map')).toBeInTheDocument()
    expect(screen.getByText('Lateral position')).toBeInTheDocument()
    expect(screen.getByText('Guide line')).toBeInTheDocument()

    // Neutral prompts from the manifest's learning tasks.
    expect(screen.getByText('Find the largest fluid pocket.')).toBeInTheDocument()
    expect(screen.getByText('Classify the effusion pattern.')).toBeInTheDocument()
  })

  it('keeps ground truth hidden until the learner predicts and reveals', async () => {
    mockCaseFetch()
    render(<PleuralUltrasoundSimulator />)

    await screen.findByText('Educational simulation only')

    // No classification feedback before the learner answers.
    expect(screen.queryByText('Correct')).not.toBeInTheDocument()

    const revealButton = await screen.findByRole('button', { name: 'Check classification' })
    expect(revealButton).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Simple anechoic' }))
    expect(screen.queryByText('Correct')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Check classification' }))
    expect(await screen.findByText('Correct')).toBeInTheDocument()
  })

  it('surfaces a load error instead of rendering a broken simulator', async () => {
    const fetchMock = jest.fn(async () => ({ ok: false, status: 503 }))
    ;(globalThis as { fetch?: unknown }).fetch = fetchMock

    render(<PleuralUltrasoundSimulator />)

    expect(await screen.findByText('Simulator assets could not load')).toBeInTheDocument()
  })
})
