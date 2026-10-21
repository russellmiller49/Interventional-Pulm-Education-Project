/**
 * The lab's readout of what lies over the nodule, read from a table baked from the course CT.
 *
 * Lab readouts are computed synchronously from the controls and never see the CT volume (it loads
 * asynchronously, and the Now card, the "what changed" table and the jsdom double read the same
 * function), so `scripts/peripheral-imaging/build-ray-crossings.ts` labels the CT with
 * `labelStructures` once and writes one hex digit per whole-degree view obliquity and tilt.
 * `model-truth.test.ts` rebuilds sampled entries from the real atlas and holds the table to them.
 */
import table from '../data/rayCrossings.json'
import { clamp } from './physics'
import { crossingFromBits, type RayCrossing } from './rayStructures'

export const RAY_CROSSING_TABLE = table

/** What the X-ray path through the nodule crosses at a whole-degree view obliquity and tilt. */
export function tableCrossing(viewObliquity: number, tilt: number): RayCrossing {
  const obliquity = clamp(Math.round(viewObliquity), table.obliquity.min, table.obliquity.max)
  const row = table.rows[clamp(Math.round(tilt), table.tilt.min, table.tilt.max) - table.tilt.min]
  return crossingFromBits(Number.parseInt(row[obliquity - table.obliquity.min], 16))
}
