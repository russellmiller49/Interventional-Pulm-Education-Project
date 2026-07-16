import {
  buildGameTargets,
  buildTargetQueue,
  classifyLobe,
  computeTargetGuide,
  difficultyById,
  isArrived,
  isOffCorridor,
  scoreTarget,
  shuffle,
  targetTier,
} from './airway-game'
import type { AirwayGraph, CenterlineLabels } from './types'

// Trachea (edge 0) → carina → right mainstem (edge 1) → RB6 span (edge 3);
// left mainstem (edge 2) is the "wrong" corridor for a right-sided target.
const graph: AirwayGraph = {
  schema: 'fluoroview_airway_graph/v1',
  units: 'mm',
  coordinateSystem: 'LPS',
  rootNodeId: 0,
  carinaNodeId: 1,
  carinaLpsMm: [0, 0, -10],
  terminalNodeIds: [3, 4],
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
      degree: 3,
      rootDistanceMm: 10,
      parentNodeId: 0,
      parentEdgeId: 0,
      childEdgeIds: [1, 2],
    },
    {
      id: 2,
      lps: [10, 0, -20],
      kind: 'bifurcation',
      degree: 2,
      rootDistanceMm: 24,
      parentNodeId: 1,
      parentEdgeId: 1,
      childEdgeIds: [3],
    },
    {
      id: 3,
      lps: [16, 0, -34],
      kind: 'terminal',
      degree: 1,
      rootDistanceMm: 39,
      parentNodeId: 2,
      parentEdgeId: 3,
      childEdgeIds: [],
    },
    {
      id: 4,
      lps: [-10, 0, -20],
      kind: 'terminal',
      degree: 1,
      rootDistanceMm: 24,
      parentNodeId: 1,
      parentEdgeId: 2,
      childEdgeIds: [],
    },
  ],
  edges: [
    {
      id: 0,
      sourceCurve: 'c0',
      sourceCellId: 0,
      startNodeId: 0,
      endNodeId: 1,
      lengthMm: 10,
      radiusMm: 8,
      pointsLps: [
        [0, 0, 0],
        [0, 0, -10],
      ],
    },
    {
      id: 1,
      sourceCurve: 'c1',
      sourceCellId: 1,
      startNodeId: 1,
      endNodeId: 2,
      lengthMm: 14,
      radiusMm: 5,
      pointsLps: [
        [0, 0, -10],
        [10, 0, -20],
      ],
    },
    {
      id: 2,
      sourceCurve: 'c2',
      sourceCellId: 2,
      startNodeId: 1,
      endNodeId: 4,
      lengthMm: 14,
      radiusMm: 5,
      pointsLps: [
        [0, 0, -10],
        [-10, 0, -20],
      ],
    },
    {
      id: 3,
      sourceCurve: 'c3',
      sourceCellId: 3,
      startNodeId: 2,
      endNodeId: 3,
      lengthMm: 15,
      radiusMm: 3,
      pointsLps: [
        [10, 0, -20],
        [16, 0, -34],
      ],
    },
  ],
}

const labels: CenterlineLabels = {
  schema: 'airway_anatomy_centerline_labels/v1',
  units: 'mm',
  coordinateSystem: 'LPS',
  source: 'test',
  edgeLabels: {
    '0': { abbreviatedLabel: 'TR', fullLabel: 'Trachea' },
    '1': { abbreviatedLabel: 'RMSB', fullLabel: 'Right Mainstem Bronchus' },
    '2': { abbreviatedLabel: 'LMSB', fullLabel: 'Left Mainstem Bronchus' },
    '3': { abbreviatedLabel: 'RB6', fullLabel: 'Right Lower Lobe Superior Segment' },
  },
  polylines: [],
}

describe('airway game targets', () => {
  it('builds one target per distinct label with an arrival edge set', () => {
    const targets = buildGameTargets(graph, labels)
    const abbrs = targets.map((target) => target.abbr).sort()
    expect(abbrs).toEqual(['LMSB', 'RB6', 'RMSB', 'TR'])

    const rb6 = targets.find((target) => target.abbr === 'RB6')!
    expect(rb6.edgeIds).toContain(3)
    expect(rb6.tier).toBe('segment')
    expect(rb6.lobe).toBe('rll')
    // Anchor sits at the deep end of the labeled span.
    expect(rb6.anchorLps[2]).toBeCloseTo(-34)
  })

  it('derives the root→target corridor for wrong-turn detection', () => {
    const rb6 = buildGameTargets(graph, labels).find((target) => target.abbr === 'RB6')!
    // Corridor is trachea (0) → right mainstem (1) → RB6 (3).
    expect(rb6.pathEdgeIds).toEqual([0, 1, 3])
    expect(isArrived(rb6, 3)).toBe(true)
    expect(isArrived(rb6, 1)).toBe(false)
    // On the corridor is fine; the left mainstem (2) is a wrong turn.
    expect(isOffCorridor(rb6, 1)).toBe(false)
    expect(isOffCorridor(rb6, 2)).toBe(true)
    expect(isOffCorridor(rb6, 3)).toBe(false)
  })

  it('classifies lobes and tiers from the full label', () => {
    expect(classifyLobe('Right Lower Lobe Superior Segment')).toBe('rll')
    expect(classifyLobe('Left Upper Lobe Superior Lingular Segment')).toBe('lingula')
    expect(classifyLobe('Trachea')).toBe('central')
    expect(targetTier('Right Upper Lobe Apical Segment')).toBe('segment')
    expect(targetTier('Right Mainstem Bronchus')).toBe('landmark')
  })
})

describe('airway game queue', () => {
  it('filters to the difficulty tier and never repeats consecutively', () => {
    const targets = buildGameTargets(graph, labels)
    const queue = buildTargetQueue(targets, difficultyById('segments'))
    expect(queue.every((target) => target.tier === 'segment')).toBe(true)

    const landmarks = buildTargetQueue(targets, difficultyById('landmarks'))
    expect(landmarks.every((target) => target.tier === 'landmark')).toBe(true)
    for (let i = 1; i < landmarks.length; i += 1) {
      expect(landmarks[i].abbr).not.toBe(landmarks[i - 1].abbr)
    }
  })

  it('shuffles deterministically with an injected rng', () => {
    const seeded = [0.1, 0.9, 0.3, 0.7]
    let call = 0
    const rng = () => seeded[call++ % seeded.length]
    const a = shuffle([1, 2, 3, 4], rng)
    call = 0
    const b = shuffle([1, 2, 3, 4], rng)
    expect(a).toEqual(b)
  })
})

describe('airway game scoring', () => {
  it('rewards a fast clean hit with three stars and extends the combo', () => {
    const result = scoreTarget({ tier: 'segment', elapsedSec: 8, wrongTurns: 0, comboBefore: 2 })
    expect(result.stars).toBe(3)
    expect(result.clean).toBe(true)
    expect(result.comboAfter).toBe(3)
    expect(result.points).toBeGreaterThan(150)
  })

  it('penalizes wrong turns and resets the combo', () => {
    const clean = scoreTarget({ tier: 'segment', elapsedSec: 20, wrongTurns: 0, comboBefore: 3 })
    const messy = scoreTarget({ tier: 'segment', elapsedSec: 20, wrongTurns: 2, comboBefore: 3 })
    expect(messy.points).toBeLessThan(clean.points)
    expect(messy.comboAfter).toBe(0)
    expect(messy.stars).toBeLessThan(3)
  })

  it('never drops below the floor and clamps the combo multiplier', () => {
    const slow = scoreTarget({ tier: 'landmark', elapsedSec: 500, wrongTurns: 9, comboBefore: 99 })
    expect(slow.points).toBeGreaterThanOrEqual(15)
    expect(slow.comboMultiplier).toBeCloseTo(1 + 6 * 0.15)
  })
})

describe('airway target guide', () => {
  const pose = {
    tipLps: [0, 0, 0] as [number, number, number],
    lookAtLps: [0, 0, -10] as [number, number, number],
    tangentLps: [0, 0, -1] as [number, number, number],
    yawDeg: 0,
    pitchDeg: 0,
    rollDeg: 0,
  }

  it('reads hot when the target is close and cold when far', () => {
    const near = computeTargetGuide([0, 0, -12], pose, 1, 88)
    const far = computeTargetGuide([0, 0, -180], pose, 1, 88)
    expect(near.proximity).toBeGreaterThan(far.proximity)
    expect(near.proximity).toBeGreaterThan(0.9)
  })

  it('marks a target dead ahead as on-screen and centered', () => {
    const guide = computeTargetGuide([0, 0, -40], pose, 1, 88)
    expect(guide.onScreen).toBe(true)
    expect(guide.leftPct).toBeCloseTo(50)
    expect(guide.topPct).toBeCloseTo(50)
  })

  it('reports a screen bearing for an off-axis target behind the scope', () => {
    const behind = computeTargetGuide([0, 0, 40], pose, 1, 88)
    expect(behind.onScreen).toBe(false)
    expect(behind.depthMm).toBeLessThan(0)
  })
})
