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
 * Inside this drawer it is laid out as a numbered list (see `.sectionsPanel nav`), as in ECMO.
 */
export function SectionsDrawer({
  pathway,
  activeSectionId,
  position,
  label,
  unit = 'Section',
  onSelect,
}: {
  readonly pathway: LearningPathway
  readonly activeSectionId: string
  /** "8 of 17". */
  readonly position: string
  readonly label: string
  /** What the module calls one entry: "Section" (the default) or "Lesson". */
  readonly unit?: string
  readonly onSelect: (sectionId: string) => void
}) {
  const ref = useRef<HTMLDetailsElement>(null)

  /*
   * On opening, the current section is brought to the middle of the list, so a learner deep in
   * the course does not open the drawer onto section 01. Only the panel scrolls; the page stays put.
   */
  function onToggle() {
    const drawer = ref.current
    if (!drawer?.open) return
    const panel = drawer.querySelector<HTMLElement>('[data-sections-panel]')
    const current = panel?.querySelector<HTMLElement>('[aria-current="step"]')
    if (!panel || !current) return
    const offset = current.getBoundingClientRect().top - panel.getBoundingClientRect().top
    panel.scrollTop += offset - (panel.clientHeight - current.offsetHeight) / 2
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLDetailsElement>) {
    if (event.key !== 'Escape' || !ref.current?.open) return
    event.preventDefault()
    ref.current.open = false
    ref.current.querySelector('summary')?.focus()
  }

  return (
    <details
      ref={ref}
      className={styles.sectionsDrawer}
      data-sections-drawer
      onKeyDown={onKeyDown}
      onToggle={onToggle}
    >
      <summary className={styles.sectionsSummary}>
        <span>{unit}s</span>
        <span className={styles.sectionsPosition}>{position}</span>
      </summary>
      <div className={styles.sectionsPanel} data-sections-panel>
        <PathwayNav
          pathway={pathway}
          label={label}
          unit={unit}
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
