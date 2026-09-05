import { ventilationLearningUnits } from '../content/learningCurriculum'
import { ventilationExperimentByUnit } from '../content/learningExperiments'
import { ventilationSectionSpec, ventilationSectionSpecs } from '../content/sectionSpecs'
import { ventilationStageLesson, ventilationStageLessons } from '../content/stageLessons'
import { ventilationLeakMatches, ventilationPrecommitDenyPatterns } from '../test-support/stageLeak'
import { breathStop } from '../content/breathSpine'

describe('the fourteen stage lessons', () => {
  it('builds one lesson per unit, in canonical order, with one first prediction and one transfer prediction', () => {
    expect(ventilationStageLessons.map((lesson) => lesson.sectionId)).toEqual(
      ventilationLearningUnits.map((unit) => unit.id),
    )
    for (const lesson of ventilationStageLessons) {
      const predictions = lesson.steps.filter((step) => step.interaction.kind === 'prediction')
      expect(predictions).toHaveLength(2)
      expect(lesson.steps[lesson.predictionStepIndex].interaction).toMatchObject({
        kind: 'prediction',
        round: 0,
      })
      expect(lesson.steps[lesson.transferPredictionStepIndex].interaction).toMatchObject({
        kind: 'prediction',
        round: 1,
      })
      expect(lesson.steps.length).toBe(lesson.sectionId === 'controls-and-goals' ? 9 : 8)
      expect(lesson.steps.map((step) => step.ordinal)).toEqual(
        lesson.steps.map((_, index) => index + 1),
      )
      expect(new Set(lesson.steps.map((step) => step.id)).size).toBe(lesson.steps.length)
      // Everything after the first prediction waits for it.
      lesson.steps.forEach((step, index) => {
        expect(step.gate).toBe(index <= lesson.predictionStepIndex ? 'open' : 'after-prediction')
      })
      // The phases read Recognize → Predict → Act → Observe → Explain, then the transfer.
      expect(lesson.steps.slice(0, 5).map((step) => step.phase)).toEqual([
        'recognize',
        'predict',
        'act',
        'observe',
        'explain',
      ])
      expect(lesson.steps.slice(-3).every((step) => step.phase === 'transfer')).toBe(true)
    }
  })

  it('gives the walk to the trace section, the location question to the mismatch sections, and the sort to the controls section', () => {
    expect(ventilationStageLesson('waveform-anatomy').steps[0].interaction.kind).toBe('walk')
    for (const unitId of [
      'triggering-and-cycling',
      'waveform-reading-sequence',
      'dyssynchrony-mechanisms',
    ]) {
      expect(ventilationStageLesson(unitId).steps[0].interaction.kind).toBe('locate')
    }
    expect(
      ventilationStageLesson('controls-and-goals').steps.some(
        (step) => step.interaction.kind === 'sort',
      ),
    ).toBe(true)
    expect(ventilationStageLesson('breathing-with-support').steps[0].interaction.kind).toBe('read')
  })

  it('keeps every pre-commit surface clear of the answer, the direction and the diagnosis', () => {
    const findings: string[] = []
    for (const lesson of ventilationStageLessons) {
      const deny = ventilationPrecommitDenyPatterns(lesson.sectionId)
      const spec = ventilationSectionSpec(lesson.sectionId)
      const surfaces: { where: string; text: string }[] = [
        { where: 'unit title', text: lesson.unit.title },
        { where: 'increment', text: lesson.unit.increment },
        { where: 'objective', text: spec.objective },
        { where: 'new concept', text: spec.newConcept },
        ...(spec.orientation ?? []).map((text) => ({ where: 'orientation', text })),
      ]
      for (const step of lesson.steps.slice(0, lesson.predictionStepIndex + 1)) {
        surfaces.push({ where: `${step.id} title`, text: step.title })
        surfaces.push({ where: `${step.id} instruction`, text: step.instruction })
        if (step.rationale) surfaces.push({ where: `${step.id} rationale`, text: step.rationale })
      }
      for (const stopId of spec.stops) {
        const stop = breathStop(stopId)
        surfaces.push({
          where: `stop ${stopId}`,
          text: [
            stop.title,
            stop.plainName,
            stop.consoleLabel,
            stop.analogy,
            ...Object.values(stop.look),
            ...stop.checklist,
          ].join(' '),
        })
      }
      // Later steps show only their ordinal and phase before they are reached, so their titles are
      // not pre-commit surfaces — except the second prediction's instruction, which the learner
      // reads after the first reveal and which must not answer itself.
      const transfer = lesson.steps[lesson.transferPredictionStepIndex]
      const secondRound = ventilationExperimentByUnit.get(lesson.sectionId)!.rounds[1]
      const transferDeny = [
        new RegExp(
          secondRound.choices[secondRound.correct].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
          'i',
        ),
      ]
      for (const match of ventilationLeakMatches(
        `${transfer.title} ${transfer.instruction}`,
        transferDeny,
      )) {
        findings.push(`${lesson.sectionId}: transfer instruction matches /${match}/`)
      }
      for (const surface of surfaces) {
        for (const match of ventilationLeakMatches(surface.text, deny)) {
          findings.push(
            `${lesson.sectionId}: ${surface.where} matches /${match}/ — "${surface.text}"`,
          )
        }
      }
    }
    expect(findings).toEqual([])
  })

  it('names every Practice pairing by presentation and pairs a case its unit lists', () => {
    for (const spec of ventilationSectionSpecs) {
      const unit = ventilationLearningUnits.find((candidate) => candidate.id === spec.unitId)!
      if (spec.practicePairing) expect(unit.caseIds).toContain(spec.practicePairing.caseId)
    }
  })
})
