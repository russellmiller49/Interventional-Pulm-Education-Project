import type { ScopePose } from '../../components/space/types'
import { tourStops, type TourStops } from '../../content/anatomy'
import type { PleuralZoneId } from '../../content/pleuralZones'
import { reachIdentity } from './zoneReach'

/**
 * Where the tour of section 6 stops: for each region, the position that shows the most of it with
 * nothing in the way, computed offline by `scripts/medical-thoracoscopy/build-tour-stops.ts` and
 * recorded with its snapshot. As with reach, the record is used only while that snapshot is the one
 * the engine would compute it for now; otherwise there is no tour to take.
 */
export interface TourStop {
  readonly zone: PleuralZoneId
  readonly pose: ScopePose
  readonly lungStep: number
}

export function currentTourStops(record: TourStops = tourStops): readonly TourStop[] | null {
  const now = reachIdentity(record.lungStep)
  const parts = Object.keys(now) as (keyof typeof now)[]
  if (!parts.every((part) => now[part] === record.computedFor[part])) return null
  const stops = record.stops.flatMap((stop) =>
    stop.pose ? [{ zone: stop.zone, pose: stop.pose, lungStep: record.lungStep }] : [],
  )
  return stops.length === record.stops.length ? stops : null
}
