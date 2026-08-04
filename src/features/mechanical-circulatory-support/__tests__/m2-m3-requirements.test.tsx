import { readFileSync } from 'node:fs'
import path from 'node:path'

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
/*
 * The canvas is stubbed; the authored pathway summary is not. It carries the anatomy targets a
 * section points at, so stubbing it would let this suite pass while a learner saw nothing.
 */
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

import { criticalCareActivities } from '@/features/critical-care/content/activities'
import { criticalCareLearningPathway } from '@/features/critical-care/content/learningPathways'

import { McsHub } from '../components/McsHub'
import { McsWorkbench } from '../components/McsWorkbench'
import {
  MCS_LEARN_PHASES,
  mcsAnatomyTargets,
  mcsCapstoneScenarios,
  mcsLearnControls,
  mcsLessonTransferByLessonId,
  mcsLessons,
  mcsMonitorTargets,
  mcsPracticeScenarios,
  mcsSectionLearningContracts,
  mcsSectionPrimarySurfaces,
  mcsSurfaceTarget,
  type McsSectionLearningContract,
} from '../content'
import {
  MCS_COMPLETABLE_ITEM_COUNT,
  createDefaultMcsProgress,
  createInitialMcsState,
  mcsReducer,
  readMcsProgress,
  type McsSimulationState,
} from '../engine'

const PROGRESS_KEY = 'interventionalpulm:mcs-progress:v1'

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

function savedLessonIds(): readonly string[] {
  return JSON.parse(window.localStorage.getItem(PROGRESS_KEY) ?? '{}').completedLessonIds ?? []
}

/** The section's authored starting state, settled, exactly as the workbench opens it. */
function openedState(contract: McsSectionLearningContract): McsSimulationState {
  let state = createInitialMcsState('learn', contract.startingDevice)
  for (const action of contract.startingActions) state = mcsReducer(state, action)
  for (let tick = 0; tick < 30; tick += 1) {
    state = mcsReducer(state, { type: 'TICK', seconds: 0.2 })
  }
  return state
}

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

// ── Orientation and identity ─────────────────────────────────────────────────

describe('M2/M3 — nothing persistent moved', () => {
  it('keeps all nine section ids, in pathway order', () => {
    expect(mcsLessons.map((lesson) => lesson.id)).toEqual([...KNOWN_SECTION_IDS])
    expect(
      criticalCareLearningPathway('mechanical-circulatory-support').sections.map(
        (section) => section.id,
      ),
    ).toEqual([...KNOWN_SECTION_IDS])
  })

  it('keeps every activity id unchanged', () => {
    const learnActivities = criticalCareActivities
      .filter((activity) => activity.id.startsWith('mcs:learn:'))
      .map((activity) => activity.id)
    expect(learnActivities).toEqual(KNOWN_SECTION_IDS.map((id) => `mcs:learn:${id}`))
  })

  it('keeps the storage key, payload shape, and payload version', () => {
    const progress = createDefaultMcsProgress()
    expect(progress.version).toBe(1)
    expect(Object.keys(progress).sort()).toEqual(
      [
        'bestScores',
        'completedCapstoneIds',
        'completedCaseIds',
        'completedLessonIds',
        'criticalErrorStatus',
        'lastActivityId',
        'lastDevice',
        'lastSection',
        'masteredCaseIds',
        'version',
      ].sort(),
    )
    // The key itself, read from the module rather than typed here twice.
    const source = readFileSync(
      path.join(process.cwd(), 'src/features/mechanical-circulatory-support/engine/progress.ts'),
      'utf8',
    )
    expect(source).toContain("const STORAGE_KEY = 'interventionalpulm:mcs-progress:v1'")
  })

  it('reads a completion record written before this package', () => {
    window.localStorage.setItem(
      PROGRESS_KEY,
      JSON.stringify({
        ...createDefaultMcsProgress(),
        completedLessonIds: ['iabp-timing-triggering'],
        masteredCaseIds: ['IABP-01'],
      }),
    )
    expect(readMcsProgress().completedLessonIds).toEqual(['iabp-timing-triggering'])
    expect(readMcsProgress().masteredCaseIds).toEqual(['IABP-01'])
  })

  it.each(KNOWN_SECTION_IDS)('opens %s directly, with no prerequisite gating', (sectionId) => {
    const { container, unmount } = render(
      <McsWorkbench section="learn" initialActivityId={sectionId} />,
    )
    const contract = mcsSectionLearningContracts.find(
      (candidate) => candidate.sectionId === sectionId,
    )
    expect(contract).toBeDefined()
    expect(screen.getAllByText(contract!.lessonTitle).length).toBeGreaterThan(0)
    // Nothing on the surface is locked behind another section.
    expect(container.querySelector('[data-locked="true"]')).toBeNull()
    const rail = screen.getByRole('navigation', { name: /MCS learning pathway sections/i })
    for (const button of within(rail).getAllByRole('button')) {
      expect(button).toBeEnabled()
    }
    unmount()
  })

  it('counts the nine sections consistently wherever a count is shown', () => {
    expect(mcsLessons).toHaveLength(9)
    expect(mcsSectionPrimarySurfaces).toHaveLength(9)
    expect(mcsSectionLearningContracts).toHaveLength(9)
    expect(MCS_COMPLETABLE_ITEM_COUNT).toBe(
      mcsLessons.length + mcsPracticeScenarios.length + mcsCapstoneScenarios.length,
    )
  })
})

// ── M2: primary-pane mapping ─────────────────────────────────────────────────

describe('M2 — the primary surface is authored, not inferred', () => {
  it('gives every section exactly one primary surface and no unknown section a surface', () => {
    expect(mcsSectionPrimarySurfaces.map((entry) => entry.sectionId)).toEqual([
      ...KNOWN_SECTION_IDS,
    ])
    expect(new Set(mcsSectionPrimarySurfaces.map((entry) => entry.sectionId)).size).toBe(9)
    for (const entry of mcsSectionPrimarySurfaces) {
      expect(['anatomy', 'monitor']).toContain(entry.primarySurface)
      expect(mcsSurfaceTarget(entry.primarySurface, entry.primaryTarget)).toBeDefined()
      expect(entry.primarySurfaceRationale.length).toBeGreaterThan(40)
    }
  })

  it('places anatomy on the pathway and placement sections and the monitor on the signal ones', () => {
    const bySection = new Map(
      mcsSectionPrimarySurfaces.map((entry) => [entry.sectionId, entry.primarySurface]),
    )
    expect(bySection.get('mcs-foundations-mechanisms')).toBe('anatomy')
    expect(bySection.get('impella-unloading-placement')).toBe('anatomy')
    expect(bySection.get('impella-suction-purge-rv')).toBe('anatomy')
    expect(bySection.get('iabp-timing-triggering')).toBe('monitor')
    expect(bySection.get('iabp-efficacy-limits')).toBe('monitor')
    expect(bySection.get('lvad-parameters-assessment')).toBe('monitor')
    expect(bySection.get('mcs-foundations-signals')).toBe('monitor')
  })

  it('decides the surface in data, with no product-name or device branch in the component', () => {
    const componentDir = path.join(
      process.cwd(),
      'src/features/mechanical-circulatory-support/components',
    )
    for (const file of ['McsLearnPrimaryPane.tsx', 'McsLearnSection.tsx']) {
      const source = readFileSync(path.join(componentDir, file), 'utf8')
      for (const productName of ['Impella', 'IABP', 'LVAD', 'HeartMate', 'Cardiosave']) {
        expect(source).not.toContain(`'${productName}'`)
        expect(source).not.toContain(`"${productName}"`)
      }
      // No device-kind branch decides which surface renders.
      expect(source).not.toMatch(/deviceKind\s*===/)
      expect(source).not.toMatch(/device\.kind\s*===\s*'(?:iabp|impella|lvad)'/)
    }
    const primaryPane = readFileSync(path.join(componentDir, 'McsLearnPrimaryPane.tsx'), 'utf8')
    expect(primaryPane).toContain("contract.primarySurface === 'anatomy'")
  })

  it.each(mcsSectionLearningContracts.map((contract) => [contract.sectionId, contract] as const))(
    'renders %s with its authored target actually present and highlighted',
    async (_sectionId, contract) => {
      const { container, unmount } = render(
        <McsWorkbench section="learn" initialActivityId={contract.sectionId} />,
      )
      const attribute =
        contract.primarySurface === 'anatomy' ? 'data-anatomy-target' : 'data-monitor-target'
      // The heavy-asset gate resolves on a timer before the anatomy renders its children.
      await waitFor(() =>
        expect(
          container.querySelectorAll(`[${attribute}="${contract.primaryTarget}"]`).length,
        ).toBeGreaterThan(0),
      )
      const nodes = container.querySelectorAll(`[${attribute}="${contract.primaryTarget}"]`)
      expect(nodes.length).toBeGreaterThan(0)
      const highlighted = container.querySelectorAll(
        `[${attribute}="${contract.primaryTarget}"][${attribute.replace('-target', '-highlighted')}="true"]`,
      )
      expect(highlighted.length).toBeGreaterThan(0)
      // The highlight has a text equivalent, so it is not carried by colour alone.
      const surfaceTarget = mcsSurfaceTarget(contract.primarySurface, contract.primaryTarget)!
      expect(
        screen.getAllByText(new RegExp(surfaceTarget.textEquivalent.slice(0, 40), 'i')).length,
      ).toBeGreaterThan(0)
      unmount()
    },
  )

  it('changes the selected surface or target when the learner changes section', () => {
    const { container } = render(<McsWorkbench section="learn" />)
    const rail = screen.getByRole('navigation', { name: /MCS learning pathway sections/i })
    const firstSurface = container
      .querySelector('[data-primary-surface]')
      ?.getAttribute('data-primary-target')
    expect(firstSurface).toBe('monitor:flow-account')

    fireEvent.click(within(rail).getByRole('button', { name: /Unloading, augmentation/i }))
    const secondPane = container.querySelector('[data-primary-surface]')
    expect(secondPane?.getAttribute('data-primary-surface')).toBe('anatomy')
    expect(secondPane?.getAttribute('data-primary-target')).toBe('anatomy:support-pathway-overview')
  })

  it('changes only the authored starting state when a section is entered', () => {
    // Section 6 authors a right-limited circulation and a raised left-sided level; section 5 does
    // not, so moving between them must produce each section's authored state and nothing carried.
    const five = openedState(
      mcsSectionLearningContracts.find((c) => c.sectionId === 'impella-unloading-placement')!,
    )
    const six = openedState(
      mcsSectionLearningContracts.find((c) => c.sectionId === 'impella-suction-purge-rv')!,
    )
    expect(five.patient.rightVentricularContractility).toBe(0.85)
    expect(six.patient.rightVentricularContractility).toBeCloseTo(0.36, 5)
    expect(five.device.kind === 'impella' && five.device.left.performanceLevel).toBe(5)
    expect(six.device.kind === 'impella' && six.device.left.performanceLevel).toBe(7)
    // Neither section changes anything the other did not author.
    expect(five.patient.preloadPercent).toBe(six.patient.preloadPercent)
    expect(five.patient.systemicVascularResistanceDynSecCm5).toBe(
      six.patient.systemicVascularResistanceDynSecCm5,
    )
  })
})

// ── M3: learning contracts ───────────────────────────────────────────────────

describe('M3 — every section carries a complete learning contract', () => {
  it('has one contract per section and no generic placeholder copy', () => {
    expect(mcsSectionLearningContracts.map((contract) => contract.sectionId)).toEqual([
      ...KNOWN_SECTION_IDS,
    ])
    const placeholders = [
      /^explore the device\.?$/i,
      /^review the case\.?$/i,
      /^optimi[sz]e support\.?$/i,
      /^assess the patient\.?$/i,
      /^continue when ready\.?$/i,
      /^observe the response\.?$/i,
    ]
    for (const contract of mcsSectionLearningContracts) {
      for (const copy of [
        contract.clinicalQuestion,
        contract.startingContext,
        contract.recognizePrompt,
        contract.predictionPrompt,
        contract.actionInstruction,
        contract.observationFocus,
        contract.explanation,
        contract.transferPrompt,
        contract.completionCondition,
      ]) {
        expect(copy.trim().length).toBeGreaterThan(15)
        for (const pattern of placeholders) expect(copy.trim()).not.toMatch(pattern)
      }
    }
  })

  it('states the clinical question, the context, and all four ladder levels for every section', () => {
    for (const contract of mcsSectionLearningContracts) {
      expect(contract.clinicalQuestion).toMatch(/\?/)
      expect(contract.startingContext.length).toBeGreaterThan(30)
      expect(contract.pressureLevelExplanation.length).toBeGreaterThan(30)
      expect(contract.flowLevelExplanation.length).toBeGreaterThan(30)
      expect(contract.oxygenDeliveryExplanation.length).toBeGreaterThan(30)
      expect(contract.organResponseExplanation.length).toBeGreaterThan(30)
      expect(contract.whatThisEstablishes.length).toBeGreaterThan(30)
      expect(contract.whatThisDoesNotEstablish.length).toBeGreaterThan(30)
      expect(contract.commonMisinterpretation.length).toBeGreaterThan(20)
    }
  })

  it('opens every phase instruction with a direct verb', () => {
    const verbOpening = /^(?:Do not|[A-Z][a-z]+)\b/
    for (const contract of mcsSectionLearningContracts) {
      for (const copy of [
        contract.recognizePrompt,
        contract.predictionPrompt,
        contract.actionInstruction,
        contract.observationFocus,
        contract.transferPrompt,
      ]) {
        expect(copy).toMatch(verbOpening)
      }
    }
  })

  it('says explicitly, on an inspect-only section, that no adjustment is expected', () => {
    const inspectOnly = mcsSectionLearningContracts.filter(
      (contract) => contract.actionMode === 'inspect-only',
    )
    expect(inspectOnly.length).toBeGreaterThan(0)
    for (const contract of inspectOnly) {
      expect(contract.targetControl).toBeUndefined()
      expect(contract.noActionExplanation).toMatch(/no adjustment is expected/i)
      expect(contract.actionInstruction).toMatch(/^Do not change/i)
    }
  })

  it.each(
    mcsSectionLearningContracts
      .filter((contract) => contract.actionMode !== 'inspect-only')
      .map((contract) => [contract.sectionId, contract] as const),
  )('points %s at a control that actually renders', (_sectionId, contract) => {
    const control = mcsLearnControls[contract.targetControl!]
    expect(control).toBeDefined()
    const { container, unmount } = render(
      <McsWorkbench section="learn" initialActivityId={contract.sectionId} />,
    )
    // Walk to the act phase, where the control is presented.
    fireEvent.click(screen.getAllByRole('radio')[0])
    fireEvent.click(screen.getByRole('button', { name: 'Record what you identified' }))
    fireEvent.click(screen.getByRole('button', { name: /Continue to the prediction/i }))
    fireEvent.click(screen.getAllByRole('radio')[0])
    fireEvent.click(screen.getByRole('button', { name: 'Commit this answer' }))
    fireEvent.click(screen.getByRole('button', { name: /Continue to the task/i }))

    expect(container.querySelector(`[data-mcs-control="${control.id}"]`)).not.toBeNull()
    expect(
      container.querySelector(`[data-mcs-control="${control.id}"][data-mcs-control-highlighted]`),
    ).not.toBeNull()
    unmount()
  })

  it('does not let two neighbouring sections render the same task, target and explanation', () => {
    for (let index = 1; index < mcsSectionLearningContracts.length; index += 1) {
      const previous = mcsSectionLearningContracts[index - 1]
      const current = mcsSectionLearningContracts[index]
      expect(current.clinicalQuestion).not.toBe(previous.clinicalQuestion)
      expect(current.actionInstruction).not.toBe(previous.actionInstruction)
      expect(current.explanation).not.toBe(previous.explanation)
      expect(current.patientProblem).not.toBe(previous.patientProblem)
      const sameTarget = current.primaryTarget === previous.primaryTarget
      const sameMode = current.actionMode === previous.actionMode
      expect(sameTarget && sameMode).toBe(false)
    }
  })

  it('keeps the common model and the pathway cards on the two foundation sections', () => {
    const signals = render(
      <McsWorkbench section="learn" initialActivityId="mcs-foundations-signals" />,
    )
    expect(signals.container.querySelector('[data-mcs-common-model="root"]')).not.toBeNull()
    expect(
      signals.container.querySelectorAll(
        '[data-mcs-common-model="questions"] [data-question-order]',
      ),
    ).toHaveLength(7)
    signals.unmount()

    const mechanisms = render(
      <McsWorkbench section="learn" initialActivityId="mcs-foundations-mechanisms" />,
    )
    expect(mechanisms.container.querySelector('[data-mcs-common-model="root"]')).not.toBeNull()
    expect(mechanisms.container.querySelectorAll('[data-pathway-id]')).toHaveLength(8)
    mechanisms.unmount()
  })
})

// ── Six-phase behaviour and completion ───────────────────────────────────────

/** Drives one section through recognize → predict, stopping at the act phase. */
function walkToAct(contract: McsSectionLearningContract) {
  fireEvent.click(
    screen.getByRole('radio', {
      name: new RegExp(
        contract.recognizeOptions
          .find((option) => option.correct)!
          .label.slice(0, 30)
          .replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'i',
      ),
    }),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Record what you identified' }))
  fireEvent.click(screen.getByRole('button', { name: /Continue to the prediction/i }))
  fireEvent.click(screen.getAllByRole('radio')[0])
  fireEvent.click(screen.getByRole('button', { name: 'Commit this answer' }))
}

describe('M2/M3 — the six phases behave as instructional states', () => {
  it('runs the phases in the authored order and never skips ahead', () => {
    render(<McsWorkbench section="learn" />)
    const contract = mcsSectionLearningContracts[0]

    expect(screen.getByRole('heading', { name: /^Recognize — step 1 of 6$/ })).toBeInTheDocument()
    // Jumping ahead from the shared stepper does not move the section.
    const stepper = screen.getByRole('group', { name: 'MCS shared activity phases' })
    fireEvent.click(within(stepper).getByText('Transfer'))
    expect(screen.getByRole('heading', { name: /^Recognize — step 1 of 6$/ })).toBeInTheDocument()

    walkToAct(contract)
    // Committing the prediction shows the verdict, and does not advance.
    expect(screen.getByRole('heading', { name: /^Predict — step 2 of 6$/ })).toBeInTheDocument()
    expect(document.querySelector('[data-answer-verdict]')).not.toBeNull()
    // The primary pane is still mounted and visible while the verdict is up.
    expect(screen.getByRole('region', { name: /Live monitor panel/i })).toBeInTheDocument()
    expect(document.querySelector('[data-primary-surface]')).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /Continue to the task/i }))
    expect(screen.getByRole('heading', { name: /^Act — step 3 of 6$/ })).toBeInTheDocument()
  })

  it('reads Observe from the resulting live state, and differently for different actions', () => {
    const contract = mcsSectionLearningContracts.find(
      (candidate) => candidate.sectionId === 'impella-unloading-placement',
    )!

    function observedRow(position: string): string {
      const view = render(<McsWorkbench section="learn" initialActivityId={contract.sectionId} />)
      walkToAct(contract)
      fireEvent.click(screen.getByRole('button', { name: /Continue to the task/i }))
      fireEvent.change(screen.getByRole('combobox', { name: 'Placement state' }), {
        target: { value: position },
      })
      fireEvent.click(screen.getByRole('button', { name: /Continue to what changed/i }))
      const row = screen
        .getByRole('table')
        .querySelector('[data-signal="leftDeviceFlowLMin"] td:last-child')!.textContent!
      view.unmount()
      return row
    }

    const tooDeep = observedRow('too-deep')
    const tooShallow = observedRow('too-shallow')
    expect(tooDeep).not.toEqual(tooShallow)
  })

  it('records a section only at the end of the authored sequence', async () => {
    render(<McsWorkbench section="learn" initialActivityId="lvad-alarms-emergencies" />)
    const contract = mcsSectionLearningContracts.find(
      (candidate) => candidate.sectionId === 'lvad-alarms-emergencies',
    )!

    expect(savedLessonIds()).toEqual([])
    walkToAct(contract)
    expect(savedLessonIds()).toEqual([]) // after prediction and verdict alone
    fireEvent.click(screen.getByRole('button', { name: /Continue to the task/i }))
    fireEvent.click(screen.getByRole('checkbox', { name: /High-power \/ thrombosis pattern/i }))
    expect(savedLessonIds()).toEqual([]) // after the action alone
    fireEvent.click(screen.getByRole('button', { name: /Continue to what changed/i }))
    expect(savedLessonIds()).toEqual([]) // after the observation alone
    fireEvent.click(screen.getByRole('button', { name: /Continue to the explanation/i }))
    fireEvent.click(screen.getByRole('button', { name: /Continue to the transfer patient/i }))
    expect(savedLessonIds()).toEqual([]) // at the transfer, before committing

    fireEvent.click(screen.getByRole('radio', { name: /Preserve verified power/i }))
    fireEvent.click(
      screen.getByRole('button', { name: 'Escalate to the shock / mechanical-support team' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Commit this transfer answer' }))
    await waitFor(() => expect(savedLessonIds()).toContain('lvad-alarms-emergencies'))
  })

  it('offers no manual completion control anywhere in Learn', () => {
    const { container } = render(<McsWorkbench section="learn" />)
    for (const button of Array.from(container.querySelectorAll('button, a'))) {
      const label = (button.textContent ?? '').toLowerCase()
      expect(label).not.toMatch(/mark .*complete/)
      expect(label).not.toMatch(/^complete (?:lesson|section)/)
    }
  })

  it('keeps completion copy free of readiness and credentialing claims', () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        'src/features/mechanical-circulatory-support/components/McsLearnActionPane.tsx',
      ),
      'utf8',
    )
    expect(source).toContain('records participation in an educational module')
    expect(source).toContain('does not establish readiness for independent device selection')
    for (const term of ['certified', 'certification', 'competency', 'credential']) {
      expect(source.toLowerCase()).not.toContain(term)
    }
  })
})

// ── Clinical distinctions ────────────────────────────────────────────────────

describe('M2/M3 — the clinical distinctions survive the rewrite', () => {
  it('never assigns counterpulsation a device flow, in the model or in the contracts', () => {
    const iabpSections = mcsSectionLearningContracts.filter(
      (contract) => contract.startingDevice === 'iabp',
    )
    expect(iabpSections.length).toBeGreaterThan(0)
    for (const contract of iabpSections) {
      const state = openedState(contract)
      expect(state.metrics.deviceFlowLMin).toBeCloseTo(0, 2)
      expect(state.metrics.effectiveSystemicFlowLMin).toBeCloseTo(state.metrics.nativeFlowLMin, 2)
      expect(contract.teaching.flowAccountNote).toMatch(/native|no device flow|empty/i)
    }
  })

  it('keeps the left and right microaxial pathways distinct and never sums them', () => {
    const contract = mcsSectionLearningContracts.find(
      (candidate) => candidate.sectionId === 'impella-suction-purge-rv',
    )!
    let state = openedState(contract)
    state = mcsReducer(state, {
      type: 'SET_IMPELLA_CONFIGURATION',
      control: 'rightEnabled',
      value: true,
    })
    for (let tick = 0; tick < 40; tick += 1) {
      state = mcsReducer(state, { type: 'TICK', seconds: 0.2 })
    }
    expect(state.metrics.rightDeviceFlowLMin).toBeGreaterThan(0.5)
    // The systemic device signal carries the left pump only.
    expect(state.metrics.deviceFlowLMin).toBeCloseTo(state.metrics.leftDeviceFlowLMin, 2)
    // And effective systemic flow is not the sum of the two pumps plus native.
    const summed =
      state.metrics.nativeFlowLMin +
      state.metrics.leftDeviceFlowLMin +
      state.metrics.rightDeviceFlowLMin
    expect(state.metrics.effectiveSystemicFlowLMin).toBeLessThan(summed - 0.5)
    expect(contract.commonMisinterpretation).toMatch(/adding|added/i)
  })

  it('never presents the two serial pump flows as one summed total', () => {
    render(<McsWorkbench section="learn" initialActivityId="impella-suction-purge-rv" />)
    // Walk to the act phase and start right-sided support, so both pumps are running.
    fireEvent.click(screen.getAllByRole('radio')[0])
    fireEvent.click(screen.getByRole('button', { name: 'Record what you identified' }))
    fireEvent.click(screen.getByRole('button', { name: /Continue to the prediction/i }))
    fireEvent.click(screen.getAllByRole('radio')[0])
    fireEvent.click(screen.getByRole('button', { name: 'Commit this answer' }))
    fireEvent.click(screen.getByRole('button', { name: /Continue to the task/i }))
    fireEvent.change(screen.getByRole('combobox', { name: /Right-sided Impella configuration/i }), {
      target: { value: 'rp' },
    })

    // The teaching pane reports the two pumps as two destinations, never as one figure.
    const readout = document.querySelector('[data-live-readout]')!
    expect(readout.textContent).toMatch(
      /Left [\d.]+ L\/min into the aorta · right [\d.]+ L\/min into the lung/,
    )
    // And the before-and-after comparison keeps them on separate rows.
    fireEvent.click(screen.getByRole('button', { name: /Continue to what changed/i }))
    const table = screen.getByRole('table')
    expect(table.querySelector('[data-signal="leftDeviceFlowLMin"]')).not.toBeNull()
    expect(table.querySelector('[data-signal="rightDeviceFlowLMin"]')).not.toBeNull()
    expect(table.querySelector('[data-signal="deviceFlowLMin"]')).not.toBeNull()
  })

  it('keeps durable support distinct from a larger temporary pathway', () => {
    const durable = mcsSectionLearningContracts.filter(
      (contract) => contract.startingDevice === 'lvad',
    )
    expect(durable.length).toBeGreaterThan(0)
    expect(
      durable.some((contract) => /different decision in kind/i.test(contract.deviceOrMechanism)),
    ).toBe(true)
    expect(mcsLearnControls['control:select-lvad'].doesNotGuarantee).toMatch(
      /different decision in kind/i,
    )
  })

  it('keeps cannula advancement and blood-flow direction separate on every anatomy pane', async () => {
    const contract = mcsSectionLearningContracts.find(
      (candidate) => candidate.sectionId === 'impella-suction-purge-rv',
    )!
    render(<McsWorkbench section="learn" initialActivityId={contract.sectionId} />)
    expect(
      await screen.findByText(/not the direction the catheter or cannula was advanced/i),
    ).toBeInTheDocument()
    expect(contract.teaching.whatTheTargetRepresents).toMatch(
      /direction of advancement and direction of flow are different/i,
    )
  })

  it('never asks the learner to read right-sided support from the pulmonary pulsatility ratio', () => {
    const rightSided = mcsSectionLearningContracts.find(
      (candidate) => candidate.sectionId === 'impella-suction-purge-rv',
    )!
    expect(rightSided.whatThisDoesNotEstablish).toMatch(/pulmonary pulsatility ratio/i)
    // No section makes it a success criterion of the action.
    for (const contract of mcsSectionLearningContracts) {
      expect(contract.observationFocus).not.toMatch(/PAPi/)
      expect(contract.actionInstruction).not.toMatch(/PAPi/)
    }
    render(<McsWorkbench section="learn" initialActivityId={rightSided.sectionId} />)
    expect(
      screen.getByText(
        /must not be used on its own to judge whether right-sided support is working/i,
      ),
    ).toBeInTheDocument()
  })

  it('never equates a pressure improvement with improved perfusion', () => {
    for (const contract of mcsSectionLearningContracts) {
      expect(contract.organResponseExplanation.length).toBeGreaterThan(30)
    }
    const durable = mcsSectionLearningContracts.find(
      (candidate) => candidate.sectionId === 'lvad-parameters-assessment',
    )!
    expect(durable.commonMisinterpretation).toMatch(/cardiac power|measured cardiac output/i)
    expect(durable.pressureLevelExplanation).toMatch(/improving patient/i)
  })

  it('labels every displayed pump flow as an estimate rather than a measurement', () => {
    for (const contract of mcsSectionLearningContracts) {
      if (contract.startingDevice === 'iabp') continue
      expect(`${contract.teaching.flowAccountNote} ${contract.flowLevelExplanation}`).toMatch(
        /estimate|reasoned|computed/i,
      )
    }
  })
})

// ── Route and case clarity ───────────────────────────────────────────────────

describe('M2/M3 — routes and cases are described accurately', () => {
  it('describes Learn, Practice, and Challenge, with counts the runtime supports', async () => {
    render(<McsHub />)
    const orientation = screen.getByRole('region', {
      name: /Three routes, and what changes between them/i,
    })
    expect(within(orientation).getByText('Learn')).toBeInTheDocument()
    expect(within(orientation).getByText('Practice')).toBeInTheDocument()
    expect(within(orientation).getByText('Challenge')).toBeInTheDocument()
    expect(
      within(orientation).getByText(`${mcsLessons.length} guided sections`),
    ).toBeInTheDocument()
    expect(
      within(orientation).getByText(
        `${mcsPracticeScenarios.length} patient cases, plus an open studio`,
      ),
    ).toBeInTheDocument()
    expect(
      within(orientation).getByText(
        `${mcsCapstoneScenarios.length} harder cases, one per device track`,
      ),
    ).toBeInTheDocument()
  })

  it('gives every real case a problem, a pathway, a role, a goal, and what makes it distinct', () => {
    for (const scenario of [mcsPracticeScenarios[0], mcsCapstoneScenarios[0]]) {
      const view = render(
        <McsWorkbench
          section={scenario.kind === 'capstone' ? 'assess' : 'practice'}
          initialActivityId={scenario.id}
        />,
      )
      const identity = view.container.querySelector('[data-case-identity]')!
      expect(identity).not.toBeNull()
      for (const label of [
        'Patient problem',
        'Support pathway',
        'Your role',
        'Immediate goal',
        'What makes this one different',
      ]) {
        expect(within(identity as HTMLElement).getByText(label)).toBeInTheDocument()
      }
      expect(within(identity as HTMLElement).getByText(scenario.shortTitle)).toBeInTheDocument()
      view.unmount()
    }
  })

  it('does not call the open workspace a case', () => {
    render(<McsWorkbench section="practice" />)
    const studio = screen.getByRole('region', { name: /Mechanism Studio instructions/i })
    expect(within(studio).getAllByText(/not a patient case/i).length).toBeGreaterThan(0)
    expect(studio.querySelector('[data-case-identity]')).toBeNull()
  })

  it('leaves Practice and Challenge behaviour unchanged', () => {
    render(<McsWorkbench section="practice" initialActivityId="IABP-01" />)
    // The case still runs its own six-step rail and its own prediction commitment.
    expect(screen.getByRole('button', { name: /Record initial frame/i })).toBeInTheDocument()
    expect(screen.getByText('Simulation response')).toBeInTheDocument()
    // No Learn-style immediate verdict has been added.
    expect(document.querySelector('[data-answer-verdict]')).toBeNull()
  })
})

// ── Accessibility and pane behaviour ─────────────────────────────────────────

describe('M2/M3 — pane order, labels, and keyboard reach', () => {
  it('orders the panes primary surface → teaching → learner action, in the DOM', () => {
    render(<McsWorkbench section="learn" />)
    const workspace = screen.getByRole('region', {
      name: /Mechanical circulatory support learning workspace/i,
    })
    const primary = within(workspace).getByRole('region', { name: /^Live monitor panel$/i })
    const teaching = within(workspace).getByRole('region', { name: /^Teaching panel$/i })
    const action = within(workspace).getByRole('region', { name: /^Your turn panel$/i })
    const follows = (first: Element, second: Element) =>
      Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING)
    expect(follows(primary, teaching)).toBe(true)
    expect(follows(teaching, action)).toBe(true)
    // Focus order follows the visual order, because the panes are focusable in DOM order.
    expect([primary, teaching, action].every((pane) => pane.getAttribute('tabindex') === '0')).toBe(
      true,
    )
  })

  it('gives each pane an accessible heading and the phase an accessible name', () => {
    render(<McsWorkbench section="learn" />)
    expect(screen.getByRole('heading', { name: /^Recognize — step 1 of 6$/ })).toBeInTheDocument()
    const rail = screen.getByRole('list', { name: /Where you are in this section/i })
    expect(within(rail).getAllByRole('listitem')).toHaveLength(MCS_LEARN_PHASES.length)
    expect(
      within(rail)
        .getAllByRole('listitem')
        .filter((node) => node.getAttribute('aria-current') === 'step'),
    ).toHaveLength(1)
  })

  it('keeps Help and Continue reachable, and the instruction present, at every phase', () => {
    render(<McsWorkbench section="learn" />)
    const contract = mcsSectionLearningContracts[0]
    expect(screen.getByRole('button', { name: /Help with this step/i })).toBeEnabled()
    expect(document.querySelector('[data-learn-instruction]')?.textContent).toContain(
      contract.recognizePrompt,
    )
    fireEvent.click(screen.getByRole('button', { name: /Help with this step/i }))
    expect(document.querySelector('[data-learn-help]')).not.toBeNull()
  })

  it('keeps section navigation reachable from inside the action pane', () => {
    render(<McsWorkbench section="learn" initialActivityId="iabp-timing-triggering" />)
    const nav = screen.getByRole('navigation', { name: /Move to another section/i })
    expect(within(nav).getByText(/Section 3 of 9/i)).toBeInTheDocument()
    fireEvent.click(within(nav).getByRole('button', { name: /Back to/i }))
    expect(screen.getByRole('heading', { name: /^Recognize — step 1 of 6$/ })).toBeInTheDocument()
  })

  it('names every anatomy and monitor target used by a section in the registries', () => {
    for (const entry of mcsSectionPrimarySurfaces) {
      const registry = entry.primarySurface === 'anatomy' ? mcsAnatomyTargets : mcsMonitorTargets
      expect(Object.keys(registry)).toContain(entry.primaryTarget)
    }
  })

  it('closes every section with an authored transfer that requires a response', () => {
    for (const contract of mcsSectionLearningContracts) {
      const transfer = mcsLessonTransferByLessonId.get(contract.sectionId)
      expect(transfer).toBeDefined()
      expect(transfer!.item.choices.length).toBeGreaterThan(1)
      expect(transfer!.requiredActionIds.length).toBeGreaterThan(0)
      expect(contract.transferContext.length).toBeGreaterThan(30)
    }
  })
})
