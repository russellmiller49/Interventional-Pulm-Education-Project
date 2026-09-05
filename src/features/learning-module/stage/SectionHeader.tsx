'use client'

import type { ReactNode, RefObject } from 'react'

import { Link } from '@/i18n/navigation'

import styles from './lesson-shell.module.css'

/**
 * The slim header of a lean lesson surface: where you are, what it is called, and at most five
 * controls. Objectives are deliberately absent — they render inside the first step's own body,
 * where the leak scan covers them, never above the workspace where they would answer the
 * prediction beneath.
 */
export function SectionHeader({
  breadcrumb,
  kicker,
  title,
  meta,
  sectionsControl,
  options,
  helpRef,
  onHelp,
  onRestart,
  restartLabel = 'Restart',
  onSaveAndExit,
  saveAndExitHref,
  resumedNote,
}: {
  readonly breadcrumb?: { readonly href: string; readonly label: string }
  readonly kicker: string
  readonly title: string
  readonly meta?: readonly string[]
  /** The collapsed Sections disclosure trigger. */
  readonly sectionsControl?: ReactNode
  readonly options?: ReactNode
  readonly helpRef?: RefObject<HTMLButtonElement | null>
  readonly onHelp?: () => void
  readonly onRestart?: () => void
  readonly restartLabel?: string
  readonly onSaveAndExit?: () => void
  readonly saveAndExitHref?: string
  readonly resumedNote?: string
}) {
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
            data-stage-help
            onClick={onHelp}
          >
            What do I do now?
          </button>
        ) : null}
        {onRestart ? (
          <button
            type="button"
            className={styles.headerButton}
            data-stage-restart
            onClick={onRestart}
          >
            {restartLabel}
          </button>
        ) : null}
        {saveAndExitHref ? (
          <Link
            href={saveAndExitHref}
            className={styles.headerButton}
            data-primary="true"
            data-stage-save-exit
            onClick={onSaveAndExit}
          >
            Save &amp; exit
          </Link>
        ) : onSaveAndExit ? (
          <button
            type="button"
            className={styles.headerButton}
            data-primary="true"
            data-stage-save-exit
            onClick={onSaveAndExit}
          >
            Save &amp; exit
          </button>
        ) : null}
      </div>
      {resumedNote ? (
        <p className={styles.resumedNote} role="note" data-stage-resumed-note>
          {resumedNote}
        </p>
      ) : null}
    </>
  )
}
