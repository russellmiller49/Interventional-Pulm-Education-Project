'use client'

import { useEffect, useId, type ReactNode, type RefObject } from 'react'
import type { NowCardAction, NowCardModel } from '@/features/learning-module/stage/NowCard'
import { Link } from '@/i18n/navigation'
import type { CoursePresentation } from '../../content/courseFlow'
import styles from './course-flow.module.css'

/**
 * Module-local presentation only. All activity state and handlers belong to BronchStageHost.
 *
 * `skip` is the self-paced way on (BF-01): "Continue without answering" and its siblings, offered
 * whenever the current activity is not done. It moves the learner on and records nothing.
 */
export function BronchCourseLayout({
  stepId,
  presentation,
  activity,
  header,
  model,
  skip,
  teaching,
  workspace,
  response,
  completion,
  footer,
  overlay,
  focusRef,
  storageFailed,
}: {
  readonly stepId: string
  readonly presentation: CoursePresentation
  readonly activity: string
  readonly header: ReactNode
  readonly model: NowCardModel
  readonly skip?: NowCardAction
  readonly teaching: ReactNode
  readonly workspace: ReactNode
  readonly response: ReactNode
  readonly completion: ReactNode
  readonly footer: ReactNode
  readonly overlay: ReactNode
  readonly focusRef: RefObject<HTMLDivElement | null>
  readonly storageFailed: boolean
}) {
  const id = useId()
  const interactive = presentation === 'skill' || presentation === 'inspection'
  // The site navigation wraps under text enlargement. Reserve its actual height
  // for native keyboard scrolling without changing focus or the shared shell.
  useEffect(() => {
    const root = document.documentElement
    const header = document.getElementById('main-content')?.previousElementSibling
    if (!header) return
    const measure = () => {
      const zoom = Number.parseFloat(getComputedStyle(root).zoom) || 1
      root.style.setProperty(
        '--bronch-focus-clear-top',
        `${(header.getBoundingClientRect().height + 12) / zoom}px`,
      )
    }
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(header)
    return () => {
      observer?.disconnect()
      root.style.removeProperty('--bronch-focus-clear-top')
    }
  }, [])
  const continuation = (
    <div className={styles.continuation}>
      {model.status ? (
        <p className={styles.status} data-now-status role="status">
          {model.status}
        </p>
      ) : null}
      <div className={styles.actions}>
        {model.back ? <Action action={{ ...model.back, label: 'Back' }} back /> : <span />}
        <div className={styles.forward}>
          {skip ? <Action action={skip} skip /> : null}
          {model.secondary ? <Action action={model.secondary} /> : null}
          {model.primary ? (
            <Action action={model.primary} primary reasonId={`${id}-reason`} />
          ) : null}
        </div>
      </div>
      {model.primary?.disabled && model.primary.disabledReason ? (
        <p id={`${id}-reason`} data-now-disabled-reason>
          {model.primary.disabledReason}
        </p>
      ) : null}
    </div>
  )
  return (
    <div
      className={styles.course}
      data-stage={stepId}
      data-course-presentation={presentation}
      data-course-activity={activity}
      data-module="bronchoscopy-foundations"
    >
      <header className={styles.courseHeader}>{header}</header>
      {storageFailed ? (
        <p role="alert" className={styles.storageFailure}>
          Your place in the course could not be saved on this device. You can keep learning; where
          you left off and the sections you marked may not be remembered when you leave.
        </p>
      ) : null}
      <section data-now-card aria-labelledby={`${id}-title`} className={styles.lesson}>
        <div ref={focusRef} tabIndex={-1} data-now-focus className={styles.taskHeading}>
          <p className={styles.position}>{model.kicker}</p>
          <h2 id={`${id}-title`}>{model.heading}</h2>
          <p data-current-instruction>{model.body}</p>
        </div>
        {interactive ? continuation : null}
        {interactive ? (
          <div className={styles.skillGrid}>
            <div className={styles.workspace}>{workspace}</div>
            <div className={styles.coaching}>
              {teaching}
              {response}
            </div>
          </div>
        ) : (
          <div className={styles.reading}>
            {teaching}
            {workspace ? <div className={styles.workspace}>{workspace}</div> : null}
            {response}
          </div>
        )}
        {completion}
        {!interactive ? continuation : null}
      </section>
      <footer className={styles.sources}>{footer}</footer>
      {overlay}
    </div>
  )
}

function Action({
  action,
  primary = false,
  back = false,
  skip = false,
  reasonId,
}: {
  readonly action: NowCardAction
  readonly primary?: boolean
  readonly back?: boolean
  readonly skip?: boolean
  readonly reasonId?: string
}) {
  const props = {
    className: primary ? styles.primary : styles.secondary,
    'data-now-primary': primary || undefined,
    'data-now-secondary': (!primary && !back && !skip) || undefined,
    'data-now-back': back || undefined,
    'data-now-skip': skip || undefined,
  }
  return action.href && !action.disabled ? (
    <Link href={action.href} {...props}>
      {action.label}
    </Link>
  ) : (
    <button
      type="button"
      {...props}
      onClick={action.onActivate}
      disabled={action.disabled}
      aria-describedby={action.disabled && action.disabledReason ? reasonId : undefined}
    >
      {action.label}
    </button>
  )
}
