'use client'

import { IMAGING_CONTROL_PANEL, imagingControlIds } from '../../content/controlPanel'
import { GRAMMAR_TREND_RULE, IMAGING_GRAMMAR } from '../../content/grammar'
import type { ImagingStageLesson } from '../../content/stageLessons'
import type { ImagingLearningActivity } from '../../content/learningActivities'
import type { ChainStopId } from '../../content/imagingChain'
import { RECONSTRUCTION_SECTIONS } from '../../content/reconstruction'
import { ReconstructionComparison } from './ReconstructionComparison'
import { imagingSectionLinkTarget } from '../../content/pathwayResolver'
import { Link } from '@/i18n/navigation'
import styles from './imaging-stage.module.css'

/** Resolve only this activity's authored content. Earlier teaching is reviewed by activity ID. */
export function ImagingTeachingColumn({
  lesson,
  activity,
  independent = false,
}: {
  readonly lesson: ImagingStageLesson
  readonly activity: ImagingLearningActivity
  readonly independent?: boolean
  readonly stops?: readonly ChainStopId[]
}) {
  const { spec } = lesson
  if (independent)
    return (
      <div data-teaching-panel data-independent-foundations>
        <p>
          Use the supplied evidence and acquisition context. Task-specific feedback appears after
          your answer.
        </p>
      </div>
    )
  return (
    <div className={styles.teaching} data-teaching-panel>
      {activity.content.map((ref) => {
        if (ref === '@purpose')
          return (
            <div key={ref} data-teaching-block="purpose">
              <p className={styles.kicker}>Imaging question</p>
              <p>{spec.objective}</p>
              <details>
                <summary>Clinical purpose and prior learning</summary>
                <p>{lesson.lesson.why}</p>
                <p>{lesson.lesson.recall.prompt}</p>
                <p>{spec.incrementSentence}</p>
              </details>
            </div>
          )
        if (ref === '@worked')
          return (
            <section key={ref} data-teaching-block="adds" className={styles.worked}>
              <h3>Worked example</h3>
              <p>{lesson.lesson.worked.scenario}</p>
              <p>{lesson.lesson.worked.reasoning}</p>
            </section>
          )
        if (ref === '@controls')
          return (
            <details key={ref} data-teaching-block="control-panel">
              <summary>Control families and monitoring reference</summary>
              <p>{IMAGING_CONTROL_PANEL.sentence}</p>
              <ul className={styles.checklist}>
                {IMAGING_CONTROL_PANEL.controls.map((c) => (
                  <li key={c.id}>
                    <strong>{c.plainName}.</strong> Changes {c.changes} Does not change{' '}
                    {c.doesNotChange}
                  </li>
                ))}
              </ul>
              {IMAGING_CONTROL_PANEL.monitoring.map((c) => (
                <p key={c.id}>
                  {c.plainName}: {c.sentence}
                </p>
              ))}
              <p>
                Next: <Link href={imagingSectionLinkTarget('field')}>field and stored display</Link>{' '}
                and <Link href={imagingSectionLinkTarget('time')}>temporal acquisition</Link>.
              </p>
            </details>
          )
        if (ref === '@summary')
          return (
            <section key={ref} data-teaching-block="adds">
              <h3>Take with you</h3>
              <ul data-takeaways className={styles.takeaways}>
                {lesson.lesson.takeaway.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <p data-recall-answer>
                <strong>Earlier question, revisited.</strong> {lesson.lesson.recall.answer}
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
          <section key={ref} data-content-ref={ref} data-teaching-block="mechanism">
            <h3>{block.title}</h3>
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
      })}
    </div>
  )
}
