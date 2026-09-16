'use client'

import { useState } from 'react'
import { Link } from '@/i18n/navigation'
import {
  ventilationPlacementQuestions,
  ventilationFinalQuestions,
  ventilationUnitQuestions,
} from '../content/learningQuestions'
import {
  ventilationGenericQuestionPurpose,
  ventilationUnitById,
} from '../content/learningCurriculum'
import { ventilationQuestionTeachingById } from '../content/questionTeaching'
import { VentilationReinforcement } from './VentilationReinforcement'
import { VentilationWorkedComparison } from './VentilationWorkedComparison'
import { VentilationLearningSources } from './VentilationLearningVisuals'
import styles from './ventilation-course.module.css'

/**
 * Saved placement, final and review URLs open optional questions and worked comparisons. Nothing
 * chosen here is saved or read back, and none of it controls access to the lessons.
 */
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
  const teaching = ventilationQuestionTeachingById.get(question.id)
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
            Try a question, open its explanation before answering, or read a worked comparison.
            Nothing you choose here is saved, and none of it controls access to the lessons.
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
                {ventilationQuestionTeachingById.get(item.id)?.presentation === 'worked-comparison'
                  ? ' (worked comparison)'
                  : ''}
              </option>
            ))}
          </select>
        </label>
        <section className={styles.card}>
          {teaching?.presentation === 'worked-comparison' ? (
            <VentilationWorkedComparison
              key={question.id}
              question={question}
              teaching={teaching}
            />
          ) : (
            <VentilationReinforcement
              key={question.id}
              id={question.id}
              purpose={teaching?.purpose ?? ventilationGenericQuestionPurpose(unit)}
              prompt={question.prompt}
              choices={question.choices}
              hint={teaching?.hint ?? unit.explanation}
              explanation={teaching?.explanation ?? best.label + '. ' + best.rationale}
              nextCheck={teaching?.nextCheck}
              bestChoiceId={question.correctId}
            />
          )}
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
          <VentilationLearningSources evidenceIds={teaching?.evidenceIds ?? question.evidenceIds} />
        </section>
        <Link href="/mechanical-ventilation/practice">Explore the live cases</Link>
      </div>
    </div>
  )
}
