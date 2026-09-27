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
 * nothing is withheld. Inside this drawer it is laid out as a list (see `.sectionsPanel nav`).
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

  /*
   * On opening, the current section is brought to the middle of the list. From section 12 onward
   * it would otherwise sit below the panel's fold. Only the panel scrolls; the page stays put.
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
        <span>Sections</span>
        <span className={styles.sectionsPosition}>{position}</span>
      </summary>
      <div className={styles.sectionsPanel} data-sections-panel>
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
