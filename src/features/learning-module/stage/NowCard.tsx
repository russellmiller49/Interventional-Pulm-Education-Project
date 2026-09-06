'use client'

import { useId, type ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'

import { Link } from '@/i18n/navigation'

import styles from './lesson-shell.module.css'

export interface NowCardAction {
  readonly label: string
  readonly onActivate?: () => void
  readonly href?: string | { readonly pathname: string; readonly query?: Record<string, string> }
  readonly disabled?: boolean
  /** Read to assistive technology as the reason the action is not yet available. */
  readonly disabledReason?: string
  readonly icon?: ReactNode
}

export interface NowCardModel {
  /** "Step 3 of 8 · Act". */
  readonly kicker: string
  readonly heading: string
  readonly body?: string
  readonly primary?: NowCardAction
  readonly secondary?: NowCardAction
  /** A single line of state the learner is waiting on. */
  readonly status?: string
  /**
   * Back to the previous step. Kept out of the actions row on purpose: the card's premise is that
   * there is one thing to do now, and a Back button beside the primary action competes with it.
   */
  readonly back?: NowCardAction
  /** Disclosed on request; never part of the default read. */
  readonly why?: string
  readonly tone?: 'neutral' | 'safety'
}

/**
 * The one thing to do now.
 *
 * Sticky at the top of the task column, first in its reading order, with one primary action.
 * Interaction bodies — a prediction's choices, a verdict, a task list — render as children between
 * the instruction and the primary action, so the card stays the only place a learner has to look.
 */
export function NowCard({
  model,
  children,
}: {
  readonly model: NowCardModel
  readonly children?: ReactNode
}) {
  const headingId = useId()
  const reasonId = useId()
  const tone = model.tone ?? 'neutral'

  return (
    <section
      className={styles.now}
      data-now-card
      data-tone={tone}
      role={tone === 'safety' ? 'alert' : undefined}
      aria-labelledby={headingId}
    >
      <p className={styles.nowKicker}>{model.kicker}</p>
      {model.back ? (
        <button
          type="button"
          className={styles.nowBack}
          data-now-back
          onClick={model.back.onActivate}
        >
          <ArrowLeft aria-hidden="true" />
          {model.back.label}
        </button>
      ) : null}
      <h2 id={headingId} className={styles.nowHeading}>
        {model.heading}
      </h2>
      {model.body ? <p className={styles.nowBody}>{model.body}</p> : null}
      {children}
      {model.status ? (
        <p className={styles.nowStatus} data-now-status>
          {model.status}
        </p>
      ) : null}
      {model.primary || model.secondary ? (
        <div className={styles.nowActions}>
          {model.primary ? (
            <NowActionControl
              action={model.primary}
              className={styles.nowPrimary}
              reasonId={reasonId}
              primary
            />
          ) : null}
          {model.secondary ? (
            <NowActionControl action={model.secondary} className={styles.nowSecondary} />
          ) : null}
        </div>
      ) : null}
      {model.primary?.disabled && model.primary.disabledReason ? (
        <p id={reasonId} className={styles.nowStatus} data-now-disabled-reason>
          {model.primary.disabledReason}
        </p>
      ) : null}
      {model.why ? (
        <details className={styles.nowWhy} data-now-why>
          <summary>Why this matters</summary>
          <p>{model.why}</p>
        </details>
      ) : null}
    </section>
  )
}

function NowActionControl({
  action,
  className,
  reasonId,
  primary = false,
}: {
  readonly action: NowCardAction
  readonly className: string
  readonly reasonId?: string
  readonly primary?: boolean
}) {
  const marker = primary ? { 'data-now-primary': true } : { 'data-now-secondary': true }
  if (action.href && !action.disabled) {
    return (
      <Link href={action.href} className={className} {...marker}>
        {action.icon}
        {action.label}
      </Link>
    )
  }
  return (
    <button
      type="button"
      className={className}
      disabled={action.disabled}
      aria-describedby={action.disabled && action.disabledReason ? reasonId : undefined}
      onClick={action.onActivate}
      {...marker}
    >
      {action.icon}
      {action.label}
    </button>
  )
}
