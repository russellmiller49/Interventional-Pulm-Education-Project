/**
 * M4 — the nine live teaching panels.
 *
 * Two kinds of test live here and they are deliberately different in what they drive.
 *
 * The panel tests render one panel against a state the *reducer* produced from the section's own
 * authored starting actions and its own authored learner action. Nothing is hand-built: a fabricated
 * metrics object would let a panel pass while the state a learner can actually reach makes it print
 * something else.
 *
 * The workspace tests render the whole workbench, because prediction integrity is a claim about the
 * DOM a learner is looking at, not about a component in isolation. Answer leakage is tested by
 * asserting the withheld sentences are *absent from the document*, never by asking whether they are
 * visible — content hidden with a stylesheet is still content.
 */
import { render, screen, fireEvent, within } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

const mockRouterPush = jest.fn()

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...rest
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: mockRouterPush }),
}))

jest.mock('../components/McsAnatomy3D', () => {
  const { McsAnatomyPathwaySummary } = jest.requireActual<
    typeof import('../components/McsAnatomyPathwaySummary')
  >('../components/McsAnatomyPathwaySummary')
  return {
    McsAnatomy3D: ({
      state,
      highlightTarget,
    }: {
      state: Parameters<typeof McsAnatomyPathwaySummary>[0]['state']
      highlightTarget?: Parameters<typeof McsAnatomyPathwaySummary>[0]['highlightTarget']
    }) => (
      <section aria-label="Animated mechanical-support anatomy">
        <McsAnatomyPathwaySummary state={state} highlightTarget={highlightTarget} />
      </section>
    ),
  }
})

import { assertTeachingPanelContract } from '@/features/critical-care/test-support/teachingPanelContract'

import { McsWorkbench } from '../components/McsWorkbench'
import { McsLearnTeachingPane } from '../components/McsLearnTeachingPane'
import {
  McsTeachingPanel,
  mcsTeachingPanelSectionIds,
  validateMcsTeachingPanelRegistry,
} from '../components/teaching/McsTeachingPanel'
import {
  MCS_DISPLAY_DEADBANDS,
  MCS_MEASURED_IDLE_DRIFT,
  deadbandFor,
} from '../components/teaching/selectors'
import {
  MCS_REVEAL_STAGES,
  mcsComparesAgainstActionBaseline,
  mcsMechanismDisclosed,
  mcsRevealStage,
  type McsRevealStage,
} from '../components/teaching/revealStage'
import {
  MCS_LEARN_PHASES,
  mcsCapstoneScenarios,
  mcsLessons,
  mcsPracticeScenarios,
  mcsSectionLearningContracts,
  mcsSectionPrimarySurfaces,
  type McsSectionLearningContract,
} from '../content'
import { createInitialMcsState, mcsReducer } from '../engine'
import type { McsAction, McsDerivedMetrics, McsSimulationState } from '../engine'

const KNOWN_SECTION_IDS = [
  'mcs-foundations-signals',
  'mcs-foundations-mechanisms',
  'iabp-timing-triggering',
  'iabp-efficacy-limits',
  'impella-unloading-placement',
  'impella-suction-purge-rv',
  'lvad-parameters-assessment',
  'lvad-alarms-emergencies',
  'mcs-device-selection-integration',
] as const

/**
 * One supported reducer action per section, and the reading it should visibly move.
 *
 * Eight of the nine are the section's own authored learner action. The first is a patient control,
 * because that section is inspect-only by contract — the requirement is that the panel responds to a
 * supported state change, not that an inspect-only section acquires one.
 */
const sectionActions: Readonly<
  Record<string, { readonly action: McsAction; readonly metric: keyof McsDerivedMetrics }>
> = {
  'mcs-foundations-signals': {
    action: { type: 'SET_PATIENT_CONTROL', control: 'leftVentricularContractility', value: 0.4 },
    metric: 'nativeFlowLMin',
  },
  'mcs-foundations-mechanisms': {
    action: { type: 'SELECT_DEVICE', device: 'impella' },
    metric: 'leftDeviceFlowLMin',
  },
  'iabp-timing-triggering': {
    action: { type: 'SET_IABP_CONTROL', control: 'inflationOffsetMs', value: 0 },
    metric: 'timingQualityPercent',
  },
  'iabp-efficacy-limits': {
    action: { type: 'SET_PATIENT_CONTROL', control: 'rightVentricularContractility', value: 0.3 },
    metric: 'rapMmHg',
  },
  'impella-unloading-placement': {
    action: { type: 'SET_IMPELLA_CONTROL', side: 'left', control: 'position', value: 'too-deep' },
    metric: 'leftDeviceFlowLMin',
  },
  'impella-suction-purge-rv': {
    action: { type: 'SET_IMPELLA_CONFIGURATION', control: 'rightEnabled', value: true },
    metric: 'rightDeviceFlowLMin',
  },
  'lvad-parameters-assessment': {
    action: {
      type: 'SET_PATIENT_CONTROL',
      control: 'systemicVascularResistanceDynSecCm5',
      value: 1900,
    },
    metric: 'mapMmHg',
  },
  'lvad-alarms-emergencies': {
    action: { type: 'SET_LVAD_CONTROL', control: 'suspectedPumpThrombosis', value: true },
    metric: 'pumpPowerW',
  },
  'mcs-device-selection-integration': {
    action: { type: 'SET_IMPELLA_CONTROL', side: 'left', control: 'performanceLevel', value: 8 },
    metric: 'leftDeviceFlowLMin',
  },
}

function tick(state: McsSimulationState, steps: number): McsSimulationState {
  let next = state
  for (let index = 0; index < steps; index += 1) {
    next = mcsReducer(next, { type: 'TICK', seconds: 0.1 })
  }
  return next
}

/** The section's authored opening state, settled, exactly as the workbench reaches it. */
function openedState(contract: McsSectionLearningContract): McsSimulationState {
  let state = createInitialMcsState('learn', contract.startingDevice)
  for (const action of contract.startingActions) state = mcsReducer(state, action)
  return tick(state, 80)
}

/** The same state after the section's supported action, settled again. */
function actedState(contract: McsSectionLearningContract): McsSimulationState {
  return tick(mcsReducer(openedState(contract), sectionActions[contract.sectionId].action), 40)
}

function renderPanel(
  contract: McsSectionLearningContract,
  state: McsSimulationState,
  reveal: McsRevealStage,
  beforeMetrics: McsDerivedMetrics | null = null,
) {
  return render(
    <McsTeachingPanel
      contract={contract}
      state={state}
      reveal={reveal}
      beforeMetrics={beforeMetrics}
    />,
  )
}

function renderPane(
  contract: McsSectionLearningContract,
  state: McsSimulationState,
  reveal: McsRevealStage,
  beforeMetrics: McsDerivedMetrics | null = null,
) {
  return render(
    <McsLearnTeachingPane
      contract={contract}
      state={state}
      reveal={reveal}
      beforeMetrics={beforeMetrics}
    />,
  )
}

const contractCases = mcsSectionLearningContracts.map(
  (contract) => [contract.sectionId, contract] as const,
)

beforeEach(() => {
  mockRouterPush.mockReset()
  window.localStorage.clear()
  Object.defineProperty(global, 'fetch', {
    configurable: true,
    writable: true,
    value: jest.fn().mockResolvedValue({ ok: true }),
  })
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: jest.fn().mockReturnValue({
      matches: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }),
  })
})

// ── Registry ─────────────────────────────────────────────────────────────────

describe('M4 — the panel registry is exhaustive and fails closed', () => {
  it('registers exactly nine panels, one per Learn section, in pathway order', () => {
    expect(mcsTeachingPanelSectionIds).toHaveLength(9)
    expect(mcsTeachingPanelSectionIds).toEqual([...KNOWN_SECTION_IDS])
    expect(mcsLessons.map((lesson) => lesson.id)).toEqual([...mcsTeachingPanelSectionIds])
    expect(validateMcsTeachingPanelRegistry()).toEqual([])
  })

  it('registers no Practice case, no Challenge case, and no unknown section', () => {
    const registered = new Set(mcsTeachingPanelSectionIds)
    for (const scenario of [...mcsPracticeScenarios, ...mcsCapstoneScenarios]) {
      expect(registered.has(scenario.id)).toBe(false)
    }
    for (const sectionId of registered) {
      expect(mcsLessons.map((lesson) => lesson.id)).toContain(sectionId)
    }
  })

  it('renders a distinct panel, carrying its own section id, for every section', () => {
    const markers = new Set<string>()
    const shapes = new Set<string>()
    for (const contract of mcsSectionLearningContracts) {
      const view = renderPanel(contract, openedState(contract), 'orientation')
      const node = view.container.querySelector('[data-teaching-panel]')
      expect(node).not.toBeNull()
      expect(node?.getAttribute('data-teaching-panel')).toBe(contract.sectionId)
      // One panel per section, and no two sections resolving to the same generic component: the
      // panel's own section headings are its fingerprint.
      const sections = Array.from(view.container.querySelectorAll('[data-panel-section]'))
        .map((element) => element.getAttribute('data-panel-section'))
        .join('|')
      markers.add(contract.sectionId)
      shapes.add(sections)
      view.unmount()
    }
    expect(markers.size).toBe(9)
    expect(shapes.size).toBe(9)
  })

  it('throws rather than rendering an empty pane for a section with no panel', () => {
    const contract = { ...mcsSectionLearningContracts[0], sectionId: 'not-a-section' }
    expect(() =>
      renderPanel(
        contract as McsSectionLearningContract,
        openedState(mcsSectionLearningContracts[0]),
        'orientation',
      ),
    ).toThrow(/No MCS teaching panel registered/)
  })
})

// ── M2/M3 preservation ───────────────────────────────────────────────────────

describe('M4 — nothing the previous package landed has moved', () => {
  it('keeps the primary-surface and target mapping exactly as authored', () => {
    expect(mcsSectionPrimarySurfaces.map((entry) => entry.sectionId)).toEqual([
      ...KNOWN_SECTION_IDS,
    ])
    expect(
      mcsSectionPrimarySurfaces.map((entry) => `${entry.primarySurface}:${entry.primaryTarget}`),
    ).toEqual([
      'monitor:monitor:flow-account',
      'anatomy:anatomy:support-pathway-overview',
      'monitor:monitor:arterial-waveform',
      'monitor:monitor:response-trend',
      'anatomy:anatomy:left-pump-inlet-and-outlet',
      'anatomy:anatomy:right-pump-caval-to-pulmonary-path',
      'monitor:monitor:power-pulsatility',
      'monitor:monitor:alarms',
      'monitor:monitor:filling-pressures',
    ])
  })

  it('keeps the six phases in order, with commitment showing a verdict and not advancing', () => {
    render(<McsWorkbench section="learn" />)
    expect(MCS_LEARN_PHASES).toEqual([
      'recognize',
      'predict',
      'act',
      'observe',
      'explain',
      'transfer',
    ])
    expect(screen.getByRole('heading', { name: /^Recognize — step 1 of 6$/ })).toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('radio')[0])
    fireEvent.click(screen.getByRole('button', { name: 'Record what you identified' }))
    fireEvent.click(screen.getByRole('button', { name: /Continue to the prediction/i }))
    fireEvent.click(screen.getAllByRole('radio')[0])
    fireEvent.click(screen.getByRole('button', { name: 'Commit this answer' }))

    // The verdict is up, the phase has not moved, and Continue is still a separate control.
    expect(document.querySelector('[data-answer-verdict]')).not.toBeNull()
    expect(screen.getByRole('heading', { name: /^Predict — step 2 of 6$/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Continue to the task/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Continue to the task/i }))
    expect(screen.getByRole('heading', { name: /^Act — step 3 of 6$/ })).toBeInTheDocument()
  })

  it('leaves Practice and Challenge untouched by the new panels', () => {
    const practice = render(<McsWorkbench section="practice" initialActivityId="IABP-01" />)
    expect(practice.container.querySelector('[data-teaching-panel]')).toBeNull()
    expect(document.querySelector('[data-answer-verdict]')).toBeNull()
    practice.unmount()

    const challenge = render(<McsWorkbench section="assess" />)
    expect(challenge.container.querySelector('[data-teaching-panel]')).toBeNull()
    challenge.unmount()
  })

  it('puts no control, no dispatch and no completion anywhere inside a panel', () => {
    for (const contract of mcsSectionLearningContracts) {
      for (const reveal of MCS_REVEAL_STAGES) {
        const view = renderPanel(
          contract,
          openedState(contract),
          reveal,
          openedState(contract).metrics,
        )
        expect(view.container.querySelectorAll('button')).toHaveLength(0)
        expect(view.container.querySelectorAll('input')).toHaveLength(0)
        expect(view.container.querySelectorAll('select')).toHaveLength(0)
        expect(view.container.textContent ?? '').not.toMatch(/mark .*complete/i)
        view.unmount()
      }
    }
  })
})

// ── Reveal stage ─────────────────────────────────────────────────────────────

describe('M4 — one reveal-stage mapping, centralized', () => {
  it('maps every phase, and treats an uncommitted prediction as orientation', () => {
    expect(mcsRevealStage('recognize', false)).toBe('orientation')
    expect(mcsRevealStage('predict', false)).toBe('orientation')
    expect(mcsRevealStage('predict', true)).toBe('mechanism')
    expect(mcsRevealStage('act', false)).toBe('mechanism')
    expect(mcsRevealStage('observe', false)).toBe('observation')
    expect(mcsRevealStage('explain', false)).toBe('explanation')
    expect(mcsRevealStage('transfer', false)).toBe('transfer')
  })

  it('discloses the mechanism only after a commitment, and compares only where a baseline holds', () => {
    expect(mcsMechanismDisclosed('orientation')).toBe(false)
    for (const stage of MCS_REVEAL_STAGES.filter((candidate) => candidate !== 'orientation')) {
      expect(mcsMechanismDisclosed(stage)).toBe(true)
    }
    expect(mcsComparesAgainstActionBaseline('observation')).toBe(true)
    expect(mcsComparesAgainstActionBaseline('explanation')).toBe(true)
    // The transfer phase loads a different patient, so the action-entry snapshot describes nothing.
    expect(mcsComparesAgainstActionBaseline('transfer')).toBe(false)
    expect(mcsComparesAgainstActionBaseline('orientation')).toBe(false)
  })
})

// ── Prediction integrity ─────────────────────────────────────────────────────

describe('M4 — nothing reveals the answer before it is committed', () => {
  it.each(contractCases)('withholds the mechanism from %s before a commitment', (_id, contract) => {
    const state = openedState(contract)
    const view = renderPane(contract, state, 'orientation')
    const text = view.container.textContent ?? ''
    const correct = contract.predictionItem.choices.find((choice) =>
      contract.predictionItem.correctChoiceIds.includes(choice.id),
    )
    expect(correct).toBeDefined()

    const withheld: readonly string[] = [
      correct!.label,
      correct!.rationale,
      contract.predictionItem.explanation,
      contract.explanation,
      contract.teaching.howTheActionAffectsTheModel,
      contract.teaching.flowAccountNote,
      contract.whatThisEstablishes,
      contract.commonMisinterpretation,
      contract.pressureLevelExplanation,
      contract.flowLevelExplanation,
      contract.oxygenDeliveryExplanation,
      contract.organResponseExplanation,
    ]
    for (const sentence of withheld) {
      expect(text).not.toContain(sentence)
    }
    view.unmount()
  })

  it.each(contractCases)(
    'reveals the authored mechanism for %s after a commitment',
    (_id, contract) => {
      const state = openedState(contract)
      const view = renderPane(contract, state, 'mechanism')
      const text = view.container.textContent ?? ''
      expect(text).toContain(contract.teaching.howTheActionAffectsTheModel)
      expect(text).toContain(contract.teaching.flowAccountNote)
      expect(text).toContain(contract.whatThisDoesNotEstablish)
      // The causal account still waits for Explain.
      expect(text).not.toContain(contract.flowLevelExplanation)
      view.unmount()
    },
  )

  it.each(contractCases)('renders the whole causal ladder for %s at Explain', (_id, contract) => {
    const state = actedState(contract)
    const view = renderPane(contract, state, 'explanation', openedState(contract).metrics)
    const text = view.container.textContent ?? ''
    expect(text).toContain(contract.pressureLevelExplanation)
    expect(text).toContain(contract.flowLevelExplanation)
    expect(text).toContain(contract.oxygenDeliveryExplanation)
    expect(text).toContain(contract.organResponseExplanation)
    view.unmount()
  })

  it('keeps the withheld sentences out of the live workspace DOM, not merely out of sight', () => {
    render(<McsWorkbench section="learn" initialActivityId="iabp-timing-triggering" />)
    const contract = mcsSectionLearningContracts.find(
      (candidate) => candidate.sectionId === 'iabp-timing-triggering',
    )!
    const correct = contract.predictionItem.choices.find((choice) =>
      contract.predictionItem.correctChoiceIds.includes(choice.id),
    )!
    const teaching = screen.getByRole('region', { name: /^Teaching panel$/i })
    expect(teaching.textContent ?? '').not.toContain(correct.rationale)
    expect(teaching.textContent ?? '').not.toContain(contract.teaching.howTheActionAffectsTheModel)

    fireEvent.click(screen.getAllByRole('radio')[0])
    fireEvent.click(screen.getByRole('button', { name: 'Record what you identified' }))
    fireEvent.click(screen.getByRole('button', { name: /Continue to the prediction/i }))
    // Still uncommitted at the prediction itself.
    expect(
      screen.getByRole('region', { name: /^Teaching panel$/i }).textContent ?? '',
    ).not.toContain(contract.teaching.howTheActionAffectsTheModel)

    fireEvent.click(screen.getAllByRole('radio')[0])
    fireEvent.click(screen.getByRole('button', { name: 'Commit this answer' }))
    expect(screen.getByRole('region', { name: /^Teaching panel$/i }).textContent ?? '').toContain(
      contract.teaching.howTheActionAffectsTheModel,
    )
  })
})

// ── Live state ───────────────────────────────────────────────────────────────

describe('M4 — every panel is computed from the live state', () => {
  it.each(contractCases)('renders %s from a reducer-produced state', (_id, contract) => {
    const view = renderPanel(contract, openedState(contract), 'orientation')
    const text = view.container.textContent ?? ''
    expect(text).not.toMatch(/NaN|Infinity|undefined|\[object Object\]/)
    for (const node of view.container.querySelectorAll('[data-live-value]')) {
      expect((node.textContent ?? '').trim().length).toBeGreaterThan(0)
    }
    for (const node of view.container.querySelectorAll('[data-flow-line]')) {
      expect((node.textContent ?? '').trim().length).toBeGreaterThan(0)
    }
    view.unmount()
  })

  it.each(contractCases)(
    'changes what %s renders when the reducer changes the state',
    (_id, contract) => {
      const before = openedState(contract)
      const after = actedState(contract)
      expect(after.metrics[sectionActions[contract.sectionId].metric]).not.toEqual(
        before.metrics[sectionActions[contract.sectionId].metric],
      )
      const first = renderPanel(contract, before, 'observation', before.metrics)
      const firstText = first.container.textContent ?? ''
      first.unmount()
      const second = renderPanel(contract, after, 'observation', before.metrics)
      const secondText = second.container.textContent ?? ''
      second.unmount()
      expect(secondText).not.toEqual(firstText)
    },
  )

  it.each(contractCases)(
    'reads %s at Observe from the captured baseline and the current state',
    (_id, contract) => {
      const before = openedState(contract)
      const after = actedState(contract)
      const view = renderPanel(contract, after, 'observation', before.metrics)
      const figure = view.container.querySelector('[data-before-after-figure]')
      expect(figure).not.toBeNull()
      const baselines = figure!.querySelectorAll('[data-baseline-value]')
      expect(baselines.length).toBeGreaterThan(0)
      for (const cell of baselines) {
        expect((cell.textContent ?? '').trim()).not.toBe('not captured yet')
      }
      view.unmount()
    },
  )

  it('says a baseline is missing rather than inventing one', () => {
    const contract = mcsSectionLearningContracts[0]
    const view = renderPanel(contract, openedState(contract), 'observation', null)
    const figure = view.container.querySelector('[data-before-after-figure]')!
    expect(figure.querySelector('[data-baseline-value]')?.textContent).toContain('not captured yet')
    expect(figure.querySelector('[data-direction]')?.textContent).toContain('no baseline')
    view.unmount()
  })

  it('renders a waiting state rather than an empty figure while a trace is still filling', () => {
    const contract = mcsSectionLearningContracts.find(
      (candidate) => candidate.sectionId === 'iabp-timing-triggering',
    )!
    // The opening state carries a single waveform sample, which is what a learner sees on mount.
    let state = createInitialMcsState('learn', contract.startingDevice)
    for (const action of contract.startingActions) state = mcsReducer(state, action)
    const view = renderPanel(contract, state, 'orientation')
    expect(view.container.querySelector('[data-waiting-state]')).not.toBeNull()
    expect(view.container.querySelector('[data-iabp-strip]')).toBeNull()
    expect(view.container.textContent ?? '').not.toMatch(/NaN|undefined/)
    view.unmount()

    // Once the buffer has filled, the strip is drawn.
    const settled = renderPanel(contract, openedState(contract), 'orientation')
    expect(settled.container.querySelector('[data-iabp-strip]')).not.toBeNull()
    settled.unmount()
  })

  it.each(contractCases)(
    'does not describe the fixed-step settling in %s as a response to the learner',
    (_id, contract) => {
      const before = openedState(contract)
      // No learner action at all: only modeled time passes, exactly as it does while a learner reads.
      const later = tick(before, 60)
      const view = renderPanel(contract, later, 'observation', before.metrics)
      for (const cell of view.container.querySelectorAll('[data-direction]')) {
        expect(cell.getAttribute('data-direction')).toBe('unchanged')
      }
      view.unmount()
    },
  )

  it('keeps every display deadband above the idle drift it exists to absorb', () => {
    for (const [metric, drift] of Object.entries(MCS_MEASURED_IDLE_DRIFT)) {
      const band = deadbandFor(metric as keyof McsDerivedMetrics)
      expect(band).toBeGreaterThanOrEqual(drift as number)
    }
    expect(Object.keys(MCS_DISPLAY_DEADBANDS).length).toBeGreaterThan(0)
  })
})

// ── Evidence contract ────────────────────────────────────────────────────────

describe('M4 — the shared evidence contract holds for every panel', () => {
  it.each(contractCases)('satisfies the teaching-panel contract for %s', (sectionId, contract) => {
    const stage =
      sectionId === 'mcs-device-selection-integration'
        ? ('integration' as const)
        : ('foundation' as const)
    for (const reveal of MCS_REVEAL_STAGES) {
      const view = renderPanel(
        contract,
        actedState(contract),
        reveal,
        openedState(contract).metrics,
      )
      assertTeachingPanelContract(view.container, stage)
      view.unmount()
    }
  })

  it('renders both Impella evidence surfaces on the placement section, with distinct semantics', () => {
    const contract = mcsSectionLearningContracts.find(
      (candidate) => candidate.sectionId === 'impella-unloading-placement',
    )!
    const view = renderPanel(
      contract,
      actedState(contract),
      'explanation',
      openedState(contract).metrics,
    )
    const clarification = view.container.querySelector(
      '[data-measurement-clarification="clarification.mcs.impella-cp-flow-measurands"]',
    )
    const conflict = view.container.querySelector(
      '[data-held-disagreement="conflict.mcs.impella-cp-textbook-flow"]',
    )
    expect(clarification).not.toBeNull()
    expect(conflict).not.toBeNull()

    // Three manufacturer measurands, each naming what it measures.
    expect(clarification!.querySelectorAll('[data-clarified-quantity]')).toHaveLength(3)
    const measurands = Array.from(clarification!.querySelectorAll('[data-measurand]')).map(
      (node) => node.textContent,
    )
    expect(measurands).toEqual([
      'Maximum mean flow',
      'Peak flow rate at systole',
      'Average flow observed during support',
    ])

    // Two textbook positions, both retained.
    expect(conflict!.querySelectorAll('[data-conflict-position]')).toHaveLength(2)
    const claims = conflict!.textContent ?? ''
    expect(claims).toContain('3.8 L/min')
    expect(claims).toContain('3.5 L/min')

    // The semantics are not swapped: the manufacturer figures are not inside a disagreement, and
    // the textbook figures are not inside a clarification.
    expect(clarification!.querySelector('[data-conflict-position]')).toBeNull()
    expect(conflict!.querySelector('[data-clarified-quantity]')).toBeNull()
    expect(clarification!.textContent ?? '').not.toContain('3.5 L/min')

    // Nothing is averaged. The mean of the two textbook figures never appears.
    expect(view.container.textContent ?? '').not.toContain('3.65')
    view.unmount()
  })
})

// ── Clinical invariants ──────────────────────────────────────────────────────

describe('M4 — the clinical invariants survive the visuals', () => {
  it('never reports a device flow for counterpulsation, and keeps effective equal to native', () => {
    for (const contract of mcsSectionLearningContracts.filter(
      (candidate) => candidate.startingDevice === 'iabp',
    )) {
      const state = openedState(contract)
      expect(state.metrics.deviceFlowLMin).toBeCloseTo(0, 2)
      expect(state.metrics.effectiveSystemicFlowLMin).toBeCloseTo(state.metrics.nativeFlowLMin, 2)
      const view = renderPanel(contract, state, 'explanation', state.metrics)
      const account = view.container.querySelector('[data-flow-account]')
      if (account) {
        expect(account.getAttribute('data-flow-account')).toBe('none-reported')
        const device = account.querySelector('[data-flow-line="device"]')
        expect(device?.textContent).toContain('none reported')
        expect(device?.getAttribute('data-flow-line-kind')).toBe('not-available')
        // An absent number is never given a provenance it cannot have.
        expect(device?.getAttribute('data-flow-line-kind')).not.toBe('estimated')
      }
      view.unmount()
    }
  })

  it('keeps the two microaxial flows on separate rows and out of the systemic total', () => {
    const contract = mcsSectionLearningContracts.find(
      (candidate) => candidate.sectionId === 'impella-suction-purge-rv',
    )!
    const state = actedState(contract)
    expect(state.metrics.rightDeviceFlowLMin).toBeGreaterThan(0.5)
    expect(state.metrics.deviceFlowLMin).toBeCloseTo(state.metrics.leftDeviceFlowLMin, 2)

    const view = renderPanel(contract, state, 'explanation', openedState(contract).metrics)
    const account = view.container.querySelector('[data-flow-account]')!
    expect(account.querySelector('[data-flow-line="device"]')).not.toBeNull()
    expect(account.querySelector('[data-flow-line="right-pulmonary"]')).not.toBeNull()
    expect(account.querySelector('[data-flow-line="right-pulmonary"]')?.textContent).toContain(
      'pulmonary artery',
    )

    // The systemic sum never appears anywhere in the panel.
    const summed = (state.metrics.leftDeviceFlowLMin + state.metrics.rightDeviceFlowLMin).toFixed(1)
    const effective = state.metrics.effectiveSystemicFlowLMin.toFixed(1)
    expect(summed).not.toEqual(effective)
    const effectiveRow = account.querySelector('[data-flow-line="effective"]')!
    expect(effectiveRow.textContent).toContain(`${effective} L/min`)
    expect(effectiveRow.textContent).not.toContain(`${summed} L/min`)
    // And nowhere else in the panel either — the arithmetic is prohibited, not merely kept off one row.
    expect(view.container.textContent ?? '').not.toContain(`${summed} L/min`)

    // Pump balance is labelled as a difference between two pumps, never as an output.
    const balance = Array.from(view.container.querySelectorAll('[data-live-value]')).find(
      (node) => node.getAttribute('data-live-value') === 'Pump balance',
    )
    expect(balance?.textContent).toMatch(/difference between two pumps/i)
    expect(balance?.textContent).not.toMatch(/systemic output/i)
    view.unmount()
  })

  it('labels every displayed pump flow an estimate, and never a measurement', () => {
    for (const contract of mcsSectionLearningContracts.filter(
      (candidate) => candidate.startingDevice !== 'iabp',
    )) {
      const view = renderPanel(
        contract,
        openedState(contract),
        'explanation',
        openedState(contract).metrics,
      )
      const account = view.container.querySelector('[data-flow-account]')
      const device = account?.querySelector('[data-flow-line="device"]')
      expect(device?.getAttribute('data-flow-line-kind')).toBe('estimated')
      expect(view.container.textContent ?? '').not.toMatch(
        /measured by a flow probe|probe reading/i,
      )
      view.unmount()
    }
  })

  it('never asks the pulmonary pulsatility ratio to report right-sided support', () => {
    for (const sectionId of ['impella-suction-purge-rv', 'mcs-device-selection-integration']) {
      const contract = mcsSectionLearningContracts.find(
        (candidate) => candidate.sectionId === sectionId,
      )!
      const view = renderPanel(
        contract,
        actedState(contract),
        'explanation',
        openedState(contract).metrics,
      )
      const limitation = view.container.querySelector('[data-papi-limitation]')
      expect(limitation).not.toBeNull()
      expect(limitation?.textContent).toMatch(/must not be used on its own/i)
      expect(limitation?.textContent).toMatch(/simulator|simulation/i)
      view.unmount()
    }
  })

  it('claims no whole-body oxygen delivery and no organ response anywhere', () => {
    for (const contract of mcsSectionLearningContracts) {
      const view = renderPanel(
        contract,
        actedState(contract),
        'explanation',
        openedState(contract).metrics,
      )
      const text = view.container.textContent ?? ''
      expect(text).not.toMatch(/oxygen delivery (?:of|is) \d/i)
      expect(text).not.toMatch(/organ (?:perfusion|recovery) (?:is|has) (?:adequate|improved)/i)
      view.unmount()
    }

    const signals = mcsSectionLearningContracts[0]
    const view = renderPanel(signals, openedState(signals), 'orientation')
    expect(view.container.querySelector('[data-unmodeled-organ-response]')).not.toBeNull()
    for (const id of ['mentation', 'urine-output', 'lactate', 'skin-perfusion', 'organ-recovery']) {
      expect(view.container.querySelector(`[data-unmodeled-signal="${id}"]`)).not.toBeNull()
    }
    expect(view.container.textContent).toContain('does not calculate whole-body oxygen delivery')
    view.unmount()
  })

  it('does not claim the high-power pattern reduces delivered flow, and marks what is unmodeled', () => {
    const contract = mcsSectionLearningContracts.find(
      (candidate) => candidate.sectionId === 'lvad-alarms-emergencies',
    )!
    const before = openedState(contract)
    const after = actedState(contract)
    // The engine really does leave delivered flow essentially where it was — inside the band that
    // the fixed-step model moves it by on its own — while the power signature climbs by watts.
    expect(
      Math.abs(after.metrics.effectiveSystemicFlowLMin - before.metrics.effectiveSystemicFlowLMin),
    ).toBeLessThanOrEqual(deadbandFor('effectiveSystemicFlowLMin'))
    expect(after.metrics.pumpPowerW! - before.metrics.pumpPowerW!).toBeGreaterThan(2)

    const view = renderPanel(contract, after, 'explanation', before.metrics)
    const text = view.container.textContent ?? ''
    expect(
      view.container.querySelector('[data-high-power-boundary="flow-unchanged"]'),
    ).not.toBeNull()
    expect(
      view.container.querySelector('[data-high-power-boundary="hemolysis"]')?.textContent,
    ).toMatch(/not modeled/i)
    expect(
      view.container.querySelector('[data-high-power-boundary="obstruction"]')?.textContent,
    ).toMatch(/not modeled/i)
    expect(text).toMatch(/suspected/i)
    expect(text).toMatch(/raises power and leaves the delivered flow where it was/i)
    expect(text).toMatch(/does not teach the converse/i)
    // The converse claim never appears in any form, negated or otherwise.
    expect(text).not.toMatch(/(?:reduces|reducing|lowers|lowering) (?:the )?delivered flow/i)
    expect(text).not.toMatch(/pump thrombosis is present|confirmed thrombosis/i)
    view.unmount()
  })

  it('presents no reference maximum as a target and no one-number device rule', () => {
    for (const contract of mcsSectionLearningContracts) {
      const view = renderPanel(
        contract,
        actedState(contract),
        'transfer',
        openedState(contract).metrics,
      )
      const text = view.container.textContent ?? ''
      expect(text).not.toMatch(/\btarget flow\b|\bflow target\b|\btarget of\s*\d/i)
      expect(text).not.toMatch(/\bshould (?:always )?be (?:above|below)\s*\d/i)
      expect(text).not.toMatch(
        /(?:choose|select|start) (?:an? )?(?:Impella|IABP|LVAD|balloon pump)\b/i,
      )
      view.unmount()
    }
    const integration = mcsSectionLearningContracts.find(
      (candidate) => candidate.sectionId === 'mcs-device-selection-integration',
    )!
    const view = renderPanel(
      integration,
      openedState(integration),
      'explanation',
      openedState(integration).metrics,
    )
    expect(view.container.querySelector('[data-congestion-limit]')?.textContent).toMatch(
      /does not .*select a support device/i,
    )
    // Gas exchange is named as information this simulation does not establish.
    expect(view.container.textContent).toMatch(/models no gas-exchange failure state/i)
    view.unmount()
  })
})

// ── Text equivalents, boundaries, accessibility ──────────────────────────────

describe('M4 — every figure is readable without the picture', () => {
  it.each(contractCases)('gives %s a text equivalent and a model boundary', (_id, contract) => {
    for (const reveal of MCS_REVEAL_STAGES) {
      const view = renderPanel(
        contract,
        actedState(contract),
        reveal,
        openedState(contract).metrics,
      )
      const equivalents = view.container.querySelectorAll('[data-text-equivalent]')
      expect(equivalents.length).toBeGreaterThan(0)
      for (const node of equivalents) {
        expect((node.textContent ?? '').trim().length).toBeGreaterThan(30)
      }
      expect(view.container.querySelectorAll('[data-model-boundary]').length).toBeGreaterThan(0)

      /*
       * Per figure, not per panel. One text equivalent at the bottom of a panel with six figures in
       * it is not an equivalent of any of them, so every block that draws something — a trace, a
       * schematic, a flow account, or a table this package authored — has to carry its own. The
       * shared evidence renderers are exempt: their tables already name every value in words, with a
       * caption, and a second prose copy beside them would be noise rather than access.
       */
      for (const section of view.container.querySelectorAll('[data-panel-section]')) {
        const authoredTables = Array.from(section.querySelectorAll('table')).filter(
          (table) =>
            !table.closest('[data-measurement-clarification]') &&
            !table.closest('[data-held-disagreement]') &&
            !table.closest('[data-derived-value]'),
        )
        const drawsAFigure =
          section.querySelector('svg') !== null ||
          section.querySelector('[data-flow-account]') !== null ||
          authoredTables.length > 0
        if (!drawsAFigure) continue
        // Named in the assertion so a failure says which block lost its equivalent.
        expect([
          section.getAttribute('data-panel-section'),
          section.querySelectorAll('[data-text-equivalent]').length > 0,
        ]).toEqual([section.getAttribute('data-panel-section'), true])
      }
      view.unmount()
    }
  })

  it.each(contractCases)(
    'carries the live numbers into the text equivalent for %s',
    (_id, contract) => {
      const state = actedState(contract)
      const view = renderPanel(contract, state, 'explanation', openedState(contract).metrics)
      const spoken = Array.from(view.container.querySelectorAll('[data-text-equivalent]'))
        .map((node) => node.textContent ?? '')
        .join(' ')
      expect(spoken).toContain(state.metrics.effectiveSystemicFlowLMin.toFixed(1))
      view.unmount()
    },
  )

  it.each(contractCases)(
    'spells out every value kind and every alarm priority for %s',
    (_id, contract) => {
      const view = renderPanel(
        contract,
        actedState(contract),
        'observation',
        openedState(contract).metrics,
      )
      for (const node of view.container.querySelectorAll('[data-live-value-kind-label]')) {
        expect((node.textContent ?? '').trim().length).toBeGreaterThan(0)
      }
      for (const node of view.container.querySelectorAll('[data-alarm-priority-words]')) {
        expect(node.textContent).toMatch(/critical priority|warning priority|advisory priority/)
      }
      // Direction is a word, not only a mark.
      for (const node of view.container.querySelectorAll('[data-direction]')) {
        expect(node.textContent).toMatch(/higher|lower|about the same|no baseline/)
      }
      view.unmount()
    },
  )

  it.each(contractCases)('gives %s a heading structure and no canvas', (_id, contract) => {
    const view = renderPanel(
      contract,
      actedState(contract),
      'explanation',
      openedState(contract).metrics,
    )
    expect(view.container.querySelectorAll('canvas')).toHaveLength(0)
    const headings = view.container.querySelectorAll('h4, h5')
    expect(headings.length).toBeGreaterThan(0)
    for (const section of view.container.querySelectorAll('[data-panel-section]')) {
      expect(section.getAttribute('aria-labelledby')).toBeTruthy()
    }
    // Every SVG carries a name, because the picture is never the only copy of the content.
    for (const svg of view.container.querySelectorAll('svg')) {
      const named = svg.getAttribute('aria-label') || svg.getAttribute('aria-hidden')
      expect(named).toBeTruthy()
    }
    view.unmount()
  })

  it('labels the transfer state as live rather than comparing it with a stale baseline', () => {
    for (const contract of mcsSectionLearningContracts) {
      const view = renderPanel(
        contract,
        actedState(contract),
        'transfer',
        openedState(contract).metrics,
      )
      expect(view.container.querySelector('[data-transfer-state]')).not.toBeNull()
      expect(
        view.container.querySelector('[data-transferable-principle]')?.textContent?.length ?? 0,
      ).toBeGreaterThan(20)
      expect(view.container.querySelector('[data-before-after-figure]')).toBeNull()
      expect(view.container.querySelector('[data-transfer-baseline-note]')?.textContent).toMatch(
        /No baseline from the previous patient is carried across/i,
      )
      view.unmount()
    }
  })
})

// ── The pane keeps its accepted content ──────────────────────────────────────

describe('M4 — the accepted M2/M3 teaching is still represented', () => {
  it.each(contractCases)(
    'keeps every accepted block for %s somewhere in the sequence',
    (_id, contract) => {
      const state = openedState(contract)
      const seen = new Set<string>()
      for (const reveal of MCS_REVEAL_STAGES) {
        const view = renderPane(contract, state, reveal, state.metrics)
        const text = view.container.textContent ?? ''
        for (const [key, sentence] of Object.entries({
          whatYouAreSeeing: contract.teaching.whatYouAreSeeing,
          whatTheTargetRepresents: contract.teaching.whatTheTargetRepresents,
          surfaceRationale: contract.primarySurfaceRationale,
          howTheActionAffectsTheModel: contract.teaching.howTheActionAffectsTheModel,
          flowAccountNote: contract.teaching.flowAccountNote,
          establishes: contract.whatThisEstablishes,
          doesNotEstablish: contract.whatThisDoesNotEstablish,
          misinterpretation: contract.commonMisinterpretation,
          pressure: contract.pressureLevelExplanation,
          flow: contract.flowLevelExplanation,
          oxygen: contract.oxygenDeliveryExplanation,
          organ: contract.organResponseExplanation,
        })) {
          if (text.includes(sentence)) seen.add(key)
        }
        view.unmount()
      }
      expect([...seen].sort()).toEqual(
        [
          'doesNotEstablish',
          'establishes',
          'flow',
          'flowAccountNote',
          'howTheActionAffectsTheModel',
          'misinterpretation',
          'organ',
          'oxygen',
          'pressure',
          'surfaceRationale',
          'whatTheTargetRepresents',
          'whatYouAreSeeing',
        ].sort(),
      )
    },
  )

  it('keeps the common model and the pathway cards on the foundation sections', () => {
    const view = render(
      <McsWorkbench section="learn" initialActivityId="mcs-foundations-mechanisms" />,
    )
    const teaching = screen.getByRole('region', { name: /^Teaching panel$/i })
    expect(within(teaching).getByText(/The common model this section builds/i)).toBeInTheDocument()
    expect(teaching.querySelectorAll('[data-pathway-id]')).toHaveLength(8)
    expect(teaching.querySelector('[data-mcs-common-model="root"]')).not.toBeNull()
    view.unmount()
  })
})
