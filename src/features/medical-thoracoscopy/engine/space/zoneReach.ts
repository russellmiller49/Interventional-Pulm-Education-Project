import { SNAPSHOT_PARTS, type ScopePose, type SpaceSnapshotId } from '../../components/space/types'
import { zoneReach, type ZoneReach } from '../../content/anatomy'
import { REACH } from './coverage'
import { acrossRibsLimitDeg } from './fulcrum'
import type { LoadedSpace, SpaceResolver } from './loadSpace'
import { spaceSnapshot } from './spaceSnapshot'
import { CLEARANCE_SKIN_MM } from './spatial/spatialWorld'
import { VIEW } from './spatial/visibility'

/**
 * Which zone samples the port lets the telescope bring into its field: computed offline by
 * `scripts/medical-thoracoscopy/build-zone-reach.ts`, with the lung at its most collapsed step, from
 * the proxies (plan, section 4.5, "outside this model's reach"). The record names the snapshot it was
 * computed for. Unless that is the snapshot the engine would compute it for now, there is no reach,
 * and the ledger never says a region is out of reach.
 *
 * The survey happens with the lung fallen away, so reach is computed at the lung's last step. Whether
 * a sample is in the field does not depend on the lung; only which positions the instrument can take
 * does, and an earlier step's larger lung leaves it fewer of them.
 *
 * One digit a sample: 0 out of the field from every position tried, 1 in the field from some but
 * always behind something, 2 seeable from some (`REACH`). The record names every part of the
 * snapshot but the scenario, and the grid it was computed on; if either differs from now, there is
 * no reach (independent review, R4).
 */
export type ReachIdentity = Omit<SpaceSnapshotId, 'scenario' | 'tool'>

const REACH_PARTS = SNAPSHOT_PARTS.filter(
  (part): part is Exclude<(typeof SNAPSHOT_PARTS)[number], 'scenario' | 'tool'> =>
    part !== 'scenario' && part !== 'tool',
)

export function reachIdentity(lungStep: number): ReachIdentity {
  const snapshot = spaceSnapshot('reach', lungStep)
  return Object.fromEntries(
    REACH_PARTS.map((part) => [part, snapshot[part]]),
  ) as unknown as ReachIdentity
}

/** The proxies a geometry names, without a teaching target the scenario adds. */
const proxiesOf = (geometry: string) => geometry.split('+').slice(0, 2).join('+')

/**
 * Whether the record was computed for the engine's own snapshot: every part but the scenario and
 * the lung's step (the record names its own), and the same proxies, whatever target a scenario adds.
 * The ledger and the view then answer from the same geometry and the same rules.
 */
export function reachFits(
  snapshot: SpaceSnapshotId,
  record: Pick<ZoneReach, 'computedFor'> = zoneReach,
): boolean {
  return REACH_PARTS.every((part) =>
    part === 'lungAndFluid'
      ? true
      : part === 'geometry'
        ? proxiesOf(snapshot.geometry) === proxiesOf(record.computedFor.geometry)
        : snapshot[part] === record.computedFor[part],
  )
}

/** For each sample, its `REACH` value; null if the record is not current. */
export function currentReach(
  sampleCount: number,
  record: Pick<ZoneReach, 'computedFor' | 'lungStep' | 'reachable' | 'grid'> = zoneReach,
): readonly number[] | null {
  const now = reachIdentity(record.lungStep)
  if (!REACH_PARTS.every((part) => now[part] === record.computedFor[part])) return null
  if (
    record.grid.tiltStepDeg !== REACH_GRID.tiltStepDeg ||
    record.grid.depthStepMm !== REACH_GRID.depthStepMm ||
    record.grid.rollsDeg.join() !== REACH_GRID.rollsDeg.join()
  )
    return null
  if (record.reachable.length !== sampleCount) return null
  return Array.from(record.reachable, (digit) =>
    digit === '2' ? REACH.sight : digit === '1' ? REACH.field : REACH.none,
  )
}

/** The grid of positions reach is computed over: tilts inside the ellipse, depths, and rolls. */
export interface ReachGrid {
  readonly tiltStepDeg: number
  readonly depthStepMm: number
  readonly rollsDeg: readonly number[]
}

export const REACH_GRID: ReachGrid = { tiltStepDeg: 2, depthStepMm: 3, rollsDeg: [0, 90, 180, 270] }

/** Evenly from `from` to `to`, both ends included, no step longer than `step`. */
function span(from: number, to: number, step: number): number[] {
  const count = Math.max(1, Math.ceil((to - from) / step))
  return Array.from({ length: count + 1 }, (_, i) => from + ((to - from) * i) / count)
}

/**
 * Which samples come into the field from some position the port allows, and which of those some
 * position shows with nothing in the way. The tilts fill the ellipse, its edge included; at each,
 * every depth the instrument clears in `depthStepMm` steps and the deepest it clears, found by
 * halving; at each position, every roll of the grid, since the optic sits off the axis.
 */
export function computeReach(
  space: LoadedSpace,
  resolver: SpaceResolver,
  lungStep: number,
  grid: ReachGrid = REACH_GRID,
): { readonly reach: Uint8Array; readonly seeable: Uint8Array; readonly poses: number } {
  const across = acrossRibsLimitDeg(space.port, space.device)
  const along = space.device.alongRibsLimitDeg
  const [least, most] = space.depthLimits
  const reach = new Uint8Array(resolver.sampleCount)
  const seeable = new Uint8Array(resolver.sampleCount)
  let poses = 0
  const clear = (pose: ScopePose) => resolver.clearance(pose, lungStep) >= CLEARANCE_SKIN_MM
  const look = (pose: ScopePose) => {
    for (const rollDeg of grid.rollsDeg) {
      poses += 1
      resolver.view({ ...pose, rollDeg }, lungStep).forEach((value, s) => {
        if (value !== VIEW.out) reach[s] = 1
        if (value === VIEW.inView) seeable[s] = 1
      })
    }
  }
  for (const a of span(-across, across, grid.tiltStepDeg)) {
    const reachAlong = along * Math.sqrt(Math.max(0, 1 - (a / across) ** 2))
    for (const b of span(-reachAlong, reachAlong, grid.tiltStepDeg)) {
      const at = (depthMm: number): ScopePose => ({
        tiltAcrossRibsDeg: a,
        tiltAlongRibsDeg: b,
        depthMm,
        rollDeg: 0,
      })
      if (!clear(at(least))) continue
      let deepest = least
      for (const depth of span(least, most, grid.depthStepMm)) {
        if (!clear(at(depth))) break
        deepest = depth
        look(at(depth))
      }
      if (deepest < most) {
        let lo = deepest
        let hi = Math.min(most, deepest + grid.depthStepMm)
        for (let i = 0; i < 12; i += 1) {
          const mid = (lo + hi) / 2
          if (clear(at(mid))) lo = mid
          else hi = mid
        }
        look(at(lo))
      }
    }
  }
  return { reach, seeable, poses }
}

/** The record's digits: 0 out of the field, 1 in the field only behind something, 2 seeable. */
export function reachDigits(reach: Uint8Array, seeable: Uint8Array): string {
  return Array.from(reach, (value, s) =>
    seeable[s] ? REACH.sight : value ? REACH.field : REACH.none,
  ).join('')
}
