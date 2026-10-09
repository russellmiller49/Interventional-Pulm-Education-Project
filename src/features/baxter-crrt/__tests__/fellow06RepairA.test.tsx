import { fireEvent, render, screen, within } from '@testing-library/react'
import { useReducer } from 'react'

import { CrrtCasePlayer } from '../components/CrrtCasePlayer'
import { baxterCrrtCases, getBaxterCrrtCase } from '../content/completeCases'
import type { CrrtCaseId, RuntimeCrrtCase } from '../content/schema'
import { CRRT_NUMBERS } from '../content/teachingNumbers'
import { selectCrrtBloodFlowState } from '../engine/circuitDelivery'
import {
  createCrrtLearningSession,
  crrtLearningSessionReducer,
  type CrrtLearningSessionAction,
  type CrrtLearningSessionState,
} from '../engine/learningSession'
import { readAllowlistedCrrtMetric } from '../engine/outcomes'
import { selectCrrtLabEvidence } from '../labEvidence'

/**
 * CRRT-FELLOW-06 repair A (final acceptance findings F06-R01, F06-R02, F06-R03).
 *
 * R01: CRRT-03 and CRRT-04 promised a laboratory trend over time. No case models one; the
 *      laboratory values are supplied once and the internal removal-only pools stay withheld.
 * R02: the authored teaching at the end of the debrief reported a reassessment, an escalation and
 *      a recorded plan after runs that performed none of them.
 * R03: CRRT-08 and CRRT-09 described a preconnection, paused or pre-start state while their
 *      fixture is connected and delivering from the first second, and no action changes that.
 *
 * Every repair here is wording and one debrief section boundary. The engine, the fixtures and the
 * actual-run ledger are unchanged, and these tests hold both halves.
 *
 * Teaching-first revision (2026-10-08): CRRT-03, 08, 09 and 17 now state their values and key on
 * a first move. The tests keep the three truths (no promised laboratory series, a prospective
 * worked teaching, a running fixture that no action changes) and no longer require hedge wording.
 */

jest.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

function learnerCopy(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(learnerCopy)
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, nested]) =>
      key === 'sourceBasis' ? [] : learnerCopy(nested),
    )
  }
  return []
}

function newSession(caseId: CrrtCaseId): CrrtLearningSessionState {
  return createCrrtLearningSession({
    caseDefinition: getBaxterCrrtCase(caseId),
    experience: 'practice',
    roleLens: 'integrated',
    attempt: 1,
    deviceId: 'prismax-aw8035-2xx',
  })
}

function reduce(
  state: CrrtLearningSessionState,
  ...actions: readonly CrrtLearningSessionAction[]
): CrrtLearningSessionState {
  return actions.reduce(crrtLearningSessionReducer, state)
}

function Player({ initial }: { initial: CrrtLearningSessionState }) {
  const [state, dispatch] = useReducer(crrtLearningSessionReducer, initial)
  return (
    <CrrtCasePlayer
      session={state}
      dispatch={dispatch}
      onRoleChange={() => {}}
      onReset={() => dispatch({ type: 'RESET' })}
    />
  )
}

const sectionFor = (name: RegExp) =>
  screen.getByRole('heading', { name }).closest('section') as HTMLElement

const workedTeaching = () => sectionFor(/Worked teaching for this case · not a record of this run/)

const cardFor = (label: string) =>
  screen
    .getAllByRole('article')
    .find((candidate) => within(candidate).queryByText(label, { exact: true }) !== null)!

const perform = (label: string) => fireEvent.click(within(cardFor(label)).getByRole('button'))

const openDebrief = () =>
  fireEvent.click(screen.getByRole('button', { name: 'End run and review debrief' }))

const intervention = (definition: RuntimeCrrtCase, suffix: string) => {
  const match = definition.interventions.find(({ id }) => id.endsWith(suffix))
  if (!match) throw new Error(`${definition.id} has no intervention ending in ${suffix}.`)
  return match
}

beforeEach(() => window.localStorage.clear())

/* -------------------------------------------------------------------------------------------- */
/* F06-R01                                                                                      */
/* -------------------------------------------------------------------------------------------- */

/** Wording that says a laboratory or solute series exists, changes, or will follow. */
const laboratoryTrendPromises: readonly RegExp[] = [
  /serial (solute|simulated|synthetic) trend/i,
  /trend (is|are) visible/i,
  /trend changes/i,
  /later (laboratory|solute)/i,
  /laboratory trends?\b/i,
  /delayed (simulated )?laboratory/i,
  /delayed direction of laboratory/i,
  /solute response is delayed/i,
  /solute model changes/i,
  /drives the later/i,
  /observed trajectory/i,
]

describe.each(['CRRT-03', 'CRRT-04'] as const)(
  'F06-R01 · %s promises no laboratory series',
  (caseId) => {
    const definition = getBaxterCrrtCase(caseId)

    it('no learner-facing field says a laboratory or solute trend exists, changes, or follows', () => {
      const copy = learnerCopy(definition)
      for (const pattern of laboratoryTrendPromises) {
        expect(copy.filter((line) => pattern.test(line))).toEqual([])
      }
    })

    it('supplies laboratory values once and keeps the evolving chemistry withheld', () => {
      const state = reduce(newSession(caseId), { type: 'ADVANCE_TIME', seconds: 7_200 })
      const labs = selectCrrtLabEvidence(state)
      expect(labs.suppliedBaseline.length).toBeGreaterThan(0)
      expect(labs.unmodeledResponses.map(({ soluteId }) => soluteId)).toEqual(
        expect.arrayContaining(['potassium', 'bicarbonate', 'urea-marker']),
      )
      for (const metric of [
        'patient.solutes.potassiumMmolPerL',
        'patient.solutes.bicarbonateMmolPerL',
      ]) {
        expect(readAllowlistedCrrtMetric(state.simulation, metric)).toBeNull()
      }
    })

    it('reviews delivered treatment in the debrief', () => {
      expect(definition.debrief.trendReview).toMatch(/delivered/)
    })
  },
)

describe('F06-R01 · CRRT-03 states its values, keys on the dose and shows no solute series', () => {
  const definition = getBaxterCrrtCase('CRRT-03')
  const coordinate = intervention(definition, 'action-safe-candidate')

  it('states the case-start values of the fixture in the introduction, before any action', () => {
    render(<Player initial={newSession('CRRT-03')} />)
    const brief = screen.getByText(definition.patientDescription).closest('section') as HTMLElement
    const { solutes, simulatedBodyWeightKg } = definition.initialPatient
    expect(brief).toHaveTextContent(`${simulatedBodyWeightKg} kg`)
    expect(brief).toHaveTextContent(`Potassium is ${solutes.potassiumMmolPerL.toFixed(1)} mmol/L`)
    expect(brief).toHaveTextContent(`pH ${solutes.pH.toFixed(2)}`)
    expect(brief).toHaveTextContent(`bicarbonate ${solutes.bicarbonateMmolPerL} mmol/L`)
    expect(brief).not.toHaveTextContent(/trend .* visible/i)
  })

  it('records the dose plan without changing the simulation, with arithmetic that matches the fixture', () => {
    const assessed = reduce(newSession('CRRT-03'), {
      type: 'PERFORM_INTERVENTION',
      interventionId: intervention(definition, 'action-assess').id,
    })
    const planned = reduce(assessed, {
      type: 'PERFORM_INTERVENTION',
      interventionId: coordinate.id,
    })
    expect(coordinate.effects).toEqual([])
    expect(planned.simulation).toEqual(assessed.simulation)
    expect(coordinate.label).toContain(CRRT_NUMBERS.value('dose-delivered'))
    expect(coordinate.response).toMatch(/plan is recorded/)
    expect(coordinate.response).toMatch(/laboratory values are the case-start set/)
    // The dose the response quotes is the fixture's dialysate flow over its body weight.
    const dose =
      definition.initialPrescription.dialysateFlowMlPerHour /
      definition.initialPatient.simulatedBodyWeightKg
    expect(coordinate.response).toContain(`about ${dose.toFixed(1)} mL/kg/h`)
    expect(definition.debrief.trendReview).toContain(`about ${dose.toFixed(1)} mL/kg/h`)
  })

  it('keeps delivery evidence and shows no solute value after two hours', () => {
    render(<Player initial={newSession('CRRT-03')} />)
    perform('Complete the initial clinical assessment')
    perform(coordinate.label)
    expect(cardFor(coordinate.label)).toHaveTextContent(coordinate.response)
    fireEvent.click(screen.getByRole('button', { name: '+1 hr' }))
    fireEvent.click(screen.getByRole('button', { name: '+1 hr' }))
    const patient = sectionFor(/Patient and delivered-therapy state/)
    expect(patient).toHaveTextContent('Delivered dose')
    expect(patient).toHaveTextContent('Downtime')
    expect(patient).not.toHaveTextContent(/potassium|urea|bicarbonate|creatinine/i)

    openDebrief()
    // The laboratory section says the values stay at case start; the promise of a series may not
    // come back in the action notes or the worked teaching around it.
    for (const section of [sectionFor(/Action teaching notes from this run/), workedTeaching()]) {
      for (const pattern of laboratoryTrendPromises) {
        expect(section.textContent ?? '').not.toMatch(pattern)
      }
    }
    expect(sectionFor(/What you did in this run/)).toHaveTextContent(coordinate.label)
    expect(sectionFor(/Laboratory values in this case/)).toHaveTextContent(/Not modeled/)
  })
})

describe('F06-R01 · CRRT-04 keeps its machine workflow and drops the chemistry promise', () => {
  const definition = getBaxterCrrtCase('CRRT-04')

  it('still refuses the start card until the machine has recorded prime and review', () => {
    const start = intervention(definition, 'start-reviewed-treatment')
    const attempted = reduce(newSession('CRRT-04'), {
      type: 'PERFORM_INTERVENTION',
      interventionId: start.id,
    })
    expect(attempted.performedInterventionIds).not.toContain(start.id)
    expect(attempted.simulation.device.deliveryState).not.toBe('running')
    expect(start.description).toMatch(/refused whenever the machine is not ready to start/)
  })

  it('keeps every intervention id, effect and timed event of the workflow', () => {
    expect(definition.interventions.map(({ id, effects }) => [id, effects.length])).toEqual([
      ['crrt04-assess-goal', 0],
      ['crrt04-enter-blood-flow', 1],
      ['crrt04-enter-dialysate-primary', 1],
      ['crrt04-enter-dialysate-alternative', 1],
      ['crrt04-enter-machine-pfr', 1],
      ['crrt04-complete-prime-review', 0],
      ['crrt04-start-reviewed-treatment', 1],
      ['crrt04-advance-six-hours', 1],
      ['crrt04-reassess-delivery', 0],
      ['crrt04-start-before-review', 0],
      ['crrt04-equate-prescribed-delivered', 0],
    ])
    expect(definition.timedEvents.map(({ id }) => id)).toEqual([
      'crrt04-therapy-interruption',
      'crrt04-therapy-resumption',
    ])
  })

  it('describes delivery and downtime, and names what would need reassessment', () => {
    const observe = intervention(definition, 'advance-six-hours')
    expect(observe.description).toMatch(/actual treatment delivery/)
    expect(observe.description).toMatch(/Laboratory values are not modeled over time/)
    expect(definition.debrief.causalChain.at(-1)).toMatch(
      /not modeled here and needs serial clinical measurements/,
    )
    expect(definition.debrief.causalChain).toEqual(
      expect.arrayContaining([
        'Actual pump delivery accumulates only while therapy is delivered.',
        'Downtime separates prescribed from delivered intensity.',
      ]),
    )
  })

  it('renders a no-run debrief with delivery review and no laboratory-trend promise', () => {
    render(<Player initial={newSession('CRRT-04')} />)
    openDebrief()
    const teaching = workedTeaching()
    for (const pattern of laboratoryTrendPromises) {
      expect(teaching.textContent ?? '').not.toMatch(pattern)
    }
    expect(sectionFor(/Laboratory values in this case/)).toHaveTextContent(/Not modeled/)
    expect(teaching).toHaveTextContent(
      'Review prescribed dose, delivered dose, downtime, and actual effluent.',
    )
  })
})

/* -------------------------------------------------------------------------------------------- */
/* F06-R02                                                                                      */
/* -------------------------------------------------------------------------------------------- */

/** Wording that reports an action, a reassessment or a result as having happened. */
const completedRunLanguage: readonly RegExp[] = [
  /showed whether/i,
  /determined whether/i,
  /framed the goal/i,
  /plan is recorded/i,
  /recorded in the case timeline/i,
  /\bwas recorded\b/i,
  /team receives/i,
  /\byour (review|verification|coordination|plan|choice)\b/i,
  /remains paused/i,
  /reassessment (was|is) (recorded|complete)/i,
]

describe('F06-R02 · a no-action debrief reports no action, reassessment or result', () => {
  it.each(baxterCrrtCases.map(({ id }) => id))(
    '%s keeps the actual ledger empty and the worked teaching prospective',
    (caseId) => {
      render(<Player initial={newSession(caseId as CrrtCaseId)} />)
      openDebrief()

      expect(screen.getByLabelText('Debrief status')).toHaveTextContent(
        'Debrief opened · no run performed',
      )
      const actual = sectionFor(/What you did in this run/)
      // Opening the debrief is the only event; no case action or time advance sits beside it.
      expect(within(actual).getAllByRole('listitem')).toHaveLength(1)
      expect(actual).toHaveTextContent('Ended the run and opened the debrief')
      expect(actual).toHaveTextContent(/Actual reassessment\s*Not recorded\./)
      expect(screen.queryByRole('heading', { name: 'Action teaching notes from this run' })).toBe(
        null,
      )

      const teaching = workedTeaching()
      expect(teaching).toHaveTextContent(
        'They are the same after every run; what you did in this run is listed above.',
      )
      const definition = getBaxterCrrtCase(caseId as CrrtCaseId)
      expect(teaching).toHaveTextContent(definition.debrief.trendReview)
      expect(teaching).toHaveTextContent(definition.debrief.transferQuestion)
      for (const pattern of completedRunLanguage) {
        expect(teaching.textContent ?? '').not.toMatch(pattern)
      }
    },
  )

  it.each(['CRRT-01', 'CRRT-02', 'CRRT-06', 'CRRT-07', 'CRRT-11'] as const)(
    '%s states its reassessment step as what reassessing would show',
    (caseId) => {
      const chain = getBaxterCrrtCase(caseId).debrief.causalChain
      expect(chain.at(-1)).toMatch(
        /^Reassessing .+ would show whether the intended response occurred\.$/,
      )
      expect(chain[0]).toMatch(/^The clinical context frames the goal: /)
    },
  )

  it('CRRT-17 no longer says an escalation was recorded or received', () => {
    const definition = getBaxterCrrtCase('CRRT-17')
    render(<Player initial={newSession('CRRT-17')} />)
    openDebrief()
    const debrief = sectionFor(/Causal debrief/)
    expect(debrief).not.toHaveTextContent(/escalation and reassessment plan is recorded/i)
    expect(debrief).not.toHaveTextContent(/responsible team receives/i)
    expect(workedTeaching()).not.toHaveTextContent(/escalation would give|responsible team/i)
    // The case now carries both calcium values, and the worked ratio is their arithmetic.
    const { totalCalciumMgPerDl, systemicIonizedCalciumMmolPerL } =
      definition.initialPatient.solutes
    expect(totalCalciumMgPerDl).not.toBeNull()
    // The stem quotes the total in both units; they are the same value (1 mmol/L = 4.008 mg/dL).
    const quoted = definition.patientDescription.match(
      /total calcium ([\d.]+) mg\/dL \(([\d.]+) mmol\/L\)/,
    )!
    expect(Number(quoted[1])).toBe(totalCalciumMgPerDl)
    const totalMmolPerL = Number(quoted[2])
    expect((totalMmolPerL * 4.008).toFixed(1)).toBe(totalCalciumMgPerDl!.toFixed(1))
    expect(definition.debrief.trendReview).toContain(
      `${totalMmolPerL.toFixed(2)} ÷ ${systemicIonizedCalciumMmolPerL.toFixed(2)} is ${(
        totalMmolPerL / systemicIonizedCalciumMmolPerL
      ).toFixed(1)}`,
    )
    expect(totalMmolPerL / systemicIonizedCalciumMmolPerL).toBeGreaterThan(2.5)
    expect(definition.debrief.trendReview).toContain(CRRT_NUMBERS.value('calcium-ratio'))
  })

  it('no case reuses an action response as its debrief teaching paragraph', () => {
    for (const definition of baxterCrrtCases) {
      const responses = definition.interventions
        .filter(({ response }) => /\b(recorded|your)\b/i.test(response))
        .map(({ response }) => response)
      expect(responses).not.toContain(definition.debrief.trendReview)
    }
  })
})

describe('F06-R02 · a run that acted and reassessed still reads as actual', () => {
  it('CRRT-17 records the performed citrate reduction and the committed reassessment', () => {
    const definition = getBaxterCrrtCase('CRRT-17')
    const escalate = intervention(definition, 'action-safe-candidate')
    const reassessment = definition.reassessmentOptions.find(({ id }) =>
      definition.requiredReassessmentIds.includes(id),
    )!
    const state = reduce(
      newSession('CRRT-17'),
      {
        type: 'PERFORM_INTERVENTION',
        interventionId: intervention(definition, 'action-assess').id,
      },
      { type: 'PERFORM_INTERVENTION', interventionId: escalate.id },
      { type: 'ADVANCE_TIME', seconds: 3_600 },
      { type: 'COMMIT_REASSESSMENT', optionIds: [reassessment.id] },
    )
    expect(state.performedInterventionIds).toContain(escalate.id)
    expect(state.reassessment.committed).toBe(true)

    render(<Player initial={state} />)
    openDebrief()
    expect(screen.getByLabelText('Debrief status')).toHaveTextContent(
      /recorded events? in this run/,
    )
    const actual = sectionFor(/What you did in this run/)
    expect(actual).toHaveTextContent(escalate.label)
    expect(actual).toHaveTextContent(reassessment.label)
    expect(actual).not.toHaveTextContent('Not recorded. The reassessment below')

    // The performed action's own response is real and stays in the actual-action notes.
    const notes = sectionFor(/Action teaching notes from this run/)
    expect(escalate.label).not.toMatch(/escalat/i)
    expect(notes).toHaveTextContent(escalate.response)
    // The worked teaching below it stays prospective either way.
    for (const pattern of completedRunLanguage) {
      expect(workedTeaching().textContent ?? '').not.toMatch(pattern)
    }
  })

  it('CRRT-11 records a real fluid-removal change, its time, and the reassessment', () => {
    const definition = getBaxterCrrtCase('CRRT-11')
    const reduceRemoval = intervention(definition, 'action-safe-candidate')
    const reassessment = definition.reassessmentOptions.find(({ id }) =>
      definition.requiredReassessmentIds.includes(id),
    )!
    const fresh = newSession('CRRT-11')
    const state = reduce(
      fresh,
      {
        type: 'PERFORM_INTERVENTION',
        interventionId: intervention(definition, 'action-assess').id,
      },
      { type: 'PERFORM_INTERVENTION', interventionId: reduceRemoval.id },
      { type: 'ADVANCE_TIME', seconds: 3_600 },
      { type: 'COMMIT_REASSESSMENT', optionIds: [reassessment.id] },
    )
    expect(reduceRemoval.effects.length).toBeGreaterThan(0)
    expect(state.simulation.prescription).not.toEqual(fresh.simulation.prescription)

    render(<Player initial={state} />)
    openDebrief()
    const actual = sectionFor(/What you did in this run/)
    expect(actual).toHaveTextContent(reduceRemoval.label)
    expect(actual).toHaveTextContent(reassessment.label)
    expect(sectionFor(/Action teaching notes from this run/)).toHaveTextContent(
      reduceRemoval.response,
    )
    expect(workedTeaching()).toHaveTextContent(/would show whether the intended response occurred/)
  })
})

/* -------------------------------------------------------------------------------------------- */
/* F06-R03                                                                                      */
/* -------------------------------------------------------------------------------------------- */

/** Chronology the running fixture contradicts. */
const falseChronology: readonly RegExp[] = [
  /^Before connection,/,
  /^Before treatment starts/i,
  /remains paused/i,
  /setup paused/i,
  /before simulated connection/i,
  /precedes simulated connection/i,
]

describe.each(['CRRT-08', 'CRRT-09'] as const)(
  'F06-R03 · %s narrative agrees with its running fixture',
  (caseId) => {
    const definition = getBaxterCrrtCase(caseId)
    const verify = intervention(definition, 'action-safe-candidate')

    it('starts connected and delivering at 150 mL/min, as it did before this repair', () => {
      const { simulation } = newSession(caseId)
      const flow = selectCrrtBloodFlowState(simulation)
      expect(simulation.device.deliveryState).toBe('running')
      expect(simulation.device.patientConnected).toBe(true)
      expect(flow.status).toBe('delivering')
      expect(flow.actualMlMin).toBe(150)
      expect(definition.initialDeviceOverrides?.treatmentState).toBe('running')
    })

    it('has no action that stops, pauses or otherwise changes the simulation', () => {
      expect(definition.interventions.every(({ effects }) => effects.length === 0)).toBe(true)
      const assessed = reduce(newSession(caseId), {
        type: 'PERFORM_INTERVENTION',
        interventionId: intervention(definition, 'action-assess').id,
      })
      const verified = reduce(assessed, { type: 'PERFORM_INTERVENTION', interventionId: verify.id })
      expect(verified.performedInterventionIds).toContain(verify.id)
      expect(verified.simulation).toEqual(assessed.simulation)

      const later = reduce(verified, { type: 'ADVANCE_TIME', seconds: 7_200 })
      expect(later.simulation.device.deliveryState).toBe('running')
      expect(later.simulation.deliveredTherapy.cumulativeDowntimeSeconds).toBe(0)
      expect(selectCrrtBloodFlowState(later.simulation).actualMlMin).toBe(150)
    })

    it('no learner-facing field claims a preconnection, pre-start or paused state', () => {
      const copy = learnerCopy(definition)
      for (const pattern of falseChronology) {
        expect(copy.filter((line) => pattern.test(line))).toEqual([])
      }
    })

    it('tells the learner on the action card that the machine keeps running, before and after the action', () => {
      expect(verify.description).toMatch(/machine beside the case keeps running as it is/)
      expect(verify.response).toMatch(/is recorded\. The machine beside this case/)
      expect(verify.response).not.toMatch(/remains (paused|unavailable)/)

      render(<Player initial={newSession(caseId)} />)
      expect(cardFor(verify.label)).toHaveTextContent(verify.description)
      perform('Complete the initial clinical assessment')
      perform(verify.label)
      expect(cardFor(verify.label)).toHaveTextContent(verify.response)
      fireEvent.click(screen.getByRole('button', { name: '+1 hr' }))
      openDebrief()
      const actual = sectionFor(/What you did in this run/)
      expect(actual).toHaveTextContent(verify.label)
      expect(actual).toHaveTextContent('150 mL/min')
      const debrief = sectionFor(/Causal debrief/)
      for (const pattern of falseChronology) {
        expect(debrief.textContent ?? '').not.toMatch(pattern)
      }
    })
  },
)

describe('F06-R03 · the educational objective survives the reframing', () => {
  it('CRRT-08 still teaches verification that belongs before connection', () => {
    const definition = getBaxterCrrtCase('CRRT-08')
    expect(definition.learningObjectives[0]).toMatch(
      /^Run the pre-connection check in a fixed order/,
    )
    expect(definition.debrief.trendReview).toMatch(/repeat the whole check/)
    expect(definition.debrief.requiredActionsReview).toMatch(/^Stop before connecting/)
  })

  it('CRRT-09 teaches the registered calcium targets and adds no medication behavior', () => {
    const definition = getBaxterCrrtCase('CRRT-09')
    for (const id of ['postfilter-ica', 'postfilter-ica-ceiling', 'systemic-ica'] as const) {
      expect(definition.debrief.trendReview).toContain(CRRT_NUMBERS.value(id))
    }
    expect(definition.debrief.trendReview).toContain(CRRT_NUMBERS.value('citrate-monitoring'))
    // No drug dose is taught and no action changes the simulated circuit.
    expect(
      learnerCopy(definition).filter((line) => /\b(units?\/|mg\/kg|mmol\/L citrate)/i.test(line)),
    ).toEqual([])
    expect(definition.interventions.every(({ effects }) => effects.length === 0)).toBe(true)
  })
})
