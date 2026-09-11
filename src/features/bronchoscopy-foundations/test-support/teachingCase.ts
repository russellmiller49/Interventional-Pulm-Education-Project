import fs from 'node:fs'
import path from 'node:path'

import { sweepClearance, type LumenCollider } from '@/lib/bronchoscopy-core/frame'
import type { AirwayGraph, Vec3 } from '@/lib/airway-anatomy/types'

import type { ScopeCommand, ScopeInputMode, ScopeViewSpec } from '../components/scope/types'
import { createScopeCase, type ScopeCase, type TeachingGraphFile } from '../engine/scope/scopeCase'
import { createScopeState, reduceScope } from '../engine/scope/scopeReducer'
import type { ScopeRuntimeState } from '../engine/scope/scopeRuntime'

/**
 * Node-side access to the course's teaching graph for engine tests: the same public JSON the
 * browser loads, read from disk, and a stepping helper over the reducer.
 */
export const TEACHING_GRAPH_PATH =
  'public/bronchoscopy-foundations/anatomy/adult-teaching-combined-left-basal-v1/graph.json'

export function readTeachingGraphFile(): TeachingGraphFile {
  return JSON.parse(
    fs.readFileSync(path.join(process.cwd(), TEACHING_GRAPH_PATH), 'utf8'),
  ) as TeachingGraphFile
}

let cached: ScopeCase | null = null

/** The teaching case without a lumen: the graph-only engine the fallback and the tests run. */
export function teachingCase(): ScopeCase {
  cached ??= createScopeCase(readTeachingGraphFile())
  return cached
}

function distanceToSegment(point: Vec3, a: Vec3, b: Vec3): number {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
  const ap = [point[0] - a[0], point[1] - a[1], point[2] - a[2]]
  const lengthSq = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2
  const t =
    lengthSq > 0
      ? Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / lengthSq))
      : 0
  return Math.hypot(ap[0] - ab[0] * t, ap[1] - ab[1] * t, ap[2] - ab[2] * t)
}

/**
 * An analytic lumen for tests: a tube of each edge's centerline radius around its polyline. It
 * stands in for the reviewed lumen so free drive can be exercised without WebGL.
 */
export function centerlineTubeCollider(graph: AirwayGraph): LumenCollider {
  const clearance = (point: Vec3) => {
    let best = Number.NEGATIVE_INFINITY
    for (const edge of graph.edges) {
      const radius = edge.radiusMm ?? 2
      for (let i = 1; i < edge.pointsLps.length; i += 1) {
        best = Math.max(
          best,
          radius - distanceToSegment(point, edge.pointsLps[i - 1], edge.pointsLps[i]),
        )
      }
    }
    return best
  }
  return {
    clearance,
    sweep: (from, to, radiusMm) => sweepClearance(clearance, from, to, radiusMm),
    visible: () => true,
  }
}

/** Drives the reducer the way the host does: one command at a time, one input mode. */
export class ScopeDriver {
  state: ScopeRuntimeState

  constructor(
    readonly view: ScopeViewSpec,
    readonly scopeCase: ScopeCase | null = teachingCase(),
    readonly inputMode: ScopeInputMode = 'keyboard',
  ) {
    this.state = createScopeState(view, scopeCase)
  }

  send(command: ScopeCommand): ScopeRuntimeState {
    this.state = reduceScope(this.state, command, this.inputMode, {
      view: this.view,
      scopeCase: this.scopeCase,
    })
    return this.state
  }
}
