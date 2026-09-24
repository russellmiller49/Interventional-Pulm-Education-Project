'use client'

import { useSyncExternalStore, type ReactNode, type RefObject } from 'react'

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
  trackToggle,
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
  readonly trackToggle?: ReactNode
  readonly options?: ReactNode
  readonly helpRef?: RefObject<HTMLButtonElement | null>
  readonly onHelp?: () => void
  readonly onRestart?: () => void
  readonly restartLabel?: string
  readonly onSaveAndExit?: () => void
  readonly resumedNote?: string
}) {
  const phone = useSyncExternalStore(subscribePhone, phoneSnapshot, () => false)
  const restartButton = onRestart ? (
    <button type="button" className={styles.headerButton} data-ecmo-restart onClick={onRestart}>
      {restartLabel}
    </button>
  ) : null
  /*
   * On a phone the header used to take about 270 px of an 844 px screen, and more than a full
   * screen at 200% text, before the task began (fellow walkthrough, Figure 23). Where you are — the
   * kicker names the track and the section — the sections list, help and Save & exit stay in view;
   * switching track and restarting fold into one disclosure. Nothing is removed.
   */
  const phoneOptions =
    phone && (trackToggle || restartButton) ? (
      <details className={styles.headerMore} data-ecmo-header-more>
        <summary>{trackToggle ? 'Switch track or restart' : 'Restart'}</summary>
        <div className={styles.headerMoreBody}>
          {trackToggle}
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
      {phone ? null : trackToggle}
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
        {phone ? null : restartButton}
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
        {phoneOptions}
      </div>
      {resumedNote ? (
        <p className={styles.resumedNote} role="note" data-ecmo-resumed-note>
          {resumedNote}
        </p>
      ) : null}
    </>
  )
}
