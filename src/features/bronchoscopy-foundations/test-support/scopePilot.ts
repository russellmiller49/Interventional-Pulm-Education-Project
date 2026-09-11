import { sampleEdgePose } from '@/lib/airway-anatomy/scope-state'
import type { Vec3 } from '@/lib/airway-anatomy/types'

import type {
  AirwayLabel,
  ScopeCommand,
  ScopeGoal,
  ScopeState,
  ScopeViewSpec,
} from '../components/scope/types'
import type { ScopeCase } from '../engine/scope/scopeCase'
import { aimAt } from '../engine/scope/scopeFrame'
import { scopeGoalStatuses } from '../engine/scope/scopeGoalEvaluation'
import { tipBaseFrame } from '../engine/scope/scopePose'

/**
 * Whatever carries a command to the reducer and hands back the state: the bare `ScopeDriver` in
 * the engine tests, or the stage host through the pane double in the flow tests.
 */
export interface ScopeTransport {
  readonly view: ScopeViewSpec
  readonly scopeCase: ScopeCase | null
  readonly state: ScopeState
  send(command: ScopeCommand): void
}

/**
 * The learner's own way of moving the scope, over any transport: approach a fork with the tip
 * straight, rotate and bend it into the next airway, advance, relax the bend. If a goal an
 * author wrote cannot be met this way, the step cannot be completed.
 */
export class ScopePilot {
  constructor(readonly transport: ScopeTransport) {}

  get view(): ScopeViewSpec {
    return this.transport.view
  }

  get scopeCase(): ScopeCase | null {
    return this.transport.scopeCase
  }

  get state(): ScopeState {
    return this.transport.state
  }

  send(command: ScopeCommand): ScopeState {
    this.transport.send(command)
    return this.state
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
