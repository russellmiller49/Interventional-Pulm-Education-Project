/**
 * M5 — the six-phase Learn runtime, driven through the interface for every authored section.
 *
 * The tables below run over `mcsSectionLearningContracts` rather than a list retyped here, so a
 * tenth section cannot arrive without arriving in these tests too. Each table asserts one contract:
 * what the section opens on, what it withholds until a commitment, what satisfies its action, what
 * the observation compares against, and when — and only when — the section is recorded.
 *
 * Nothing here dispatches a contract's own action ids. The act and transfer steps move the visible
 * slider, select or button, because a test that replays the authoring data proves that the data was
 * replayed and nothing about the workbench.
 */
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'

jest.mock('@/i18n/navigation', () =>
  jest
    .requireActual<
      typeof import('../test-support/mcsWorkbenchStubs')
    >('../test-support/mcsWorkbenchStubs')
    .navigationModule(),
)
jest.mock('../components/McsAnatomy3D', () =>
  jest
    .requireActual<
      typeof import('../test-support/mcsWorkbenchStubs')
    >('../test-support/mcsWorkbenchStubs')
    .anatomyModule(),
)
jest.mock('../components/EcmoCannulationPreview', () =>
  jest
    .requireActual<
      typeof import('../test-support/mcsWorkbenchStubs')
    >('../test-support/mcsWorkbenchStubs')
    .ecmoPreviewModule(),
)
jest.mock('../components/ImpellaVariantPreview', () =>
  jest
    .requireActual<
      typeof import('../test-support/mcsWorkbenchStubs')
    >('../test-support/mcsWorkbenchStubs')
    .impellaPreviewModule(),
)

import {
  mcsLessons,
  mcsSectionLearningContracts,
  type McsSectionLearningContract,
} from '../content'
import { mcsRevealStage } from '../components/teaching/revealStage'
import {
  advanceSimulation,
  commitPredictionPhase,
  commitTransferPhase,
  completeRecognizePhase,
  continueFromPhase,
  flushAnimationFrames,
  jumpToSharedPhase,
  learnPhase,
  learnTransfer,
  progressWriteCount,
  renderWorkbench,
  renderWorkbenchOnFakeTimers,
  satisfyLearnAction,
  satisfyLearnTransferActions,
  seedStoredProgress,
  setupMcsWorkbenchEnvironment,
  sharedStepperPhase,
  storedLessonIds,
  teardownMcsWorkbenchEnvironment,
  workThroughLearnSection,
} from '../test-support/mcsWorkbench'

const sections = mcsSectionLearningContracts.map(
  (contract) => [contract.sectionId, contract] as const,
)

function revealStageHost(container: HTMLElement): string {
  return container
    .querySelector('[data-mcs-teaching-panel-host]')
    ?.getAttribute('data-reveal-stage') as string
}

function walkToPhase(contract: McsSectionLearningContract, target: 'act' | 'observe' | 'explain') {
  completeRecognizePhase(contract.sectionId)
  continueFromPhase('recognize')
  commitPredictionPhase(contract.sectionId)
  continueFromPhase('predict')
  if (target === 'act') return
  satisfyLearnAction(contract.sectionId)
  continueFromPhase('act')
  if (target === 'observe') return
  continueFromPhase('observe')
}

describe('MCS M5 — every Learn section opens on its authored contract', () => {
  beforeEach(() => setupMcsWorkbenchEnvironment({ route: '/mechanical-circulatory-support/learn' }))
  afterEach(() => teardownMcsWorkbenchEnvironment())

  it.each(sections)(
    'opens %s on its clinical question, authored surface, and starting topology',
    async (sectionId, contract) => {
      const { container } = await renderWorkbench({
        section: 'learn',
        initialActivityId: sectionId,
      })

      expect(screen.getByRole('heading', { name: contract.clinicalQuestion })).toBeInTheDocument()
      const primary = container.querySelector('[data-primary-surface]')
      expect(primary?.getAttribute('data-primary-surface')).toBe(contract.primarySurface)
      expect(primary?.getAttribute('data-primary-target')).toBe(contract.primaryTarget)
      expect(learnPhase()).toBe('recognize')
      expect(screen.getAllByText(contract.recognizePrompt).length).toBeGreaterThan(0)
    },
  )

  it('names what the pathway shows when the recognition is wrong', async () => {
    const contract = mcsSectionLearningContracts[0]
    await renderWorkbench({ section: 'learn', initialActivityId: contract.sectionId })
    const wrong = contract.recognizeOptions.find((option) => !option.correct)!
    const right = contract.recognizeOptions.find((option) => option.correct)!

    fireEvent.click(screen.getByRole('radio', { name: wrong.label }))
    fireEvent.click(screen.getByRole('button', { name: 'Record what you identified' }))

    const feedback = document.querySelector('[data-recognize-feedback]') as HTMLElement
    expect(feedback).toHaveAttribute('data-right', 'false')
    expect(within(feedback).getByText('Not this one')).toBeInTheDocument()
    expect(within(feedback).getByText(wrong.feedback)).toBeInTheDocument()
    // The corrective half: what the pathway actually shows, not merely that the answer was wrong.
    expect(within(feedback).getByText('What the pathway shows:')).toBeInTheDocument()
    expect(within(feedback).getByText(right.feedback)).toBeInTheDocument()
    // A wrong recognition still lets the learner continue: the phase is a step, not a gate.
    expect(screen.getByRole('button', { name: /^Continue to the prediction/ })).toBeEnabled()
  })

  it.each(sections)('presents %s with no learner-visible completion control', async (sectionId) => {
    await renderWorkbench({ section: 'learn', initialActivityId: sectionId })

    expect(screen.queryByRole('button', { name: /Mark lesson complete/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /complete this section/i })).not.toBeInTheDocument()
  })
})

describe('MCS M5 — prediction timing in Learn', () => {
  beforeEach(() => setupMcsWorkbenchEnvironment({ route: '/mechanical-circulatory-support/learn' }))
  afterEach(() => teardownMcsWorkbenchEnvironment())

  it.each(sections)(
    'withholds the %s verdict until it is committed, then shows it without advancing',
    async (sectionId, contract) => {
      const { container } = await renderWorkbench({
        section: 'learn',
        initialActivityId: sectionId,
      })
      completeRecognizePhase(sectionId)
      continueFromPhase('recognize')

      // Precommit: the answer is not in the DOM at all, not merely out of sight.
      expect(container.querySelector('[data-answer-verdict]')).toBeNull()
      expect(container.textContent).not.toContain(contract.predictionItem.explanation)
      expect(screen.getByRole('button', { name: 'Commit this answer' })).toBeDisabled()

      commitPredictionPhase(sectionId)

      expect(container.querySelector('[data-answer-verdict]')).not.toBeNull()
      expect(learnPhase()).toBe('predict')
      expect(sharedStepperPhase()).toBe('Predict')
      expect(storedLessonIds()).toEqual([])

      // A separate control does the advancing.
      continueFromPhase('predict')
      expect(learnPhase()).toBe('act')
    },
  )

  it.each(sections)(
    'keeps the %s teaching panel reveal stage in step with the phase',
    async (sectionId, contract) => {
      const { container } = await renderWorkbench({
        section: 'learn',
        initialActivityId: sectionId,
      })

      expect(revealStageHost(container)).toBe(mcsRevealStage('recognize', false))
      completeRecognizePhase(sectionId)
      continueFromPhase('recognize')
      expect(revealStageHost(container)).toBe(mcsRevealStage('predict', false))

      commitPredictionPhase(sectionId)
      expect(revealStageHost(container)).toBe(mcsRevealStage('predict', true))

      continueFromPhase('predict')
      expect(revealStageHost(container)).toBe(mcsRevealStage('act', true))
      satisfyLearnAction(contract.sectionId)
      continueFromPhase('act')
      expect(revealStageHost(container)).toBe(mcsRevealStage('observe', true))
      continueFromPhase('observe')
      expect(revealStageHost(container)).toBe(mcsRevealStage('explain', true))
      continueFromPhase('explain')
      expect(revealStageHost(container)).toBe(mcsRevealStage('transfer', true))
    },
  )
})

describe('MCS M5 — the Act phase asks for a real control and reads the resulting state', () => {
  beforeEach(() => setupMcsWorkbenchEnvironment({ route: '/mechanical-circulatory-support/learn' }))
  afterEach(() => teardownMcsWorkbenchEnvironment())

  it.each(sections)(
    'presents the authored %s action mode and gates Continue on the resulting state',
    async (sectionId, contract) => {
      const { container } = await renderWorkbench({
        section: 'learn',
        initialActivityId: sectionId,
      })
      walkToPhase(contract, 'act')

      expect(screen.getAllByText(contract.actionInstruction).length).toBeGreaterThan(0)
      if (contract.actionMode === 'inspect-only') {
        expect(container.querySelector('[data-inspect-only]')).not.toBeNull()
        expect(container.querySelector('[data-target-control]')).toBeNull()
      } else {
        expect(
          container.querySelector('[data-target-control]')?.getAttribute('data-target-control'),
        ).toBe(contract.targetControl)
        // The control the instruction names is present, and it is the only one highlighted.
        expect(
          container.querySelector(`[data-mcs-control="${contract.targetControl}"]`),
        ).not.toBeNull()
        expect(container.querySelectorAll('[data-mcs-control-highlighted="true"]')).toHaveLength(1)
      }

      const advance = screen.getByRole('button', { name: /^Continue to what changed/ })
      expect(advance).toBeDisabled()
      satisfyLearnAction(sectionId)
      expect(screen.getByRole('button', { name: /^Continue to what changed/ })).toBeEnabled()
    },
  )

  it('does not accept an unrelated control as the requested action', async () => {
    // The LVAD parameters section asks for systemic vascular resistance, and nothing else.
    await renderWorkbench({ section: 'learn', initialActivityId: 'lvad-parameters-assessment' })
    walkToPhase(mcsSectionLearningContracts[6], 'act')

    fireEvent.change(screen.getByRole('slider', { name: 'PEEP' }), { target: { value: '12' } })
    expect(screen.getByRole('button', { name: /^Continue to what changed/ })).toBeDisabled()

    fireEvent.change(screen.getByRole('slider', { name: 'SVR' }), { target: { value: '2000' } })
    expect(screen.getByRole('button', { name: /^Continue to what changed/ })).toBeEnabled()
  })

  it('reads the adjustment predicate from the resulting state, not from the action id', async () => {
    // Moving the highlighted control the wrong way dispatches the authored action id and still
    // leaves the section unsatisfied, because the predicate is a statement about the state.
    await renderWorkbench({ section: 'learn', initialActivityId: 'iabp-efficacy-limits' })
    walkToPhase(mcsSectionLearningContracts[3], 'act')

    fireEvent.change(screen.getByRole('slider', { name: 'RV contractility' }), {
      target: { value: '1.2' },
    })
    expect(screen.getByRole('button', { name: /^Continue to what changed/ })).toBeDisabled()

    fireEvent.change(screen.getByRole('slider', { name: 'RV contractility' }), {
      target: { value: '0.3' },
    })
    expect(screen.getByRole('button', { name: /^Continue to what changed/ })).toBeEnabled()
  })
})

describe('MCS M5 — Observe, Explain, and Transfer', () => {
  beforeEach(() => setupMcsWorkbenchEnvironment({ route: '/mechanical-circulatory-support/learn' }))
  afterEach(() => teardownMcsWorkbenchEnvironment())

  it.each(sections)(
    'compares %s at Observe against the baseline captured on entering Act',
    async (sectionId, contract) => {
      const { container } = await renderWorkbench({
        section: 'learn',
        initialActivityId: sectionId,
      })
      walkToPhase(contract, 'observe')

      const table = container.querySelector<HTMLElement>('[data-before-after]')
      expect(table).not.toBeNull()
      for (const signal of contract.observedSignals) {
        const row = table!.querySelector<HTMLElement>(`[data-signal="${String(signal.key)}"]`)
        expect(row).not.toBeNull()
        expect(within(row!).getByRole('rowheader')).toHaveTextContent(signal.label)
        // A baseline was captured, so no reading may claim it was not.
        expect(row!.querySelectorAll('td')[0].textContent).not.toBe('not captured')
      }
    },
  )

  it.each(sections)(
    'renders the accepted causal ladder for %s at Explain',
    async (sectionId, contract) => {
      const { container } = await renderWorkbench({
        section: 'learn',
        initialActivityId: sectionId,
      })
      walkToPhase(contract, 'explain')

      expect(screen.getByText('This establishes')).toBeInTheDocument()
      expect(screen.getByText('This does not establish')).toBeInTheDocument()
      expect(screen.getAllByText(contract.whatThisDoesNotEstablish).length).toBeGreaterThan(0)
      const ladder = container.querySelector('[data-causal-ladder-summary]')
      expect(ladder).not.toBeNull()
      for (const level of ['Pressure', 'Flow', 'Oxygen delivery', 'Organ response']) {
        expect(within(ladder as HTMLElement).getByText(level)).toBeInTheDocument()
      }
    },
  )

  it.each(sections)(
    'opens %s Transfer on its own authored patient state',
    async (sectionId, contract) => {
      await renderWorkbench({ section: 'learn', initialActivityId: sectionId })
      walkToPhase(contract, 'explain')
      continueFromPhase('explain')

      expect(learnPhase()).toBe('transfer')
      const transfer = learnTransfer(sectionId)
      expect(screen.getByText(transfer.item.stem)).toBeInTheDocument()
      expect(screen.getByText(transfer.requiredActionLabel)).toBeInTheDocument()
      // Both a response and the paired live work are required before the answer can be committed.
      expect(screen.getByRole('button', { name: 'Commit this transfer answer' })).toBeDisabled()
    },
  )
})

describe('MCS M5 — Learn completion is sequence-derived', () => {
  beforeEach(() => setupMcsWorkbenchEnvironment({ route: '/mechanical-circulatory-support/learn' }))
  afterEach(() => teardownMcsWorkbenchEnvironment())

  it.each(sections)(
    'records %s only at the transfer endpoint, and once',
    async (sectionId, contract) => {
      await renderWorkbench({ section: 'learn', initialActivityId: sectionId })

      expect(storedLessonIds()).toEqual([])
      completeRecognizePhase(sectionId)
      expect(storedLessonIds()).toEqual([])
      continueFromPhase('recognize')
      commitPredictionPhase(sectionId)
      expect(storedLessonIds()).toEqual([])
      continueFromPhase('predict')
      satisfyLearnAction(sectionId)
      expect(storedLessonIds()).toEqual([])
      continueFromPhase('act')
      expect(storedLessonIds()).toEqual([])
      continueFromPhase('observe')
      expect(storedLessonIds()).toEqual([])
      continueFromPhase('explain')
      expect(storedLessonIds()).toEqual([])

      satisfyLearnTransferActions(sectionId)
      expect(storedLessonIds()).toEqual([])
      commitTransferPhase(sectionId)

      await waitFor(() => expect(storedLessonIds()).toContain(contract.sectionId))
      expect(storedLessonIds()).toHaveLength(1)
    },
  )

  it('states the participation boundary and claims no readiness', async () => {
    await renderWorkbench({ section: 'learn', initialActivityId: 'mcs-foundations-signals' })
    workThroughLearnSection('mcs-foundations-signals')

    const completion = await screen.findByRole('region', { name: 'Section worked through' })
    expect(
      within(completion).getByText(/records participation in an educational module/),
    ).toBeVisible()
    expect(completion.textContent).toMatch(/does not establish readiness for independent device/)
    expect(completion.textContent).not.toMatch(/competen|certif|qualified to/i)
  })

  it('writes the completion once and does not rewrite it on every simulation tick', async () => {
    await renderWorkbenchOnFakeTimers({
      section: 'learn',
      initialActivityId: 'lvad-alarms-emergencies',
    })
    workThroughLearnSection('lvad-alarms-emergencies')
    await act(async () => {
      jest.advanceTimersByTime(0)
    })
    const writesAfterCompletion = progressWriteCount()
    expect(writesAfterCompletion).toBe(1)

    advanceSimulation(2_000)
    expect(progressWriteCount()).toBe(writesAfterCompletion)
    expect(storedLessonIds()).toEqual(['lvad-alarms-emergencies'])
  })

  it('does not duplicate the id when an already recorded section is revisited', async () => {
    seedStoredProgress({ completedLessonIds: ['mcs-foundations-signals'] })
    await renderWorkbench({ section: 'learn', initialActivityId: 'mcs-foundations-signals' })

    workThroughLearnSection('mcs-foundations-signals')
    await waitFor(() =>
      expect(screen.getByRole('region', { name: 'Section worked through' })).toBeInTheDocument(),
    )
    expect(storedLessonIds()).toEqual(['mcs-foundations-signals'])
  })

  it('preserves the first section, and existing case history, when a second is worked through', async () => {
    seedStoredProgress({
      completedLessonIds: ['mcs-foundations-signals'],
      completedCaseIds: ['IABP-01'],
      masteredCaseIds: ['IABP-01'],
      completedCapstoneIds: ['CAP-IABP-01'],
      bestScores: { 'IABP-01': 91 },
    })
    await renderWorkbench({ section: 'learn', initialActivityId: 'iabp-timing-triggering' })

    workThroughLearnSection('iabp-timing-triggering')

    await waitFor(() => expect(storedLessonIds()).toContain('iabp-timing-triggering'))
    expect(storedLessonIds()).toContain('mcs-foundations-signals')
    const stored = JSON.parse(window.localStorage.getItem('interventionalpulm:mcs-progress:v1')!)
    expect(stored.masteredCaseIds).toEqual(['IABP-01'])
    expect(stored.completedCapstoneIds).toEqual(['CAP-IABP-01'])
    expect(stored.bestScores).toEqual({ 'IABP-01': 91 })
  })

  it('recommends a next section that is neither the active one nor an already recorded one', async () => {
    seedStoredProgress({ completedLessonIds: [mcsLessons[0].id, mcsLessons[1].id] })
    await renderWorkbench({ section: 'learn', initialActivityId: mcsLessons[2].id })

    const recommended = await screen.findByRole('link', { name: /^Next recommended/ })
    expect(recommended).toHaveAttribute(
      'href',
      `/mechanical-circulatory-support/learn?lesson=${mcsLessons[3].id}`,
    )
  })
})

describe('MCS M5 — Learn phase navigation', () => {
  beforeEach(() => setupMcsWorkbenchEnvironment({ route: '/mechanical-circulatory-support/learn' }))
  afterEach(() => teardownMcsWorkbenchEnvironment())

  it('refuses a shared-stepper jump past the furthest phase worked through', async () => {
    await renderWorkbench({ section: 'learn', initialActivityId: 'mcs-foundations-signals' })

    jumpToSharedPhase('Transfer')
    expect(learnPhase()).toBe('recognize')
    jumpToSharedPhase('Act')
    expect(learnPhase()).toBe('recognize')
  })

  it('allows a return to an earlier phase without losing the furthest one', async () => {
    await renderWorkbench({ section: 'learn', initialActivityId: 'mcs-foundations-signals' })
    completeRecognizePhase('mcs-foundations-signals')
    continueFromPhase('recognize')
    commitPredictionPhase('mcs-foundations-signals')
    continueFromPhase('predict')
    expect(learnPhase()).toBe('act')

    jumpToSharedPhase('Recognize')
    expect(learnPhase()).toBe('recognize')

    // The furthest phase survives the visit, so the learner can come straight back.
    jumpToSharedPhase('Act')
    expect(learnPhase()).toBe('act')
  })

  it('keeps the committed prediction when the learner returns to Predict', async () => {
    const contract = mcsSectionLearningContracts[0]
    await renderWorkbench({ section: 'learn', initialActivityId: contract.sectionId })
    completeRecognizePhase(contract.sectionId)
    continueFromPhase('recognize')
    commitPredictionPhase(contract.sectionId)
    continueFromPhase('predict')

    jumpToSharedPhase('Predict')

    expect(learnPhase()).toBe('predict')
    expect(screen.queryByRole('button', { name: 'Commit this answer' })).not.toBeInTheDocument()
    expect(document.querySelector('[data-answer-verdict]')).not.toBeNull()
  })

  it('moves focus back to the activity viewport after a stepper jump', async () => {
    await renderWorkbench({ section: 'learn', initialActivityId: 'mcs-foundations-signals' })
    completeRecognizePhase('mcs-foundations-signals')
    continueFromPhase('recognize')

    jumpToSharedPhase('Recognize')
    // The workbench schedules the focus move on the next animation frame.
    flushAnimationFrames()

    expect(document.activeElement).toHaveAttribute('id', 'mcs-activity-viewport')
  })

  it('returns the section to Recognize when the activity is reset', async () => {
    await renderWorkbench({ section: 'learn', initialActivityId: 'iabp-timing-triggering' })
    completeRecognizePhase('iabp-timing-triggering')
    continueFromPhase('recognize')
    commitPredictionPhase('iabp-timing-triggering')
    continueFromPhase('predict')
    expect(learnPhase()).toBe('act')

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))

    expect(learnPhase()).toBe('recognize')
    expect(document.querySelector('[data-answer-verdict]')).toBeNull()
    // The furthest phase resets with it, so the stepper cannot jump forward again.
    jumpToSharedPhase('Act')
    expect(learnPhase()).toBe('recognize')
  })

  it('closes an open help note when the phase changes', async () => {
    await renderWorkbench({ section: 'learn', initialActivityId: 'mcs-foundations-signals' })
    fireEvent.click(screen.getByRole('button', { name: 'Help with this step' }))
    expect(document.querySelector('[data-learn-help]')).not.toBeNull()

    completeRecognizePhase('mcs-foundations-signals')
    continueFromPhase('recognize')

    expect(document.querySelector('[data-learn-help]')).toBeNull()
  })

  it('keeps the primary surface mounted across every phase change', async () => {
    const contract = mcsSectionLearningContracts[2]
    const { container } = await renderWorkbench({
      section: 'learn',
      initialActivityId: contract.sectionId,
    })

    const surfaceAt = () => container.querySelector('[data-primary-surface]')
    expect(surfaceAt()).not.toBeNull()
    completeRecognizePhase(contract.sectionId)
    continueFromPhase('recognize')
    expect(surfaceAt()).not.toBeNull()
    commitPredictionPhase(contract.sectionId)
    continueFromPhase('predict')
    expect(surfaceAt()).not.toBeNull()
    satisfyLearnAction(contract.sectionId)
    continueFromPhase('act')
    expect(surfaceAt()).not.toBeNull()
    continueFromPhase('observe')
    expect(surfaceAt()).not.toBeNull()
    continueFromPhase('explain')
    expect(surfaceAt()).not.toBeNull()
  })
})

describe('MCS M5 — moving between Learn sections', () => {
  beforeEach(() => setupMcsWorkbenchEnvironment({ route: '/mechanical-circulatory-support/learn' }))
  afterEach(() => teardownMcsWorkbenchEnvironment())

  it('resets the six-phase runtime and the learner answers when the section changes', async () => {
    await renderWorkbench({ section: 'learn', initialActivityId: 'iabp-timing-triggering' })
    completeRecognizePhase('iabp-timing-triggering')
    continueFromPhase('recognize')
    commitPredictionPhase('iabp-timing-triggering')
    continueFromPhase('predict')
    satisfyLearnAction('iabp-timing-triggering')
    continueFromPhase('act')
    expect(learnPhase()).toBe('observe')

    fireEvent.click(screen.getByRole('button', { name: /^Ahead to/ }))

    expect(learnPhase()).toBe('recognize')
    expect(document.querySelector('[data-answer-verdict]')).toBeNull()
    expect(document.querySelector('[data-recognize-feedback]')).toBeNull()
    // And the furthest phase went with it: the stepper cannot jump forward again.
    jumpToSharedPhase('Observe')
    expect(learnPhase()).toBe('recognize')
  })

  it('gives the new section its own authored starting device and starting actions', async () => {
    const { container } = await renderWorkbench({
      section: 'learn',
      initialActivityId: 'iabp-timing-triggering',
    })
    // The IABP timing section opens with inflation authored 120 ms early.
    completeRecognizePhase('iabp-timing-triggering')
    continueFromPhase('recognize')
    commitPredictionPhase('iabp-timing-triggering')
    continueFromPhase('predict')
    expect(screen.getByRole('slider', { name: 'Inflation vs notch' })).toHaveValue('-120')

    fireEvent.click(screen.getByRole('button', { name: /^Ahead to/ }))
    completeRecognizePhase('iabp-efficacy-limits')
    continueFromPhase('recognize')
    commitPredictionPhase('iabp-efficacy-limits')
    continueFromPhase('predict')

    // The efficacy section authors no offset, so the inherited −120 ms must not have survived. The
    // workspace still carries the timing slider; what matters is that it is back at its baseline.
    expect(
      container.querySelector('[data-target-control]')?.getAttribute('data-target-control'),
    ).toBe('control:patient-rv-contractility')
    expect(screen.getByRole('slider', { name: 'Inflation vs notch' })).toHaveValue('0')
  })

  it('keeps unrelated stored progress when the section changes', async () => {
    seedStoredProgress({ completedLessonIds: ['mcs-foundations-mechanisms'] })
    await renderWorkbench({ section: 'learn', initialActivityId: 'iabp-timing-triggering' })

    fireEvent.click(screen.getByRole('button', { name: /^Back to/ }))

    expect(storedLessonIds()).toEqual(['mcs-foundations-mechanisms'])
  })

  it('offers Back and Ahead that open the neighbouring authored sections', async () => {
    await renderWorkbench({ section: 'learn', initialActivityId: mcsLessons[4].id })

    expect(
      screen.getByRole('button', { name: `Back to ${mcsLessons[3].title}` }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: `Ahead to ${mcsLessons[5].title}` }),
    ).toBeInTheDocument()
  })

  it('sends the last section on to Practice rather than inventing another lesson', async () => {
    const last = mcsLessons[mcsLessons.length - 1]
    await renderWorkbench({ section: 'learn', initialActivityId: last.id })

    expect(screen.queryByRole('button', { name: /^Ahead to/ })).not.toBeInTheDocument()
    workThroughLearnSection(last.id)

    const onward = await screen.findByRole('link', { name: /Continue to practice/ })
    expect(onward).toHaveAttribute('href', '/mechanical-circulatory-support/practice')
  })

  it('continues from a worked-through section to the next authored section', async () => {
    await renderWorkbench({ section: 'learn', initialActivityId: mcsLessons[0].id })
    workThroughLearnSection(mcsLessons[0].id)

    const onward = await screen.findByRole('button', {
      name: `Continue to the next section: ${mcsLessons[1].title}`,
    })
    fireEvent.click(onward)

    expect(learnPhase()).toBe('recognize')
    expect(
      screen.getByRole('heading', { name: mcsSectionLearningContracts[1].clinicalQuestion }),
    ).toBeInTheDocument()
  })
})
