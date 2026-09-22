/**
 * ECMO-FELLOW-02 — what the learner reads agrees with the state that produced it.
 *
 * The engine half of this batch is in `ecmo-fellow-02-causality-and-time.test.ts`. This file holds
 * the surfaces: the debrief's named reading pairs and untreated replay (C1-3, C2-1), the Practice
 * clock and presentation labels, the reassessment's statement of what the monitor cannot show
 * (C1-1, C3-2, VAC2-1), mode-true monitor notes (VAC6-1), the Learn clock (S17-4), and the copy
 * repairs where a sentence claimed more than the model does.
 */
import { fireEvent, render, screen, within } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import { PatientMonitor } from '../components/CircuitAndMonitors'
import { ReassessmentPanel, ClinicalCaseBrief } from '../components/PracticeCasePlayer'
import { EcmoCaseDebrief } from '../components/practice/EcmoCaseDebrief'
import {
  EcmoPracticeCaseView,
  type EcmoPracticeCaseViewProps,
} from '../components/practice/EcmoPracticeActivity'
import { buildDebriefTimeline } from '../components/practice/debriefTimeline'
import { OxygenDeliveryExplorer } from '../components/teaching/OxygenDeliveryExplorer'
import { VvNormalStatePanel } from '../components/teaching/VvNormalStatePanel'
import { VvSeriesPhysiologyPanel } from '../components/teaching/VvSeriesPhysiologyPanel'
import { clinicalPracticeScenarioById, clinicalPracticeScenarios } from '../content/clinicalCases'
import { ecmoFoundationLearningItemsFor } from '../content/foundationLearningItems'
import {
  ecmoFoundationLessonRuntime,
  ecmoFoundationVariant,
} from '../content/foundationLessonRuntime'
import { cardiohelpLearnLessons } from '../content/learnLessons'
import { resolveScenarioReassessment } from '../content/practiceSupport'
import { cardiohelpScenarioById } from '../content/scenarios'
import {
  createDefaultProgress,
  createInitialSimulationState,
  createReferenceSimulationState,
  ecmoSimulationReducer,
  replayWithoutAction,
  selectScenarioOutcome,
} from '../engine'
import type { EcmoSimulationState, ScenarioDefinition, SimulationAction } from '../engine/types'
import {
  createEcmoFoundationSessionState,
  ecmoFoundationRestoreAction,
  ecmoFoundationSessionReducer,
} from '../session/foundationSession'

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...rest
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string; query?: Record<string, string> }
    children: ReactNode
  }) => (
    <a
      href={typeof href === 'string' ? href : `${href.pathname}?${new URLSearchParams(href.query)}`}
      {...rest}
    >
      {children}
    </a>
  ),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn() }),
  usePathname: () => '/cardiohelp-ecmo/practice',
}))

function run(scenarioId: string, actions: readonly SimulationAction[]): EcmoSimulationState {
  return actions.reduce(ecmoSimulationReducer, createInitialSimulationState(scenarioId, 'guided'))
}

function scenarioOf(state: EcmoSimulationState): ScenarioDefinition {
  const scenario =
    clinicalPracticeScenarioById.get(state.scenario.scenarioId) ??
    cardiohelpScenarioById.get(state.scenario.scenarioId)
  if (!scenario) throw new Error(`missing ${state.scenario.scenarioId}`)
  return scenario
}

const steps = (count: number): SimulationAction[] =>
  Array.from({ length: count }, () => ({ type: 'STEP' }))

const card = (interventionId: string): SimulationAction => ({
  type: 'APPLY_CLINICAL_INTERVENTION',
  interventionId,
})

const VV_START: readonly SimulationAction[] = [
  card('vv-readiness-check'),
  card('vv-connect-circuit'),
  { type: 'SET_RPM', rpm: 3200 },
  { type: 'SET_SWEEP', sweep: 4 },
  { type: 'SET_GAS_FIO2', fio2: 1 },
  { type: 'START_ECMO' },
]

describe('A · the debrief compares named, immutable reading pairs (C1-3, C2-1)', () => {
  it('records what each action found and produced, at the second it was taken', () => {
    const started = run('clinical-vv-initiation-ards', VV_START)
    const start = started.scenario.clinical?.appliedInterventions.find(
      (record) => record.interventionId === 'start-ecmo',
    )
    expect(start?.observation?.before.time).toBe(0)
    expect(start?.observation?.after.time).toBe(0)
    expect(start?.observation?.before.bloodFlow).toBe(0)
    expect(start?.observation?.after.bloodFlow).toBeCloseTo(4.05, 2)
    // Missing stays missing: a stopped circuit's drainage pressure is not shown, not invented.
    expect(start?.observation?.before.pVen).toBeNull()
    expect(start?.observation?.after.pVen).not.toBeNull()
  })

  it('never rewrites an action’s readings as the simulation runs on', () => {
    const started = run('clinical-vv-initiation-ards', VV_START)
    const later = [...steps(10)].reduce(ecmoSimulationReducer, started)
    expect(later.scenario.clinical?.appliedInterventions).toEqual(
      started.scenario.clinical?.appliedInterventions,
    )
  })

  it('starting support reads as the flow change it was, with the same-second actions grouped', () => {
    const state = run('clinical-vv-initiation-ards', [
      ...VV_START,
      ...steps(6),
      { type: 'REVEAL_DEBRIEF' },
    ])
    const view = render(
      <EcmoCaseDebrief
        state={state}
        scenario={scenarioOf(state)}
        outcome={selectScenarioOutcome(state)}
        supportMode="vv"
        onReplay={jest.fn()}
      />,
    )
    const text = view.container.textContent ?? ''
    expect(text).toContain('Circuit flow 0.00 → 4.05 L/min')
    expect(text).not.toContain('Circuit flow: unchanged')
    expect(text).toMatch(/3 actions in the same modeled second; the clock did not\s+advance/)
    const group = view.container.querySelector('[data-debrief-group="0"]')
    expect(group).not.toBeNull()
    expect(within(group as HTMLElement).getByText(/This run, 0 → 6 s/)).toBeInTheDocument()
    expect(
      within(group as HTMLElement).getByText(/Same case left untreated from the start/),
    ).toBeInTheDocument()
  })

  it('a transfusion’s MAP change is shown over the interval that carried it, beside the untreated case', () => {
    const state = run('clinical-vv-occult-hemorrhage', [
      { type: 'SET_RPM', rpm: 3200 },
      card('hemorrhage-search'),
      card('hemorrhage-prbc'),
      ...steps(4),
      card('hemorrhage-source-control'),
      ...steps(4),
      { type: 'REVEAL_DEBRIEF' },
    ])
    const [first] = buildDebriefTimeline(state)
    expect(first.time).toBe(0)
    expect(first.intervalSeconds).toBe(4)
    const map = first.interval?.find((change) => change.label === 'MAP')
    expect(map).toMatchObject({ before: '54', after: '65', changed: true })
    const untreatedMap = first.untreated?.find((change) => change.label === 'MAP')
    // Left alone, the same case's MAP falls over the same four seconds.
    expect(Number(untreatedMap?.after)).toBeLessThan(54)
  })

  it('the untreated line is the deterministic replay of the same case', () => {
    const replay = replayWithoutAction('clinical-vv-recirculation-migration', [0, 4, 10])
    const manual = [...steps(10)].reduce(
      ecmoSimulationReducer,
      createInitialSimulationState('clinical-vv-recirculation-migration', 'guided'),
    )
    expect(replay.get(10)?.spo2).toBe(manual.patient.spo2)
    expect(replay.get(0)?.spo2).toBe(78)
    expect(replayWithoutAction('clinical-vv-recirculation-migration', [0, 4, 10])).toEqual(replay)
  })

  it('names the key as the response this case expects, not as the response the model showed', () => {
    const state = run('clinical-vv-tension-pneumothorax', [
      card('tension-pocus'),
      card('tension-decompress'),
      ...steps(4),
      {
        type: 'COMMIT_REASSESSMENT',
        answers: {
          deviceOptionId: 'tension-device-correct',
          circuitOptionId: 'tension-circuit-correct',
          patientOptionId: 'tension-patient-correct',
        },
      },
      { type: 'REVEAL_DEBRIEF' },
    ])
    const view = render(
      <EcmoCaseDebrief
        state={state}
        scenario={scenarioOf(state)}
        outcome={selectScenarioOutcome(state)}
        supportMode="vv"
        onReplay={jest.fn()}
      />,
    )
    const text = view.container.textContent ?? ''
    expect(text).not.toMatch(/Modeled response:|this is the modeled response/)
    expect(text).toContain('this is the response this case expects')
    expect(view.container.querySelector('[data-model-boundary="response"]')?.textContent).toMatch(
      /does not model blood pressure recovering after the chest is decompressed/,
    )
  })
})

describe('B · Practice says what its clock and its brief are', () => {
  function renderCase(state: EcmoSimulationState) {
    const scenario = scenarioOf(state)
    const props: EcmoPracticeCaseViewProps = {
      section: 'practice',
      state,
      scenario,
      outcome: selectScenarioOutcome(state),
      progress: createDefaultProgress(),
      supportMode: scenario.supportMode,
      activityMode: 'practice',
      dispatch: jest.fn(),
      onLoadScenario: jest.fn(),
      onSelectTrack: jest.fn(),
      onReveal: jest.fn(),
      onSaveAndExit: jest.fn(),
      onReset: jest.fn(),
    }
    return render(<EcmoPracticeCaseView {...props} />)
  }

  it('counts modeled seconds and says they are compressed', () => {
    const view = renderCase(createInitialSimulationState('clinical-vv-recirculation-migration'))
    const clock = view.container.querySelector('[aria-label="Simulation clock"]')
    expect(clock?.textContent).toContain('0 modeled s')
    expect(clock?.querySelector('[data-time-scale]')?.textContent).toMatch(
      /compressed.*not a bedside time course/,
    )
  })

  it('stops at the reveal and says so, with the clock controls off', () => {
    const view = renderCase(
      run('clinical-vv-recirculation-migration', [...steps(2), { type: 'REVEAL_DEBRIEF' }]),
    )
    const clock = view.container.querySelector('[aria-label="Simulation clock"]') as HTMLElement
    expect(clock.textContent).toContain('stopped at the reveal')
    for (const button of within(clock).getAllByRole('button')) expect(button).toBeDisabled()
  })

  it('labels the brief’s numbers as the presentation, not the live monitor (C2-1, C5-2)', () => {
    const state = createInitialSimulationState('clinical-vv-recirculation-migration')
    render(<ClinicalCaseBrief state={state} scenario={scenarioOf(state)} />)
    expect(screen.getByLabelText('Case data at presentation')).toBeInTheDocument()
    expect(document.querySelector('[data-presentation-note]')?.textContent).toMatch(
      /At presentation/,
    )
  })

  it.each([
    ['clinical-vv-initiation-ards', /Work of breathing and respiratory rate are not modeled/],
    ['clinical-vv-tension-pneumothorax', /does not model blood pressure recovering/],
    ['va-clinical-tamponade', /holds pulse pressure at the value the case opened with/],
  ])(
    '%s: the reassessment says, before the choice, what this monitor cannot show',
    (caseId, boundary) => {
      const state = createInitialSimulationState(caseId)
      render(
        <ReassessmentPanel
          state={state}
          scenario={scenarioOf(state)}
          dispatch={jest.fn()}
          onReveal={jest.fn()}
          stageNumber={4}
          onShowStage={jest.fn()}
        />,
      )
      expect(document.querySelector('[data-model-boundary="response"]')?.textContent).toMatch(
        boundary,
      )
    },
  )

  it('keys are unchanged: every clinical case still expects the same options', () => {
    // A boundary note is not a re-key.
    const keys = clinicalPracticeScenarios.map((scenario) => {
      const reassessment = resolveScenarioReassessment(scenario)
      return [
        scenario.id,
        reassessment.device.correctOptionId,
        reassessment.circuit.correctOptionId,
        reassessment.patient.correctOptionId,
      ]
    })
    expect(keys).toEqual(
      clinicalPracticeScenarios.map((scenario) => [
        scenario.id,
        scenario.reassessment?.device.correctOptionId,
        scenario.reassessment?.circuit.correctOptionId,
        scenario.reassessment?.patient.correctOptionId,
      ]),
    )
  })
})

describe('C · monitor notes are true for the mode they render in (VAC6-1)', () => {
  it('the limb case describes its own story; another VA case keeps the held-limb note', () => {
    const limb = render(
      <PatientMonitor state={createInitialSimulationState('va-clinical-limb-ischemia')} />,
    )
    expect(
      limb.container.querySelector('[data-local-model-boundary="limb-perfusion-case-story"]'),
    ).not.toBeNull()
    expect(
      limb.container.querySelector('[data-local-model-boundary="limb-perfusion-fixed"]'),
    ).toBeNull()
    limb.unmount()

    const tamponade = render(
      <PatientMonitor state={createInitialSimulationState('va-clinical-tamponade')} />,
    )
    expect(
      tamponade.container.querySelector('[data-local-model-boundary="limb-perfusion-fixed"]'),
    ).not.toBeNull()
  })

  it('heart rate and work of breathing say they are held rather than modeled', () => {
    const view = render(
      <PatientMonitor state={createInitialSimulationState('clinical-vv-tension-pneumothorax')} />,
    )
    expect(
      view.container.querySelector('[data-local-model-boundary="heart-rate-not-modeled"]'),
    ).not.toBeNull()
    expect(
      view.container.querySelector('[data-local-model-boundary="breathing-held"]'),
    ).not.toBeNull()
  })
})

describe('D · the Learn clock starts only when the learner starts it (S17-4)', () => {
  const runtime = ecmoFoundationLessonRuntime('vv-integration-capstone')
  const held = ecmoFoundationVariant(runtime, 'vv', 'gas-source-before-change')!
  const evolved = ecmoFoundationVariant(runtime, 'vv', 'gas-source-after-change')!
  const preview = ecmoFoundationVariant(runtime, 'vv', 'recirculation-preview')!

  it('revealing the evolved state or loading a preview leaves a held clock held', () => {
    const opened = createEcmoFoundationSessionState(held)
    expect(opened.clockRunning).toBe(false)
    const revealed = ecmoFoundationSessionReducer(opened, ecmoFoundationRestoreAction(evolved))
    expect(revealed.clockRunning).toBe(false)
    const previewed = ecmoFoundationSessionReducer(revealed, ecmoFoundationRestoreAction(preview))
    expect(previewed.clockRunning).toBe(false)
  })

  it('the learner’s own start is kept across a restore, and a held variant still re-holds it', () => {
    const started = ecmoFoundationSessionReducer(createEcmoFoundationSessionState(held), {
      type: 'SET_CLOCK_RUNNING',
      running: true,
    })
    const previewed = ecmoFoundationSessionReducer(started, ecmoFoundationRestoreAction(preview))
    expect(previewed.clockRunning).toBe(true)
    const reheld = ecmoFoundationSessionReducer(previewed, ecmoFoundationRestoreAction(held))
    expect(reheld.clockRunning).toBe(false)
  })
})

describe('E · teaching copy says what the model does', () => {
  it('S5-1: the baseline change names the reading it is measured from', () => {
    let state = createReferenceSimulationState('vv-reference')
    state = [...steps(8)].reduce(ecmoSimulationReducer, state)
    const view = render(<VvNormalStatePanel state={state} snapshot={null} />)
    expect(view.container.textContent).toMatch(/as it read at 0 modeled s/)
    // And the settled reference reports no drift against it.
    expect(view.container.textContent).not.toMatch(/\+2\.6|\+3\.2/)
  })

  it('S6-2: the recirculating share is one percentage everywhere, and the table names its state', () => {
    const state = createReferenceSimulationState('vv-reference')
    const view = render(<VvSeriesPhysiologyPanel state={state} />)
    const text = view.container.textContent ?? ''
    expect(text).toContain('8.0% of drainage')
    expect(text).not.toMatch(/of every 100 parts/)
    // The headline tile and the series path use the percentage; the mixing formula keeps its
    // fraction and says which percentage it is.
    expect(
      view.container.querySelector('[data-series-signal="recirculation-fraction"]')?.textContent,
    ).toContain('8.0% of drainage')
    expect(text).toMatch(
      /the 8\.0% of drainage shown above, written as the fraction this formula takes/,
    )
    expect(view.container.querySelector('[data-comparison-state]')?.textContent).toMatch(
      /stable vv reference circuit/i,
    )
  })

  it('S1-5: halving the cardiac output says which value was set and what delivery became', () => {
    let state = createReferenceSimulationState('vv-reference')
    state = [...steps(8)].reduce(ecmoSimulationReducer, state)
    render(<OxygenDeliveryExplorer state={state} sourceIds={[]} />)
    expect(screen.getByLabelText(/Arterial oxygen saturation/i)).toHaveAttribute(
      'aria-valuetext',
      expect.stringContaining('%'),
    )
    fireEvent.click(screen.getByRole('button', { name: /Halve the cardiac output/i }))
    expect(document.querySelector('[data-delivery-nearest-step]')?.textContent).toMatch(
      /nearest step,\s*2\.3.*rather than exactly half/s,
    )
    expect(document.querySelector('[data-delivery-total]')?.parentElement?.textContent).toMatch(
      /51% of it/,
    )
  })

  it('S3-3: the reversed-direction option is graded by its own rationale', () => {
    const pump = ecmoFoundationLearningItemsFor('pump-and-pressure-zones')
    const choice = pump.prediction.choices.find((item) => item.id === 'flow-down-more-suction')
    expect(choice?.plausibility).toBe('incorrect-mechanism')
    expect(pump.prediction.correctChoiceIds).toEqual(['flow-down-drainage-less-negative'])
  })

  it('IA-3: recognition-only wording no longer claims a correction', () => {
    const fallback = resolveScenarioReassessment(
      cardiohelpScenarioById.get('va-mixed-circulation-capstone')!,
    )
    const text = JSON.stringify(fallback)
    expect(text).not.toMatch(/after the cause was addressed|after correction|judges resolution/)
    const differential = resolveScenarioReassessment(
      clinicalPracticeScenarioById.get('va-clinical-differential-hypoxemia')!,
    )
    expect(JSON.stringify(differential)).not.toMatch(
      /configuration is revised|problem is addressed|support strategy is revised/,
    )
  })

  it('S11-2: transfer steps name the setting they complete on and promise no unadvanced response', () => {
    const text = JSON.stringify(cardiohelpLearnLessons)
    expect(text).not.toMatch(
      /by one small step|by one bounded step|re-read after the model responds/,
    )
  })

  it('VAC3-1: the vasoplegia speed card does not claim chatter the model does not produce', () => {
    const vasoplegia = clinicalPracticeScenarioById.get('va-clinical-vasoplegia')!
    const card = vasoplegia.clinicalCase?.interventions.find(
      (item) => item.id === 'vasoplegia-more-rpm',
    )
    expect(card?.response).not.toMatch(/chatter begins/)
    const after = run('va-clinical-vasoplegia', [{ type: 'SET_RPM', rpm: 4200 }, ...steps(4)])
    expect(after.circuit.drainageChatter).toBe(false)
  })
})
