import { RIMS, mappedForks, turnedRim, type FrameLabels, type Sector } from '../engine/arc-map'
import {
  LESION_REACH_MM,
  ROUTE_PLAN_PARTS,
  planPrefilled,
  divisionBearings,
  lesionPathCrossings,
  lesionPathSlices,
  lesionShowPoint,
  lesionVerdict,
  planFrame,
  planReducer,
  segmentChoices,
  settlePlan,
  startPlan,
  summarizePlan,
  type PlanAction,
  type PlanSession,
  type PlanSpec,
} from '../engine/plan-session'
import { CT_TARGETS } from '../geometry/native-ct'
import { TARGET_IDS, targetById, traceForTarget } from '../content/targets'

/**
 * Planning from the lesion back (Mortimer & Saghaie): find the airway into the lesion, name its
 * segment, label the ostium circle, draw each division's branches, review.
 */
const ALL: PlanSpec['parts'] = ['lesion', 'segment', 'views', 'frame', 'arcs']
function setup(targetId: string, parts: PlanSpec['parts'] = ALL) {
  const target = targetById(targetId)!
  const trace = traceForTarget(targetId)
  const spec: PlanSpec = { traceId: trace.id, targetId, parts }
  const reduce = planReducer(trace, target, spec)
  const run = (state: PlanSession, ...actions: PlanAction[]) => actions.reduce(reduce, state)
  return { target, trace, spec, reduce, run, start: startPlan(trace, target, spec) }
}

describe('the airway into the lesion', () => {
  it('crosses the slices beside every lesion, and the bench’s own mark is in it', () => {
    for (const id of TARGET_IDS) {
      const { trace, target } = setup(id)
      const [low, high] = lesionPathSlices(trace)
      expect(low).toBeLessThanOrEqual(high)
      const show = lesionShowPoint(trace)
      expect(lesionVerdict(trace, show).ok).toBe(true)
      // The lesion is drawn on at least one slice the airway crosses.
      const drawn = target.patch.frames.map((f) => f.slice)
      expect(drawn.some((s) => s >= low && s <= high)).toBe(true)
    }
  })

  it('counts a mark within 3 mm of the airway, and says where the airway is from a miss', () => {
    const { trace } = setup('r-apical-anterior')
    const show = lesionShowPoint(trace)
    const near: [number, number] = [show.pixel[0] + 2, show.pixel[1]]
    expect(lesionVerdict(trace, { slice: show.slice, pixel: near }).ok).toBe(true)
    const far: [number, number] = [show.pixel[0] + 12, show.pixel[1]]
    const miss = lesionVerdict(trace, { slice: show.slice, pixel: far })
    expect(miss.ok).toBe(false)
    expect(miss.nearest!.mm).toBeGreaterThan(LESION_REACH_MM)
    expect(miss.nearest!.leftMm).toBeLessThan(0)
    // Far down the scan the airway is many slices toward the head.
    const low = lesionVerdict(trace, { slice: 300, pixel: show.pixel })
    expect(low.ok).toBe(false)
    expect(low.nearest!.slices).toBeGreaterThan(100)
  })

  it('counts an airway that runs along the slice all the way along it', () => {
    // RB5a's last 20 mm lies within slices 310–311.
    const { trace } = setup('r-middle-medial-a')
    const [low, high] = lesionPathSlices(trace)
    expect(high - low).toBeLessThanOrEqual(2)
    expect(lesionVerdict(trace, lesionShowPoint(trace)).ok).toBe(true)
    expect(
      lesionPathCrossings(trace, low).length + lesionPathCrossings(trace, high).length,
    ).toBeLessThan(4)
  })
})

describe('naming the segment', () => {
  it('offers the segmental bronchi of the lesion’s lobe, its own among them', () => {
    for (const target of CT_TARGETS) {
      const codes = segmentChoices(target).map((c) => c.code)
      expect(codes).toContain(target.segment.bronchusCode)
      expect(codes.length).toBeGreaterThanOrEqual(2)
    }
  })
})

describe('a whole plan', () => {
  const frameWords = (id: string, turn: 0 | 1 | 2 | 3 = 0): FrameLabels => {
    const { trace, target } = setup(id)
    const rim = turnedRim(planFrame(trace, target)!.rim, turn)
    return Object.fromEntries(RIMS.map((r) => [r, rim[r].word])) as FrameLabels
  }
  const labelAll = (labels: FrameLabels): PlanAction[] =>
    RIMS.map((rim) => ({ type: 'label-rim', rim, word: labels[rim] }) as PlanAction)

  it('runs the parts in order and ends in the review', () => {
    const { run, start, trace, target, spec } = setup('r-apical-anterior')
    expect(start.stage).toBe('lesion')
    let s = run(start, { type: 'mark-lesion', mark: lesionShowPoint(trace) })
    expect(s.stage).toBe('segment')
    s = run(s, { type: 'choose-segment', code: 'RB3' })
    expect([s.stage, s.log.segment.misses]).toEqual(['segment', 1])
    s = run(s, { type: 'choose-segment', code: 'RB3' }) // the same miss again is not counted
    expect(s.log.segment.misses).toBe(1)
    s = run(s, { type: 'choose-segment', code: 'RB1' })
    expect(s.stage).toBe('views')
    s = run(s, { type: 'set-view', view: 'coronal', on: true }, { type: 'views-done' })
    expect([s.stage, s.views.coronal]).toEqual(['frame', true])
    s = run(s, ...labelAll(frameWords('r-apical-anterior')), { type: 'check-frame' })
    expect([s.stage, s.frameTurn]).toEqual(['arcs', 0])
    for (let d = 0; d < mappedForks(trace, target).length; d++) {
      const bearings = divisionBearings(trace, target, d, 0)
      s = run(
        s,
        ...bearings.map((b) => ({ type: 'place-arc', sector: b.sector }) as PlanAction),
        { type: 'lead-on', index: bearings.findIndex((b) => b.onRoute) },
        { type: 'check-arcs' },
      )
    }
    expect(s.stage).toBe('review')
    const summary = summarizePlan(spec, s)
    expect(summary.arcs).toEqual({ asked: 3, firstTry: 3 })
    expect(summary.segment.misses).toBe(1)
    expect(run(s, { type: 'finish' }).stage).toBe('done')
  })

  it('accepts the learner’s circle in another roll and reads the arcs on it', () => {
    const { run, start, trace, target } = setup('l-superior', ['frame', 'arcs'])
    expect(start.stage).toBe('frame')
    let s = run(start, ...labelAll(frameWords('l-superior', 3)), { type: 'check-frame' })
    expect([s.stage, s.frameTurn]).toEqual(['arcs', 3])
    const bearings = divisionBearings(trace, target, 0, 3)
    s = run(
      s,
      ...bearings.map((b) => ({ type: 'place-arc', sector: b.sector }) as PlanAction),
      { type: 'lead-on', index: bearings.findIndex((b) => b.onRoute) },
      { type: 'check-arcs' },
    )
    expect([s.division, s.arcs[0].ok]).toEqual([1, true])
  })

  it('holds a mirrored circle, counts the miss once, and lets it be fixed', () => {
    const { run, start } = setup('r-apical-anterior', ['frame'])
    const mirrored: FrameLabels = {
      top: 'medial',
      right: 'anterior',
      bottom: 'lateral',
      left: 'posterior',
    }
    let s = run(start, ...labelAll(mirrored), { type: 'check-frame' }, { type: 'check-frame' })
    expect([s.stage, s.frameChecked, s.log.frame.misses]).toEqual(['frame', true, 1])
    s = run(s, { type: 'label-rim', rim: 'right', word: 'posterior' })
    expect(s.frameChecked).toBe(false)
    s = run(s, { type: 'label-rim', rim: 'left', word: 'anterior' }, { type: 'check-frame' })
    expect(s.stage).toBe('done')
  })

  it('does not check a circle with an empty position', () => {
    const { run, start } = setup('r-apical-anterior', ['frame'])
    const s = run(start, { type: 'label-rim', rim: 'top', word: 'medial' }, { type: 'check-frame' })
    expect([s.stage, s.frameChecked, s.log.frame.misses]).toEqual(['frame', false, 0])
  })

  it('holds arcs that do not fit, and marks the one that is off', () => {
    const { run, start } = setup('r-apical-anterior', ['arcs'])
    // RB1b leaves anterior (left, 6), RB1a posterior (right, 2).
    let s = run(start, { type: 'place-arc', sector: 0 }, { type: 'place-arc', sector: 2 })
    s = run(s, { type: 'lead-on', index: 0 }, { type: 'check-arcs' })
    expect([s.division, s.arcs[0].checked, s.arcs[0].misses]).toEqual([0, true, 1])
    s = run(s, { type: 'remove-arc', index: 0 })
    expect([s.arcs[0].placed, s.arcs[0].leadsOn]).toEqual([[2], null])
    s = run(
      s,
      { type: 'place-arc', sector: 6 },
      { type: 'lead-on', index: 1 },
      { type: 'check-arcs' },
    )
    expect([s.division, s.arcs[0].ok]).toEqual([1, true])
  })

  it('needs the branch toward the lesion marked before the arcs are checked', () => {
    const { run, start } = setup('r-apical-anterior', ['arcs'])
    const s = run(
      start,
      { type: 'place-arc', sector: 6 },
      { type: 'place-arc', sector: 2 },
      { type: 'check-arcs' },
    )
    expect([s.division, s.arcs[0].checked]).toEqual([0, false])
  })

  it('draws no more branches than the division has, and never two in one place', () => {
    const { run, start } = setup('r-apical-anterior', ['arcs'])
    const s = run(
      start,
      { type: 'place-arc', sector: 6 },
      { type: 'place-arc', sector: 6 },
      { type: 'place-arc', sector: 2 },
      { type: 'place-arc', sector: 4 },
    )
    expect(s.arcs[0].placed).toEqual([6, 2] as Sector[])
  })

  it('shows each step on request, and the shown answer stands', () => {
    for (const id of TARGET_IDS) {
      const { run, start, trace, target, spec } = setup(id)
      let s = run(start, { type: 'show-lesion' }, { type: 'show-segment' }, { type: 'views-done' })
      s = run(s, { type: 'show-frame' })
      for (let d = 0; d < mappedForks(trace, target).length; d++) s = run(s, { type: 'show-arcs' })
      expect([id, s.stage]).toEqual([id, 'review'])
      expect(s.segmentChoice).toBe(target.segment.bronchusCode)
      expect(s.arcs.every((a) => a.ok && a.shown)).toBe(true)
      const summary = summarizePlan(spec, s)
      expect(summary.arcs.firstTry).toBe(0)
      expect(summary.lesion.shown && summary.segment.shown && summary.frame.shown).toBe(true)
    }
  })

  it('skips the parts a trip does not ask for', () => {
    const { start } = setup('r-apical-anterior', ['lesion', 'segment'])
    expect(start.stage).toBe('lesion')
    const { run } = setup('r-apical-anterior', ['lesion', 'segment'])
    const s = run(start, { type: 'show-lesion' }, { type: 'show-segment' })
    expect(s.stage).toBe('done')
    expect(start.frameTurn).toBe(0)
  })
})

describe('a whole lesion outside the lessons', () => {
  it('plans without a views step: naming the segment leads straight to the circle', () => {
    expect(ROUTE_PLAN_PARTS).toEqual(['lesion', 'segment', 'frame', 'arcs'])
    const { run, start, trace } = setup('r-apical-anterior', ROUTE_PLAN_PARTS)
    const named = run(
      start,
      { type: 'mark-lesion', mark: lesionShowPoint(trace) },
      { type: 'choose-segment', code: 'RB1' },
    )
    expect(named.stage).toBe('frame')
    // Opening a reconstruction is still recorded, though no step waits on it.
    expect(run(named, { type: 'set-view', view: 'coronal', on: true }).views.coronal).toBe(true)
  })

  it('a place saved on the views step opens on the circle; every other place is left alone', () => {
    const full = setup('r-apical-anterior')
    const saved = full.run(full.start, { type: 'show-lesion' }, { type: 'show-segment' })
    expect(saved.stage).toBe('views')
    const route = setup('r-apical-anterior', ROUTE_PLAN_PARTS)
    const settled = settlePlan(route.spec, saved)
    expect(settled).toEqual({ ...saved, stage: 'frame' })
    expect(settlePlan(route.spec, route.start)).toBe(route.start)
    expect(settlePlan(full.spec, saved)).toBe(saved)
    // A plan that asks only for the first two parts ends where the saved step is gone.
    const short = setup('r-apical-anterior', ['lesion', 'segment'])
    expect(settlePlan(short.spec, saved).stage).toBe('done')
  })
})

describe('a map the bench has drawn already', () => {
  const target = targetById('r-apical-anterior')!
  const trace = traceForTarget('r-apical-anterior')
  const spec: PlanSpec = {
    traceId: trace.id,
    targetId: target.id,
    parts: ['frame', 'arcs'],
    prefilled: true,
  }
  const reduce = planReducer(trace, target, spec)
  const start = startPlan(trace, target, spec)

  it('opens on the review with the model’s circle and arcs, and nothing asked', () => {
    expect(start.stage).toBe('review')
    expect(planPrefilled(spec, start)).toBe(true)
    // The same map "Show me" draws at every step.
    const shown = setup('r-apical-anterior', ['frame', 'arcs'])
    const byHand = shown.run(
      shown.start,
      { type: 'show-frame' },
      ...mappedForks(trace, target).map(() => ({ type: 'show-arcs' }) as PlanAction),
    )
    expect(byHand.stage).toBe('review')
    expect(start.frame).toEqual(byHand.frame)
    expect(start.frameTurn).toBe(0)
    expect(start.arcs.map((a) => [a.placed, a.leadsOn])).toEqual(
      byHand.arcs.map((a) => [a.placed, a.leadsOn]),
    )
    expect(summarizePlan(spec, start)).toEqual({
      lesion: { asked: false, misses: 0, shown: false },
      segment: { asked: false, misses: 0, shown: false },
      frame: { asked: false, misses: 0, shown: false },
      arcs: { asked: 0, firstTry: 0 },
    })
    // It drives on from the review like any map.
    expect(reduce(start, { type: 'finish' }).stage).toBe('done')
    // A restart brings the drawn map back.
    expect(reduce(reduce(start, { type: 'draw-own' }), { type: 'restart' })).toEqual(start)
  })

  it('can be cleared and drawn by the learner, and is then theirs', () => {
    const own = reduce(start, { type: 'draw-own' })
    expect(own.stage).toBe('frame')
    expect(planPrefilled(spec, own)).toBe(false)
    expect(own.frame).toEqual({ top: null, right: null, bottom: null, left: null })
    expect(own.arcs.every((a) => a.placed.length === 0)).toBe(true)
    expect(own.log.frame.asked).toBe(true)
    // Once theirs, there is nothing to clear.
    expect(reduce(own, { type: 'draw-own' })).toBe(own)
    const drawn = [
      { type: 'show-frame' },
      { type: 'show-arcs' },
      { type: 'show-arcs' },
      { type: 'show-arcs' },
    ].reduce((state, action) => reduce(state, action as PlanAction), own)
    expect(drawn.stage).toBe('review')
    expect(summarizePlan(spec, drawn).arcs).toEqual({ asked: 3, firstTry: 0 })
  })

  it('a plan that is not drawn already has nothing to clear', () => {
    const plain = setup('r-apical-anterior', ['frame', 'arcs'])
    expect(planPrefilled(plain.spec, plain.start)).toBe(false)
    expect(plain.run(plain.start, { type: 'draw-own' })).toBe(plain.start)
  })
})
