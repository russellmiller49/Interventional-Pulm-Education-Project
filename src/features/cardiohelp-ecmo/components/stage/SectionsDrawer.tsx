'use client'

import { useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react'

import { PathwayNav } from '@/features/learning-module/curriculum'
import type { LearningPathway } from '@/features/learning-module/curriculum/types'

import styles from './EcmoLessonStage.module.css'

/**
 * The seventeen sections, behind one control.
 *
 * The rail used to sit permanently above the lesson, seventeen items tall, which was the first
 * thing a learner met in the task pane and the last thing they needed while working a step. It
 * lives here now, closed by default, opened by one button that says where the learner is. The
 * rail itself is the shared `PathwayNav`, unchanged: every section stays one click away and
 * nothing is withheld.
 */
export function SectionsDrawer({
  pathway,
  activeSectionId,
  position,
  onSelect,
}: {
  readonly pathway: LearningPathway
  readonly activeSectionId: string
  /** "Section 8 of 17". */
  readonly position: string
  readonly onSelect: (sectionId: string) => void
}) {
  const ref = useRef<HTMLDetailsElement>(null)

  function onKeyDown(event: ReactKeyboardEvent<HTMLDetailsElement>) {
    if (event.key !== 'Escape' || !ref.current?.open) return
    event.preventDefault()
    ref.current.open = false
    ref.current.querySelector('summary')?.focus()
  }

  return (
    <details ref={ref} className={styles.sectionsDrawer} data-sections-drawer onKeyDown={onKeyDown}>
      <summary className={styles.sectionsSummary}>
        <span>Sections</span>
        <span className={styles.sectionsPosition}>{position}</span>
      </summary>
      <div className={styles.sectionsPanel}>
        <PathwayNav
          pathway={pathway}
          label={`${pathway.trackId?.toUpperCase() ?? ''} learning pathway`.trim()}
          activeSectionId={activeSectionId}
          onSelect={(sectionId) => {
            if (ref.current) ref.current.open = false
            onSelect(sectionId)
          }}
        />
      </div>
    </details>
  )
}
