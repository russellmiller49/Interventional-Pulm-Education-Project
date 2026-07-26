'use client'

import type { ReactNode } from 'react'

import { PathwayNav, PathwayViewport } from '@/features/learning-module/curriculum'

import { pacLearningPathway, type PacLearningPathwaySectionId } from '../content'

interface PacLearningPathwayNavProps {
  readonly activeSectionId: PacLearningPathwaySectionId
  readonly onSelect: (sectionId: PacLearningPathwaySectionId) => void
}

/** Module binding of the shared pathway rail. */
export function PacLearningPathwayNav({ activeSectionId, onSelect }: PacLearningPathwayNavProps) {
  return (
    <PathwayNav
      pathway={pacLearningPathway}
      label="PAC learning pathway"
      activeSectionId={activeSectionId}
      onSelect={(sectionId) => onSelect(sectionId as PacLearningPathwaySectionId)}
    />
  )
}

export function PacLearningPathwayViewport({
  activeSectionId,
  onSelect,
  children,
}: PacLearningPathwayNavProps & { readonly children: ReactNode }) {
  return (
    <PathwayViewport
      pathway={pacLearningPathway}
      label="PAC learning pathway"
      activeSectionId={activeSectionId}
      onSelect={(sectionId) => onSelect(sectionId as PacLearningPathwaySectionId)}
    >
      {children}
    </PathwayViewport>
  )
}
