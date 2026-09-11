import { flaggedLearnerCopyTerms } from '@/features/learning-module/activity/clinicalLearningItem'

import { scopeViewErrors } from '../engine/scope/scopeViewErrors'
import { BRONCH_SECTION_IDS } from '../content/pathway'
import {
  bronchStageLesson,
  bronchStageLessons,
  ACT_ACTION_LABELS,
  precommitAuthoredSurfaces,
  scopeViewOfStep,
  validateBronchStageLessons,
} from '../content/stageLessons'
import { bronchStageSources } from '../content/stageSources'

describe('the stage lessons', () => {
  it('validate as a set', () => {
    expect(validateBronchStageLessons()).toEqual([])
    expect(bronchStageLessons()).toHaveLength(BRONCH_SECTION_IDS.length)
  })

  it.each(BRONCH_SECTION_IDS)(
    '%s opens on Recognize, predicts once, acts, explains and ends on the transfer',
    (sectionId) => {
      const lesson = bronchStageLesson(sectionId)
      const phases = lesson.steps.map((step) => step.phase)
      expect(phases[0]).toBe('recognize')
      expect(phases.at(-1)).toBe('transfer')
      expect(lesson.predictionStepIndex).toBe(1)
      expect(lesson.transferStepIndex).toBe(lesson.steps.length - 1)
      expect(lesson.steps.filter((step) => step.interaction.kind === 'prediction')).toHaveLength(2)
      expect(lesson.steps.filter((step) => step.phase === 'act')).toHaveLength(1)
      lesson.steps.forEach((step, index) => {
        expect(step.ordinal).toBe(index + 1)
        expect(step.gate).toBe(index > lesson.predictionStepIndex ? 'after-prediction' : 'open')
        expect(step.lookIn.landmark.length).toBeGreaterThan(0)
        const view = scopeViewOfStep(step)
        if (view) expect(scopeViewErrors(view)).toEqual([])
      })
      const observe = lesson.steps.filter((step) => step.phase === 'observe')
      const act = lesson.section.act
      expect(observe).toHaveLength(act.kind === 'scope-lab' && act.observe ? 1 : 0)
    },
  )

  it.each(BRONCH_SECTION_IDS)(
    '%s carries no deny-listed phrase on a pre-commit surface',
    (sectionId) => {
      const lesson = bronchStageLesson(sectionId)
      const findings: string[] = []
      for (const surface of precommitAuthoredSurfaces(lesson)) {
        if (surface.where.endsWith('stem') || surface.where.endsWith('situation')) continue
        for (const pattern of lesson.section.precommitDenyPatterns) {
          if (pattern.test(surface.text)) findings.push(`${surface.where}: /${pattern.source}/`)
        }
      }
      expect(findings).toEqual([])
    },
  )

  it.each(BRONCH_SECTION_IDS)(
    '%s cites at least one registered source, with a location',
    (sectionId) => {
      const sources = bronchStageSources(sectionId)
      expect(sources.records.length).toBeGreaterThan(0)
      for (const record of sources.records) {
        expect(record.source.id).toBe(sources.evidenceIds[sources.records.indexOf(record)])
        expect(record.locations.length).toBeGreaterThan(0)
      }
    },
  )

  it('names its Act actions in words the copy gate allows', () => {
    for (const label of Object.values(ACT_ACTION_LABELS)) {
      expect(flaggedLearnerCopyTerms(label)).toEqual([])
    }
  })
})
