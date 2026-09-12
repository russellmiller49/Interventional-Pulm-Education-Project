import type { AirwayLabel, ScopeState } from '../../components/scope/types'
import { SPINE_STOPS, spineCaption, type SpineStopId } from '../../content/spine'

/**
 * Where the tip is, in the words the caption strip prints, and which spine stop that lights.
 *
 * The spine numbers its stops only through `spineCaption`, so the caption is the one surface that
 * says "3 of 6". A step whose prediction is answered on the map shows a neutral caption instead
 * (the host decides; see `NEUTRAL_LOCATION_CAPTION`).
 */

export const NEUTRAL_LOCATION_CAPTION = spineCaption(null)

/** The deepest non-carina stop that lists the airway: main bronchi, lobar or segmental. */
export function spineStopForAirway(label: AirwayLabel, nearCarina: boolean): SpineStopId {
  if (label === 'TR') return nearCarina ? 'carina' : 'trachea'
  for (const id of ['segmental', 'lobar', 'main-bronchi'] as const) {
    if (SPINE_STOPS.find((stop) => stop.id === id)?.airways.includes(label)) return id
  }
  return 'segmental'
}

export function scopeLocationCaption(state: Pick<ScopeState, 'place' | 'location'>): string {
  const { spineStop, label, fullLabel } = state.location
  if (state.place === 'bench' || !spineStop) return 'On the bench · the tip is outside the airway'
  if (state.place === 'airway' && label === 'TR') return spineCaption(spineStop)
  return `${spineCaption(spineStop)} · ${fullLabel}`
}
