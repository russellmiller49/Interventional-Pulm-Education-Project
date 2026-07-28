'use client'

import { useId } from 'react'

import styles from './learning-module-v2.module.css'

export type ResumeBannerState = 'ready' | 'loading' | 'incompatible' | 'error'

export function ResumeBanner({
  state,
  title,
  description,
  onResume,
  onStartSafe,
  resumeActionLabel = 'Resume activity',
}: {
  readonly state: ResumeBannerState
  readonly title: string
  readonly description: string
  readonly onResume?: () => void
  readonly onStartSafe?: () => void
  readonly resumeActionLabel?: string
}) {
  const headingId = useId()

  return (
    <section className={styles.resumeBanner} data-state={state} aria-labelledby={headingId}>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        aria-busy={state === 'loading' || undefined}
      >
        <strong id={headingId}>{title}</strong>
        <p>{description}</p>
      </div>
      {state === 'ready' && onResume ? (
        <button type="button" className={styles.primaryButton} onClick={onResume}>
          {resumeActionLabel}
        </button>
      ) : null}
      {(state === 'incompatible' || state === 'error') && onStartSafe ? (
        <button type="button" className={styles.secondaryButton} onClick={onStartSafe}>
          {state === 'error' ? 'Start activity again' : 'Start from safe checkpoint'}
        </button>
      ) : null}
    </section>
  )
}
