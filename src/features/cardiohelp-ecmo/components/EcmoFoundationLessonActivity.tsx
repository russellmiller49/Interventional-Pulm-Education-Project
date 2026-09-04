'use client'

import type { CriticalCareActivityPhase } from '@/features/learning-module/activity/types'

import type { EcmoInteractiveFoundationSectionId } from '../content/foundationLessonRuntime'
import type { SupportMode } from '../engine/types'
import { FoundationStageHost } from './stage/FoundationStageHost'

export { foundationCircuitLocationDisclosure } from './stage/adapters/foundationStageAdapter'

/**
 * The foundation Learn activity, now the lesson stage.
 *
 * The ten interactive foundation sections render through `FoundationStageHost`: the same one-step-
 * at-a-time progression, Now card, surface disclosures and Sections drawer the drills use, over the
 * foundation session reducer. This name is kept as the route's entry point; the stage owns the
 * behaviour. Commitment is never persisted, so a URL into a commitment-gated phase fails closed
 * at the mount boundary inside the host.
 */
export function EcmoFoundationLessonActivity({
  sectionId,
  supportMode,
  initialPhase = 'recognize',
  locale = 'en',
}: {
  readonly sectionId: EcmoInteractiveFoundationSectionId
  readonly supportMode: SupportMode
  /** The phase the lesson opens at, carried by the URL. Nothing about it is persisted. */
  readonly initialPhase?: CriticalCareActivityPhase
  readonly locale?: string
}) {
  return (
    <FoundationStageHost
      sectionId={sectionId}
      supportMode={supportMode}
      initialPhase={initialPhase}
      locale={locale}
    />
  )
}
