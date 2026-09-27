import { fireEvent, render, screen, within } from '@testing-library/react'
import { useReducer } from 'react'

import { selectCrrtCaseEvidence } from '../caseEvidence'
import { CrrtCasePlayer } from '../components/CrrtCasePlayer'
import { getBaxterCrrtCase } from '../content/completeCases'
import type { RuntimeCrrtCase } from '../content/schema'
import {
  createCrrtLearningSession,
  crrtLearningSessionReducer,
  type CrrtLearningSessionState,
} from '../engine/learningSession'
import { readAllowlistedCrrtMetric } from '../engine/outcomes'
import { selectCrrtLabEvidence } from '../labEvidence'

/**
 * CRRT-FELLOW-06 F06-01. CRRT-12 promised changing electrolyte, temperature, medication and
 * nutrition trends during an interruption, and its review action announced that "the linked
 * trends … become available". None of that exists in the case: the patient values are one
 * case-start record, every action has no effect, and the run starts with treatment running.
 * The case is now an information-gap exercise; these tests hold that line.
 */

jest.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

const definition = getBaxterCrrtCase('CRRT-12')
const ASSESS_ID = 'crrt12-action-assess'
const REVIEW_ID = 'crrt12-action-safe-candidate'
const review = definition.interventions.find(({ id }) => id === REVIEW_ID)!

/** Wording that asserts the missing serial evidence exists, changes, or arrives. */
const unsupportedClaims: readonly RegExp[] = [
  /become(s)? available/i,
  /trends? (change|changing)/i,
  /domains? change/i,
  /changing baseline/i,
  /during a period of interrupted/i,
  /alongside a period of interrupted/i,
  /integrate patient trends/i,
  /review linked trends/i,
]

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

function session(): CrrtLearningSessionState {
  return createCrrtLearningSession({
    caseDefinition: definition,
    experience: 'practice',
    roleLens: 'integrated',
    attempt: 1,
    deviceId: 'prismax-aw8035-2xx',
  })
}

function Player({ caseDefinition }: { caseDefinition: RuntimeCrrtCase }) {
  const [state, dispatch] = useReducer(
    crrtLearningSessionReducer,
    {
      caseDefinition,
      experience: 'practice' as const,
      roleLens: 'integrated' as const,
      attempt: 1,
      deviceId: 'prismax-aw8035-2xx' as const,
    },
    createCrrtLearningSession,
  )
  return (
    <CrrtCasePlayer
      session={state}
      dispatch={dispatch}
      onRoleChange={() => {}}
      onReset={() => dispatch({ type: 'RESET' })}
    />
  )
}

const cardFor = (label: string) =>
  screen
    .getAllByRole('article')
    .find((candidate) => within(candidate).queryByText(label, { exact: true }) !== null)!

const perform = (label: string) => fireEvent.click(within(cardFor(label)).getByRole('button'))

const sectionFor = (name: RegExp) =>
  screen.getByRole('heading', { name }).closest('section') as HTMLElement

beforeEach(() => window.localStorage.clear())

describe('CRRT-12 claims only the evidence it carries', () => {
  it('no learner-facing field says serial clinical trends change, exist, or arrive', () => {
    const copy = learnerCopy(definition)
    for (const pattern of unsupportedClaims) {
      expect(copy.filter((line) => pattern.test(line))).toEqual([])
    }
  })

  it('does not present an interruption as observed in this run', () => {
    // The run starts delivering and its only timed event sets delivery to running.
    expect(definition.initialDeviceOverrides?.treatmentState).toBe('running')
    for (const event of definition.timedEvents) {
      for (const effect of event.effects) {
        if (effect.target === 'device.deliveryState') expect(effect.value).toBe('running')
      }
    }
    expect(definition.patientDescription).toMatch(/no record of an earlier treatment interruption/)
    expect(definition.visibleFindings[0]).toMatch(/no earlier treatment interruption is recorded/)
  })

  it('frames the review action as a request for evidence, not its arrival', () => {
    expect(review.label).toMatch(/request/i)
    expect(review.effects).toEqual([])
    expect(review.response).toMatch(/requesting the data does not supply it/)
    expect(definition.debrief.trendReview).toMatch(/cannot attribute/)
  })
})

describe('CRRT-12 evidence scope', () => {
  const evidence = selectCrrtCaseEvidence(definition)

  it('exists and reads its supplied values from the fixture, at case start only', () => {
    expect(evidence).not.toBeNull()
    const supplied = new Map(evidence!.supplied.map((entry) => [entry.id, entry]))
    const patient = definition.initialPatient
    expect([...supplied.keys()]).toEqual(['potassium', 'bicarbonate', 'ph', 'temperature'])
    expect(supplied.get('potassium')!.valueText).toBe(
      `${patient.solutes.potassiumMmolPerL.toFixed(1)} mmol/L`,
    )
    expect(supplied.get('bicarbonate')!.valueText).toBe(
      `${patient.solutes.bicarbonateMmolPerL.toFixed(1)} mmol/L`,
    )
    expect(supplied.get('ph')!.valueText).toBe(patient.solutes.pH.toFixed(2))
    expect(supplied.get('temperature')!.valueText).toBe(
      `${patient.temperatureCelsius.toFixed(1)} °C`,
    )
    expect(supplied.get('temperature')!.valueText).toBe('35.8 °C')
    expect(supplied.get('temperature')!.sampleIdentity).toMatch(/not a temperature trend/)
    for (const entry of evidence!.supplied) {
      expect(entry.supplied).toBe(true)
      expect(entry.timePoint).toBe('At case start')
    }
  })

  it('names the serial clinical evidence as absent', () => {
    const absent = evidence!.absent.map((entry) => entry.label)
    expect(absent).toEqual([
      'Serial electrolyte and acid-base values',
      'Serial temperature',
      'Medication delivery or drug exposure over time',
      'Nutrition intake or its effect over time',
      'An earlier treatment interruption',
      'Results of a multidisciplinary reassessment',
    ])
  })

  it('lists only quantities the simulation calculates, and what it does not model', () => {
    const calculates = evidence!.modelCalculates.join(' ')
    expect(calculates).toMatch(/Delivered dose/)
    expect(calculates).toMatch(/downtime, as they actually occur in this run/)
    expect(calculates).toMatch(/whole-patient fluid ledger/)
    expect(calculates).not.toMatch(/temperature|potassium|electrolyte|medication exposure/i)
    const notModeled = evidence!.modelDoesNotModel.join(' ')
    for (const domain of [/electrolyte/, /temperature/, /medication/, /nutrition/, /attribute/]) {
      expect(notModeled).toMatch(domain)
    }
  })

  it('renders in the task before any action, with the case-start temperature', () => {
    render(<Player caseDefinition={definition} />)
    const scope = sectionFor(/What this case can show you/)
    expect(scope).toHaveTextContent('35.8 °C')
    expect(scope).toHaveTextContent('At case start')
    expect(scope).toHaveTextContent('Serial temperature')
    expect(scope).toHaveTextContent('An earlier treatment interruption')
    expect(scope).toHaveTextContent('Results of a multidisciplinary reassessment')
  })
})

describe('performing the CRRT-12 review records a plan and changes nothing else', () => {
  it('leaves the simulation state identical', () => {
    let state = crrtLearningSessionReducer(session(), {
      type: 'PERFORM_INTERVENTION',
      interventionId: ASSESS_ID,
    })
    const before = state.simulation
    state = crrtLearningSessionReducer(state, {
      type: 'PERFORM_INTERVENTION',
      interventionId: REVIEW_ID,
    })
    expect(state.performedInterventionIds).toEqual([ASSESS_ID, REVIEW_ID])
    expect(state.simulation).toEqual(before)
    expect(state.simulation.simulationTimeSeconds).toBe(0)
    expect(
      state.timeline.filter(
        (entry) => entry.type === 'intervention-performed' && entry.referenceId === REVIEW_ID,
      ),
    ).toHaveLength(1)
  })

  it('shows a response about a request, and no clinical series appears afterwards', () => {
    render(<Player caseDefinition={definition} />)
    perform('Complete the initial clinical assessment')
    perform(review.label)
    const card = cardFor(review.label)
    expect(card).toHaveTextContent('requesting the data does not supply it')
    expect(card).not.toHaveTextContent(/become available/i)

    fireEvent.click(screen.getByRole('button', { name: '+1 hr' }))
    fireEvent.click(screen.getByRole('button', { name: '+1 hr' }))
    const patient = screen
      .getByRole('heading', { name: 'Patient and delivered-therapy state' })
      .closest('section') as HTMLElement
    expect(patient).toHaveTextContent('Delivered dose')
    expect(patient).toHaveTextContent('Downtime')
    expect(patient).not.toHaveTextContent(/temperature|potassium|medication|nutrition/i)
  })
})

describe('the CRRT-12 debrief keeps the missing evidence missing', () => {
  it('records the actual action and never announces the trends', () => {
    render(<Player caseDefinition={definition} />)
    perform('Complete the initial clinical assessment')
    perform(review.label)
    fireEvent.click(screen.getByRole('button', { name: '+1 hr' }))
    fireEvent.click(screen.getByRole('button', { name: 'End run and review debrief' }))

    const actual = sectionFor(/What you did in this run/)
    expect(actual).toHaveTextContent(review.label)
    expect(actual).toHaveTextContent('Not recorded')

    const debrief = screen
      .getByRole('heading', { name: 'Causal debrief' })
      .closest('section') as HTMLElement
    for (const pattern of unsupportedClaims) {
      expect(debrief.textContent ?? '').not.toMatch(pattern)
    }
    expect(debrief).toHaveTextContent(definition.debrief.trendReview)
    expect(debrief).toHaveTextContent('requesting the data does not supply it')
    // The generic duplicate debrief removed in Batch 04 does not come back.
    expect(screen.queryByText('intervention performed')).toBeNull()
  })

  it('still withholds the internal solute pools as laboratory evidence', () => {
    let state = crrtLearningSessionReducer(session(), { type: 'ADVANCE_TIME', seconds: 7_200 })
    const labs = selectCrrtLabEvidence(state)
    expect(labs.unmodeledResponses.map(({ soluteId }) => soluteId)).toEqual(
      expect.arrayContaining(['potassium', 'bicarbonate']),
    )
    expect(readAllowlistedCrrtMetric(state.simulation, 'patient.solutes.potassiumMmolPerL')).toBe(
      null,
    )
    state = crrtLearningSessionReducer(state, { type: 'REVEAL_DEBRIEF' })
    expect(state.debriefRevealed).toBe(true)
  })
})
