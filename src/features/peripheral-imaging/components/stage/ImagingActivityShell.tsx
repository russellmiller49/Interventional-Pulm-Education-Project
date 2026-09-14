'use client'

import type { ReactNode, RefObject } from 'react'
import type { NowCardModel } from '@/features/learning-module/stage/NowCard'
import type { ImagingStageLesson } from '../../content/stageLessons'
import {
  imagingPathwayGroups,
  imagingPhaseOf,
  imagingSectionLinkTarget,
} from '../../content/pathwayResolver'
import { peripheralImagingModuleNavItems } from '../PeripheralImagingModuleFrame'
import { Link } from '@/i18n/navigation'
import styles from './imaging-flow.module.css'

export function ImagingActivityShell({
  lesson,
  index,
  model,
  headingRef,
  visual,
  teaching,
  response,
  children,
  references,
  onReview,
  performedIds,
  onHelp,
  helpRef,
  onRestart,
  finished,
  nextHref,
  nextTitle,
}: {
  lesson: ImagingStageLesson
  index: number
  model: NowCardModel
  headingRef: RefObject<HTMLDivElement | null>
  visual: ReactNode
  teaching: ReactNode
  response: ReactNode
  children?: ReactNode
  references: ReactNode
  performedIds: ReadonlySet<string>
  onReview: (index: number) => void
  onHelp: () => void
  helpRef: RefObject<HTMLButtonElement | null>
  onRestart: () => void
  finished: boolean
  nextHref: string | ReturnType<typeof imagingSectionLinkTarget>
  nextTitle: string
}) {
  const activity = lesson.steps[index].activity
  return (
    <section
      className={styles.course}
      data-stage={lesson.steps[index].id}
      data-imaging-flow
      data-now-card
      data-presentation={activity.presentation}
      data-task-kind={activity.task}
      data-learning-activity={activity.id}
    >
      <header className={styles.header}>
        <div>
          <Link href="/peripheral-imaging" className={styles.eyebrow}>
            Peripheral bronchoscopy imaging
          </Link>
          <p>
            {imagingPhaseOf(lesson.sectionId).title} · Section {lesson.index + 1} of {lesson.total}
          </p>
          <h1>{lesson.title}</h1>
        </div>
        <nav className={styles.courseNav} aria-label="Peripheral imaging course destinations">
          {peripheralImagingModuleNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={item.title === 'Learn' ? 'page' : undefined}
            >
              {item.title}
            </Link>
          ))}
        </nav>
        <div className={styles.headerTools}>
          <details className={styles.outline} data-course-outline>
            <summary>Course outline</summary>
            <nav aria-label="Course outline">
              {imagingPathwayGroups().map((group) => (
                <section key={group.phase}>
                  <h2>{group.title}</h2>
                  <ol>
                    {group.sections.map((section) => (
                      <li key={section.id}>
                        <Link
                          href={imagingSectionLinkTarget(section.id)}
                          aria-current={section.id === lesson.sectionId ? 'page' : undefined}
                        >
                          {section.title}
                        </Link>
                      </li>
                    ))}
                  </ol>
                </section>
              ))}
            </nav>
          </details>
          <button type="button" ref={helpRef} onClick={onHelp}>
            Help
          </button>
          <button type="button" onClick={onRestart}>
            Restart section
          </button>
        </div>
      </header>
      <div className={styles.progress}>
        <span>
          Activity {index + 1} of {lesson.steps.length}
        </span>
        <progress
          value={finished ? lesson.steps.length : index}
          max={lesson.steps.length}
          aria-label="Section progress"
        />
        <details>
          <summary>Review earlier activities</summary>
          <ol>
            {lesson.steps
              .slice(0, index)
              .filter((step) => performedIds.has(step.id))
              .map((step) => (
                <li key={step.id}>
                  <button type="button" onClick={() => onReview(step.ordinal - 1)}>
                    {step.title}
                  </button>
                </li>
              ))}
          </ol>
        </details>
      </div>
      <div className={styles.taskHeading} ref={headingRef} tabIndex={-1} data-now-focus>
        <h2>{model.heading}</h2>
        <p>{model.body}</p>
      </div>
      {!['check', 'transfer'].includes(activity.task) && index === 0 && (
        <p className={styles.safetyCue} role="note">
          Before an exposure: state the imaging question and preserve adequate information.
          Coordinate patient care, equipment clearance and staff protection with the team. Follow
          current device instructions and local protocols.
        </p>
      )}
      <div className={styles.task} data-current-task>
        <div className={styles.evidence}>{visual}</div>
        <div className={styles.explanation}>
          {teaching}
          {response}
        </div>
      </div>
      <aside className={styles.boundary} role="note" data-teaching-block="boundary">
        <strong>Model limitations.</strong> {lesson.spec.modelBoundary}
      </aside>
      {children}
      <div className={styles.references}>{references}</div>
      <footer className={styles.actions} aria-label="Activity navigation">
        <div className={styles.actionStatus} role="status" data-now-status>
          {model.status ??
            (model.primary?.disabled
              ? model.primary.disabledReason
              : `Next: ${lesson.steps[index + 1]?.title ?? nextTitle}`)}
        </div>
        <div className={styles.buttons}>
          {model.back && (
            <button type="button" data-now-back onClick={model.back.onActivate}>
              {model.back.label}
            </button>
          )}
          {model.secondary && (
            <button type="button" data-now-secondary onClick={model.secondary.onActivate}>
              {model.secondary.label}
            </button>
          )}
          {finished ? (
            <Link
              href={nextHref}
              data-now-primary
              data-next-section={lesson.index + 1 < lesson.total ? nextTitle : 'assess'}
            >
              {nextTitle}
            </Link>
          ) : (
            model.primary && (
              <button
                type="button"
                data-now-primary
                disabled={model.primary.disabled}
                onClick={model.primary.onActivate}
              >
                {model.primary.label}
              </button>
            )
          )}
        </div>
      </footer>
    </section>
  )
}
