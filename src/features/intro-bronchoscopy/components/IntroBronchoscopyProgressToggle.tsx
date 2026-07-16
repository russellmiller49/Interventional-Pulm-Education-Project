'use client'

import { useSyncExternalStore } from 'react'
import { CheckCircle2, Circle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { recordSiteModuleEvent } from '@/lib/analytics'

import {
  INTRO_BRONCHOSCOPY_SECTIONS,
  countIntroCompletedSections,
  emptyIntroBronchoscopyProgress,
  markIntroBronchoscopySection,
  readIntroBronchoscopyProgress,
  subscribeIntroBronchoscopyProgress,
} from '../engine/progress'
import type { IntroBronchoscopySectionKey } from '../types'

interface IntroBronchoscopyProgressToggleProps {
  moduleId: string
  section: IntroBronchoscopySectionKey
  label: string
}

export function IntroBronchoscopyProgressToggle({
  moduleId,
  section,
  label,
}: IntroBronchoscopyProgressToggleProps) {
  const progress = useSyncExternalStore(
    subscribeIntroBronchoscopyProgress,
    readIntroBronchoscopyProgress,
    emptyIntroBronchoscopyProgress,
  )
  const complete = Boolean(progress[moduleId]?.[section])

  function toggle() {
    const next = !complete
    const progress = markIntroBronchoscopySection(moduleId, section, next)

    if (next) {
      recordSiteModuleEvent({
        eventPayload: { course: 'intro-bronchoscopy', section },
        eventType: 'section_completed',
        moduleId: `intro-bronchoscopy:${moduleId}`,
        percentComplete: Math.round(
          (countIntroCompletedSections(progress[moduleId]) / INTRO_BRONCHOSCOPY_SECTIONS.length) *
            100,
        ),
        section,
      })
    }
  }

  return (
    <Button
      type="button"
      variant={complete ? 'default' : 'outline'}
      className="justify-start gap-2"
      onClick={toggle}
      aria-pressed={complete}
    >
      {complete ? (
        <CheckCircle2 className="h-4 w-4" aria-hidden />
      ) : (
        <Circle className="h-4 w-4 text-muted-foreground" aria-hidden />
      )}
      {complete ? `${label} complete` : label}
    </Button>
  )
}
