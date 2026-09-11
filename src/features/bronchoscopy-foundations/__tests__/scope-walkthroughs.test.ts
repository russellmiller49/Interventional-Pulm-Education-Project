/** @jest-environment node */
import { sampleEdgePose } from '@/lib/airway-anatomy/scope-state'
import type { Vec3 } from '@/lib/airway-anatomy/types'

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
import { aimAt } from '../engine/scope/scopeFrame'
import { scopeGoalStatuses } from '../engine/scope/scopeGoalEvaluation'
import { tipBaseFrame } from '../engine/scope/scopePose'
import { breathPhaseAt, LARYNX_GLOTTIS_MM } from '../engine/scope/scopeScripts'
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

class Pilot extends ScopeDriver {
  constructor(view: ScopeViewSpec, scopeCase: ScopeCase | null = teachingCase()) {
    super(view, scopeCase)
  }

  private get sc(): ScopeCase {
    if (!this.scopeCase) throw new Error('This step has no teaching graph')
    return this.scopeCase
  }

  get engine() {
    const engine = this.state.engine
    if (!engine) throw new Error(`The tip is not in the airway tree (${this.state.place})`)
    return engine
  }

  advance(mm = this.state.inputs.stepMm) {
    return this.send({ type: 'advance', mm })
  }

  withdraw(mm = this.state.inputs.stepMm) {
    return this.send({ type: 'advance', mm: -mm })
  }

  advanceUntil(done: () => boolean, max = 120) {
    for (let i = 0; !done(); i += 1) {
      if (i >= max) throw new Error(`Not reached after ${max} advances (${this.state.message})`)
      this.advance()
    }
  }

  aimAtPoint(point: Vec3) {
    const aim = aimAt(tipBaseFrame(this.engine, this.view, this.sc), point)
    this.send({ type: 'set-rotation', deg: aim.rotationDeg })
    this.send({ type: 'set-deflection', deg: aim.deflectionDeg })
  }

  lookAt(label: AirwayLabel) {
    const point = this.sc.ostiumPoint.get(label)
    if (!point) throw new Error(`No opening for ${label}`)
    this.aimAtPoint(point)
  }

  straighten() {
    if (this.state.inputs.deflectionDeg !== 0) this.send({ type: 'set-deflection', deg: 0 })
  }

  private pathTo(edgeId: number): number[] {
    const path: number[] = []
    let edge = this.sc.index.edgesById.get(edgeId)
    while (edge) {
      path.unshift(edge.id)
      const parent = this.sc.index.nodesById.get(edge.startNodeId)?.parentEdgeId
      edge = parent == null ? undefined : this.sc.index.edgesById.get(parent)
    }
    return path
  }

  goToEdge(target: number) {
    const path = this.pathTo(target)
    for (let guard = 0; this.engine.edgeId !== target; guard += 1) {
      if (guard > 400) throw new Error(`Stuck on edge ${this.engine.edgeId} heading for ${target}`)
      const here = path.indexOf(this.engine.edgeId)
      if (here < 0) throw new Error(`Edge ${this.engine.edgeId} is not on the way to ${target}`)
      const edge = this.sc.index.edgesById.get(this.engine.edgeId)!
      const toFork = edge.lengthMm - this.engine.distanceMm
      if (toFork > 1.01) {
        this.straighten()
        this.advance(Math.min(this.state.inputs.stepMm, toFork - 1))
        continue
      }
      const next = this.sc.index.edgesById.get(path[here + 1])!
      this.aimAtPoint(sampleEdgePose(next, Math.min(8, next.lengthMm)).point)
      this.advance(toFork + 1)
    }
    this.straighten()
  }

  goInto(label: AirwayLabel) {
    this.goToEdge(this.sc.originEdge.get(label)!)
  }

  /** Far enough into an airway's first segment to see beyond its opening. */
  goDeep(label: AirwayLabel) {
    const origin = this.sc.originEdge.get(label)!
    if (this.engine.edgeId !== origin) throw new Error(`Not at the start of ${label}`)
    const want = Math.min(8, this.sc.index.edgesById.get(origin)!.lengthMm * 0.5) + 0.2
    this.straighten()
    while (this.engine.distanceMm < want)
      this.advance(Math.min(this.state.inputs.stepMm, want - this.engine.distanceMm))
  }

  withdrawTo(label: AirwayLabel) {
    for (let guard = 0; this.state.location.label !== label; guard += 1) {
      if (guard > 200) throw new Error(`Could not withdraw to ${label}`)
      this.straighten()
      this.withdraw()
    }
  }

  withdrawToEdge(edgeId: number) {
    for (let guard = 0; this.engine.edgeId !== edgeId; guard += 1) {
      if (guard > 200) throw new Error(`Could not withdraw to edge ${edgeId}`)
      this.straighten()
      this.withdraw()
    }
  }

  goals(goals: readonly ScopeGoal[]) {
    return Object.fromEntries(scopeGoalStatuses(goals, this.state).map((s) => [s.goal.id, s.met]))
  }
}

const allMet = (goals: readonly ScopeGoal[]) => Object.fromEntries(goals.map((g) => [g.id, true]))

describe('authored scope-lab steps can be completed with the learner’s controls', () => {
  it('five-controls: one control at a time on the bench', () => {
    const act = actOf(fiveControls)
    const bench = new Pilot(act.view, null)
    bench.send({ type: 'rotate', deg: 45 })
    bench.send({ type: 'deflect', deg: 45 })
    bench.send({ type: 'rotate', deg: 45 })
    expect(bench.goals(act.goals)).toEqual(allMet(act.goals))
    const observe = act.observe!
    const o = new Pilot(observe.view ?? act.view, null)
    o.advance()
    o.withdraw()
    o.send({ type: 'suction', on: true })
    o.send({ type: 'suction', on: false })
    expect(o.goals(observe.goals)).toEqual(allMet(observe.goals))
  })

  it('branch-entry: to the carina, into each main bronchus, and a held view', () => {
    const act = actOf(branchEntry)
    const p = new Pilot(act.view)
    p.goInto('RMSB')
    p.withdrawTo('TR')
    p.goInto('LMSB')
    expect(p.goals(act.goals)).toEqual(allMet(act.goals))
    const observe = act.observe!
    const o = new Pilot(observe.view ?? act.view)
    o.send({ type: 'acknowledge' })
    o.send({ type: 'capture' })
    for (let i = 0; i < 6; i += 1) o.send({ type: 'tick', seconds: 1 })
    expect(o.goals(observe.goals)).toEqual(allMet(observe.goals))
  })

  it('branch-entry: moving during the hold is drift', () => {
    const observe = actOf(branchEntry).observe!
    const o = new Pilot(observe.view ?? actOf(branchEntry).view)
    o.withdraw()
    expect(o.state.events).toContain('drift-detected')
  })

  it('view-loss: withdraw out of the red field, then on to the carina; clear the lens in place', () => {
    const act = actOf(viewLoss)
    const p = new Pilot(act.view)
    expect(p.state.signals.view).toBe('red-out')
    p.withdraw()
    expect(p.state.signals.view).toBe('clear')
    p.advanceUntil(() => p.state.events.includes('reached-carina'))
    expect(p.goals(act.goals)).toEqual(allMet(act.goals))
    const observe = act.observe!
    const o = new Pilot(observe.view ?? act.view)
    expect(o.state.signals.view).toBe('contaminated')
    o.send({ type: 'clear-lens' })
    expect(o.goals(observe.goals)).toEqual(allMet(observe.goals))
  })

  it('view-loss: advancing or suctioning in the red field is recorded and does not help', () => {
    const p = new Pilot(actOf(viewLoss).view)
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
    const p = new Pilot(act.view)
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
    const p = new Pilot(actOf(larynxAndEntry).view)
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
    const p = new Pilot(act.view)
    p.withdrawTo('RMSB')
    p.lookAt('RUL')
    p.goInto('RUL')
    for (const label of ['RB3', 'RB2', 'RB1'] as const) p.lookAt(label)
    expect(p.goals(act.goals)).toEqual(allMet(act.goals))
    const observe = act.observe!
    const o = new Pilot(observe.view ?? act.view)
    o.goInto('RB4')
    o.withdrawTo('RML')
    o.goInto('RB5')
    o.withdrawTo('BI')
    o.goInto('RB6')
    expect(o.goals(observe.goals)).toEqual(allMet(observe.goals))
  })

  it('left-side: the lingular division and its segments, then the superior segment', () => {
    const act = actOf(leftSide)
    const p = new Pilot(act.view)
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
    const p = new Pilot(act.view)
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
    const p = new Pilot(act.view)
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
    const early = new Pilot(view)
    early.send({ type: 'accessory-move', to: 'in-channel' })
    early.send({ type: 'accessory', state: 'brush-exposed' })
    expect(early.state.inputs.accessory).toBe('brush-sheathed')
    expect(early.state.events).toContain('accessory-unsafe')
    const trusting = new Pilot(view)
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
    const p = new Pilot(act.view)
    p.advanceUntil(() => p.state.events.includes('reached-carina'))
    expect(p.goals(act.goals)).toEqual(allMet(act.goals))
    const observe = act.observe!
    const o = new Pilot(observe.view ?? act.view)
    o.advanceUntil(() => o.state.events.includes('tube-exited'))
    expect(o.goals(observe.goals)).toEqual(allMet(observe.goals))
    const bent = new Pilot(act.view)
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
    const p = new Pilot(view, lumenCase)
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
