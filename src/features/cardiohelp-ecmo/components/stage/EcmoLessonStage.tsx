'use client'

import type { EcmoSimulationState } from '../../engine/types'
import { DrillStageHost } from './DrillStageHost'

/**
 * The Learn stage: one surface for every section of the pathway.
 *
 * Drills render through the drill host over the shared session core. The foundation sections are
 * routed to their own host by the page (`FoundationStageHost`), on the same shell primitives.
 *
 * `onStateChange` is an observability seam: it reports the engine state after every change, so a
 * test or the render harness can read what the simulator holds without reaching into the session.
 * Nothing in the stage depends on it.
 */
export function EcmoLessonStage({
  locale = 'en',
  onStateChange,
}: {
  readonly locale?: string
  readonly onStateChange?: (state: EcmoSimulationState) => void
}) {
  return <DrillStageHost locale={locale} onStateChange={onStateChange} />
}
