'use client'

import { HemodynamicsStageHost } from './stage/HemodynamicsStageHost'

/**
 * The Learn route's entry for one section of the pathway.
 *
 * Kept under its original name and props so the route and its test are undisturbed; everything
 * it used to do — a client-side section switch, two different activity components, a phase bar —
 * is now the lesson stage, which renders one section at a time and moves between sections by URL.
 */
export function PacLearningPathwayActivity({
  initialSectionId,
  locale = 'en',
}: {
  readonly initialSectionId: string
  readonly locale?: string
}) {
  return <HemodynamicsStageHost sectionId={initialSectionId} locale={locale} />
}
