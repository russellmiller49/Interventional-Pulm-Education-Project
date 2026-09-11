/** @jest-environment node */
import { projectOptical, scalar, type OpticalFrame } from '@/lib/bronchoscopy-core/frame'
import { makeFrame } from '@/lib/bronchoscopy-core/frame'

import {
  AIRWAY_LABELS,
  type AirwayLabel,
  type ScopeGoal,
  type ScopeGoalTest,
  type ScopeViewSpec,
} from '../components/scope/types'
import { bronchLearnerCopyErrors } from '../content/learnerCopy'
import { BRONCH_SECTION_IDS } from '../content/sectionIds'
import type { BronchSectionDefinition } from '../content/types'
import {
  PROFILE_NODE_BINDINGS,
  scopeCaseProfileErrors,
  teachingGraphFileErrors,
} from '../engine/scope/anatomyProfiles'
import { DECLARATION_MESSAGES } from '../engine/scope/inspectionLedger'
import { NEUTRAL_LOCATION_CAPTION, scopeLocationCaption } from '../engine/scope/scopeCaption'
import { createScopeCase } from '../engine/scope/scopeCase'
import { isScopeEventId } from '../engine/scope/scopeEvents'
import { scopeFrame } from '../engine/scope/scopeFrame'
import { scopeGoalsMet, scopeGoalTestMet } from '../engine/scope/scopeGoalEvaluation'
import { SCOPE_MESSAGES, SCRIPT_REPORTS } from '../engine/scope/scopeMessages'
import {
  ACCESSORY_POSITION_WORDS,
  ACCESSORY_STATE_WORDS,
  CORDS_STATE_WORDS,
  describeScopePerformance,
  formatScopeMetric,
  SCOPE_ASSIST_NAMES,
  SCOPE_INPUT_MODE_NAMES,
  SCOPE_METRIC_LABELS,
} from '../engine/scope/scopeMetrics'
import { LOCATION_WORDS } from '../engine/scope/scopePose'
import { createScopeState } from '../engine/scope/scopeReducer'
import { scopeViewErrors } from '../engine/scope/scopeViewErrors'
import { ScopeDriver, readTeachingGraphFile, teachingCase } from '../test-support/teachingCase'

const scopeCase = teachingCase()

const walkView = (
  label: AirwayLabel,
  at: 'proximal' | 'mid' | 'distal',
  extra: Partial<ScopeViewSpec> = {},
): ScopeViewSpec => ({
  sectionId: 'engine-test',
  mode: 'guided-walk',
  profile: 'adult-teaching-combined-left-basal-v1',
  start: { kind: 'airway', label, at },
  controls: ['advance', 'withdraw', 'rotate', 'deflect', 'declare', 'suction', 'recenter'],
  assists: { 'centerline-lock': true, 'aim-guard': true, recenter: true },
  ledger: { expected: 'profile' },
  boundary: 'Engine test view.',
  ...extra,
})

let sections: readonly BronchSectionDefinition[] = []
beforeAll(async () => {
  sections = await Promise.all(
    BRONCH_SECTION_IDS.map(
      async (id) =>
        ((await import(`../content/sections/${id}`)) as { section: BronchSectionDefinition })
          .section,
    ),
  )
})

function scopeStepsOf(section: BronchSectionDefinition) {
  const steps: { view: ScopeViewSpec; goals: readonly ScopeGoal[] }[] = []
  if (section.workspace.kind === 'scope') steps.push({ view: section.workspace.view, goals: [] })
  if (section.act.kind === 'scope-lab') {
    steps.push({ view: section.act.view, goals: section.act.goals })
    const observe = section.act.observe
    if (observe) steps.push({ view: observe.view ?? section.act.view, goals: observe.goals })
  }
  return steps
}

function goalEvents(test: ScopeGoalTest): string[] {
  switch (test.type) {
    case 'event':
    case 'without':
      return [test.event]
    case 'event-sequence':
      return [...test.events]
    case 'all':
      return test.tests.flatMap(goalEvents)
    default:
      return []
  }
}

describe('the teaching profile', () => {
  it('reads a well-formed teaching graph file', () => {
    expect(teachingGraphFileErrors(readTeachingGraphFile())).toEqual([])
  })

  it('agrees with the teaching tree on every airway’s parent (A03)', () => {
    expect(scopeCaseProfileErrors(scopeCase)).toEqual([])
  })

  it('binds all 31 manifest nodes; only the two basal groups go unlabelled', () => {
    expect(PROFILE_NODE_BINDINGS).toHaveLength(31)
    expect(
      PROFILE_NODE_BINDINGS.filter((node) => node.label === null).map((node) => node.nodeId),
    ).toEqual(['R_BASAL_GROUP', 'L_BASAL_GROUP'])
  })

  it('keeps the graph facts the authored starts rely on', () => {
    expect(
      Object.fromEntries(
        ['TR', 'RMSB', 'LMSB', 'RUL', 'BI', 'RB7'].map((l) => [
          l,
          scopeCase.originEdge.get(l as AirwayLabel),
        ]),
      ),
    ).toEqual({ TR: 0, RMSB: 1, LMSB: 2, RUL: 3, BI: 4, RB7: 35 })
    expect(scopeCase.graph.carinaNodeId).toBe(1)
    // RB7 leaves the lower lobe before the trunk that divides into RB9 and RB10 (drill D08).
    expect(scopeCase.labelAt(72)).toBe('RLL')
    expect(scopeCase.index.nodesById.get(74)?.childEdgeIds).toEqual([137, 138])
  })

  it('refuses a graph label that is not a profile airway (A05)', () => {
    const file = readTeachingGraphFile()
    const broken = {
      ...file,
      edgeLabels: { ...file.edgeLabels, '6': { abbreviatedLabel: '10R', fullLabel: 'x' } },
    }
    expect(teachingGraphFileErrors(broken).join(' ')).toContain('10R')
  })
})

describe('the scope frame', () => {
  const base = makeFrame([0, 0, 0], [0, 0, -1])

  it('turns the lever’s plane clockwise when the control section turns clockwise', () => {
    const turned = scopeFrame(base, { rotationDeg: 90, deflectionDeg: 0 })
    expect(scalar(turned.up, base.right)).toBeCloseTo(1, 9)
    const bent = scopeFrame(base, { rotationDeg: 90, deflectionDeg: 30 })
    expect(scalar(bent.forward, base.right)).toBeCloseTo(Math.sin(Math.PI / 6), 9)
  })

  it('bends the tip toward the top of the image', () => {
    const bent = scopeFrame(base, { rotationDeg: 0, deflectionDeg: 45 })
    expect(scalar(bent.forward, base.up)).toBeCloseTo(Math.SQRT1_2, 9)
  })
})

describe('roll invariance (A06, A28)', () => {
  const project = (frame: OpticalFrame, point: [number, number, number]) => {
    const p = projectOptical(point, frame, 4 / 3, 88)!
    return [p.x * (4 / 3), p.y] as const
  }
  const rotations = [-170, -90, -35, 20, 75, 135, 180]

  it('never changes the location, the openings, their visibility or the record', () => {
    let checkedPins = 0
    for (const label of AIRWAY_LABELS) {
      for (const at of ['proximal', 'mid', 'distal'] as const) {
        const view = walkView(label, at)
        for (const deg of rotations) {
          const driver = new ScopeDriver(view)
          const before = driver.state
          const after = driver.send({ type: 'rotate', deg })
          expect(after.location).toEqual(before.location)
          expect(after.ostia.map((p) => [p.label, p.inView])).toEqual(
            before.ostia.map((p) => [p.label, p.inView]),
          )
          expect(after.ledger).toEqual(before.ledger)
          expect(after.events).toEqual([...before.events, 'control-used:rotation'])
          const roll = (after.inputs.rotationDeg * Math.PI) / 180
          for (const pin of before.ostia.filter((p) => p.inView)) {
            const [x0, y0] = project(before.pose!.opticalFrame!, pin.pointLps)
            const [x1, y1] = project(after.pose!.opticalFrame!, pin.pointLps)
            // A clockwise turn of the scope turns the image counterclockwise by the same angle.
            expect(x1).toBeCloseTo(x0 * Math.cos(roll) - y0 * Math.sin(roll), 6)
            expect(y1).toBeCloseTo(x0 * Math.sin(roll) + y0 * Math.cos(roll), 6)
            checkedPins += 1
          }
        }
      }
    }
    expect(checkedPins).toBeGreaterThan(50)
  })

  it('with the tip bent, rotating sweeps the view but never renames anything', () => {
    for (const label of AIRWAY_LABELS) {
      const driver = new ScopeDriver(walkView(label, 'mid'))
      driver.send({ type: 'set-deflection', deg: 40 })
      const before = driver.state
      const after = driver.send({ type: 'rotate', deg: 120 })
      expect(after.location).toEqual(before.location)
      expect(after.ostia.map((p) => p.label)).toEqual(before.ostia.map((p) => p.label))
    }
  })
})

describe('the inspection record (A07, A30)', () => {
  it('never counts entering an airway as inspecting it', () => {
    const driver = new ScopeDriver(walkView('RLL', 'distal', { ledger: { expected: ['RLL'] } }))
    const record = driver.state.ledger.RLL!
    expect(record.entered).toBe(true)
    expect(record.inspected).toBe('no')
    expect(
      scopeGoalTestMet({ type: 'ledger', airway: 'RLL', status: 'inspected' }, driver.state),
    ).toBe(false)
  })

  it('keeps an inspection declared without a view beyond the opening visible as unsupported', () => {
    const driver = new ScopeDriver(walkView('RB6', 'proximal', { ledger: { expected: ['RB6'] } }))
    driver.send({ type: 'declare', airway: 'RB6', status: 'inspected' })
    expect(driver.state.ledger.RB6!.inspected).toBe('declared-without-view')
    expect(driver.state.events).toContain('declared:RB6:inspected')
    expect(
      scopeGoalTestMet({ type: 'ledger', airway: 'RB6', status: 'inspected' }, driver.state),
    ).toBe(false)
    expect(driver.state.message).toBe(DECLARATION_MESSAGES.inspectedWithoutView)
  })

  it('refuses to record an airway already entered as not safely accessible', () => {
    const driver = new ScopeDriver(walkView('RB6', 'mid', { ledger: { expected: ['RB6'] } }))
    driver.send({ type: 'declare', airway: 'RB6', status: 'not-safely-accessible' })
    expect(driver.state.ledger.RB6!.limitation).toBeNull()
    expect(driver.state.events.some((e) => e.startsWith('declared:'))).toBe(false)
  })
})

describe('goals', () => {
  it('reads sequences in order with other events between, and "without" over the whole step', () => {
    const state = {
      ...createScopeState(walkView('TR', 'mid'), scopeCase),
      events: ['entered:RMSB', 'wall-contact', 'returned-to-trachea'] as const,
    }
    expect(
      scopeGoalTestMet(
        { type: 'event-sequence', events: ['entered:RMSB', 'returned-to-trachea'] },
        state,
      ),
    ).toBe(true)
    expect(
      scopeGoalTestMet(
        { type: 'event-sequence', events: ['returned-to-trachea', 'entered:RMSB'] },
        state,
      ),
    ).toBe(false)
    expect(scopeGoalTestMet({ type: 'without', event: 'wall-contact' }, state)).toBe(false)
  })
})

describe('the authored scope views', () => {
  it('every view honours the pane contract and every goal names a real event', () => {
    let views = 0
    for (const section of sections) {
      for (const { view, goals } of scopeStepsOf(section)) {
        views += 1
        expect({ id: section.id, errors: scopeViewErrors(view) }).toEqual({
          id: section.id,
          errors: [],
        })
        const state = createScopeState(view, scopeCase)
        for (const goal of goals) {
          for (const event of goalEvents(goal.test)) expect(isScopeEventId(event)).toBe(true)
        }
        if (goals.length > 0)
          expect({ id: section.id, metAtStart: scopeGoalsMet(goals, state) }).toEqual({
            id: section.id,
            metAtStart: false,
          })
      }
    }
    expect(views).toBeGreaterThanOrEqual(15)
  })
})

describe('the engine’s learner-facing words', () => {
  it('pass the course’s copy gate', () => {
    const strings: string[] = [
      ...Object.values(SCOPE_MESSAGES).map((value) =>
        typeof value === 'string' ? value : (value as (arg: string) => string)('RB10'),
      ),
      SCOPE_MESSAGES.wrongAccessory('brush'),
      SCOPE_MESSAGES.accessoryChecked(ACCESSORY_STATE_WORDS['brush-sheathed'].toLowerCase()),
      SCOPE_MESSAGES.reportDisagrees(ACCESSORY_STATE_WORDS['brush-exposed'].toLowerCase()),
      ...Object.values(SCRIPT_REPORTS),
      ...Object.values(DECLARATION_MESSAGES),
      ...Object.values(LOCATION_WORDS),
      ...Object.values(SCOPE_METRIC_LABELS),
      ...Object.values(SCOPE_ASSIST_NAMES),
      ...Object.values(SCOPE_INPUT_MODE_NAMES),
      ...Object.values(CORDS_STATE_WORDS),
      ...Object.values(ACCESSORY_STATE_WORDS),
      ...Object.values(ACCESSORY_POSITION_WORDS),
      NEUTRAL_LOCATION_CAPTION,
    ]
    for (const section of sections) {
      for (const { view } of scopeStepsOf(section)) {
        const state = createScopeState(view, scopeCase)
        strings.push(scopeLocationCaption(state), describeScopePerformance(state))
        for (const metric of Object.keys(
          SCOPE_METRIC_LABELS,
        ) as (keyof typeof SCOPE_METRIC_LABELS)[])
          strings.push(formatScopeMetric(metric, state))
      }
    }
    const errors = strings.flatMap((text) => bronchLearnerCopyErrors('engine copy', text))
    expect(errors).toEqual([])
  })
})

describe('honest records (A18)', () => {
  it('discloses the guided walk’s assists and calls the bench unaided', () => {
    const walk = new ScopeDriver(walkView('TR', 'mid'))
    walk.send({ type: 'advance', mm: 3 })
    expect(describeScopePerformance(walk.state)).toBe(
      'keyboard, assisted (centerline lock, aim guard)',
    )
    const bench = new ScopeDriver(
      { ...walkView('TR', 'mid'), mode: 'controls-isolated', start: { kind: 'bench' } },
      null,
      'pointer',
    )
    bench.send({ type: 'rotate', deg: 30 })
    expect(describeScopePerformance(bench.state)).toBe('pointer, unaided')
  })

  it('discloses the centerline lock when free drive has no lumen to drive against', () => {
    const driver = new ScopeDriver({ ...walkView('TR', 'mid'), mode: 'free-drive', assists: {} })
    expect(driver.state.assistsUsed).toContain('centerline-lock')
  })
})

describe('control gating', () => {
  it('refuses a control the step does not offer and changes nothing else', () => {
    const driver = new ScopeDriver({ ...walkView('TR', 'mid'), controls: ['advance'] })
    const before = driver.state
    const after = driver.send({ type: 'rotate', deg: 30 })
    expect(after.inputs).toEqual(before.inputs)
    expect(after.events).toEqual(before.events)
    expect(after.message).toBe(SCOPE_MESSAGES.controlNotOffered)
  })

  it('builds a case from the file with the same result every time', () => {
    const again = createScopeCase(readTeachingGraphFile())
    expect([...again.originEdge]).toEqual([...scopeCase.originEdge])
  })
})
