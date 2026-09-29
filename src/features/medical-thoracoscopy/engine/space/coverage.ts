import type { ZoneLedger, ZoneLedgerEntry } from '../../components/space/types'
import { PLEURAL_ZONE_IDS, type PleuralZoneId } from '../../content/pleuralZones'
import { VIEW, type ZoneSamples } from './spatial/visibility'

/**
 * What the telescope has shown so far, sample by sample, as plain arrays: seen once in view at any
 * moment; hidden once in the field but blocked at any moment. The ledger follows from it (owner
 * decisions, T12): a region is seen when every one of its samples has been seen. For the rest of a
 * region, the reason is the one the learner can still act on, in this order: not looked at yet, if
 * some of it can be reached and has never been in the field; hidden, if all of what can be reached
 * has been in the field and something was in the way each time; out of reach from this port, if none
 * of what is left comes into the field from any position.
 *
 * Reach is the field's, not the sight's (plan, section 4.5: "outside this model's reach"): a sample
 * is reachable when some position the port allows brings it into the field, within range and facing
 * the telescope, whatever lies in the way. What lies in the way is the second reason, not the third.
 */
export interface Coverage {
  readonly seen: readonly number[]
  readonly hidden: readonly number[]
}

export function emptyCoverage(samples: number): Coverage {
  return { seen: new Array(samples).fill(0), hidden: new Array(samples).fill(0) }
}

export function addView(coverage: Coverage, view: Uint8Array): Coverage {
  return {
    seen: coverage.seen.map((value, s) => (value || view[s] === VIEW.inView ? 1 : 0)),
    hidden: coverage.hidden.map((value, s) => (value || view[s] === VIEW.hidden ? 1 : 0)),
  }
}

export function zonesInView(view: Uint8Array, samples: ZoneSamples): PleuralZoneId[] {
  const inView = new Set<PleuralZoneId>()
  view.forEach((value, s) => {
    if (value === VIEW.inView) inView.add(samples.zones[s])
  })
  return PLEURAL_ZONE_IDS.filter((zone) => inView.has(zone))
}

/** `reach`: for each sample, whether any position the port allows brings it into the field; null if not computed. */
export function ledgerFrom(
  coverage: Coverage,
  samples: ZoneSamples,
  reach: readonly number[] | null,
): ZoneLedger {
  return PLEURAL_ZONE_IDS.map((zone): ZoneLedgerEntry => {
    const members = samples.zones.flatMap((z, s) => (z === zone ? [s] : []))
    const unseen = members.filter((s) => !coverage.seen[s])
    if (unseen.length === 0) return { zone, seen: 'seen', reason: null }
    const seen = unseen.length === members.length ? 'not-seen' : 'partly-seen'
    const reachable = reach ? unseen.filter((s) => reach[s]) : unseen
    if (reachable.length === 0) return { zone, seen, reason: 'out-of-reach' }
    if (reachable.some((s) => !coverage.hidden[s])) return { zone, seen, reason: 'not-looked-at' }
    return { zone, seen, reason: 'hidden' }
  })
}
