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
import { guidedFork } from '../engine/scope/scopeMotion'
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
 *
 * Guided travel stops an undecided tip short of a fork (`FORK_STANDOFF_MM`), where both openings
 * are still in the picture, and holds it there until one opening is plainly the nearest the centre
 * of that picture. So the pilot drives straight until the guard refuses or the fork is reached,
 * then centres the opening of the airway it wants and advances until it is through.
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

  /** How many advances the aim guard has refused so far in this attempt. */
  private get refusals(): number {
    return this.state.events.filter((event) => event === 'aim-refused').length
  }

  /**
   * Bring the opening that leads into an edge to the centre of the picture the fork ahead is read
   * from: the view from where the scope waits. Guided travel enters the opening nearest the centre
   * of that picture, so this is the aim that decides.
   */
  aimDown(edgeId: number) {
    const fork = guidedFork(this.engine.edgeId, this.state.inputs, {
      view: this.view,
      scopeCase: this.sc,
    })
    const opening = fork?.openings.find((candidate) => candidate.edgeId === edgeId)
    if (!fork || !opening) throw new Error(`Edge ${edgeId} does not open off the fork ahead`)
    const aim = aimAt(fork.base, opening.aimPoint)
    this.send({ type: 'set-rotation', deg: aim.rotationDeg })
    this.send({ type: 'set-deflection', deg: aim.deflectionDeg })
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
    // Whether the aim guard is holding the straight tip short of the fork ahead.
    let waiting = false
    for (let guard = 0; this.engine.edgeId !== target; guard += 1) {
      if (guard > 400) throw new Error(`Stuck on edge ${this.engine.edgeId} heading for ${target}`)
      const here = path.indexOf(this.engine.edgeId)
      if (here < 0) throw new Error(`Edge ${this.engine.edgeId} is not on the way to ${target}`)
      const edge = this.sc.index.edgesById.get(this.engine.edgeId)!
      const toFork = edge.lengthMm - this.engine.distanceMm
      if (toFork > 1.01 && !waiting) {
        this.straighten()
        const refusals = this.refusals
        this.advance(Math.min(this.state.inputs.stepMm, toFork - 1))
        waiting = this.refusals > refusals
        continue
      }
      // At the fork, or held short of it: centre the next airway's opening and go on.
      this.aimDown(path[here + 1])
      this.advance(Math.min(this.state.inputs.stepMm, toFork + 1))
      if (this.engine.edgeId !== edge.id) waiting = false
    }
    this.straighten()
  }

  goInto(label: AirwayLabel) {
    this.goToEdge(this.sc.originEdge.get(label)!)
  }

  /**
   * Far enough into an airway's first segment to see beyond its opening. Where that is inside the
   * stretch the aim guard holds a straight tip out of, the view is turned down the first airway
   * beyond it to go on.
   */
  goDeep(label: AirwayLabel) {
    const origin = this.sc.originEdge.get(label)!
    if (this.engine.edgeId !== origin) throw new Error(`Not at the start of ${label}`)
    const edge = this.sc.index.edgesById.get(origin)!
    const beyond = this.sc.index.nodesById.get(edge.endNodeId)?.childEdgeIds[0]
    const want = Math.min(8, edge.lengthMm * 0.5) + 0.2
    let waiting = false
    for (let guard = 0; this.engine.distanceMm < want; guard += 1) {
      if (guard > 60 || this.engine.edgeId !== origin)
        throw new Error(`Could not go deep into ${label} (${this.state.message})`)
      if (waiting && beyond !== undefined) this.aimDown(beyond)
      else this.straighten()
      const refusals = this.refusals
      this.advance(Math.min(this.state.inputs.stepMm, want - this.engine.distanceMm))
      if (this.refusals > refusals) waiting = true
    }
    this.straighten()
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
