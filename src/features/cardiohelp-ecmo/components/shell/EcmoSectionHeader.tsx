'use client'

import { useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from 'react'

import { useIsomorphicLayoutEffect } from '../useIsomorphicLayoutEffect'

import { Link } from '@/i18n/navigation'

import styles from './EcmoActivityShell.module.css'

/*
 * Phone width, by the viewport the header actually sits in. Server and first client render take the
 * wide arrangement; a phone switches to the compact one straight after hydration, so there is no
 * markup mismatch and nothing to repair.
 */
const PHONE_HEADER_QUERY = '(max-width: 600px)'
function subscribePhone(onChange: () => void) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {}
  const query = window.matchMedia(PHONE_HEADER_QUERY)
  query.addEventListener?.('change', onChange)
  return () => query.removeEventListener?.('change', onChange)
}
function phoneSnapshot() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(PHONE_HEADER_QUERY).matches
  )
}

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
  readonly onSaveAndExit?: () => void
  readonly resumedNote?: string
}) {
  const phone = useSyncExternalStore(subscribePhone, phoneSnapshot, () => false)
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
  // Keep the same controls mounted across the breakpoint. If a control has focus, keep its
  // disclosure open when shrinking; when widening, a focused summary hands focus to its contents.
  const detailsRef = useRef<HTMLDetailsElement>(null)
  const [optionsOpen, setOptionsOpen] = useState(false)
  useIsomorphicLayoutEffect(() => {
    const details = detailsRef.current
    if (!details) return
    const active = document.activeElement
    const summary = details.querySelector('summary')
    if (!phone && active === summary) {
      details.querySelector<HTMLElement>('button, a, input')?.focus({ preventScroll: true })
    }
    if (phone && active !== summary && active && details.contains(active)) setOptionsOpen(true)
  }, [phone])
  const responsiveOptions =
    mainMenuButton || restartButton ? (
      <details
        ref={detailsRef}
        className={styles.headerMore}
        data-ecmo-header-more
        open={!phone || optionsOpen}
      >
        <summary
          onClick={(event) => {
            event.preventDefault()
            setOptionsOpen((current) => !current)
          }}
        >
          {mainMenuButton && restartButton
            ? 'Main menu or restart'
            : mainMenuButton
              ? 'Main menu'
              : 'Restart'}
        </summary>
        <div className={styles.headerMoreBody}>
          {mainMenuButton}
          {restartButton}
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
            onClick={onSaveAndExit}
          >
            Save &amp; exit
          </button>
        ) : null}
        {responsiveOptions}
      </div>
      {resumedNote ? (
        <p className={styles.resumedNote} role="note" data-ecmo-resumed-note>
          {resumedNote}
        </p>
      ) : null}
    </>
  )
}
