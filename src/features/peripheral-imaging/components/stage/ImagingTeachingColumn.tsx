'use client'

import { useId } from 'react'

import { StageBlock } from '@/features/learning-module/stage/StageBlock'
import { useStageTeachingScope } from '@/features/learning-module/stage/StageTeachingScope'

import {
  IMAGING_CONTROL_PANEL,
  imagingControlIds,
  type ControlStripState,
} from '../../content/controlPanel'
import { GRAMMAR_TREND_RULE, IMAGING_GRAMMAR } from '../../content/grammar'
import { chainStop, type ChainStopId } from '../../content/imagingChain'
import type { ImagingStageLesson } from '../../content/stageLessons'
import { classifyTeachingBlocks } from '../../content/teachingBlocks'
import type { TeachingBlock } from '../../types'
import { RECONSTRUCTION_SECTIONS } from '../../content/reconstruction'
import { ReconstructionComparison } from './ReconstructionComparison'
import styles from './imaging-stage.module.css'

/**
 * The teaching pane: what a learner reads beside the suite, foregrounded by the step.
 *
 * Before the commitment: what the section is for, the blocks that frame the question and name
 * the signals, and the stop the step stands at (its analogy, its precise statement, its
 * checklist). After the commitment: the mechanism blocks, the worked example, the recall answer,
 * the rows of the one table this section fills in, the control strip and the model boundary. The
 * scope decides which blocks are the focus; the commitment decides what may be said at all.
 */
const STATE_WORDS: Readonly<Record<ControlStripState, string>> = {
  'this-one': 'this one',
  'not-this-one': 'not this one',
  'harmful-reflex': 'the harmful reflex',
  monitoring: 'monitoring only here',
}

/**
 * A block's body. The optional detail is after-commitment content by classification (the
 * authored leak scan never reads it), so it is not in the document at all until the prediction
 * is committed — a collapsed disclosure would still be readable by a screen reader or in the
 * page source.
 */
function BlockBody({
  block,
  listId,
  detailVisible,
}: {
  readonly block: TeachingBlock
  readonly listId: string
  readonly detailVisible: boolean
}) {
  return (
    <>
      <p className={styles.kicker}>{block.title}</p>
      <p>{block.body}</p>
      {block.points && block.points.length > 0 ? (
        <ul className={styles.checklist} aria-labelledby={listId}>
          {block.points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      ) : null}
      {block.detail && detailVisible ? (
        <details data-block-detail>
          <summary>{block.detail.title}</summary>
          <p>{block.detail.body}</p>
        </details>
      ) : null}
    </>
  )
}

export function ImagingTeachingColumn({
  lesson,
  stops,
}: {
  readonly lesson: ImagingStageLesson
  /** The stops lit on the current step; the walk narrows this to one. */
  readonly stops: readonly ChainStopId[]
}) {
  const scope = useStageTeachingScope()
  const idBase = useId()
  const committed = scope?.predictionCommitted ?? true
  const { spec } = lesson
  const blocks = classifyTeachingBlocks(lesson.lesson)
  const rows = IMAGING_GRAMMAR.filter((row) => spec.grammarRowIds.includes(row.id))
  const stopsToShow = stops.length > 0 ? stops : spec.chainStops
  const showStopCards = committed || spec.stopCardsBeforeCommit !== false
  const introducesPanel = lesson.sectionId === 'good-image'

  return (
    <div className={styles.teaching} data-teaching-panel>
      <StageBlock kind="question" heading="What this section is for">
        <section className={styles.teachingCard} data-teaching-block="purpose">
          <p className={styles.kicker}>What this section is for</p>
          <p>{spec.objective}</p>
          <p>
            <strong>One new idea.</strong> {spec.newConcept}
          </p>
          <div className={styles.increment}>
            <p className={styles.kicker}>What this section adds</p>
            <p data-increment-sentence>{spec.incrementSentence}</p>
          </div>
          <p>
            <strong>In the suite.</strong> {lesson.lesson.why}
          </p>
          <p data-recall-prompt>
            <strong>Recall.</strong> {lesson.lesson.recall.prompt}
          </p>
        </section>
      </StageBlock>

      {blocks
        .filter(
          (entry) =>
            entry.kind === 'question' || entry.kind === 'signals' || entry.kind === 'pattern',
        )
        .map((entry, index) => (
          <StageBlock
            key={entry.block.title}
            kind={entry.kind === 'question' ? 'signals' : entry.kind}
            heading={entry.block.title}
          >
            <section
              className={styles.teachingCard}
              data-teaching-block="framing"
              data-block-kind={entry.kind}
            >
              <BlockBody
                block={entry.block}
                listId={`${idBase}-block-${index}`}
                detailVisible={committed}
              />
            </section>
          </StageBlock>
        ))}

      {showStopCards ? (
        <StageBlock kind="pattern" heading="Where you are on the chain">
          {stopsToShow.map((stopId) => {
            const stop = chainStop(stopId)
            return (
              <section
                key={stopId}
                className={styles.teachingCard}
                data-teaching-block="stop"
                data-stop={stopId}
                aria-label={stop.title}
              >
                <p className={styles.kicker}>
                  Stop {stop.number} · {stop.title}
                </p>
                <p className={styles.analogy}>{stop.analogy}</p>
                <p>{stop.precise}</p>
                <p className={styles.kicker} id={`${idBase}-${stopId}`}>
                  {stop.checklistLabel}
                </p>
                <ul className={styles.checklist} aria-labelledby={`${idBase}-${stopId}`}>
                  {stop.checklist.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </section>
            )
          })}
        </StageBlock>
      ) : null}

      {committed ? (
        <>
          {introducesPanel ? (
            <StageBlock kind="after-commitment" heading="Five things you can change">
              <section className={styles.teachingCard} data-teaching-block="control-panel">
                <p className={styles.kicker}>Five things you can change</p>
                <p>{IMAGING_CONTROL_PANEL.sentence}</p>
                <ul className={styles.checklist}>
                  {IMAGING_CONTROL_PANEL.controls.map((control) => (
                    <li key={control.id}>
                      <strong>{control.plainName}</strong> — changes {control.changes} Does not
                      change: {control.doesNotChange}
                    </li>
                  ))}
                </ul>
                {IMAGING_CONTROL_PANEL.monitoring.map((item) => (
                  <p key={item.id}>
                    <strong>{item.plainName}.</strong> {item.sentence}
                  </p>
                ))}
              </section>
            </StageBlock>
          ) : null}

          {blocks
            .filter((entry) => entry.kind === 'after-commitment' || entry.kind === 'discriminators')
            .map((entry, index) => (
              <StageBlock
                key={entry.block.title}
                kind="after-commitment"
                heading={entry.block.title}
              >
                <section className={styles.teachingCard} data-teaching-block="mechanism">
                  <BlockBody
                    block={entry.block}
                    listId={`${idBase}-after-${index}`}
                    detailVisible
                  />
                </section>
              </StageBlock>
            ))}

          {RECONSTRUCTION_SECTIONS.includes(lesson.sectionId) ? (
            <StageBlock kind="after-commitment" heading="How a reconstruction is made">
              <section className={styles.teachingCard} data-teaching-block="reconstruction">
                <p className={styles.kicker}>How a reconstruction is made</p>
                <ReconstructionComparison />
              </section>
            </StageBlock>
          ) : null}

          <StageBlock kind="after-commitment" heading="What this section adds">
            <section className={styles.teachingCard} data-teaching-block="adds">
              <p className={styles.kicker}>What this section adds</p>
              <div className={styles.worked}>
                <p>
                  <strong>Worked example.</strong> {lesson.lesson.worked.scenario}
                </p>
                <p>{lesson.lesson.worked.reasoning}</p>
              </div>
              <p data-recall-answer>
                <strong>Recall, answered.</strong> {lesson.lesson.recall.answer}
              </p>
              <p className={styles.kicker} id={`${idBase}-takeaways`}>
                Take with you
              </p>
              <ul
                className={styles.takeaways}
                aria-labelledby={`${idBase}-takeaways`}
                data-takeaways
              >
                {lesson.lesson.takeaway.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>
          </StageBlock>

          {rows.length > 0 ? (
            <StageBlock kind="after-commitment" heading="The one table">
              <section className={styles.teachingCard} data-teaching-block="grammar">
                <p className={styles.kicker}>The one table · rows this section fills in</p>
                <table className={styles.grammarTable}>
                  <thead>
                    <tr>
                      <th scope="col">What you see</th>
                      <th scope="col">Where it lives</th>
                      <th scope="col">The shortlist</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id} data-grammar-row={row.id}>
                        <th scope="row">{row.see}</th>
                        <td>{row.livesPlain}</td>
                        <td>{row.shortlist.join(' · ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className={styles.trendRule}>{GRAMMAR_TREND_RULE}</p>
              </section>
            </StageBlock>
          ) : null}

          <StageBlock kind="after-commitment" heading="Which control, if any">
            <section className={styles.teachingCard} data-teaching-block="control-strip">
              <p className={styles.kicker}>Which control, if any</p>
              <ul className={styles.controlStrip} data-control-strip={spec.controlStrip.verdict}>
                {imagingControlIds.map((controlId) => {
                  const control = IMAGING_CONTROL_PANEL.controls.find((c) => c.id === controlId)!
                  const state = spec.controlStrip.states[controlId]
                  return (
                    <li key={controlId} data-control={controlId} data-state={state}>
                      <span>{control.plainName}</span>
                      <strong>{STATE_WORDS[state]}</strong>
                    </li>
                  )
                })}
              </ul>
              <p>{spec.controlStrip.sentence}</p>
            </section>
          </StageBlock>

          <StageBlock kind="boundary" heading="What this model leaves out">
            <section className={styles.teachingCard} data-teaching-block="boundary">
              <p className={styles.kicker}>What this model leaves out</p>
              <p>{spec.modelBoundary}</p>
            </section>
          </StageBlock>
        </>
      ) : (
        <p className={styles.readBefore} data-read-before-you-decide>
          The mechanism, the worked example, the rows of the table and the control strip open once
          you have committed.
        </p>
      )}
    </div>
  )
}
