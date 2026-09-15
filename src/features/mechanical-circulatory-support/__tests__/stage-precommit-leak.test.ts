/** MCS-01 replaces title/answer secrecy with open teaching and stable source identity. */
import { criticalCareActivityById } from '@/features/critical-care/content/activities'
import { mcsLessons } from '../content/lessons'
import { mcsPathway } from '../content/pathwayResolver'
import { mcsSectionLearningContracts } from '../content/sectionLearningContracts'
import { buildMcsStageLesson } from '../content/stageLessons'
import { mcsStageSources } from '../content/stageSources'

it.each(mcsSectionLearningContracts)(
  '$sectionId retains one meaningful title across all current consumers',
  (contract) => {
    const lesson = mcsLessons.find((candidate) => candidate.id === contract.sectionId)!
    const row = mcsPathway().sections.find((section) => section.id === contract.sectionId)!
    expect(contract.lessonTitle).toBe(lesson.title)
    expect(row.title).toBe(lesson.title)
    expect(criticalCareActivityById.get(`mcs:learn:${contract.sectionId}`)?.title).toBe(
      lesson.title,
    )
    expect(lesson.title.trim().length).toBeGreaterThan(0)
  },
)
it.each(mcsSectionLearningContracts)(
  '$sectionId opens every authored phase and retains its source references',
  (contract) => {
    const lesson = buildMcsStageLesson(contract.sectionId)
    expect(lesson.steps.every((step) => step.gate === 'open')).toBe(true)
    expect(lesson.steps[lesson.predictionStepIndex].interaction.kind).toBe('prediction')
    expect(lesson.steps.at(-1)?.interaction.kind).toBe('transfer')
    expect(lesson.steps.every((step) => step.title.trim() && step.lookIn?.landmark)).toBe(true)
    const sources = mcsStageSources(contract.sectionId).sourceIds
    for (const source of contract.predictionItem.evidenceIds) expect(sources).toContain(source)
  },
)
