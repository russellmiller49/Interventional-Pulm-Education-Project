'use client'

import { useEffect, useState } from 'react'

import {
  firstPacLearningPathwaySectionId,
  isPacLearningPathwaySectionId,
  type PacLearningPathwaySectionId,
} from '../content'
import { PacGuidedSkillActivity } from './PacGuidedSkillActivity'
import { PacSignalValidationActivity } from './PacSignalValidationActivity'

interface PacLearningPathwayActivityProps {
  readonly initialSectionId: PacLearningPathwaySectionId
  readonly locale?: string
}

function sectionFromCurrentUrl(): PacLearningPathwaySectionId {
  const activity = new URL(window.location.href).searchParams.get('activity')
  return isPacLearningPathwaySectionId(activity) ? activity : firstPacLearningPathwaySectionId
}

export function PacLearningPathwayActivity({
  initialSectionId,
  locale = 'en',
}: PacLearningPathwayActivityProps) {
  const [activeSectionId, setActiveSectionId] = useState(initialSectionId)

  useEffect(() => {
    setActiveSectionId(initialSectionId)
  }, [initialSectionId])

  useEffect(() => {
    const restoreUrlSection = () => setActiveSectionId(sectionFromCurrentUrl())
    window.addEventListener('popstate', restoreUrlSection)
    return () => window.removeEventListener('popstate', restoreUrlSection)
  }, [])

  function selectSection(sectionId: PacLearningPathwaySectionId) {
    const url = new URL(window.location.href)
    url.searchParams.set('activity', sectionId)
    window.history.pushState({}, '', `${url.pathname}${url.search}${url.hash}`)
    setActiveSectionId(sectionId)
  }

  return activeSectionId === 'pac-signal-validation' ? (
    <PacSignalValidationActivity
      key={activeSectionId}
      locale={locale}
      onPathwaySectionChange={selectSection}
    />
  ) : (
    <PacGuidedSkillActivity
      key={activeSectionId}
      skillId={activeSectionId}
      locale={locale}
      onPathwaySectionChange={selectSection}
    />
  )
}
