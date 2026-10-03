'use client'

import { STAGE_PHASE_LABELS } from '@/features/learning-module/stage/stageModel'

import type { McsStageLesson } from '../../content/stageLessons'
import styles from './mcs-stage.module.css'

/**
 * What a section was for, at its end (F40).
 *
 * A learner who clicked through a section could not answer "how am I doing?", and the suggested
 * fix was a tally — "you committed 4 of 6 predictions; 3 were correct". This module does not keep
 * one: every question is optional, skipping is a legitimate way to read, and a count of answers
 * would turn a self-paced lesson into a quiz with the questions made compulsory in hindsight.
 *
 * What a learner can use at the end of a section is the section's own point, said compactly: what
 * it was teaching, the distinctions to keep, what the model leaves out, and where to go back to.
 * Every sentence here is one the section already carries — its objective, its one new idea, what
 * it establishes, the misreading it names, and what it does not establish — so the recap adds no
 * claim. It counts nothing, and it says so.
 */
export function McsSectionRecap({
  lesson,
  onRevisit,
}: {
  readonly lesson: McsStageLesson
  readonly onRevisit: (stepIndex: number) => void
}) {
  const { contract, spec } = lesson
  const distinctions = [
    `One idea: ${spec.newConcept}.`,
    contract.whatThisEstablishes,
    `A common misreading: ${contract.commonMisinterpretation}`,
  ]
  const explainIndex = lesson.steps.findIndex((step) => step.interaction.kind === 'explain')
  return (
    <section
      className={styles.block}
      aria-labelledby="mcs-section-recap-heading"
      data-section-recap
    >
      <p className={styles.kicker}>Section recap · nothing is counted</p>
      <h3 id="mcs-section-recap-heading">What this section was teaching</h3>
      <p data-recap-objective>{spec.objective}</p>

      <h4>Distinctions to keep</h4>
      <ul data-recap-distinctions>
        {distinctions.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>

      <h4>What remains a limit of the model</h4>
      <p data-recap-limit>{contract.whatThisDoesNotEstablish}</p>
      {contract.unmodeledNote ? <p data-recap-unmodeled>{contract.unmodeledNote}</p> : null}

      <h4>Go back to any part</h4>
      <ul className={styles.recapLinks} data-recap-revisit>
        {lesson.steps.map((step, index) => (
          <li key={step.id}>
            <button type="button" onClick={() => onRevisit(index)} data-recap-step={step.id}>
              {STAGE_PHASE_LABELS[step.phase]} · {step.title}
            </button>
          </li>
        ))}
      </ul>

      {explainIndex >= 0 ? (
        <p data-recap-reflection>
          <strong>Optional reflection:</strong> {contract.reassessmentPrompt}{' '}
          <button type="button" onClick={() => onRevisit(explainIndex)}>
            Open it with its worked response
          </button>
        </p>
      ) : null}

      <p className={styles.footnote} data-recap-boundary>
        Visited marks show where you have been: a way back, not a record of answers and not a
        measure of what you know.
      </p>
    </section>
  )
}
