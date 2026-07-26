'use client'

import { PathwaySectionCompletion } from '@/features/learning-module/curriculum'

interface PacSectionCompletionActionsProps {
  readonly sectionTitle: string
  readonly nextTitle?: string
  readonly continueLabel?: string
  readonly onRepeat: () => void
  readonly onContinue: () => void
}

/** Module binding of the shared section-completion actions. */
export function PacSectionCompletionActions({
  sectionTitle,
  nextTitle,
  continueLabel,
  onRepeat,
  onContinue,
}: PacSectionCompletionActionsProps) {
  return (
    <PathwaySectionCompletion
      sectionTitle={sectionTitle}
      {...(nextTitle ? { nextTitle } : {})}
      {...(continueLabel ? { endOfPathwayLabel: continueLabel } : {})}
      onRepeat={onRepeat}
      onContinue={onContinue}
    />
  )
}
