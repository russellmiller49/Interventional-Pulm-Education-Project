'use client'

import { useId } from 'react'

import { StageBlock } from '@/features/learning-module/stage/StageBlock'

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

/** Essential explanations and worked examples precede independent application. Pending items receive a separate, limited foundation view. */
const STATE_WORDS: Readonly<Record<ControlStripState, string>> = {
  'this-one': 'this one',
  'not-this-one': 'not this one',
  'harmful-reflex': 'does not resolve this question',
  monitoring: 'monitoring only here',
}

/** Deeper technical details remain accessible disclosures during teaching and review. */
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
  independent = false,
}: {
  readonly independent?: boolean
  readonly lesson: ImagingStageLesson
  /** The stops lit on the current step; the walk narrows this to one. */
  readonly stops: readonly ChainStopId[]
}) {
  const idBase = useId()

  const { spec } = lesson
  const blocks = classifyTeachingBlocks(lesson.lesson)
  const rows = IMAGING_GRAMMAR.filter((row) => spec.grammarRowIds.includes(row.id))
  const stopsToShow = stops.length > 0 ? stops : spec.chainStops
  const showStopCards = lesson.sectionId === 'chain-walk'
  const introducesPanel = lesson.sectionId === 'good-image'

  if (independent)
    return (
      <div className={styles.teaching} data-teaching-panel>
        <section className={styles.teachingCard} data-independent-foundations>
          <p className={styles.kicker}>Apply the explanation</p>
          <p>{spec.newConcept}</p>
          <p>
            Inspect the supplied image and context. Decide what the image establishes and what
            remains uncertain. Task-specific feedback and geometric explanation appear after your
            answer.
          </p>
        </section>
        <section className={styles.teachingCard} data-teaching-block="boundary">
          <p className={styles.kicker}>Model limitations</p>
          <p>{spec.modelBoundary}</p>
        </section>
      </div>
    )

  return (
    <div className={styles.teaching} data-teaching-panel>
      <StageBlock kind="question" heading="What this section is for">
        <section className={styles.teachingCard} data-teaching-block="purpose">
          <p className={styles.kicker}>What this section is for</p>
          <p>{spec.objective}</p>
          <p>{spec.newConcept}</p>
          <details>
            <summary>Clinical purpose and prior learning</summary>
            <p>{lesson.lesson.why}</p>
            <p>{lesson.lesson.recall.prompt}</p>
            <p data-increment-sentence>{spec.incrementSentence}</p>
          </details>
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
              <BlockBody block={entry.block} listId={`${idBase}-block-${index}`} detailVisible />
            </section>
          </StageBlock>
        ))}

      {showStopCards ? (
        <StageBlock kind="pattern" heading="How the image is formed">
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
                <p className={styles.kicker}>{stop.title}</p>
                <p>{stop.precise}</p>
                <p className={styles.analogy}>{stop.analogy}</p>
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

      <>
        {introducesPanel ? (
          <StageBlock kind="after-commitment" visibility="shown" heading="Fluoroscopy controls">
            <section className={styles.teachingCard} data-teaching-block="control-panel">
              <p className={styles.kicker}>Fluoroscopy controls</p>
              <p>{IMAGING_CONTROL_PANEL.sentence}</p>
              <ul className={styles.checklist}>
                {IMAGING_CONTROL_PANEL.controls.map((control) => (
                  <li key={control.id}>
                    <strong>{control.plainName}.</strong> Changes {control.changes} Does not change{' '}
                    {control.doesNotChange}
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
              visibility="shown"
              heading={entry.block.title}
            >
              <section className={styles.teachingCard} data-teaching-block="mechanism">
                <BlockBody block={entry.block} listId={`${idBase}-after-${index}`} detailVisible />
              </section>
            </StageBlock>
          ))}

        {RECONSTRUCTION_SECTIONS.includes(lesson.sectionId) ? (
          <StageBlock
            kind="after-commitment"
            visibility="shown"
            heading="How a reconstruction is made"
          >
            <section className={styles.teachingCard} data-teaching-block="reconstruction">
              <p className={styles.kicker}>How a reconstruction is made</p>
              <ReconstructionComparison />
            </section>
          </StageBlock>
        ) : null}

        <StageBlock kind="after-commitment" visibility="shown" heading="What this section adds">
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
            <ul className={styles.takeaways} aria-labelledby={`${idBase}-takeaways`} data-takeaways>
              {lesson.lesson.takeaway.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>
        </StageBlock>

        {rows.length > 0 ? (
          <StageBlock
            kind="after-commitment"
            visibility="collapsed"
            heading="Troubleshooting reference"
          >
            <section className={styles.teachingCard} data-teaching-block="grammar">
              <p className={styles.kicker}>Troubleshooting table · rows for this section</p>
              <table className={styles.grammarTable}>
                <thead>
                  <tr>
                    <th scope="col">What you see</th>
                    <th scope="col">Likely cause</th>
                    <th scope="col">What to consider</th>
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

        <StageBlock kind="after-commitment" visibility="collapsed" heading="Control reference">
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

        <StageBlock kind="boundary" visibility="shown" heading="What this model leaves out">
          <section className={styles.teachingCard} data-teaching-block="boundary">
            <p className={styles.kicker}>What this model leaves out</p>
            <p>{spec.modelBoundary}</p>
          </section>
        </StageBlock>
      </>
    </div>
  )
}
