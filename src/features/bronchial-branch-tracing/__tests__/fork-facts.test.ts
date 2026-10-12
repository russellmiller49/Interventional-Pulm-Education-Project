import { openingName } from '../content/bench-copy'
import type { CtTrace } from '../content/ct-types'
import {
  OPENING_ANCHOR_MM,
  courseWords,
  forkFacts,
  lesionFromFork,
  levelPhrase,
  type ForkFacts,
} from '../engine/fork-facts'
import { responsePlane } from '../engine/junction-feedback'
import { routeOption } from '../engine/nav-session'
import { CT_TRACES, NATIVE_CT, targetForTrace, traceById } from '../geometry/native-ct'
import { projectToParentView } from '../geometry/reference-frames'
import { SCOPE_FOV_DEG, stationCamera } from '../geometry/route-stations'

/**
 * What the route geometry says about a fork: where each opening sits in the scope's view, which
 * slice it is identified on, which way it runs. Every sentence the bench prints about a fork's
 * levels and sides is built from these.
 */
interface Station {
  trace: CtTrace
  index: number
  id: string
  facts: ForkFacts
}
const STATIONS: Station[] = CT_TRACES.flatMap((trace) =>
  trace.checkpoints.flatMap((checkpoint, index) =>
    checkpoint.decision
      ? [{ trace, index, id: checkpoint.id, facts: forkFacts(trace, index)! }]
      : [],
  ),
)
const factsOn = (traceId: string, checkpointId: string) => {
  const trace = traceById(traceId)
  const index = trace.checkpoints.findIndex((checkpoint) => checkpoint.id === checkpointId)
  return forkFacts(trace, index)!
}
const byCode = (facts: ForkFacts, code: string) =>
  facts.openings.find((opening) => opening.airway.code === code)!
const sliceOf = (z: number) => Math.round((z - NATIVE_CT.origin[2]) / NATIVE_CT.spacing[2])

describe('at every fork of every route', () => {
  test('there are facts for each of the 128 stations, one opening per daughter, one of them the route’s', () => {
    expect(STATIONS).toHaveLength(128)
    for (const { trace, index, id, facts } of STATIONS) {
      const where = `${trace.id} ${id}`
      const decision = trace.checkpoints[index].decision!
      expect([where, facts === null]).toEqual([where, false])
      expect(facts.checkpointId).toBe(id)
      expect(facts.parent).toEqual(decision.parent.airway)
      expect(facts.forkSlice).toBe(sliceOf(decision.junctionLps[2]))
      expect(facts.openings).toHaveLength(decision.options.length)
      expect(facts.openings.filter((opening) => opening.onRoute)).toHaveLength(1)
      expect(facts.openings.findIndex((opening) => opening.onRoute)).toBe(routeOption(trace, index))
      facts.openings.forEach((opening, option) => {
        expect(opening.index).toBe(option)
        expect(opening.airway).toEqual(decision.options[option].airway)
        // The plane it is identified on is the response plane, and its level is read from that.
        expect([where, option, opening.slice]).toEqual([
          where,
          option,
          responsePlane(trace, index, option)!.slice,
        ])
        expect(opening.slicesFromFork).toBe(opening.slice - facts.forkSlice)
        expect(opening.mmFromFork).toBe(Math.abs(opening.slicesFromFork) * NATIVE_CT.spacing[2])
        expect(opening.course.length).toBeGreaterThan(0)
      })
      const slices = facts.openings.map((opening) => opening.slice)
      expect(facts.inPlane).toBe(Math.max(...slices) - Math.min(...slices) <= 1)
      // Cached: the same object each time.
      expect(forkFacts(trace, index)).toBe(facts)
    }
    // A checkpoint without a division, or off the route, has no facts.
    const trace = CT_TRACES[0]
    expect(forkFacts(trace, trace.checkpoints.length - 1)).toBeNull()
    expect(forkFacts(trace, 99)).toBeNull()
  })

  test('each opening is anchored just inside its daughter and falls inside the scope’s view', () => {
    expect(OPENING_ANCHOR_MM).toBe(3)
    for (const { trace, index, id, facts } of STATIONS) {
      const where = `${trace.id} ${id}`
      const decision = trace.checkpoints[index].decision!
      const camera = stationCamera(trace, index)!
      facts.openings.forEach((opening, option) => {
        const fork = decision.junctionLps
        const toDaughter = decision.options[option].lps.map((v, axis) => v - fork[axis])
        const fromFork = opening.anchor.map((v, axis) => v - fork[axis])
        const reach = Math.hypot(...fromFork)
        expect(reach).toBeCloseTo(Math.min(OPENING_ANCHOR_MM, Math.hypot(...toDaughter)), 9)
        // Along the daughter, not across it.
        expect(
          fromFork[0] * toDaughter[0] + fromFork[1] * toDaughter[1] + fromFork[2] * toDaughter[2],
        ).toBeCloseTo(reach * Math.hypot(...toDaughter), 6)
        const projected = projectToParentView(camera, opening.anchor, SCOPE_FOV_DEG)
        expect(opening.view).toEqual([projected.x, projected.y])
        expect([where, option, projected.inFront]).toEqual([where, option, true])
        for (const value of opening.view) {
          expect(value).toBeGreaterThan(10)
          expect(value).toBeLessThan(90)
        }
      })
    }
  })

  test('the side words tell the openings of a fork apart, and agree with where they are drawn', () => {
    for (const { trace, id, facts } of STATIONS) {
      const where = `${trace.id} ${id}`
      const sides = facts.openings.map((opening) => opening.side)
      expect([where, new Set(sides).size]).toEqual([where, sides.length])
      const centre = [0, 1].map(
        (axis) =>
          facts.openings.reduce((sum, opening) => sum + opening.view[axis], 0) /
          facts.openings.length,
      )
      for (const opening of facts.openings) {
        if (opening.side.includes('left')) expect(opening.view[0]).toBeLessThan(centre[0])
        if (opening.side.includes('right')) expect(opening.view[0]).toBeGreaterThan(centre[0])
        if (opening.side.includes('upper')) expect(opening.view[1]).toBeLessThan(centre[1])
        if (opening.side.includes('lower')) expect(opening.view[1]).toBeGreaterThan(centre[1])
      }
      // Two openings are told apart along one axis: left and right, or upper and lower.
      if (sides.length === 2)
        expect([where, [...sides].sort().join('/')]).toEqual([
          where,
          sides.includes('left') ? 'left/right' : 'lower/upper',
        ])
    }
  })

  test('an opening is named by its letter and code, with the export’s direction where the code repeats', () => {
    for (const { trace, index, facts } of STATIONS) {
      const decision = trace.checkpoints[index].decision!
      const codes = decision.options.map((option) => option.airway.code)
      facts.openings.forEach((opening, option) => {
        const code = codes[option]
        const repeated =
          code === decision.parent.airway.code || codes.filter((c) => c === code).length > 1
        expect(opening.repeatedName).toBe(repeated)
      })
      // Whatever the codes, no two openings of a fork are shown under the same name.
      expect(new Set(facts.openings.map((opening) => openingName(opening, true))).size).toBe(
        facts.openings.length,
      )
      expect(new Set(facts.openings.map((opening) => openingName(opening, false))).size).toBe(
        facts.openings.length,
      )
    }
  })

  test('the same fork has the same facts on every route that passes it, apart from which opening the route takes', () => {
    const first = new Map<string, ForkFacts>()
    for (const { id, facts } of STATIONS) {
      if (!first.has(id)) first.set(id, facts)
      const strip = (f: ForkFacts) => ({
        ...f,
        openings: f.openings.map((opening) => ({ ...opening, onRoute: false })),
      })
      expect(strip(facts)).toEqual(strip(first.get(id)!))
    }
    expect(first.size).toBe(57)
  })
})

describe('forks the lessons work', () => {
  test('at the carina both main bronchi are identified on slice 372, the right on the scope’s right', () => {
    for (const trace of CT_TRACES) {
      const facts = forkFacts(trace, 0)!
      expect(facts.checkpointId).toBe('junction-1')
      expect(facts.parent.code).toBe('Trachea')
      expect(facts.forkSlice).toBe(392)
      expect(facts.openings.map((opening) => opening.slice)).toEqual([372, 372])
      expect(facts.openings.map((opening) => opening.slicesFromFork)).toEqual([-20, -20])
      expect(facts.openings.map((opening) => opening.mmFromFork)).toEqual([10, 10])
      // The scope looks down with anterior at the top: the patient's right is on its right.
      expect(byCode(facts, 'RMSB').side).toBe('right')
      expect(byCode(facts, 'LMSB').side).toBe('left')
      expect(byCode(facts, 'RMSB').course).toBe('to the patient’s right and down')
      expect(byCode(facts, 'LMSB').course).toBe('to the patient’s left and down')
      expect(facts.openings.map((opening) => openingName(opening, true))).toEqual([
        '1 · RMSB · Right main bronchus',
        '2 · LMSB · Left main bronchus',
      ])
    }
    expect(byCode(factsOn('central-right', 'junction-1'), 'RMSB').onRoute).toBe(true)
    expect(byCode(factsOn('left-lower-basal', 'junction-1'), 'LMSB').onRoute).toBe(true)
  })

  test('in the bronchus intermedius the middle lobe opening is the upper one and the lower lobe the lower', () => {
    const facts = factsOn('central-right', 'junction-5')
    expect(facts.parent.code).toBe('BI')
    expect(byCode(facts, 'RML').side).toBe('upper')
    expect(byCode(facts, 'RLL').side).toBe('lower')
    expect(byCode(facts, 'RML').onRoute).toBe(true)
    // Both daughters are found below the fork, a few slices apart.
    expect(byCode(facts, 'RML').slicesFromFork).toBeLessThan(0)
    expect(byCode(facts, 'RLL').slicesFromFork).toBeLessThan(byCode(facts, 'RML').slicesFromFork)
    expect(facts.inPlane).toBe(false)
  })

  test('the right main bronchus divides across levels; the middle lobe bronchus divides within one slice', () => {
    const rmsb = factsOn('central-right', 'junction-2')
    expect(rmsb.inPlane).toBe(false)
    expect(byCode(rmsb, 'RUL').slicesFromFork).toBeGreaterThan(0)
    expect(byCode(rmsb, 'BI').slicesFromFork).toBeLessThan(0)
    const rml = factsOn('middle-lobe-lateral', 'junction-10')
    expect(rml.parent.code).toBe('RML')
    expect(rml.inPlane).toBe(true)
    expect(new Set(rml.openings.map((opening) => opening.slice)).size).toBe(1)
    expect(rml.openings.map((opening) => opening.side).sort()).toEqual(['left', 'right'])
  })

  test('a daughter whose code repeats is named by where it sits in the scope, and three openings need both axes', () => {
    const rb4 = factsOn('middle-lobe-lateral', 'junction-19')
    expect(
      rb4.openings.map((opening) => [openingName(opening, true), opening.repeatedName]),
    ).toEqual([
      ['1 · RB4, the left branch', true],
      ['2 · RB4a · Right lateral bronchus, subsegment a', false],
    ])
    const three = STATIONS.filter(({ facts }) => facts.openings.length === 3)
    expect(new Set(three.map(({ id }) => id))).toEqual(new Set(['junction-138']))
    for (const { facts } of three) {
      expect(new Set(facts.openings.map((opening) => opening.side)).size).toBe(3)
      expect(facts.openings.some((opening) => opening.side.includes(' '))).toBe(true)
    }
  })
})

describe('levels, courses and the lesion', () => {
  test('a level is said in slices and millimetres, toward the head or the feet', () => {
    expect(levelPhrase(0)).toBe('on the fork’s own slice')
    expect(levelPhrase(9)).toBe('9 slices (4.5 mm) toward the head')
    expect(levelPhrase(-4)).toBe('4 slices (2 mm) toward the feet')
    expect(levelPhrase(1)).toBe('1 slice (0.5 mm) toward the head')
    expect(levelPhrase(-1)).toBe('1 slice (0.5 mm) toward the feet')
    expect(levelPhrase(-20)).toBe('20 slices (10 mm) toward the feet')
  })

  test('a course is the dominant one or two patient directions', () => {
    expect(courseWords([0, 0, -1])).toBe('down')
    expect(courseWords([0, 0, 5])).toBe('up')
    expect(courseWords([0, 1, 0])).toBe('back')
    expect(courseWords([0, -1, 0])).toBe('forward')
    expect(courseWords([1, 0, 0])).toBe('to the patient’s left')
    expect(courseWords([-1, 0, 0])).toBe('to the patient’s right')
    // The larger component is said first; a small one is left out.
    expect(courseWords([0, 0.6, -0.8])).toBe('down and back')
    expect(courseWords([0, 0.8, -0.6])).toBe('back and down')
    expect(courseWords([-0.9, 0.3, -0.3])).toBe('to the patient’s right')
    // Never more than two, however oblique.
    expect(courseWords([1, 1, 1]).split(' and ')).toHaveLength(2)
  })

  test('the lesion is placed from each fork by level, distance and bearing', () => {
    const trace = traceById('central-right')
    const target = targetForTrace(trace)
    const fromRmsb = lesionFromFork(trace, 1, target)!
    expect(trace.checkpoints[1].id).toBe('junction-2')
    // The middle lobe lesion lies below the right main bronchus fork.
    expect(fromRmsb.slicesFromFork).toBeLessThan(0)
    expect(fromRmsb.slice).toBe(target.slice)
    expect(fromRmsb.slicesFromFork).toBe(target.slice - forkFacts(trace, 1)!.forkSlice)
    expect(fromRmsb.bearing.length).toBeGreaterThan(0)
    // Fork by fork along the route the lesion gets nearer.
    const distances = trace.checkpoints.flatMap((checkpoint, index) =>
      checkpoint.decision ? [lesionFromFork(trace, index, target)!.mm] : [],
    )
    expect(distances).toEqual([...distances].sort((a, b) => b - a))
    expect(distances.at(-1)).toBeLessThan(40)
    for (const { trace: route, index, facts } of STATIONS) {
      const lesion = lesionFromFork(route, index, targetForTrace(route))!
      expect(lesion.slicesFromFork).toBe(targetForTrace(route).slice - facts.forkSlice)
      expect(lesion.mm).toBeGreaterThan(0)
      expect(lesion.bearing.length).toBeGreaterThan(0)
    }
    // No fork, no bearing.
    expect(lesionFromFork(trace, trace.checkpoints.length - 1, target)).toBeNull()
    // A route that comes back up: the superior segment lesion lies above the left main fork.
    const returning = traceById('left-lower-returning')
    expect(lesionFromFork(returning, 1, targetForTrace(returning))!.slicesFromFork).toBeGreaterThan(
      0,
    )
  })
})
