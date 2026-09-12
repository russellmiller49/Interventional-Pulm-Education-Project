/** @jest-environment node */
import type { AirwayLabel, ScopeGoal, ScopeViewSpec } from '../components/scope/types'
import { section as branchEntry } from '../content/sections/branch-entry'
import { section as fiveControls } from '../content/sections/five-controls'
import { section as larynxAndEntry } from '../content/sections/larynx-and-entry'
import { section as leftSide } from '../content/sections/left-side'
import { section as protectedAccessories } from '../content/sections/protected-accessories'
import { section as rightSide } from '../content/sections/right-side'
import { section as scopeInATube } from '../content/sections/scope-in-a-tube'
import { section as systematicSurvey } from '../content/sections/systematic-survey'
import { section as viewLoss } from '../content/sections/view-loss'
import type { BronchSectionDefinition, ScopeLabAct } from '../content/types'
import { createScopeCase, type ScopeCase } from '../engine/scope/scopeCase'
import { breathPhaseAt, LARYNX_GLOTTIS_MM } from '../engine/scope/scopeScripts'
import { ScopePilot } from '../test-support/scopePilot'
import {
  ScopeDriver,
  centerlineTubeCollider,
  readTeachingGraphFile,
  teachingCase,
} from '../test-support/teachingCase'

/**
 * Every authored scope-lab step, walked on the teaching graph with the learner's own controls:
 * approach a fork with the tip straight, rotate and bend it into the next airway, advance, relax
 * the bend. If a goal an author wrote cannot be met this way, the step cannot be completed.
 */

function actOf(section: BronchSectionDefinition): ScopeLabAct {
  if (section.act.kind !== 'scope-lab') throw new Error(`${section.id} is not a scope-lab section`)
  return section.act
}

/** The pilot over the bare driver: the engine alone, no host. */
function pilot(view: ScopeViewSpec, scopeCase: ScopeCase | null = teachingCase()) {
  return new ScopePilot(new ScopeDriver(view, scopeCase))
}

const allMet = (goals: readonly ScopeGoal[]) => Object.fromEntries(goals.map((g) => [g.id, true]))

describe('authored scope-lab steps can be completed with the learner’s controls', () => {
  it('five-controls: one control at a time on the bench', () => {
    const act = actOf(fiveControls)
    const bench = pilot(act.view, null)
    bench.send({ type: 'rotate', deg: 45 })
    bench.send({ type: 'deflect', deg: 45 })
    bench.send({ type: 'rotate', deg: 45 })
    expect(bench.goals(act.goals)).toEqual(allMet(act.goals))
    const observe = act.observe!
    const o = pilot(observe.view ?? act.view, null)
    o.advance()
    o.withdraw()
    o.send({ type: 'suction', on: true })
    o.send({ type: 'suction', on: false })
    expect(o.goals(observe.goals)).toEqual(allMet(observe.goals))
  })

  it('branch-entry: to the carina, into each main bronchus, and a held view', () => {
    const act = actOf(branchEntry)
    const p = pilot(act.view)
    p.goInto('RMSB')
    p.withdrawTo('TR')
    p.goInto('LMSB')
    expect(p.goals(act.goals)).toEqual(allMet(act.goals))
    const observe = act.observe!
    const o = pilot(observe.view ?? act.view)
    o.send({ type: 'acknowledge' })
    o.send({ type: 'capture' })
    for (let i = 0; i < 6; i += 1) o.send({ type: 'tick', seconds: 1 })
    expect(o.goals(observe.goals)).toEqual(allMet(observe.goals))
  })

  it('branch-entry: moving during the hold is drift', () => {
    const observe = actOf(branchEntry).observe!
    const o = pilot(observe.view ?? actOf(branchEntry).view)
    o.withdraw()
    expect(o.state.events).toContain('drift-detected')
  })

  it('view-loss: withdraw out of the red field, then on to the carina; clear the lens in place', () => {
    const act = actOf(viewLoss)
    const p = pilot(act.view)
    expect(p.state.signals.view).toBe('red-out')
    p.withdraw()
    expect(p.state.signals.view).toBe('clear')
    p.advanceUntil(() => p.state.events.includes('reached-carina'))
    expect(p.goals(act.goals)).toEqual(allMet(act.goals))
    const observe = act.observe!
    const o = pilot(observe.view ?? act.view)
    expect(o.state.signals.view).toBe('contaminated')
    o.send({ type: 'clear-lens' })
    expect(o.goals(observe.goals)).toEqual(allMet(observe.goals))
  })

  it('view-loss: advancing or suctioning in the red field is recorded and does not help', () => {
    const p = pilot(actOf(viewLoss).view)
    const depth = p.state.depthMm
    p.advance()
    p.send({ type: 'suction', on: true })
    expect(p.state.depthMm).toBe(depth)
    expect(p.state.signals.view).toBe('red-out')
    expect(p.state.events).toEqual(
      expect.arrayContaining(['advanced-in-red-out', 'suction-in-red-out']),
    )
  })

  it('larynx-and-entry: wait for the breath in, cross, then name the trachea', () => {
    const act = actOf(larynxAndEntry)
    const p = pilot(act.view)
    while (p.state.depthMm + p.state.inputs.stepMm < LARYNX_GLOTTIS_MM) p.advance()
    for (let i = 0; p.state.inputs.cords !== 'abducted'; i += 1) {
      if (i > 20) throw new Error('The folds never opened')
      p.send({ type: 'tick', seconds: 0.5 })
    }
    p.advanceUntil(() => p.state.place === 'airway')
    p.send({ type: 'declare', airway: 'TR', status: 'identified' })
    expect(p.goals(act.goals)).toEqual(allMet(act.goals))
  })

  it('larynx-and-entry: pushing against narrowing folds is refused and recorded', () => {
    const p = pilot(actOf(larynxAndEntry).view)
    while (p.state.depthMm + p.state.inputs.stepMm < LARYNX_GLOTTIS_MM) p.advance()
    expect(p.state.inputs.cords).toBe('narrowing')
    p.advance()
    expect(p.state.place).toBe('larynx')
    expect(p.state.depthMm).toBeLessThan(LARYNX_GLOTTIS_MM)
    expect(p.state.events).toContain('advanced-against-closure')
    expect(breathPhaseAt(8.9)).toBe('cough')
  })

  it('right-side: expose and enter the upper lobe from its parent, then the middle and lower lobes', () => {
    const act = actOf(rightSide)
    const p = pilot(act.view)
    p.withdrawTo('RMSB')
    p.lookAt('RUL')
    p.goInto('RUL')
    for (const label of ['RB3', 'RB2', 'RB1'] as const) p.lookAt(label)
    expect(p.goals(act.goals)).toEqual(allMet(act.goals))
    const observe = act.observe!
    const o = pilot(observe.view ?? act.view)
    o.goInto('RB4')
    o.withdrawTo('RML')
    o.goInto('RB5')
    o.withdrawTo('BI')
    o.goInto('RB6')
    expect(o.goals(observe.goals)).toEqual(allMet(observe.goals))
  })

  it('left-side: the lingular division and its segments, then the superior segment', () => {
    const act = actOf(leftSide)
    const p = pilot(act.view)
    p.goInto('LB4+5')
    p.goInto('LB4')
    p.withdrawTo('LB4+5')
    p.goInto('LB5')
    p.withdrawTo('LMSB')
    p.goInto('LB6')
    expect(p.goals(act.goals)).toEqual(allMet(act.goals))
  })

  it('systematic-survey: every airway accounted for, the smear cleared, the narrowed one recorded', () => {
    const act = actOf(systematicSurvey)
    const p = pilot(act.view)
    const inspect = (label: AirwayLabel) => {
      p.goInto(label)
      if (p.state.signals.view === 'contaminated') p.send({ type: 'clear-lens' })
      p.goDeep(label)
      p.send({ type: 'declare', airway: label, status: 'inspected' })
    }
    inspect('RLL')
    inspect('RB6')
    p.withdrawTo('RLL')
    inspect('RB7')
    p.withdrawTo('RLL')
    inspect('RB8')
    p.withdrawTo('RLL')
    inspect('RB9')
    p.withdrawTo('RLL')
    p.lookAt('RB10')
    p.send({ type: 'declare', airway: 'RB10', status: 'not-safely-accessible' })
    expect(p.state.events).toContain('survey-complete')
    p.withdrawToEdge(scopeCaseOrigin('RLL'))
    p.goInto('RB6')
    expect(p.goals(act.goals)).toEqual(allMet(act.goals))
  })

  it('protected-accessories: expose only beyond the tip; retrieve only once the image agrees', () => {
    const act = actOf(protectedAccessories)
    const p = pilot(act.view)
    p.send({ type: 'accessory-move', to: 'in-channel' })
    p.send({ type: 'accessory-move', to: 'extended' })
    p.send({ type: 'accessory', state: 'brush-exposed' })
    p.send({ type: 'accessory', state: 'brush-sheathed' })
    expect(p.state.inputs.accessory).toBe('brush-exposed')
    p.send({ type: 'verify-accessory' })
    p.send({ type: 'accessory', state: 'brush-sheathed' })
    p.send({ type: 'verify-accessory' })
    p.send({ type: 'accessory-move', to: 'in-channel' })
    expect(p.goals(act.goals)).toEqual(allMet(act.goals))
  })

  it('protected-accessories: an exposed accessory is never moved through the channel (A12)', () => {
    const view = actOf(protectedAccessories).view
    const early = pilot(view)
    early.send({ type: 'accessory-move', to: 'in-channel' })
    early.send({ type: 'accessory', state: 'brush-exposed' })
    expect(early.state.inputs.accessory).toBe('brush-sheathed')
    expect(early.state.events).toContain('accessory-unsafe')
    const trusting = pilot(view)
    trusting.send({ type: 'accessory-move', to: 'in-channel' })
    trusting.send({ type: 'accessory-move', to: 'extended' })
    trusting.send({ type: 'accessory', state: 'brush-exposed' })
    trusting.send({ type: 'accessory', state: 'brush-sheathed' })
    trusting.send({ type: 'accessory-move', to: 'in-channel' })
    expect(trusting.state.inputs.accessoryPosition).toBe('extended')
    expect(trusting.state.events).toContain('accessory-unsafe')
  })

  it('scope-in-a-tube: along the tube, beyond it, to the carina; a bent tip meets the tube', () => {
    const act = actOf(scopeInATube)
    const p = pilot(act.view)
    p.advanceUntil(() => p.state.events.includes('reached-carina'))
    expect(p.goals(act.goals)).toEqual(allMet(act.goals))
    const observe = act.observe!
    const o = pilot(observe.view ?? act.view)
    o.advanceUntil(() => o.state.events.includes('tube-exited'))
    expect(o.goals(observe.goals)).toEqual(allMet(observe.goals))
    const bent = pilot(act.view)
    const depth = bent.state.depthMm
    bent.send({ type: 'set-deflection', deg: 30 })
    bent.advance()
    expect(bent.state.depthMm).toBe(depth)
    expect(bent.state.events).toContain('wall-contact')
  })
})

function scopeCaseOrigin(label: AirwayLabel): number {
  return teachingCase().originEdge.get(label)!
}

describe('free drive against a lumen', () => {
  const file = readTeachingGraphFile()
  const lumenCase = createScopeCase(file, { collider: centerlineTubeCollider(file.graph) })
  const view: ScopeViewSpec = {
    sectionId: 'engine-test',
    mode: 'free-drive',
    profile: 'adult-teaching-combined-left-basal-v1',
    start: { kind: 'airway', label: 'TR', at: 'mid' },
    controls: ['advance', 'withdraw', 'rotate', 'deflect'],
    assists: {},
    boundary: 'Engine test view.',
  }

  it('drives the tip off the centerline until it meets the wall, and withdrawing lifts it off', () => {
    const p = pilot(view, lumenCase)
    expect(p.state.assistsUsed).not.toContain('centerline-lock')
    p.send({ type: 'set-deflection', deg: 35 })
    p.advanceUntil(() => p.state.events.includes('wall-contact'), 40)
    expect(p.state.signals.view).toBe('red-out')
    expect(p.state.signals.contactCount).toBe(1)
    p.withdraw()
    expect(p.state.signals.view).toBe('clear')
    expect(p.state.events).toContain('red-out-recovered')
  })
})
