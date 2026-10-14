import { sampleEdgePose } from '@/lib/airway-anatomy/scope-state'
import type { Vec3 } from '@/lib/airway-anatomy/types'

import type {
  AirwayLabel,
  ScopeCommand,
  ScopeGoal,
  ScopeState,
  ScopeViewSpec,
} from '../components/scope/types'
import { openingInsetMm, type ScopeCase } from '../engine/scope/scopeCase'
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
 * Guided travel stops the tip once on the way to every fork, at the place the scope waits
 * (`FORK_STANDOFF_MM` short of it), where both openings are in the picture. From there an advance
 * is refused while no opening is plainly the nearest the centre of that picture, and otherwise
 * carries the tip through the chosen opening in one movement. So the pilot advances until the
 * scope stops at a fork, centres the opening of the airway it wants, and advances once; and where
 * it finds itself off its way it withdraws, which brings the scope back to the waiting place.
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

  /** The fork ahead as guided travel reads it now: from the waiting place, or from the tip past it. */
  private forkAhead() {
    return guidedFork(
      this.engine.edgeId,
      this.state.inputs,
      { view: this.view, scopeCase: this.sc },
      this.engine.distanceMm,
    )
  }

  /** Whether the scope has come to the place it waits at before the fork ahead, or past it. */
  get atFork(): boolean {
    const fork = this.forkAhead()
    return fork !== null && this.engine.distanceMm >= fork.standMm - 1e-6
  }

  /**
   * Bring the opening that leads into an edge to the centre of the picture the fork ahead is read
   * from: the point inside it where its name is drawn. Guided travel enters the opening nearest
   * the centre of that picture, so this is the aim that decides.
   */
  aimDown(edgeId: number) {
    const fork = this.forkAhead()
    const child = this.sc.index.edgesById.get(edgeId)
    if (!fork || !child || !fork.openings.some((opening) => opening.edgeId === edgeId))
      throw new Error(`Edge ${edgeId} does not open off the fork ahead`)
    const aim = aimAt(fork.base, sampleEdgePose(child, openingInsetMm(child)).point)
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
    for (let guard = 0; this.engine.edgeId !== target; guard += 1) {
      if (guard > 400) throw new Error(`Stuck on edge ${this.engine.edgeId} heading for ${target}`)
      const here = path.indexOf(this.engine.edgeId)
      if (here < 0) {
        // Somewhere that is not on the way, by a wrong turn or from an earlier visit: back out.
        // Withdrawn out of a branch, the scope returns to where it waits before that fork.
        this.straighten()
        this.withdraw()
        continue
      }
      if (!this.atFork) {
        // Straight along the airway: the scope stops by itself where it waits before the fork.
        this.straighten()
        this.advance()
        continue
      }
      // Stopped at the fork: centre the next airway's opening, and one advance carries the tip in.
      this.aimDown(path[here + 1])
      this.advance()
    }
    this.straighten()
  }

  goInto(label: AirwayLabel) {
    this.goToEdge(this.sc.originEdge.get(label)!)
  }

  /**
   * As far into an airway's first segment as a straight tip is taken: to where the view reaches
   * beyond its opening, or to where the scope waits before the next fork if that comes first.
   */
  goDeep(label: AirwayLabel) {
    const origin = this.sc.originEdge.get(label)!
    if (this.engine.edgeId !== origin) throw new Error(`Not at the start of ${label}`)
    const want = Math.min(8, this.sc.index.edgesById.get(origin)!.lengthMm * 0.5) + 0.2
    this.straighten()
    for (let guard = 0; this.engine.distanceMm < want && !this.atFork; guard += 1) {
      if (guard > 60) throw new Error(`Could not go deep into ${label} (${this.state.message})`)
      this.advance(Math.min(this.state.inputs.stepMm, want - this.engine.distanceMm))
    }
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
