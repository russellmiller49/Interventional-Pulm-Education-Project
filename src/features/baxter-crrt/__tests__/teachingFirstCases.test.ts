import {
  baxterCrrtCases,
  CRRT_TEACHING_FIRST_CASE_COPY,
  getBaxterCrrtCase,
} from '../content/completeCases'
import { baxterCrrtRapidDrills } from '../content/rapidDrills'
import type { RuntimeCrrtCase } from '../content/schema'

/**
 * docs/teaching-first-rules.md, applied to the eighteen cases and the five rapid drills.
 *
 * The cases key on the first move and state their numbers; review status, deferrals and per-case
 * boundary notes are project metadata and stay out of what a learner reads. These checks are lint
 * over the built cases: a failure names the offending string, and the fix is in the copy.
 */

/** Text exactly as it sits inside `JSON.stringify`, so quotes and backslashes compare equal. */
const inJson = (text: string) => JSON.stringify(text).slice(1, -1)

/** Every field of a case that the player, the worked example or the debrief renders. */
function renderedLearnerFields(definition: RuntimeCrrtCase): { field: string; text: string }[] {
  const fields: { field: string; text: string }[] = []
  const add = (field: string, text: string | undefined) => {
    if (typeof text === 'string') fields.push({ field: `${definition.id} ${field}`, text })
  }
  add('title', definition.title)
  add('patientDescription', definition.patientDescription)
  definition.learningObjectives.forEach((text, index) => add(`learningObjectives[${index}]`, text))
  definition.visibleFindings.forEach((text, index) => add(`visibleFindings[${index}]`, text))
  add('hiddenMechanism.summary', definition.hiddenMechanism.summary)
  definition.hiddenMechanism.causalChain.forEach((text, index) =>
    add(`hiddenMechanism.causalChain[${index}]`, text),
  )
  for (const intervention of definition.interventions) {
    add(`interventions[${intervention.id}].label`, intervention.label)
    add(`interventions[${intervention.id}].description`, intervention.description)
    add(`interventions[${intervention.id}].response`, intervention.response)
  }
  for (const unsafe of definition.unsafeActions) {
    add(`unsafeActions[${unsafe.id}].explanation`, unsafe.explanation)
  }
  for (const criticalError of definition.criticalErrors) {
    add(`criticalErrors[${criticalError.id}].label`, criticalError.label)
    add(`criticalErrors[${criticalError.id}].explanation`, criticalError.explanation)
  }
  for (const hint of definition.hintLadder) add(`hintLadder[${hint.id}].text`, hint.text)
  add('debrief.summary', definition.debrief.summary)
  add('debrief.trendReview', definition.debrief.trendReview)
  definition.debrief.causalChain.forEach((text, index) =>
    add(`debrief.causalChain[${index}]`, text),
  )
  add('debrief.transferQuestion', definition.debrief.transferQuestion)
  for (const option of definition.reassessmentOptions) {
    add(`reassessmentOptions[${option.id}].label`, option.label)
  }
  return fields
}

describe('teaching-first case copy', () => {
  const built = JSON.stringify(baxterCrrtCases)

  it('has a replacement table to check', () => {
    expect(CRRT_TEACHING_FIRST_CASE_COPY.length).toBeGreaterThan(0)
    for (const [original, replacement] of CRRT_TEACHING_FIRST_CASE_COPY) {
      expect(original).not.toBe(replacement)
      expect(replacement.trim().length).toBeGreaterThan(0)
    }
  })

  it('applies every replacement: the new wording is in the built cases', () => {
    const missing = CRRT_TEACHING_FIRST_CASE_COPY.filter(
      ([, replacement]) => !built.includes(inJson(replacement)),
    ).map(([original, replacement]) => ({ original, replacement }))
    expect(missing).toEqual([])
  })

  it('leaves none of the replaced wording behind', () => {
    const surviving = CRRT_TEACHING_FIRST_CASE_COPY.filter(
      ([original]) => original.length > 12 && built.includes(inJson(original)),
    ).map(([original]) => original)
    expect(surviving).toEqual([])
  })

  it('renders no review status, deferral or boundary phrase in any learner field of any case', () => {
    const refused =
      /\b(synthetic|authored|not (been )?clinically reviewed|review of this case rule|responsible (clinical )?team|local policy)\b/i
    const offending = baxterCrrtCases
      .flatMap(renderedLearnerFields)
      .filter(({ text }) => refused.test(text))
    expect(offending).toEqual([])
  })
})

describe('the eight narrative cases key on a first move', () => {
  const narrativeCaseIds = [
    'CRRT-03',
    'CRRT-08',
    'CRRT-09',
    'CRRT-12',
    'CRRT-14',
    'CRRT-16',
    'CRRT-17',
    'CRRT-18',
  ] as const

  it.each(narrativeCaseIds)(
    '%s: the required action is something the fellow does, not a hand-off',
    (caseId) => {
      const definition = getBaxterCrrtCase(caseId)
      const required = definition.interventions.filter(
        (intervention) =>
          definition.requiredActionIds.includes(intervention.id) &&
          intervention.category !== 'assessment' &&
          intervention.category !== 'communication',
      )
      expect(required.length).toBeGreaterThan(0)
      const handOffs = required
        .filter(({ label }) => /\bescalat|\bcoordinate\b|^verify\b/i.test(label))
        .map(({ id, label }) => ({ id, label }))
      expect(handOffs).toEqual([])
    },
  )
})

describe('rapid drills key on a first move and teach the correction', () => {
  it.each(baxterCrrtRapidDrills.map((drill) => [drill.id, drill] as const))('%s', (_id, drill) => {
    const safe = drill.predictionOptions.filter((option) => option.disposition === 'safe')
    expect(safe).toHaveLength(1)
    expect(safe[0].id).toBe(drill.candidateCauseOptionId)
    expect(safe[0].label).not.toMatch(/escalat/i)
    expect(drill.correctionBoundary.trim().length).toBeGreaterThan(0)
    expect(drill.correctionBoundary).not.toMatch(/local policy|does not teach/i)
  })
})
