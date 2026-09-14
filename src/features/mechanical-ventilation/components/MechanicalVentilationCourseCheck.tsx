'use client'

import { useState } from 'react'
import { Link } from '@/i18n/navigation'
import {
  ventilationPlacementQuestions,
  ventilationFinalQuestions,
  ventilationUnitQuestions,
} from '../content/learningQuestions'
import { ventilationUnitById } from '../content/learningCurriculum'
import { VentilationReinforcement } from './VentilationReinforcement'
import { VentilationLearningSources } from './VentilationLearningVisuals'
import styles from './ventilation-course.module.css'

/** Saved placement/final URLs now offer optional applications without reading old answers. */
export function MechanicalVentilationCourseCheck({
  kind,
}: {
  readonly kind: 'placement' | 'final' | 'review'
}) {
  const questions =
    kind === 'placement'
      ? ventilationPlacementQuestions
      : kind === 'final'
        ? ventilationFinalQuestions
        : ventilationUnitQuestions
  const [index, setIndex] = useState(0)
  const question = questions[index]
  const unit = ventilationUnitById.get(question.unitId)!
  const best = question.choices.find((choice) => choice.id === question.correctId)!
  return (
    <div className={styles.course}>
      <div className={styles.lessonShell}>
        <header className={styles.lessonHeader}>
          <h1>
            {kind === 'placement'
              ? 'Explore the starting concepts'
              : kind === 'review'
                ? 'Revisit a concept'
                : 'Worked applications'}
          </h1>
          <p>
            Try any question, use a hint, or open the explanation. These examples do not determine
            access to the lessons.
          </p>
          <Link href="/mechanical-ventilation/learn">Open any lesson</Link>
        </header>
        <label className={styles.settings}>
          Choose a concept{' '}
          <select
            aria-label="Choose a worked application"
            value={index}
            onChange={(event) => setIndex(Number(event.target.value))}
          >
            {questions.map((item, i) => (
              <option key={item.id} value={i}>
                {i + 1}. {ventilationUnitById.get(item.unitId)?.title}
              </option>
            ))}
          </select>
        </label>
        <section className={styles.card}>
          <VentilationReinforcement
            key={question.id}
            id={question.id}
            purpose={'Apply ' + unit.title.toLowerCase() + ' to a short authored case.'}
            prompt={question.prompt}
            choices={question.choices}
            hint={unit.explanation}
            explanation={best.label + '. ' + best.rationale}
          />
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.secondary}
              disabled={index === 0}
              onClick={() => setIndex(index - 1)}
            >
              Back
            </button>
            <button
              type="button"
              className={styles.primary}
              onClick={() => setIndex((index + 1) % questions.length)}
            >
              Continue
            </button>
            <Link
              href={{ pathname: '/mechanical-ventilation/learn', query: { activity: unit.id } }}
            >
              Review {unit.title}
            </Link>
          </div>
          <VentilationLearningSources evidenceIds={question.evidenceIds} />
        </section>
        <Link href="/mechanical-ventilation/practice">Explore the live cases</Link>
      </div>
    </div>
  )
}
