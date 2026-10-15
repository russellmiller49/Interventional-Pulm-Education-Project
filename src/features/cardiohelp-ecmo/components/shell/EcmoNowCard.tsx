'use client'

import { useId, useLayoutEffect, useRef, type ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'

import { Link } from '@/i18n/navigation'

import styles from './EcmoActivityShell.module.css'

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
  /** "Now · Predict", "Step 3 of 7 · Act". */
  readonly kicker: string
  readonly heading: string
  readonly body?: string
  /** Where on the stage this step is worked. Rendered directly under the instruction. */
  readonly where?: ReactNode
  readonly primary?: NowCardAction
  /** A foundation comparison puts its enabled action before the retained baseline table. */
  readonly primaryBeforeContent?: boolean
  readonly secondary?: NowCardAction
  /** A single line of state the learner is waiting on ("12 s since your last action"). */
  readonly status?: string
  /**
   * Back to the previous step.
   *
   * Kept out of the actions row on purpose. The card's whole premise is that there is one thing to
   * do now, and a Back button sitting beside the primary action competes with it; placed under the
   * kicker it is discoverable without arguing for attention. An owner review in September 2026
   * found learners restarting a whole section to revisit one step, because the only way back was
   * the step list's inline recap and nothing said it was there.
   */
  readonly back?: NowCardAction
  /** Disclosed on request; never part of the default read. */
  readonly why?: string
  /**
   * Keep the action row in view at the bottom of the window while the card is taller than it.
   *
   * A tester (2026-10-13) could not find the way to the next task: the card's one button sat under a
   * text column, a circuit map and a row of options, two screens down. In a flowing task the row is
   * pinned to the bottom of the scrolling view, so the way forward is in the same place on every
   * step, and it settles into the foot of the card once the learner reaches it.
   */
  readonly pinActions?: boolean
  readonly tone?: 'neutral' | 'safety'
}

/**
 * The one thing to do now.
 *
 * Sticky at the top of the task column, first in its reading order, with one primary action. A
 * safety tone turns the card into an alert that replaces the step's own content. Interaction
 * bodies — a prediction's choices, a verdict, the bounded actions — render as children between the
 * instruction and the primary action, so the card stays the only place a learner has to look.
 */
export function EcmoNowCard({
  model,
  children,
}: {
  readonly model: NowCardModel
  readonly children?: ReactNode
}) {
  const headingId = useId()
  const reasonId = useId()
  const tone = model.tone ?? 'neutral'
  const footerShown = Boolean((model.primary && !model.primaryBeforeContent) || model.secondary)
  const footerRef = useRef<HTMLDivElement>(null)
  const pinned = Boolean(model.pinActions && footerShown)
  /*
   * Keyboard focus has to stop short of a pinned row, so its height is published for the scroll
   * padding (`EcmoActivityShell.module.css`). Measured, not assumed: at a phone width a long label
   * and a second button wrap the row to about 140 px, and a fixed allowance left a focused control
   * half under it (ecmo-focus.spec at 390 px).
   *
   * A row taller than a third of the room left under the pinned context strip unpins and sits at
   * the foot of the card, as the strip itself does when it grows too tall: at 200% text the strip
   * above and the row below would otherwise leave too little room for a focused control.
   */
  useLayoutEffect(() => {
    const footer = footerRef.current
    if (!pinned || !footer) return undefined
    const root = document.documentElement
    const measure = () => {
      const height = Math.ceil(footer.getBoundingClientRect().height)
      // The room the learner reads in: the scrolling shell (or the window, when the document
      // scrolls) less the context strip pinned above it.
      const shell = footer.closest<HTMLElement>('[data-ecmo-shell]')
      const rootStyle = getComputedStyle(root)
      const shellScrolls = shell ? getComputedStyle(shell).overflowY === 'auto' : false
      const room =
        shellScrolls && shell
          ? shell.clientHeight -
            (parseFloat(getComputedStyle(shell).getPropertyValue('--ecmo-sticky-strip-height')) ||
              0)
          : window.innerHeight -
            (parseFloat(rootStyle.getPropertyValue('--ecmo-document-focus-clearance')) || 0)
      // At least 22.5 rem of reading room must remain beside the row: at 200% text a 349 px clamp
      // control did not fit between the context strip and a pinned row (ecmo-focus.spec).
      const minimumRoom = parseFloat(rootStyle.fontSize) * 22.5
      const unfits = height > room / 3 || room - height < minimumRoom
      footer.dataset.pinUnfits = String(unfits)
      root.style.setProperty('--ecmo-pinned-footer-height', `${unfits ? 0 : height}px`)
    }
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(footer)
    window.addEventListener('resize', measure)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', measure)
      delete footer.dataset.pinUnfits
      root.style.removeProperty('--ecmo-pinned-footer-height')
    }
  }, [pinned])
  const why = model.why ? (
    <details className={styles.nowWhy} data-now-why>
      <summary>Why this matters</summary>
      <p>{model.why}</p>
    </details>
  ) : null
  const disabledReason =
    model.primary?.disabled && model.primary.disabledReason ? (
      <p id={reasonId} className={styles.nowStatus} data-now-disabled-reason>
        {model.primary.disabledReason}
      </p>
    ) : null

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
      {model.where ? (
        <p className={styles.nowWhere} data-now-where>
          {model.where}
        </p>
      ) : null}
      {model.primaryBeforeContent && model.primary ? (
        <div className={styles.nowActions}>
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
      {model.pinActions ? why : null}
      {footerShown ? (
        <div
          ref={footerRef}
          className={styles.nowFooter}
          data-now-footer={model.pinActions ? 'pinned' : 'inline'}
        >
          <div className={styles.nowActions}>
            {model.primary && !model.primaryBeforeContent ? (
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
          {disabledReason}
        </div>
      ) : (
        disabledReason
      )}
      {model.pinActions ? null : why}
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
