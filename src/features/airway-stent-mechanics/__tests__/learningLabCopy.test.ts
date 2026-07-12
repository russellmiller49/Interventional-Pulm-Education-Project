import {
  assessmentMasteryThreshold,
  forceLabMissions,
  forceTaxonomy,
  ginaDumonBenchData,
  guidedForceScenes,
  obstructionMorphologies,
  stentAssessmentItems,
  stentModuleCopy,
  tissueMechanisms,
} from '../content/learningLabCopy'
import { clinicalModuleCopy } from '../content/clinicalModuleCopy'
import { validateEvidenceRefs } from '../content/evidenceRegistry'
import { STENT_LESSON_IDS } from '../engine/learningLabTypes'

describe('airway stent learning-lab curriculum', () => {
  it('provides the six ordered, linkable clinical lessons', () => {
    expect(clinicalModuleCopy.title).toBe(
      'Airway Stent Clinical Decision Lab: Indication, Architecture, Fit & Complications',
    )
    expect(clinicalModuleCopy.lessons.map((lesson) => lesson.id)).toEqual(STENT_LESSON_IDS)
    expect(clinicalModuleCopy.lessons.map((lesson) => lesson.step)).toEqual([1, 2, 3, 4, 5, 6])
    expect(clinicalModuleCopy.estimatedMinutes).toBe(60)
    expect(clinicalModuleCopy.disclaimer).toMatch(/education|patient-specific/i)

    expect(clinicalModuleCopy.lessons[0]).toMatchObject({
      id: 'indication',
      eyebrow: 'Clinical Case 1 · Indication',
      title: 'Should this airway be stented?',
    })
    expect(clinicalModuleCopy.lessons[2]).toMatchObject({
      id: 'architecture-choice',
      eyebrow: 'Clinical Case 3 · Architecture',
      title: 'Choose an architecture, not merely a material',
    })
  })

  it('opens with three fixed free-braid guided scenes', () => {
    expect(guidedForceScenes).toHaveLength(3)
    expect(guidedForceScenes.map((scene) => scene.id)).toEqual([
      'guided-radial-compression',
      'guided-focal-ovalization',
      'guided-breathing-motion',
    ])
    expect(guidedForceScenes.map((scene) => scene.mode)).toEqual([
      'radial',
      'ovalization',
      'breathing',
    ])

    for (const scene of guidedForceScenes) {
      expect(`${scene.prompt} ${scene.teachingCue}`).toMatch(/free-crossing braid/i)
      expect(scene.teachingCue).toMatch(/visual|visible|displayed|schematic/i)
      expect(validateEvidenceRefs(scene.evidenceRefs).valid).toBe(true)
    }
  })

  it('provides three mode-specific practice missions with commit rationales', () => {
    expect(forceLabMissions).toHaveLength(3)
    expect(forceLabMissions.map((mission) => mission.id)).toEqual([
      'mission-curved-airway',
      'mission-eccentric-load',
      'mission-matched-radial',
    ])
    expect(forceLabMissions.map((mission) => mission.correctLoadMode)).toEqual([
      'bend',
      'ovalization',
      'radial',
    ])
    expect(forceLabMissions.map((mission) => mission.requiredArchitectureIds)).toEqual([
      [],
      [],
      ['free-crossing-braid', 'laser-cut-covered'],
    ])

    for (const mission of forceLabMissions) {
      expect(mission.choices).toHaveLength(3)
      expect(mission.choices.every((choice) => choice.rationale.length > 40)).toBe(true)
      expect(mission.choices.some((choice) => choice.id === mission.correctChoiceId)).toBe(true)
      expect(mission.explanation).toMatch(/cannot|not|limited|unknown/i)
      expect(validateEvidenceRefs(mission.evidenceRefs).valid).toBe(true)
    }
  })

  it('keeps guided and practice content inside the visual-geometry safety boundary', () => {
    const guidedCopy = JSON.stringify(guidedForceScenes)
    const correctMissionClaims = forceLabMissions
      .map((mission) => {
        const correctChoice = mission.choices.find(
          (choice) => choice.id === mission.correctChoiceId,
        )
        return `${correctChoice?.label} ${correctChoice?.rationale} ${mission.explanation}`
      })
      .join(' ')

    expect(guidedCopy).not.toMatch(/\b\d+(?:\.\d+)?\s*(?:N|kPa)\b/)
    expect(correctMissionClaims).not.toMatch(/clinically superior|validated higher force/i)
    expect(correctMissionClaims).toMatch(/geometry|geometric|shape|contact/i)
    expect(stentModuleCopy.disclaimer).toMatch(/force thresholds|product rankings/i)
  })

  it('starts every instructional lesson with prediction and ends with checkpoint', () => {
    const instructional = stentModuleCopy.lessons.filter(
      (lesson) => lesson.kind === 'instructional',
    )
    expect(instructional).toHaveLength(5)

    for (const lesson of instructional) {
      expect(lesson.prediction.choices.length).toBeGreaterThanOrEqual(3)
      expect(
        lesson.prediction.choices.some((choice) => choice.id === lesson.prediction.correctChoiceId),
      ).toBe(true)
      expect(lesson.prediction.reveal.length).toBeGreaterThan(80)
      expect(lesson.checkpoint.choices.length).toBeGreaterThanOrEqual(3)
      expect(
        lesson.checkpoint.choices.some((choice) => choice.id === lesson.checkpoint.correctChoiceId),
      ).toBe(true)
      expect(lesson.checkpoint.choices.every((choice) => choice.rationale.length > 20)).toBe(true)
      expect(lesson.sections.length).toBeGreaterThanOrEqual(2)
      expect(validateEvidenceRefs(lesson.prediction.evidenceRefs).valid).toBe(true)
      expect(validateEvidenceRefs(lesson.checkpoint.evidenceRefs).valid).toBe(true)
    }
  })

  it('uses six assessment cases, balanced answer positions, and full rationales', () => {
    expect(stentAssessmentItems).toHaveLength(6)
    expect(assessmentMasteryThreshold).toBe(5)

    const correctPositions = stentAssessmentItems.map((item) =>
      item.choices.findIndex((choice) => choice.id === item.correctChoiceId),
    )
    expect(correctPositions).toEqual([0, 1, 2, 2, 1, 0])
    expect(correctPositions.filter((position) => position === 0)).toHaveLength(2)
    expect(correctPositions.filter((position) => position === 1)).toHaveLength(2)
    expect(correctPositions.filter((position) => position === 2)).toHaveLength(2)

    for (const item of stentAssessmentItems) {
      expect(item.choices).toHaveLength(3)
      expect(item.choices.every((choice) => choice.rationale.length > 35)).toBe(true)
      expect(item.explanation.length).toBeGreaterThan(70)
      expect(validateEvidenceRefs(item.evidenceRefs).valid).toBe(true)
    }
  })

  it('covers the required decision domains without procedural instructions', () => {
    expect(stentAssessmentItems.map((item) => item.id)).toEqual([
      'assessment-curvature',
      'assessment-eccentric',
      'assessment-migration',
      'assessment-benign-removal',
      'assessment-fatigue-mucus',
      'assessment-y-fit',
    ])
    expect(obstructionMorphologies.map((item) => item.id)).toEqual([
      'intrinsic',
      'extrinsic',
      'mixed',
      'dynamic',
    ])
    expect(tissueMechanisms.map((item) => item.id)).toEqual([
      'pressure',
      'edge',
      'shear',
      'ingrowth',
      'mucus',
      'fatigue',
    ])
    expect(stentModuleCopy.lessons.map((lesson) => JSON.stringify(lesson)).join(' ')).not.toMatch(
      /step-by-step|deploy under|grasp the|advance the applicator/i,
    )
  })

  it('teaches force vocabulary and preserves method-bound GINA-Dumon values', () => {
    expect(forceTaxonomy.map((item) => item.id)).toEqual([
      'cof',
      'rrf',
      'radial-stiffness',
      'contact-pressure',
      'hysteresis',
    ])
    const migration = ginaDumonBenchData.find((item) => item.id === 'migration')
    expect(migration).toMatchObject({
      dumon: '12.83 ± 0.23 N',
      gina: '15.21 ± 0.59 N forward; 18.40 ± 0.51 N backward',
    })
    expect(migration?.method).toContain('16-mm-inner-diameter Teflon jig')
  })
})
