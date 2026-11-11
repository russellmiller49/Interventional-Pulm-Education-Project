import {
  ARC_TOLERANCE_DEG,
  RIMS,
  angleGap,
  branchBearings,
  gradeArcs,
  gradeFrame,
  layoutArcMap,
  withGhost,
  lungSide,
  mapTurnToScope,
  mappedForks,
  ostiumFrame,
  regionAncestry,
  segmentalForkIndex,
  turnBearings,
  turnedRim,
  type Anatomical,
  type FrameLabels,
  type OstiumFrame,
  type Rim,
  type Sector,
} from '../engine/arc-map'
import { routeOption } from '../engine/nav-session'
import { CT_TARGETS } from '../geometry/native-ct'
import { stationCamera } from '../geometry/route-stations'
import { TARGET_IDS, traceForTarget } from '../content/targets'

/**
 * The nested-arc map (Mortimer & Saghaie, J Clin Med 2025;14:8009): the ostium circle of each
 * lesion's segment, where each branch is drawn on it, and how a learner's circle and arcs are
 * read. The frames below were dumped from the route geometry and read before any lesson text was
 * written about them.
 */
const LESIONS = TARGET_IDS.map((id) => {
  const target = CT_TARGETS.find((t) => t.id === id)!
  const trace = traceForTarget(id)
  const forks = mappedForks(trace, target)
  return { id, target, trace, forks, frame: ostiumFrame(trace, forks[0])! }
})
const lesion = (id: string) => LESIONS.find((l) => l.id === id)!

/** top, right, bottom, left; a pair is a position between two directions. */
type Words = [string, string, string, string]
const FRAMES: Record<string, Words> = {
  RB1: ['medial', 'posterior', 'lateral', 'anterior'],
  RB3: ['superior', 'posterior/lateral', 'inferior', 'anterior/medial'],
  RB4: ['superior', 'posterior', 'inferior', 'anterior'],
  RB5: ['superior', 'lateral', 'inferior', 'medial'],
  RB8: ['anterior', 'superior/lateral', 'posterior', 'inferior/medial'],
  'LB1+2': ['medial', 'anterior', 'lateral', 'posterior'],
  LB3: ['medial', 'anterior/inferior', 'lateral', 'posterior/superior'],
  LB5: ['anterior', 'medial', 'posterior', 'lateral'],
  LB6: ['superior', 'lateral', 'inferior', 'medial'],
  LB9: ['anterior', 'medial', 'posterior', 'lateral'],
}
const rimText = (frame: OstiumFrame) =>
  RIMS.map((rim) => frame.rim[rim].word + (frame.rim[rim].also ? `/${frame.rim[rim].also}` : ''))
const labelsOf = (frame: OstiumFrame, turn: 0 | 1 | 2 | 3 = 0): FrameLabels => {
  const rim = turnedRim(frame.rim, turn)
  return Object.fromEntries(RIMS.map((r) => [r, rim[r].word])) as FrameLabels
}

describe('the ostium circle', () => {
  it('starts every lesion’s map at the first division of its segmental bronchus', () => {
    for (const { trace, target, forks } of LESIONS) {
      expect(forks.length).toBeGreaterThan(0)
      const first = segmentalForkIndex(trace, target.segment.bronchusCode)!
      expect(forks[0]).toBe(first)
      expect(trace.checkpoints[first].decision!.parent.airway.code).toBe(
        target.segment.bronchusCode,
      )
      // The map runs on to the route's last division.
      const lastFork = trace.checkpoints.map((c, i) => (c.decision ? i : -1)).filter((i) => i >= 0)
      expect(forks[forks.length - 1]).toBe(lastFork[lastFork.length - 1])
    }
  })

  it('carries one to five divisions, as the method expects', () => {
    const counts = Object.fromEntries(LESIONS.map((l) => [l.id, l.forks.length]))
    expect(counts).toEqual({
      'r-apical-anterior': 3,
      'r-apical-posterior': 3,
      'r-anterior-upper': 3,
      'r-anterior-lower': 4,
      'r-middle-lateral': 3,
      'r-middle-medial-a': 4,
      'r-middle-medial-b': 4,
      'r-anterior-basal': 2,
      'l-apicoposterior': 5,
      'l-anterior': 4,
      'l-inferior-lingula': 4,
      'l-superior': 5,
      'l-lateral-basal': 1,
    })
  })

  it('names the four rim positions of each segment as the model scope holds it', () => {
    for (const { target, frame } of LESIONS)
      expect([target.segment.bronchusCode, rimText(frame)]).toEqual([
        target.segment.bronchusCode,
        FRAMES[target.segment.bronchusCode],
      ])
  })

  it('draws RB1 as the paper does: medial up, posterior right, lateral down, anterior left', () => {
    // Mortimer & Saghaie, Figure 1E–F: the RB1 ostium circle.
    const { frame } = lesion('r-apical-anterior')
    expect(frame.into).toBe('superior')
    expect(rimText(frame)).toEqual(['medial', 'posterior', 'lateral', 'anterior'])
  })

  it('reads medial and lateral by the lung the route is in', () => {
    expect(lungSide(lesion('r-apical-anterior').trace)).toBe('right')
    expect(lungSide(lesion('l-superior').trace)).toBe('left')
  })

  it('puts opposite directions opposite each other on every circle', () => {
    const opposite: Record<Anatomical, Anatomical> = {
      superior: 'inferior',
      inferior: 'superior',
      medial: 'lateral',
      lateral: 'medial',
      anterior: 'posterior',
      posterior: 'anterior',
    }
    for (const { frame } of LESIONS) {
      expect(frame.rim.bottom.word).toBe(opposite[frame.rim.top.word])
      expect(frame.rim.left.word).toBe(opposite[frame.rim.right.word])
    }
  })
})

describe('where each branch is drawn', () => {
  it('places every daughter of every mapped division plainly across the circle', () => {
    let divisions = 0
    for (const { trace, forks, frame } of LESIONS)
      for (const ci of forks) {
        const bearings = branchBearings(trace, ci, frame)
        expect(bearings).toHaveLength(trace.checkpoints[ci].decision!.options.length)
        expect(bearings.filter((b) => b.onRoute).map((b) => b.index)).toEqual([
          routeOption(trace, ci),
        ])
        for (const bearing of bearings) expect(bearing.uncertain).toBe(false)
        // Two branches are drawn on opposite sides; three spread round the circle.
        if (bearings.length === 2)
          expect(angleGap(bearings[0].angle, bearings[1].angle)).toBeCloseTo(180, 6)
        else
          for (const a of bearings)
            for (const b of bearings)
              if (a !== b) expect(angleGap(a.angle, b.angle)).toBeGreaterThan(90)
        divisions++
      }
    expect(divisions).toBe(45)
  })

  it('draws RB1’s first division with RB1b anterior and RB1a posterior', () => {
    const { trace, forks, frame } = lesion('r-apical-anterior')
    const [b, a] = branchBearings(trace, forks[0], frame)
    expect(trace.checkpoints[forks[0]].decision!.options.map((o) => o.airway.code)).toEqual([
      'RB1b',
      'RB1a',
    ])
    expect(frame.rim.left.word).toBe('anterior')
    expect(b.sector).toBe(6)
    expect(a.sector).toBe(2)
  })
})

describe('reading the learner’s circle', () => {
  const { frame } = lesion('r-apical-anterior')

  it('accepts the model scope’s own rim words', () => {
    expect(gradeFrame(frame, labelsOf(frame))).toEqual({
      complete: true,
      ok: true,
      turn: 0,
      mirrored: false,
      off: [],
    })
  })

  it('accepts the same arrangement in any roll, and says how far it is turned', () => {
    for (const turn of [1, 2, 3] as const) {
      const grade = gradeFrame(frame, labelsOf(frame, turn))
      expect(grade.ok).toBe(true)
      expect(grade.turn).toBe(turn)
    }
  })

  it('refuses a mirror image and says so', () => {
    const mirrored: FrameLabels = {
      top: 'medial',
      right: 'anterior',
      bottom: 'lateral',
      left: 'posterior',
    }
    const grade = gradeFrame(frame, mirrored)
    expect(grade.ok).toBe(false)
    expect(grade.mirrored).toBe(true)
    expect(grade.off.length).toBe(2)
  })

  it('is not complete until all four positions have a word', () => {
    const grade = gradeFrame(frame, { top: 'medial', right: 'posterior', bottom: null, left: null })
    expect(grade.complete).toBe(false)
    expect(grade.ok).toBe(false)
    expect(grade.mirrored).toBe(false)
  })

  it('accepts either word where a rim position lies between two directions', () => {
    const rb3 = lesion('r-anterior-upper').frame
    for (const right of ['posterior', 'lateral'] as const) {
      const left = right === 'posterior' ? 'anterior' : 'medial'
      expect(gradeFrame(rb3, { top: 'superior', right, bottom: 'inferior', left }).ok).toBe(true)
    }
  })
})

describe('reading the learner’s arcs', () => {
  const { trace, forks, frame } = lesion('r-apical-anterior')
  const bearings = branchBearings(trace, forks[0], frame) // RB1b at 6 (left), RB1a at 2 (right)

  it('accepts the branches in either order, each read as the daughter it fits', () => {
    expect(gradeArcs(bearings, [6, 2], 0)).toMatchObject({ ok: true, assignment: [0, 1] })
    expect(gradeArcs(bearings, [2, 6], 1)).toMatchObject({ ok: true, assignment: [1, 0] })
  })

  it('accepts a neighbouring place but not one two places away', () => {
    expect(gradeArcs(bearings, [7, 3], 0).ok).toBe(true)
    const far = gradeArcs(bearings, [0, 2], 0)
    expect(far.ok).toBe(false)
    expect(far.off).toEqual([0])
    expect(ARC_TOLERANCE_DEG).toBe(67.5)
  })

  it('needs the branch toward the lesion marked, and marked on the route’s daughter', () => {
    expect(gradeArcs(bearings, [6, 2], null)).toMatchObject({ ok: false, leadsOnOk: null })
    expect(gradeArcs(bearings, [6, 2], 1)).toMatchObject({ ok: false, leadsOnOk: false, off: [] })
  })

  it('asks for as many branches as the division has', () => {
    expect(gradeArcs(bearings, [6], 0)).toMatchObject({ countOk: false, ok: false })
    const three = lesion('r-anterior-basal')
    const last = three.forks[three.forks.length - 1]
    const b3 = branchBearings(three.trace, last, three.frame)
    expect(b3).toHaveLength(3)
    const placed = b3.map((b) => b.sector) as Sector[]
    const route = routeOption(three.trace, last)
    expect(gradeArcs(b3, placed, route).ok).toBe(true)
    // Drawn in another order: drawn branch i is daughter (i + 1) % 3.
    const rotated = [placed[1], placed[2], placed[0]]
    expect(gradeArcs(b3, rotated, (route + 2) % 3)).toMatchObject({
      ok: true,
      assignment: [1, 2, 0],
    })
  })

  it('reads arcs on a turned circle against the turned bearings', () => {
    const turned = turnBearings(bearings, 1)
    expect(turned.map((b) => b.sector)).toEqual([0, 4])
    expect(gradeArcs(turned, [0, 4], 0).ok).toBe(true)
  })
})

describe('drawing the map', () => {
  it('nests each division inside the branch before it, and stars only the last', () => {
    for (const { trace, forks, frame } of LESIONS) {
      const levels = forks.map((ci) => ({
        angles: branchBearings(trace, ci, frame).map((b) => b.angle),
        route: routeOption(trace, ci),
      }))
      const regions = layoutArcMap(levels)
      expect(regions).toHaveLength(1 + levels.reduce((sum, l) => sum + l.angles.length, 0))
      expect(regions.filter((r) => r.target)).toHaveLength(1)
      for (const region of regions) {
        if (!region.parent) continue
        const parent = regions.find((r) => r.id === region.parent)!
        const gap = Math.hypot(region.inner.cx - parent.inner.cx, region.inner.cy - parent.inner.cy)
        expect(gap + region.inner.r).toBeLessThanOrEqual(parent.inner.r + 1e-9)
        expect(parent.onRoute).toBe(true)
        // The arc crosses its parent: the cutting circle reaches past the parent's centre side.
        const cut = region.cut!
        const reach = Math.hypot(cut.cx - parent.inner.cx, cut.cy - parent.inner.cy) - cut.r
        expect(reach).toBeLessThan(parent.inner.r)
      }
      // Siblings do not overlap.
      for (const a of regions)
        for (const b of regions)
          if (a !== b && a.parent && a.parent === b.parent)
            expect(
              Math.hypot(a.inner.cx - b.inner.cx, a.inner.cy - b.inner.cy),
            ).toBeGreaterThanOrEqual(a.inner.r + b.inner.r)
      const target = regions.find((r) => r.target)!
      expect(regionAncestry(regions, target.id)).toHaveLength(levels.length + 1)
    }
  })
})

describe('turning the map to the scope', () => {
  it('needs no turn at the ostium on an unturned circle, and a quarter on a turned one', () => {
    for (const { trace, forks, frame } of LESIONS) {
      const basis = stationCamera(trace, forks[0])!.basis
      const plain = mapTurnToScope(frame, 0, basis)
      expect(plain.reliable).toBe(true)
      expect(angleGap(plain.angle, 0)).toBeLessThan(1e-6)
      expect(angleGap(mapTurnToScope(frame, 1, basis).angle, 270)).toBeLessThan(1e-6)
    }
  })

  it('reports how far the scope has rolled by the last division', () => {
    const rows = LESIONS.map(({ id, trace, forks, frame }) => {
      const basis = stationCamera(trace, forks[forks.length - 1])!.basis
      return [id, mapTurnToScope(frame, 0, basis)] as const
    })
    for (const [, turn] of rows) {
      expect(turn.angle).toBeGreaterThanOrEqual(0)
      expect(turn.angle).toBeLessThan(360)
    }
  })
})

/** The rim positions, for exhaustiveness. */
const _rims: Rim[] = ['top', 'right', 'bottom', 'left']
void _rims

describe('the model’s arcs laid over the learner’s map', () => {
  const learner = [
    { angles: [270, 90], route: 0 },
    { angles: [0, 180], route: 1 },
  ]
  const model = [
    { angles: [255, 80], route: 0 },
    { angles: [20, 200], route: 1 },
  ]

  it('adds the model’s angles to each division and leaves the learner’s own untouched', () => {
    const both = withGhost(learner, model)
    expect(both.map((level) => level.angles)).toEqual(learner.map((level) => level.angles))
    expect(both.map((level) => level.route)).toEqual([0, 1])
    expect(both.map((level) => level.ghost)).toEqual([
      [255, 80],
      [20, 200],
    ])
    // A division the model does not have is left as the learner drew it.
    expect(withGhost(learner, model.slice(0, 1))[1]).toBe(learner[1])
  })

  it('draws them as extra arcs in the same parent, and changes nothing of the nesting', () => {
    const plain = layoutArcMap(learner)
    const overlaid = layoutArcMap(withGhost(learner, model))
    const ghosts = overlaid.filter((region) => region.ghost)
    expect(ghosts.map((region) => region.id)).toEqual(['0:g0', '0:g1', '1:g0', '1:g1'])
    for (const ghost of ghosts) {
      expect([ghost.onRoute, ghost.target, ghost.daughter]).toEqual([false, false, null])
      expect(ghost.cut).not.toBeNull()
    }
    // The first division's are cut from the ostium; the second's from the learner's route branch.
    expect(ghosts.slice(0, 2).map((region) => region.parent)).toEqual(['ostium', 'ostium'])
    expect(ghosts.slice(2).map((region) => region.parent)).toEqual(['0:0', '0:0'])
    // Without them the picture is exactly the learner's map.
    expect(overlaid.filter((region) => !region.ghost)).toEqual(plain)
  })
})
