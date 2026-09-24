'use client'

import {
  IMAGING_CONTROL_PANEL,
  controlStripDistinguishes,
  imagingControlIds,
} from '../../content/controlPanel'
import { GRAMMAR_TREND_RULE, IMAGING_GRAMMAR } from '../../content/grammar'
import type { ImagingStageLesson } from '../../content/stageLessons'
import type { ImagingLearningActivity } from '../../content/learningActivities'
import type { ChainStopId } from '../../content/imagingChain'
import { RECONSTRUCTION_SECTIONS } from '../../content/reconstruction'
import { ReconstructionComparison } from './ReconstructionComparison'
import { SectionGlossary } from './SectionGlossary'
import { ArtifactCauseStrip } from '../figures/ArtifactCauseStrip'
import { FixedMobileComparison, TeamReadinessAid } from '../figures/CbctReferenceAids'
import { TwoAxisWorkedExample } from '../figures/TwoAxisWorkedExample'
import { imagingSectionLinkTarget } from '../../content/pathwayResolver'
import { Link } from '@/i18n/navigation'
import styles from './imaging-stage.module.css'

/**
 * The teaching an activity carries.
 *
 * On a teaching step the column resolves that step's own authored content — each block once,
 * tagged with the content reference it came from. On a check it no longer withholds the section
 * (PI-01: teaching is not hidden to protect an answer). It says what the learner can do, and keeps
 * everything the section taught before the check one disclosure away, tagged as review so every
 * essential block still has exactly one teaching destination. Only the check's own explanation
 * waits, behind its Show the explanation control.
 *
 * PI-FELLOW-03: the section's opening question is printed where it is asked, not folded away
 * (reports CW4/1.6); the section's terms are defined on its first step (CW3); a block's safety
 * callout is set apart (7.4); and the closing recap restates the opening question rather than
 * claiming it was answered.
 */
export function ImagingTeachingColumn({
  lesson,
  activity,
  checking = false,
}: {
  readonly lesson: ImagingStageLesson
  readonly activity: ImagingLearningActivity
  readonly checking?: boolean
  readonly stops?: readonly ChainStopId[]
}) {
  if (checking) {
    const position = lesson.steps.findIndex((step) => step.activity.id === activity.id)
    const earlier = lesson.steps
      .slice(0, Math.max(position, 0))
      .flatMap((step) => step.activity.content)
    return (
      <div className={styles.teaching} data-teaching-panel data-check-teaching>
        <p>
          Choose the interpretation this image and its acquisition context support. You can show the
          explanation first, reread the section’s teaching, or continue without answering.
        </p>
        {earlier.length > 0 ? (
          <details data-teaching-review>
            <summary>Reread this section’s teaching</summary>
            {earlier.map((ref) => (
              <TeachingReference key={ref} lesson={lesson} contentRef={ref} review />
            ))}
          </details>
        ) : null}
        <SectionGlossary sectionId={lesson.sectionId} variant="teaching" />
      </div>
    )
  }
  return (
    <div className={styles.teaching} data-teaching-panel>
      {activity.content.map((ref) => (
        <TeachingReference key={ref} lesson={lesson} contentRef={ref} />
      ))}
    </div>
  )
}

function TeachingReference({
  lesson,
  contentRef: ref,
  review = false,
}: {
  readonly lesson: ImagingStageLesson
  readonly contentRef: string
  readonly review?: boolean
}) {
  const { spec } = lesson
  // Prompt 04 figures and reference aids sit beside the block they illustrate. Rereading the
  // section's teaching at a check is text: the figure stays on its own step.
  if (ref === '@two-axis-example') return review ? null : <TwoAxisWorkedExample />
  if (ref === '@artifact-strip') return review ? null : <ArtifactCauseStrip />
  if (ref === '@fixed-mobile-comparison') return review ? null : <FixedMobileComparison />
  if (ref === '@team-readiness') return review ? null : <TeamReadinessAid />
  if (ref === '@purpose')
    return (
      <div data-teaching-block="purpose">
        <p className={styles.kicker}>Imaging question</p>
        <p>{spec.objective}</p>
        {/* Reports CW4 and 1.6: the recap at the end of the section revisits this question, so it
            is shown here rather than inside a closed disclosure. It asks for nothing. */}
        <p className={styles.openingQuestion} data-opening-question>
          <strong>A question to carry through this section.</strong> {lesson.lesson.recall.prompt}{' '}
          <span>No answer is needed now; the section closes with it.</span>
        </p>
        <details>
          <summary>Clinical purpose and prior learning</summary>
          <p>{lesson.lesson.why}</p>
          <p>{spec.incrementSentence}</p>
        </details>
        {review ? null : <SectionGlossary sectionId={lesson.sectionId} variant="teaching" />}
      </div>
    )
  if (ref === '@worked')
    return (
      <section data-teaching-block="adds" className={styles.worked}>
        <h3>Worked example</h3>
        <p>{lesson.lesson.worked.scenario}</p>
        <p>{lesson.lesson.worked.reasoning}</p>
      </section>
    )
  if (ref === '@controls')
    return (
      <details data-teaching-block="control-panel">
        <summary>Control families and monitoring reference</summary>
        <p>{IMAGING_CONTROL_PANEL.sentence}</p>
        <ul className={styles.checklist}>
          {IMAGING_CONTROL_PANEL.controls.map((c) => (
            <li key={c.id}>
              <strong>{c.plainName}.</strong> Changes {c.changes} Does not change {c.doesNotChange}
            </li>
          ))}
        </ul>
        {IMAGING_CONTROL_PANEL.monitoring.map((c) => (
          <p key={c.id}>
            {c.plainName}: {c.sentence}
          </p>
        ))}
        <p>
          Next: <Link href={imagingSectionLinkTarget('field')}>field and stored display</Link> and{' '}
          <Link href={imagingSectionLinkTarget('time')}>temporal acquisition</Link>.
        </p>
      </details>
    )
  if (ref === '@summary')
    return (
      <section data-teaching-block="adds">
        <h3>Take with you</h3>
        <ul data-takeaways className={styles.takeaways}>
          {lesson.lesson.takeaway.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        {/* Report CW4: the recap names the question it answers, and does not say the learner
            answered it. */}
        <p data-recall-answer>
          <strong>The opening question, revisited.</strong>{' '}
          <em data-recall-prompt>{lesson.lesson.recall.prompt}</em> {lesson.lesson.recall.answer}
        </p>
        <details data-teaching-block="grammar">
          <summary>Troubleshooting and control reference</summary>
          {IMAGING_GRAMMAR.filter((row) => spec.grammarRowIds.includes(row.id)).map((row) => (
            <div key={row.id}>
              <strong>{row.see}</strong>
              <p>
                {row.livesPlain}: {row.shortlist.join(' · ')}
              </p>
            </div>
          ))}
          <p>{GRAMMAR_TREND_RULE}</p>
          <p>{spec.controlStrip.sentence}</p>
          {/*
            Report 1.7 (fellow walkthrough, PDF p.12): a section that adjusts nothing listed all five
            control families as "monitoring only", which reads as unfilled template text rather than
            a reference. Where the section's own strip marks no control as in play, its sentence
            already says so; the list is only rendered where it distinguishes one control from
            another. Nothing is removed from a section that does have controls.
          */}
          {controlStripDistinguishes(spec.controlStrip.states) ? (
            <ul data-teaching-block="control-strip">
              {imagingControlIds.map((id) => (
                <li key={id}>
                  {IMAGING_CONTROL_PANEL.controls.find((c) => c.id === id)?.plainName}:{' '}
                  {
                    {
                      'this-one': 'relevant to this question',
                      'not-this-one': 'does not address this question',
                      'harmful-reflex': 'does not resolve the uncertainty',
                      monitoring: 'monitoring only',
                    }[spec.controlStrip.states[id]]
                  }
                </li>
              ))}
            </ul>
          ) : null}
        </details>
        {RECONSTRUCTION_SECTIONS.includes(lesson.sectionId) && (
          <details>
            <summary>Reconstruction technical reference</summary>
            <ReconstructionComparison />
          </details>
        )}
      </section>
    )
  const block = lesson.lesson.blocks.find((b) => b.title === ref)!
  return (
    <section
      data-content-ref={review ? undefined : ref}
      data-review-ref={review ? ref : undefined}
      data-teaching-block="mechanism"
    >
      <h3>{block.title}</h3>
      {/* Report 7.4: an immediate safety precaution is set apart, not left inside a paragraph. */}
      {block.callout ? (
        <p className={styles.callout} role="note" data-safety-callout>
          {block.callout}
        </p>
      ) : null}
      <p>{block.body}</p>
      {block.points && (
        <ul className={styles.checklist}>
          {block.points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      )}
      {block.detail && (
        <details data-block-detail>
          <summary>{block.detail.title}</summary>
          <p>{block.detail.body}</p>
        </details>
      )}
    </section>
  )
}
