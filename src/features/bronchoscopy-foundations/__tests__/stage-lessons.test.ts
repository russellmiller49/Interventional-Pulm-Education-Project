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

  it.each(BRONCH_SECTION_IDS.filter((id) => id !== 'five-controls'))(
    '%s explicitly introduces teaching, preserves activities and completes a changed application',
    (sectionId) => {
      const lesson = bronchStageLesson(sectionId)
      const phases = lesson.steps.map((step) => step.phase)
      const rewritten = lesson.section.authoringContract === 2
      expect(phases[0]).toBe('recognize')
      // A rewritten section closes on its checklist, after the check; the first contract ends on it.
      expect(phases.at(-1)).toBe(rewritten ? 'explain' : 'transfer')
      expect(lesson.predictionStepIndex).toBeGreaterThan(0)
      expect(lesson.steps[0].activity).toBe('teaching')
      expect(lesson.steps.flatMap((step) => step.course?.blocks ?? []).sort()).toEqual(
        lesson.section.blocks.map((block) => block.id).sort(),
      )
      expect(lesson.transferStepIndex).toBe(lesson.steps.length - (rewritten ? 2 : 1))
      if (rewritten) {
        // Hook, then the prediction, before any teaching card.
        expect(lesson.steps[0].course).toMatchObject({ anchor: true, blocks: [] })
        expect(lesson.predictionStepIndex).toBe(1)
        expect(lesson.steps.at(-1)?.course).toMatchObject({ kind: 'debrief', anchor: true })
      }
      expect(lesson.steps.filter((step) => step.interaction.kind === 'prediction')).toHaveLength(2)
      expect(lesson.steps.filter((step) => step.phase === 'act').length).toBeGreaterThanOrEqual(1)
      lesson.steps.forEach((step, index) => {
        expect(step.ordinal).toBe(index + 1)
        expect(step.gate).toBe('open')
        expect(step.course).toBeDefined()
        expect(step.lookIn.landmark.length).toBeGreaterThan(0)
        const view = scopeViewOfStep(step)
        if (view) expect(scopeViewErrors(view)).toEqual([])
      })
      const observe = lesson.steps.filter((step) => step.phase === 'observe')
      const act = lesson.section.act
      expect(observe).toHaveLength(act.kind === 'scope-lab' && act.observe ? 1 : 0)
    },
  )

  it('keeps each bench unit of the five-controls sequence, guided then repeated, inside the rewritten flow', () => {
    const lesson = bronchStageLesson('five-controls')
    const units = lesson.steps.filter((step) => step.learn)
    // The hook opens the section and the checklist closes it; the bench units run between them.
    expect(lesson.steps[0].course?.anchor).toBe(true)
    expect(lesson.steps.at(-1)?.interaction.kind).toBe('explain')
    expect(units.map((step) => step.learn!.id)).toEqual([
      'check',
      'instrument',
      'depth',
      'depth-repeat',
      'bend',
      'bend-repeat',
      'rotation',
      'rotation-repeat',
      'combine',
      'suction',
      'suction-repeat',
      'transfer',
    ])
    expect(units.find((step) => step.learn!.id === 'instrument')?.learn?.orientation).toBe(true)
    for (const step of units) {
      const { id, support, demonstration, cue } = step.learn!
      if (support === 'guided') expect([id, !!demonstration, !!cue]).toEqual([id, true, true])
      if (support === 'repeat') expect([id, !!demonstration, !!cue]).toEqual([id, false, false])
      if (id !== 'check' && id !== 'instrument') expect(step.interaction.kind).toBe('scope-task')
      // A unit's identity is its own, so saved places and tests survive a change of order.
      expect(step.id).toBe(`five-controls-learn-${id}`)
      expect(step.learn!.paragraphs.length).toBeGreaterThan(0)
    }
    // One prediction before the teaching, and one check with a new opening after it.
    expect(lesson.steps.filter((step) => step.interaction.kind === 'prediction')).toHaveLength(2)
    expect(lesson.predictionStepIndex).toBeLessThan(lesson.steps.indexOf(units[1]))
    expect(lesson.transferStepIndex).toBeGreaterThan(
      lesson.steps.findIndex((step) => step.learn?.id === 'transfer'),
    )
    expect(lesson.steps.every((step) => step.gate === 'open')).toBe(true)
    for (const step of lesson.steps) {
      const view = scopeViewOfStep(step)
      if (view) expect(scopeViewErrors(view)).toEqual([])
    }
  })

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
