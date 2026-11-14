/**
 * The Navigator's addresses. Five screens: Today, the knowledge map, the repair lab, progress and
 * the curriculum explorer. The lab takes the objective and the mode in the query string so a tile
 * on the map, a review reminder and the recommendation card all open the same page.
 */
export const BOARD_NAVIGATOR_NAV_BASE = '/board-navigator'
export const BOARD_NAVIGATOR_MAP_HREF = `${BOARD_NAVIGATOR_NAV_BASE}/map`
export const BOARD_NAVIGATOR_LAB_HREF = `${BOARD_NAVIGATOR_NAV_BASE}/lab`
export const BOARD_NAVIGATOR_PROGRESS_HREF = `${BOARD_NAVIGATOR_NAV_BASE}/progress`
export const BOARD_NAVIGATOR_CURRICULUM_HREF = `${BOARD_NAVIGATOR_NAV_BASE}/curriculum`

export type LabMode = 'repair' | 'review'

/** The lab for one objective. `review` runs the retention check alone. */
export function labHref(objectiveId: string, mode: LabMode = 'repair'): string {
  const params = new URLSearchParams({ objective: objectiveId })
  if (mode !== 'repair') params.set('mode', mode)
  return `${BOARD_NAVIGATOR_LAB_HREF}?${params.toString()}`
}

/** The map, opened on one objective's tile. */
export function mapHref(objectiveId?: string): string {
  return objectiveId
    ? `${BOARD_NAVIGATOR_MAP_HREF}?objective=${encodeURIComponent(objectiveId)}`
    : BOARD_NAVIGATOR_MAP_HREF
}
