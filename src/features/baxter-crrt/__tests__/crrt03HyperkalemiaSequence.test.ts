import { getBaxterCrrtCase } from '../content/completeCases'
import { CRRT_NUMBERS } from '../content/teachingNumbers'
import { createCrrtLearningSession, crrtLearningSessionReducer } from '../engine/learningSession'

/**
 * CRRT-03: a potassium of 6.9 mmol/L with a pH of 7.08, and a swollen brain.
 *
 * The case used to key "raise the dialysate and recheck" and left calcium, insulin and glucose in
 * the accepted alternative. Immediate treatment now comes first on every accepted path, the
 * dialysate-only plan is a distractor, and the lesson about a slow osmotic change stays.
 */
const definition = getBaxterCrrtCase('CRRT-03')
const N = CRRT_NUMBERS.value

const safeControl = definition.controlOptions.find(
  ({ id }) => id === definition.hiddenMechanism.correctControlOptionIds[0],
)!
const safeAction = definition.interventions.find(({ id }) => id.endsWith('action-safe-candidate'))!
const alternativeAction = definition.interventions.find(({ id }) =>
  id.endsWith('action-alternative-candidate'),
)!
const dialysateOnly = definition.interventions.find(({ id }) => id.endsWith('action-unsafe-second'))

const inOrder = (text: string, steps: readonly RegExp[]) => {
  const positions = steps.map((step) => text.search(step))
  expect(positions).not.toContain(-1)
  expect(positions).toEqual([...positions].sort((left, right) => left - right))
}

describe('CRRT-03 keys immediate potassium treatment, then controlled clearance', () => {
  const sequence = [/ECG/, /calcium/i, /insulin/i, /glucose/i, /CRRT/, /recheck/i]

  it.each([
    ['control option', safeControl.label],
    ['required action', safeAction.label],
    ['debrief', definition.debrief.requiredActionsReview],
    ['last hint', definition.hintLadder[2].text],
  ])('the %s runs ECG, calcium, insulin, glucose, CRRT, recheck in order', (_surface, text) => {
    inOrder(text, sequence)
  })

  it('leaves no accepted path without the medical treatment', () => {
    for (const label of [
      alternativeAction.label,
      ...definition.acceptedAlternativePaths.map((path) => path.label),
      definition.debrief.acceptedAlternativesReview,
    ]) {
      expect(label).toMatch(/calcium/i)
      expect(label).toMatch(/insulin/i)
      expect(label).toMatch(/glucose/i)
    }
  })

  it('makes the dialysate-only plan a distractor with its own critical error', () => {
    expect(dialysateOnly).toBeDefined()
    expect(dialysateOnly!.label).toMatch(/dialysate/i)
    expect(dialysateOnly!.label).not.toMatch(/calcium|insulin/i)
    expect(definition.requiredActionIds).not.toContain(dialysateOnly!.id)
    expect(definition.acceptedAlternativePaths.flatMap(({ actionIds }) => actionIds)).not.toContain(
      dialysateOnly!.id,
    )

    const unsafe = definition.unsafeActions.find(({ actionId }) => actionId === dialysateOnly!.id)!
    expect(unsafe.explanation).toMatch(/calcium/i)
    expect(definition.criticalErrors.map(({ id }) => id)).toContain(unsafe.criticalErrorId)

    const control = definition.controlOptions.find(({ label }) => label === dialysateOnly!.label)!
    expect(definition.hiddenMechanism.correctControlOptionIds).not.toContain(control.id)
  })

  it('records the dialysate-only plan in a run without changing the simulation', () => {
    const session = createCrrtLearningSession({
      caseDefinition: definition,
      experience: 'practice',
      roleLens: 'integrated',
      attempt: 1,
      deviceId: 'prismax-aw8035-2xx',
    })
    const after = crrtLearningSessionReducer(session, {
      type: 'PERFORM_INTERVENTION',
      interventionId: dialysateOnly!.id,
    })
    expect(after.performedInterventionIds).toContain(dialysateOnly!.id)
    expect(after.simulation).toEqual(session.simulation)
  })

  it('reassesses early, on the schedule the drugs need', () => {
    const reassessment = definition.reassessmentOptions.find(
      ({ id }) => id === definition.hiddenMechanism.correctReassessmentOptionIds[0],
    )!
    expect(safeAction.label).toMatch(/1 hour/)
    expect(reassessment.label).toContain(N('potassium-recheck'))
    expect(reassessment.label).toContain(N('glucose-checks'))
    expect(reassessment.label).toMatch(/neurological/)
    for (const text of [reassessment.label, definition.debrief.trendReview]) {
      expect(text).not.toMatch(/(in|every) a few hours|every few hours/i)
    }
  })

  it('gives the glucose the stem quotes, below the follow-on infusion trigger', () => {
    const { glucoseMgPerDl } = definition.initialPatient.solutes
    expect(glucoseMgPerDl).toBe(104)
    expect(definition.patientDescription).toContain(`glucose ${glucoseMgPerDl} mg/dL`)
    expect(glucoseMgPerDl).toBeLessThan(126)
    expect(definition.debrief.causalChain.join(' ')).toContain(N('post-insulin-glucose-trigger'))
  })

  it('shows both sources where they differ', () => {
    const chain = definition.debrief.causalChain.join(' ')
    expect(chain).toContain(N('insulin-glucose'))
    expect(chain).toContain(N('insulin-low-dose'))
    expect(chain).toContain(N('alf-sodium-recommendation'))
    expect(chain).toContain(N('alf-sodium-icp'))
    expect(definition.acceptedAlternativePaths[0].explanation).toContain(N('calcium-without-ecg'))
    expect(definition.acceptedAlternativePaths[0].explanation).toMatch(/UKKA/)
  })

  it('every number added for this case is traceable to a source the case cites', () => {
    const cited = new Set(definition.sourceBasis.map(({ id }) => id))
    const rows = CRRT_NUMBERS.rows.filter(({ checkedOn }) => checkedOn === '2026-10-31')
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      expect(row.sources.length).toBeGreaterThan(0)
      for (const source of row.sources) {
        expect(cited).toContain(source.sourceId)
        expect(source.locator.length).toBeGreaterThan(0)
      }
    }
  })
})

describe('CRRT-03 keeps its lesson about osmotic change', () => {
  it('still teaches the urea gradient and keeps a faster modality unsafe', () => {
    expect(definition.hiddenMechanism.summary).toMatch(/urea leaves blood faster than it leaves/i)
    expect(definition.debrief.causalChain.join(' ')).toMatch(/hyperosmolar/)
    expect(safeAction.label).toMatch(/stay on CRRT/i)

    const hemodialysis = definition.interventions.find(({ label }) =>
      /intermittent hemodialysis/i.test(label),
    )!
    expect(definition.unsafeActions.map(({ actionId }) => actionId)).toContain(hemodialysis.id)
    expect(hemodialysis.response).toMatch(/intracranial pressure/)
  })

  it('makes no absolute claim that the modality can never change', () => {
    expect(definition.debrief.trendReview).not.toMatch(/\bnever\b/i)
    expect(definition.debrief.trendReview).toMatch(/modality decision/)
  })
})

describe('CRRT-03 authored copy', () => {
  it('does not leak the answer with correct, incorrect or wrong', () => {
    const authored = [
      definition.patientDescription,
      ...definition.visibleFindings,
      ...definition.goalOptions.map(({ label }) => label),
      ...definition.mechanismOptions.map(({ label }) => label),
      ...definition.controlOptions.flatMap(({ label, description }) => [label, description]),
      ...definition.unsafeActions.map(({ explanation }) => explanation),
      ...definition.acceptedAlternativePaths.map(({ explanation }) => explanation),
      definition.debrief.trendReview,
      ...definition.debrief.causalChain,
    ]
    expect(authored.filter((text) => /\b(correct\w*|incorrect|wrong)\b/i.test(text))).toEqual([])
  })
})
