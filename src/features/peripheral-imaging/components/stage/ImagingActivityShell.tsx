'use client'

import { useRef, type ReactNode, type RefObject } from 'react'
import { Bookmark, BookmarkCheck } from 'lucide-react'

import type { NowCardAction, NowCardModel } from '@/features/learning-module/stage/NowCard'
import { Link } from '@/i18n/navigation'

import type { ImagingStageLesson } from '../../content/stageLessons'
import {
  imagingPathwayGroups,
  imagingPhaseOf,
  imagingSectionLinkTarget,
} from '../../content/pathwayResolver'
import { PERIPHERAL_IMAGING_NAV_BASE } from '../../content/routes'
import { peripheralImagingModuleNavItems } from '../PeripheralImagingModuleFrame'
import styles from './imaging-flow.module.css'
import { useImagingFocusClearance } from './useImagingFocusClearance'
import { useImagingOutlinePlacement } from './useImagingOutlinePlacement'

export interface ImagingNowAction extends NowCardAction {
  /** For a disclosure toggle, such as Show the explanation: whether what it opens is open. */
  readonly expanded?: boolean
}

/**
 * The shared Now-card model with what a self-paced step adds (PI-01): a secondary action that can
 * be a disclosure toggle, and a way past the step without doing its work.
 */
export type ImagingNowModel = Omit<NowCardModel, 'secondary'> & {
  readonly secondary?: ImagingNowAction
  /** Move on without this step's work. It never answers, performs, captures or snapshots. */
  readonly skip?: NowCardAction
}

export function ImagingActivityShell({
  lesson,
  index,
  liveIndex,
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
  reviewLater,
  onToggleReviewLater,
  finished,
  nextHref,
  nextTitle,
}: {
  lesson: ImagingStageLesson
  index: number
  /** The step the learner has moved up to; every earlier step can be reviewed. */
  liveIndex: number
  model: ImagingNowModel
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
  reviewLater: boolean
  onToggleReviewLater: () => void
  finished: boolean
  nextHref: string | ReturnType<typeof imagingSectionLinkTarget>
  nextTitle: string
}) {
  const activity = lesson.steps[index].activity
  const earlierSteps = lesson.steps.slice(0, liveIndex)
  const shellNode = useRef<HTMLElement | null>(null)
  const headerNode = useRef<HTMLElement | null>(null)
  const footerNode = useRef<HTMLElement | null>(null)
  const outlineNode = useRef<HTMLDetailsElement | null>(null)
  const outlineTrigger = useRef<HTMLElement | null>(null)
  // Keeps a control that Tab moves to out from under the pinned header and footer (G02-PI-01).
  useImagingFocusClearance(shellNode, headerNode, footerNode)
  // Keeps the opened Course outline inside the viewport the pinned chrome leaves (G02-PI-02).
  useImagingOutlinePlacement(shellNode, headerNode, footerNode, outlineNode, outlineTrigger)
  return (
    <section
      className={styles.course}
      ref={shellNode}
      data-stage={lesson.steps[index].id}
      data-imaging-flow
      data-now-card
      data-presentation={activity.presentation}
      data-task-kind={activity.task}
      data-step-kind={lesson.steps[index].interaction.kind}
      data-learning-activity={activity.id}
    >
      <header className={styles.header} ref={headerNode}>
        <div>
          <Link href={PERIPHERAL_IMAGING_NAV_BASE} className={styles.eyebrow}>
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
          <details className={styles.outline} data-course-outline ref={outlineNode}>
            <summary ref={outlineTrigger}>Course outline</summary>
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
          <button
            type="button"
            aria-pressed={reviewLater}
            onClick={onToggleReviewLater}
            data-review-later-toggle
          >
            {reviewLater ? <BookmarkCheck aria-hidden="true" /> : <Bookmark aria-hidden="true" />}
            Save for review
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
            {earlierSteps.map((step) => {
              const performed = performedIds.has(step.id)
              return (
                <li key={step.id}>
                  <button
                    type="button"
                    onClick={() => onReview(step.ordinal - 1)}
                    data-review-step={step.id}
                    data-performed={performed}
                  >
                    {step.title}
                    {performed ? '' : ' (skipped)'}
                  </button>
                </li>
              )
            })}
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
      <footer className={styles.actions} ref={footerNode} aria-label="Activity navigation">
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
            <button
              type="button"
              data-now-secondary
              aria-expanded={model.secondary.expanded}
              onClick={model.secondary.onActivate}
            >
              {model.secondary.label}
            </button>
          )}
          {!finished && model.skip ? (
            <button type="button" data-now-skip onClick={model.skip.onActivate}>
              {model.skip.label}
            </button>
          ) : null}
          {finished ? (
            <Link
              href={nextHref}
              data-now-primary
              data-next-section={lesson.index + 1 < lesson.total ? nextTitle : 'integrated-cases'}
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
