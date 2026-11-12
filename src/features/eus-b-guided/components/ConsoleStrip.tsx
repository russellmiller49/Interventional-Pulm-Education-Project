'use client'
import { useId, type RefObject } from 'react'
import type { Requirement } from '../content/tasks'
import styles from './eus-b-guided.module.css'

/**
 * The one instruction of a scope task, in a single row above the lab: what to do, the list of what
 * is still asked for, and the way on. The list is the gate, so the button never waits for anything
 * the list does not say.
 */
export function ConsoleStrip({
  kicker,
  title,
  instruction,
  requirements,
  met,
  primaryLabel,
  onContinue,
  onSkip,
  onRestart,
  headingRef,
}: {
  kicker: string
  title: string
  instruction: string
  requirements: Requirement[]
  met: boolean
  primaryLabel: string
  onContinue: () => void
  onSkip: () => void
  onRestart: () => void
  headingRef?: RefObject<HTMLHeadingElement | null>
}) {
  const headingId = useId()
  const reasonId = useId()
  const outstanding = requirements.filter((item) => !item.met)
  return (
    <section className={styles.strip} data-now-card data-console-strip aria-labelledby={headingId}>
      <div className={styles.stripText}>
        <p className={styles.kicker}>{kicker}</p>
        <h2 id={headingId} ref={headingRef} tabIndex={-1}>
          {title}
        </h2>
        <p>{instruction}</p>
      </div>
      <ul className={styles.requirements} data-acquisition-outstanding aria-label="To do">
        {requirements.map((item) => (
          <li key={item.id} data-requirement={item.id} data-met={item.met}>
            <span aria-hidden="true">{item.met ? '✓' : '○'}</span>
            <span>
              {item.text}
              <span className={styles.srOnly}>{item.met ? ' Done.' : ' Not done yet.'}</span>
            </span>
          </li>
        ))}
      </ul>
      <div className={styles.stripActions}>
        <button
          type="button"
          className={styles.button}
          data-now-primary
          disabled={!met}
          aria-describedby={met ? undefined : reasonId}
          onClick={onContinue}
        >
          {primaryLabel}
        </button>
        {!met && (
          <p id={reasonId} className={styles.srOnly} data-now-disabled-reason>
            To turn this on: {outstanding.map((item) => item.text).join(' ')}
          </p>
        )}
        <div className={styles.stripLinks}>
          <button type="button" className={styles.skipLink} data-skip-lab onClick={onSkip}>
            Continue without finishing
          </button>
          <button type="button" className={styles.skipLink} data-restart-task onClick={onRestart}>
            Start this task again
          </button>
        </div>
      </div>
    </section>
  )
}
