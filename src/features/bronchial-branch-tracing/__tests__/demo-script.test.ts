import { ALL_LESSONS, buildTrip } from '../content/nav-lessons'
import { ASSESS_TARGET_IDS, TARGET_IDS, targetById, traceForTarget } from '../content/targets'
import { mappedForks } from '../engine/arc-map'
import {
  DEMO_LESSON_ID,
  DEMO_TARGET_ID,
  demoSteps,
  demoTimeline,
  demoTrip,
} from '../engine/demo-script'
import { moving, summarize } from '../engine/nav-session'
import { summarizePlan } from '../engine/plan-session'
import { startTrip } from '../engine/trip-session'

/** The same gate the bench's own sentences are held to. */
const GATE =
  /\b(score|scored|points|grade|graded|pass|passed|mastery|correct|incorrect|wrong|synthetic|authored|NOT\s+REVIEWED|pending|faculty)\b/i

const target = targetById(DEMO_TARGET_ID)!
const trace = traceForTarget(DEMO_TARGET_ID)
const trip = demoTrip(trace)
const steps = demoSteps(trace, target, trip)
const { begins, rests } = demoTimeline(trace, target, trip, steps)
const place = (session: (typeof rests)[number]) =>
  session.stage === 'plan'
    ? `plan:${session.plan!.stage}:${session.plan!.division}`
    : `${session.nav!.station}:${session.nav!.phase}`

/** The method demonstrated: the bench's own "show me" actions, in order, on one lesion. */
describe('the demonstration', () => {
  test('uses a lesion that is in no lesson and not in the closing set', () => {
    expect(TARGET_IDS).toContain(DEMO_TARGET_ID)
    expect(ASSESS_TARGET_IDS).not.toContain(DEMO_TARGET_ID)
    const taught = ALL_LESSONS.flatMap((lesson) =>
      lesson.trips.map(
        (spec) => buildTrip(spec, { matchOptional: true, cruise: true }).target?.id ?? null,
      ),
    )
    expect(taught.filter(Boolean).length).toBeGreaterThan(5)
    expect(taught).not.toContain(DEMO_TARGET_ID)
    // Its address is not a lesson's.
    expect(ALL_LESSONS.map((lesson) => lesson.id)).not.toContain(DEMO_LESSON_ID)
  })

  test('goes from the lesion to the lesion: plan, map, then drive, one step at a time', () => {
    const divisions = mappedForks(trace, target).length
    expect(divisions).toBe(4)
    expect(steps.map((step) => step.id)).toEqual([
      'lesion',
      'airway',
      'segment',
      'circle',
      'arcs-1',
      'arcs-2',
      'arcs-3',
      'arcs-4',
      'fly',
      'division-1',
      'division-2',
      'division-3',
      'division-4',
      'arrived',
    ])
    expect(steps.map((step) => step.part)).toEqual([
      ...Array(3).fill('Plan'),
      ...Array(5).fill('Map'),
      ...Array(6).fill('Navigate'),
    ])
    expect(steps[0].actions).toEqual([])
    expect(rests[0]).toEqual(startTrip(trace, target, trip))
    expect(rests.map(place)).toEqual([
      'plan:lesion:0',
      'plan:segment:0',
      'plan:frame:0',
      'plan:arcs:0',
      'plan:arcs:1',
      'plan:arcs:2',
      'plan:arcs:3',
      'plan:review:3',
      '3:choose',
      '4:choose',
      '5:choose',
      '6:choose',
      '7:choose',
      '7:arrived',
    ])
  })

  test('every step changes the bench, comes to rest, and a drive is seen before it lands', () => {
    steps.forEach((step, i) => {
      if (i) expect([step.id, begins[i] === rests[i - 1]]).toEqual([step.id, false])
      const nav = rests[i].nav
      expect([step.id, rests[i].stage === 'navigate' && nav ? moving(nav.phase) : false]).toEqual([
        step.id,
        false,
      ])
    })
    // From the map's review on, each step begins with the scope on its way.
    for (let i = steps.findIndex((step) => step.id === 'fly'); i < steps.length; i++)
      expect([steps[i].id, begins[i].nav!.phase]).toEqual([steps[i].id, 'drive'])
  })

  test('is the bench showing, not a learner answering: nothing counts as a first try', () => {
    const end = rests[rests.length - 1]
    const plan = summarizePlan(trip.plan!, end.plan!)
    expect(plan.lesion.shown && plan.segment.shown && plan.frame.shown).toBe(true)
    expect(plan.arcs).toEqual({ asked: 4, firstTry: 0 })
    const drive = summarize(end.nav!)
    expect(drive.choose.asked).toBeGreaterThan(0)
    expect(drive.choose.firstTry).toBe(0)
    expect(drive.wrongTurns).toBe(0)
  })

  test('its captions are whole sentences in the course’s own words', () => {
    const bronchus = target.segment.bronchusCode
    for (const step of steps) {
      expect(step.caption).toBe(step.caption.trim())
      expect(step.caption).toMatch(/[.]$/)
      expect(step.caption).not.toMatch(/undefined|null|NaN|\[object|  /)
      expect(step.caption).not.toMatch(GATE)
      expect(step.caption.length).toBeLessThan(260)
    }
    expect(new Set(steps.map((step) => step.id)).size).toBe(steps.length)
    // The segment is not named before the step that names it.
    const named = steps.findIndex((step) => step.caption.includes(bronchus))
    expect(steps[named].id).toBe('segment')
  })
})
