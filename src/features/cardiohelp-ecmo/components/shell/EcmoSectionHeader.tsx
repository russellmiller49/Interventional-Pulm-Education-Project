'use client'

import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from 'react'

import { useIsomorphicLayoutEffect } from '../useIsomorphicLayoutEffect'

import { Link } from '@/i18n/navigation'

import styles from './EcmoActivityShell.module.css'

/*
 * A window too narrow to hold every control on one row beside the section name.
 *
 * Three of the bar's controls are rarely used (the main menu and the two restarts). Under this
 * width they fold into one menu, so the bar is one row: section name, Sections, the help button and
 * Save & exit. The bar is pinned while the task scrolls under it, and at 1280 px it had wrapped to
 * 84 to 129 px with all six controls in line. It was first a phone-only fold (600 px); the threshold
 * is the width at which the six controls and a full section title fit on one row. The stylesheet
 * carries the same number (`EcmoActivityShell.module.css`).
 *
 * Server and first client render take the wide arrangement; a narrower window switches to the
 * compact one straight after hydration, so there is no markup mismatch and nothing to repair.
 */
const COMPACT_HEADER_QUERY = '(max-width: 1499px)'
function subscribeCompact(onChange: () => void) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {}
  const query = window.matchMedia(COMPACT_HEADER_QUERY)
  query.addEventListener?.('change', onChange)
  return () => query.removeEventListener?.('change', onChange)
}
function compactSnapshot() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(COMPACT_HEADER_QUERY).matches
  )
}

/** What Save & exit keeps and what it does not. */
const SAVE_LOCATION_NOTE =
  'Save & exit saves your location, not the current teaching or case state. Your existing progress history is retained. Reopening starts fresh; answers, snapshots, and simulator actions from this run are not restored.'

/**
 * The slim header of a lean ECMO activity: where you are, what it is called, and at most five
 * controls. Objectives are deliberately absent — they render inside the first step's own body,
 * where the leak scan covers them, never above the workspace where they would answer the
 * prediction beneath.
 */
export function EcmoSectionHeader({
  breadcrumb,
  kicker,
  title,
  meta,
  sectionsControl,
  onMainMenu,
  options,
  helpRef,
  onHelp,
  onRestart,
  restartLabel = 'Restart',
  onRestartCourse,
  onSaveAndExit,
  resumedNote,
}: {
  readonly breadcrumb?: { readonly href: string; readonly label: string }
  readonly kicker: string
  readonly title: string
  readonly meta?: readonly string[]
  /** The collapsed Sections / Case options disclosure trigger. */
  readonly sectionsControl?: ReactNode
  /**
   * Back to the ECMO menu, which is where the track is chosen. There is no in-activity VV/VA
   * switch: it lived in a disclosure whose summary did nothing on a desktop (live report,
   * 2026-09-27), and switching quietly swapped a Practice case for another one.
   */
  readonly onMainMenu?: () => void
  readonly options?: ReactNode
  readonly helpRef?: RefObject<HTMLButtonElement | null>
  readonly onHelp?: () => void
  readonly onRestart?: () => void
  readonly restartLabel?: string
  /** Opens the course's first section at its first task, beside the restart of this one. */
  readonly onRestartCourse?: () => void
  readonly onSaveAndExit?: () => void
  readonly resumedNote?: string
}) {
  const saveLocationNoteId = useId()
  const compact = useSyncExternalStore(subscribeCompact, compactSnapshot, () => false)
  const mainMenuButton = onMainMenu ? (
    <button type="button" className={styles.headerButton} data-ecmo-main-menu onClick={onMainMenu}>
      Main menu
    </button>
  ) : null
  const restartButton = onRestart ? (
    <button type="button" className={styles.headerButton} data-ecmo-restart onClick={onRestart}>
      {restartLabel}
    </button>
  ) : null
  const restartCourseButton = onRestartCourse ? (
    <button
      type="button"
      className={styles.headerButton}
      data-ecmo-restart-course
      onClick={onRestartCourse}
    >
      Restart course
    </button>
  ) : null
  const anyRestart = restartButton ?? restartCourseButton
  // Keep the same controls mounted across the breakpoint. If a control has focus, keep its
  // disclosure open when shrinking; when widening, a focused summary hands focus to its contents.
  const detailsRef = useRef<HTMLDetailsElement>(null)
  const [optionsOpen, setOptionsOpen] = useState(false)
  useIsomorphicLayoutEffect(() => {
    const details = detailsRef.current
    if (!details) return
    const active = document.activeElement
    const summary = details.querySelector('summary')
    if (!compact && active === summary) {
      details.querySelector<HTMLElement>('button, a, input')?.focus({ preventScroll: true })
    }
    if (compact && active !== summary && active && details.contains(active)) setOptionsOpen(true)
  }, [compact])
  // The folded menu closes like any other: Escape (focus returns to its button) or a press outside.
  const menuOpen = compact && optionsOpen
  useEffect(() => {
    if (!menuOpen) return undefined
    const onPointerDown = (event: PointerEvent) => {
      if (!detailsRef.current?.contains(event.target as Node)) setOptionsOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      const details = detailsRef.current
      if (details?.contains(document.activeElement)) details.querySelector('summary')?.focus()
      setOptionsOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])
  const responsiveOptions =
    mainMenuButton || anyRestart ? (
      <details
        ref={detailsRef}
        className={styles.headerMore}
        data-ecmo-header-more
        open={!compact || optionsOpen}
      >
        <summary
          onClick={(event) => {
            event.preventDefault()
            setOptionsOpen((current) => !current)
          }}
        >
          {mainMenuButton && anyRestart
            ? 'Main menu or restart'
            : mainMenuButton
              ? 'Main menu'
              : 'Restart'}
        </summary>
        <div
          className={styles.headerMoreBody}
          onClick={() => {
            // A choice from the folded menu closes it; focus goes back to the menu's button unless
            // the control pressed moves it somewhere of its own.
            if (!compact) return
            detailsRef.current?.querySelector('summary')?.focus({ preventScroll: true })
            setOptionsOpen(false)
          }}
        >
          {mainMenuButton}
          {restartButton}
          {restartCourseButton}
        </div>
      </details>
    ) : null
  return (
    <>
      <div className={styles.headerMain}>
        <p className={styles.kicker}>
          {breadcrumb ? (
            <>
              <Link href={breadcrumb.href}>{breadcrumb.label}</Link>
              {' · '}
            </>
          ) : null}
          {kicker}
        </p>
        <h1 className={styles.title}>{title}</h1>
        {meta && meta.length > 0 ? <p className={styles.meta}>{meta.join(' · ')}</p> : null}
      </div>
      <div className={styles.headerActions}>
        {sectionsControl}
        {options}
        {onHelp ? (
          <button
            ref={helpRef}
            type="button"
            className={styles.headerButton}
            data-ecmo-help
            onClick={onHelp}
          >
            What do I do now?
          </button>
        ) : null}
        {onSaveAndExit ? (
          <button
            type="button"
            className={styles.headerButton}
            data-primary="true"
            data-ecmo-save-exit
            aria-describedby={saveLocationNoteId}
            title={SAVE_LOCATION_NOTE}
            onClick={onSaveAndExit}
          >
            Save &amp; exit
          </button>
        ) : null}
        {responsiveOptions}
      </div>
      {/*
        What Save & exit keeps, as the button's description rather than a line across the header.

        It was printed under the header on every section, drill and case, and a tester (2026-10-23)
        marked it as a redundant banner. It stays the button's accessible description, and the
        button's tooltip, so it is still said where the decision is made.
      */}
      {onSaveAndExit ? (
        <p id={saveLocationNoteId} className="sr-only" data-ecmo-save-location-note>
          {SAVE_LOCATION_NOTE}
        </p>
      ) : null}
      {resumedNote ? (
        <p className={styles.resumedNote} role="note" data-ecmo-resumed-note>
          {resumedNote}
        </p>
      ) : null}
    </>
  )
}
