/**
 * The pre-commitment surfaces, read from the registries exactly as the stage reads them.
 *
 * For every section: the pathway row a learner reads on the hub, the lesson's title and
 * objectives, the section's framing (its question, its one idea, its objective, what is on the
 * screen), the titles of the steps reachable before the commitment, and the two prompts are held
 * to the section's deny patterns. Titles carry no digit anywhere, and the title every registry
 * carries is the same title.
 */
import { criticalCareActivityById } from '@/features/critical-care/content/activities'

import { mcsLessons } from '../content/lessons'
import { mcsPathway } from '../content/pathwayResolver'
import { mcsSectionLearningContracts } from '../content/sectionLearningContracts'
import { mcsSectionSpec } from '../content/sectionSpecs'
import { buildMcsStageLesson } from '../content/stageLessons'

const sections = mcsSectionLearningContracts.map(
  (contract) => [contract.sectionId, contract] as const,
)

function expectClean(patterns: readonly RegExp[], surfaces: readonly [string, string][]) {
  const hits: string[] = []
  for (const [name, text] of surfaces) {
    for (const pattern of patterns) {
      if (pattern.test(text)) hits.push(`${name} matches ${pattern}: "${text.slice(0, 100)}"`)
    }
  }
  expect(hits).toEqual([])
}

describe('pre-commitment surfaces, from the registries', () => {
  it.each(sections)(
    '%s: the hub row, the lesson header and the framing say nothing withheld',
    (sectionId, contract) => {
      const spec = mcsSectionSpec(sectionId)
      const row = mcsPathway().sections.find((section) => section.id === sectionId)!
      const lesson = mcsLessons.find((candidate) => candidate.id === sectionId)!
      const stage = buildMcsStageLesson(sectionId)
      const preCommitSteps = stage.steps.slice(0, stage.predictionStepIndex + 1)
      expectClean(spec.precommitDenyPatterns, [
        ['row.title', row.title],
        ['row.shortTitle', row.shortTitle],
        ['row.description', row.description],
        ['lesson.title', lesson.title],
        ['lesson.summary', lesson.summary],
        ...lesson.objectives.map(
          (objective, index) => [`lesson.objective[${index}]`, objective] as [string, string],
        ),
        ['spec.objective', spec.objective],
        ['spec.newConcept', spec.newConcept],
        ['contract.clinicalQuestion', contract.clinicalQuestion],
        ['contract.startingContext', contract.startingContext],
        ['contract.patientProblem', contract.patientProblem],
        ['contract.whyThisView', contract.whyThisView],
        ['teaching.whatYouAreSeeing', contract.teaching.whatYouAreSeeing],
        ['teaching.whatTheTargetRepresents', contract.teaching.whatTheTargetRepresents],
        ['contract.recognizePrompt', contract.recognizePrompt],
        ['contract.predictionPrompt', contract.predictionPrompt],
        ['prediction.stem', contract.predictionItem.stem],
        ...preCommitSteps.flatMap(
          (step) =>
            [
              [`step.${step.id}.title`, step.title],
              [`step.${step.id}.instruction`, step.instruction],
            ] as [string, string][],
        ),
        ...(stage.increment
          ? [['increment.sentence', stage.increment.sentence] as [string, string]]
          : []),
      ])
    },
  )

  it('carries no digit in any title, short title, or description on the pathway', () => {
    for (const section of mcsPathway().sections) {
      expect(section.title).not.toMatch(/\d/)
      expect(section.shortTitle).not.toMatch(/\d/)
      expect(section.description).not.toMatch(/\d/)
    }
  })

  it('carries one title per section across the four registries', () => {
    for (const contract of mcsSectionLearningContracts) {
      const lesson = mcsLessons.find((candidate) => candidate.id === contract.sectionId)!
      const row = mcsPathway().sections.find((section) => section.id === contract.sectionId)!
      const activity = criticalCareActivityById.get(`mcs:learn:${contract.sectionId}`)!
      expect(contract.lessonTitle).toBe(lesson.title)
      expect(row.title).toBe(lesson.title)
      expect(activity.title).toBe(lesson.title)
    }
  })

  it('names no diagnosis in a section title: the titles are presentations or questions', () => {
    for (const lesson of mcsLessons) {
      expect(lesson.title).not.toMatch(
        /thrombosis|malposition|hemolysis|high[- ]power|escalation|purge/i,
      )
    }
  })

  it('locks every step after the prediction and opens the two before it', () => {
    for (const [sectionId] of sections) {
      const stage = buildMcsStageLesson(sectionId)
      stage.steps.forEach((step, index) => {
        expect(step.gate).toBe(index <= stage.predictionStepIndex ? 'open' : 'after-prediction')
      })
      expect(stage.steps[stage.predictionStepIndex].interaction.kind).toBe('prediction')
      expect(stage.steps[stage.steps.length - 1].interaction.kind).toBe('transfer')
    }
  })
})
