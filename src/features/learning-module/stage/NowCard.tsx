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
  /**
   * Where on the stage this step is worked, rendered directly under the instruction.
   *
   * Usually a `LookInLine` over the step's authored location: "Where to look: Teaching panel —
   * Circuit walk." Optional so a caller that has not adopted locations renders exactly as before.
   */
  readonly where?: ReactNode
  readonly primary?: NowCardAction
  /**
   * Render the primary action above the card's body instead of in its action row: a comparison
   * whose result table follows its Run button reads top to bottom in the order it is used.
   */
  readonly primaryBeforeContent?: boolean
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
  /**
   * Keep the action row in view at the bottom of the window while the card is taller than it.
   *
   * A tester of the ECMO module (2026-10-13) could not find the way to the next task: the card's
   * one button sat under a text column and a figure, two screens down. A pinned row rides the
   * bottom of the scrolling view, so the way forward is in the same place on every step, and it
   * settles into the foot of the card once the learner reaches it. Ported from `EcmoNowCard`.
   */
  readonly pinActions?: boolean
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
  const primaryInRow = model.primary && !model.primaryBeforeContent ? model.primary : undefined
  const actions =
    primaryInRow || model.secondary ? (
      <div className={styles.nowActions}>
        {primaryInRow ? (
          <NowActionControl
            action={primaryInRow}
            className={styles.nowPrimary}
            reasonId={reasonId}
            primary
          />
        ) : null}
        {model.secondary ? (
          <NowActionControl action={model.secondary} className={styles.nowSecondary} />
        ) : null}
      </div>
    ) : null
  const disabledReason =
    model.primary?.disabled && model.primary.disabledReason ? (
      <p id={reasonId} className={styles.nowStatus} data-now-disabled-reason>
        {model.primary.disabledReason}
      </p>
    ) : null
  const why = model.why ? (
    <details className={styles.nowWhy} data-now-why>
      <summary>Why this matters</summary>
      <p>{model.why}</p>
    </details>
  ) : null

  return (
    <section
      className={styles.now}
      data-now-card
      data-tone={tone}
      data-pinned-actions={model.pinActions && actions ? true : undefined}
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
      {model.where ? (
        <p className={styles.nowWhere} data-now-where>
          {model.where}
        </p>
      ) : null}
      {model.primaryBeforeContent && model.primary ? (
        <div className={styles.nowActions} data-now-primary-first>
          <NowActionControl
            action={model.primary}
            className={styles.nowPrimary}
            reasonId={reasonId}
            primary
          />
        </div>
      ) : null}
      {children}
      {model.status ? (
        <p className={styles.nowStatus} data-now-status>
          {model.status}
        </p>
      ) : null}
      {/*
        A pinned row is the last thing in its card, so the disclosure goes ahead of it there. A card
        that does not pin keeps the order it has always had, which is also its tab order.
      */}
      {model.pinActions && actions ? (
        <>
          {why}
          <div className={styles.nowFooter} data-now-footer="pinned">
            {actions}
            {disabledReason}
          </div>
        </>
      ) : (
        <>
          {actions}
          {disabledReason}
          {why}
        </>
      )}
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
