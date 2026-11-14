'use client'

import { useEffect, useId, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { baxterCrrtNavBase } from '@/features/learning-module/moduleRoutes'
import { Link } from '@/i18n/navigation'
import styles from './crrt-foundations.module.css'

/**
 * Everything about the lesson that is not the lesson: moving between lessons, starting again, the
 * other parts of the module, and what is kept on this device.
 *
 * These were a row of buttons and two paragraphs above every task, about 180 px of a 852 px
 * window before any teaching. They sit behind one button in the lesson bar now, closed by default,
 * so the bar is one row and the task starts directly under it.
 */
export function CrrtLessonMenu({
  number,
  previous,
  next,
  onPrevious,
  onNext,
  onRestart,
  onRestartCourse,
}: {
  readonly number: number
  readonly previous?: { readonly title: string }
  readonly next?: { readonly title: string }
  readonly onPrevious: () => void
  readonly onNext: () => void
  readonly onRestart: () => void
  readonly onRestartCourse: () => void
}) {
  const ref = useRef<HTMLDetailsElement>(null)
  const restartScopeId = useId()

  // A press anywhere else closes the menu, as a menu does.
  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      const menu = ref.current
      if (menu?.open && event.target instanceof Node && !menu.contains(event.target))
        menu.open = false
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  function close() {
    if (ref.current) ref.current.open = false
  }
  function onKeyDown(event: ReactKeyboardEvent<HTMLDetailsElement>) {
    if (event.key !== 'Escape' || !ref.current?.open) return
    event.preventDefault()
    close()
    ref.current.querySelector('summary')?.focus()
  }
  const act = (action: () => void) => () => {
    close()
    action()
  }

  return (
    <details ref={ref} className={styles.lessonMenu} data-crrt-lesson-menu onKeyDown={onKeyDown}>
      <summary className={styles.lessonMenuSummary}>Menu</summary>
      <div className={styles.lessonMenuPanel} data-crrt-lesson-menu-panel>
        <nav className={styles.lessonSteps} aria-label="Previous and next lesson">
          {previous ? (
            <button
              type="button"
              aria-label={`Previous lesson: ${number - 1}. ${previous.title}`}
              onClick={act(onPrevious)}
            >
              ‹ Previous lesson
            </button>
          ) : (
            <span>First lesson</span>
          )}
          {next ? (
            <button
              type="button"
              aria-label={`Next lesson: ${number + 1}. ${next.title}`}
              onClick={act(onNext)}
            >
              Next lesson ›
            </button>
          ) : (
            <span>Last lesson</span>
          )}
        </nav>
        <div className={styles.lessonControls}>
          <button type="button" onClick={act(onRestart)} aria-describedby={restartScopeId}>
            Restart lesson
          </button>
          <button type="button" onClick={act(onRestartCourse)} data-restart-course>
            Restart course
          </button>
        </div>
        <p id={restartScopeId} className={styles.restartScope}>
          Restart lesson goes back to task 1 and clears this visit&apos;s answers and simulated
          runs. Visited topics stay saved on this device. Restart course opens lesson 1 at task 1.
        </p>
        <nav className={styles.lessonMenuLinks} aria-label="CRRT learning navigation">
          <Link href={baxterCrrtNavBase}>Overview</Link>
          <Link href={`${baxterCrrtNavBase}/learn`}>Learn</Link>
          <Link href={`${baxterCrrtNavBase}/practice`}>Practice</Link>
          <Link href={`${baxterCrrtNavBase}/assess`}>Challenge</Link>
        </nav>
        <p className={styles.context} data-crrt-storage-note>
          PrisMax AW8035 / 2.xx. Topics visited and your location stay on this device. Each visit
          starts a fresh simulation; answers and controls are not saved. Historical records remain
          unchanged.
        </p>
      </div>
    </details>
  )
}
