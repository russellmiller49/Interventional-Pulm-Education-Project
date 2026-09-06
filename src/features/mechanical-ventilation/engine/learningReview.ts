import { ventilationLearningUnits } from '../content/learningCurriculum'
import { ventilationExperimentByUnit } from '../content/learningExperiments'
import { unitQuestion } from '../content/learningQuestions'
import type { LabProgress } from './learningLab'
import { ventilationReviewQueue, type VentilationLearningProgress } from './learningProgress'

/** Reuse the retained question bank for optional retrieval after actual live experiments. */
export function ventilationLiveReviewQueue(
  lab: LabProgress,
  learning: VentilationLearningProgress,
  now = Date.now(),
) {
  const questions = new Map(
    ventilationReviewQueue(learning, now).map((question) => [question.id, question]),
  )
  const day = 86400000
  for (const unit of ventilationLearningUnits) {
    const record = lab.units[unit.id]
    if (!record?.completedAt) continue
    const question = unitQuestion(unit.id, 'transfer')
    const previous = learning.review[question.id]
    const rounds = ventilationExperimentByUnit.get(unit.id)!.rounds
    const needsRepair = previous
      ? previous.choiceId !== question.correctId || previous.confidence === 'unsure'
      : record.evidence.some(
          (evidence, index) =>
            evidence.prediction !== rounds[index].correct || evidence.confidence === 'unsure',
        )
    const elapsed = now - Date.parse(previous?.answeredAt ?? record.completedAt)
    const due = needsRepair ? !previous || elapsed >= day : elapsed >= (previous ? 30 : 7) * day
    if (due) questions.set(question.id, question)
  }
  return [...questions.values()]
}
