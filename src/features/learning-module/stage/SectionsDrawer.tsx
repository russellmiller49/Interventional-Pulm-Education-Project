'use client'

import { useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react'

import { PathwayNav } from '../curriculum/PathwayNav'
import type { LearningPathway } from '../curriculum/types'
import styles from './lesson-stage.module.css'

/**
 * Every section of the pathway, behind one control.
 *
 * Closed by default, opened by one button that says where the learner is. The rail itself is the
 * shared `PathwayNav`, unchanged: every section stays one click away and nothing is withheld.
 */
export function SectionsDrawer({
  pathway,
  activeSectionId,
  position,
  label,
  onSelect,
}: {
  readonly pathway: LearningPathway
  readonly activeSectionId: string
  /** "8 of 17". */
  readonly position: string
  readonly label: string
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
          label={label}
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
