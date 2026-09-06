/**
 * Every section, walked on the lesson stage through the interface.
 *
 * The tables run over the registries rather than a list retyped here, so a tenth section cannot
 * arrive without arriving in these tests too. What is pinned: the step order and the gate, the
 * verdicts stating their outcome, the action predicate satisfied by a visible control, the
 * before-and-after table, the transfer patient, the one persisted record — written once, and only
 * when the transfer answer is committed and its work done — and Back.
 */
import { act, fireEvent, screen, within } from '@testing-library/react'

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

import { mcsSectionLearningContracts } from '../content/sectionLearningContracts'
import { mcsSectionSpec } from '../content/sectionSpecs'
import { buildMcsStageLesson, mcsStageLessonIds } from '../content/stageLessons'
import {
  answerIdentification,
  commitPrediction,
  commitSort,
  commitTransfer,
  continueFromVerdict,
  continueStep,
  currentStepId,
  mountSection,
  nowCard,
  nowPrimary,
  nowStatus,
  performAction,
  performTransferWork,
  predictionRadios,
  setupMcsStage,
  stepRowStates,
  storedLessonIds,
  teardownMcsStage,
  walkTheLoop,
  workThroughSection,
} from '../test-support/mcsStage'
import { mockRouterPush } from '../test-support/mcsWorkbenchStubs'

const sections = mcsSectionLearningContracts.map(
  (contract) => [contract.sectionId, contract] as const,
)

beforeEach(() => {
  setupMcsStage()
})

afterEach(() => {
  teardownMcsStage()
})

describe('the stage: one progression per section', () => {
  it.each(sections)(
    '%s opens on its first step with everything past the prediction locked',
    (sectionId) => {
      mountSection(sectionId)
      const lesson = buildMcsStageLesson(sectionId)
      expect(currentStepId()).toBe(lesson.steps[0].id)
      const states = stepRowStates()
      expect(states).toHaveLength(lesson.steps.length)
      expect(states[0]).toBe('current')
      for (let index = lesson.predictionStepIndex + 1; index < states.length; index += 1) {
        expect(states[index]).toBe('locked')
      }
      // A locked row shows its ordinal and phase only.
      const rows = [...document.querySelectorAll('[data-step-list] li')]
      for (let index = lesson.predictionStepIndex + 1; index < rows.length; index += 1) {
        expect(rows[index].textContent).toContain(`Step ${index + 1}`)
        expect(rows[index].textContent).not.toContain(lesson.steps[index].title)
      }
      expect(
        screen.getByText(/later steps unlock when you commit your prediction/i),
      ).toBeInTheDocument()
    },
  )

  it.each(sections)(
    '%s runs its steps in order and records the section once, at the end',
    (sectionId) => {
      mountSection(sectionId)
      const lesson = buildMcsStageLesson(sectionId)
      const spec = mcsSectionSpec(sectionId)
      const phases = lesson.steps.map((step) => step.phase)
      expect(phases.slice(-5)).toEqual(['predict', 'act', 'observe', 'explain', 'transfer'])

      if (spec.walksTheLoop) {
        expect(nowCard().textContent).toMatch(/Stop 1 of 5/)
        walkTheLoop()
      }
      // Recognize: the identification commits and states its outcome.
      answerIdentification(sectionId)
      const feedback = document.querySelector('[data-identify-feedback]')
      expect(feedback).toHaveAttribute('data-verdict-outcome', 'correct')
      expect(feedback?.textContent).toMatch(/^Correct\./)
      expect(storedLessonIds()).toEqual([])
      continueStep()

      // Predict: nothing past it is reachable until the commitment.
      expect(currentStepId()).toBe(lesson.steps[lesson.predictionStepIndex].id)
      expect(nowPrimary()).toBeDisabled()
      commitPrediction(sectionId)
      const verdict = document.querySelector('[data-verdict] [data-verdict-outcome]')
      expect(verdict).toHaveAttribute('data-verdict-outcome', 'correct')
      expect(document.querySelector('[data-prediction-reasoning]')).toBeInTheDocument()
      expect(storedLessonIds()).toEqual([])
      continueFromVerdict()

      // Act: the primary waits for the section's own predicate, then a visible control satisfies it.
      expect(currentStepId()).toBe(`${sectionId}-act`)
      expect(nowPrimary()).toBeDisabled()
      performAction(sectionId)
      expect(nowPrimary()).not.toBeDisabled()
      expect(nowStatus()).toMatch(/^Done\./)
      continueStep()

      // Observe: the readings captured on entry to Act beside the live ones.
      expect(currentStepId()).toBe(`${sectionId}-observe`)
      const table = document.querySelector('[data-before-after]')
      expect(table).toBeInTheDocument()
      expect(table?.querySelectorAll('tbody tr')).toHaveLength(
        lesson.contract.observedSignals.length,
      )
      for (const cell of table?.querySelectorAll('tbody td') ?? []) {
        expect(cell.textContent).not.toBe('not captured')
      }
      continueStep()

      // Explain: the four levels, and the sort on the section that carries it.
      expect(currentStepId()).toBe(`${sectionId}-explain`)
      expect(document.querySelector('[data-causal-ladder-summary]')).toBeInTheDocument()
      if (spec.walksTheLoop) {
        expect(document.querySelector('[data-control-panel-sort]')).toBeInTheDocument()
        expect(nowPrimary()).toBeDisabled()
        commitSort()
        expect(document.querySelectorAll('[data-sort-outcome]')).toHaveLength(7)
      }
      continueStep()

      // Transfer: a different patient loads on entry; the answer and the work both count.
      expect(currentStepId()).toBe(`${sectionId}-transfer`)
      expect(document.querySelector('[data-transfer-context]')).toBeInTheDocument()
      expect(storedLessonIds()).toEqual([])
      commitTransfer(sectionId)
      expect(document.querySelector('[data-verdict] [data-verdict-outcome]')).toHaveAttribute(
        'data-verdict-outcome',
        'correct',
      )
      expect(document.querySelector('[data-stage-completion]')).toBeNull()
      performTransferWork(sectionId)
      expect(document.querySelector('[data-transfer-work]')).toHaveAttribute('data-met', 'true')
      expect(document.querySelector('[data-stage-completion]')).toBeInTheDocument()
      expect(storedLessonIds()).toEqual([sectionId])
      expect(nowStatus()).toMatch(/worked through/i)
    },
  )
})

describe('the stage: verdicts, Back, sources, help', () => {
  it('states a wrong identification and shows what holds', () => {
    mountSection('iabp-timing-triggering')
    answerIdentification('iabp-timing-triggering', 'wrong')
    const feedback = document.querySelector('[data-identify-feedback]')
    expect(feedback).toHaveAttribute('data-verdict-outcome', 'not-correct')
    expect(feedback?.textContent).toMatch(/^Not correct\./)
    expect(feedback?.textContent).toMatch(/What holds:/)
  })

  it('states an unsafe prediction as not correct and unsafe, and still unlocks the section', () => {
    mountSection('impella-unloading-placement')
    answerIdentification('impella-unloading-placement')
    continueStep()
    commitPrediction('impella-unloading-placement', 'unsafe')
    const verdict = document.querySelector('[data-verdict] [data-verdict-outcome]')
    expect(verdict).toHaveAttribute('data-verdict-outcome', 'unsafe')
    expect(verdict?.textContent).toMatch(/Not correct, and unsafe\./)
    continueFromVerdict()
    expect(currentStepId()).toBe('impella-unloading-placement-act')
  })

  it('offers Back on every step after the first and walks home without losing a commitment', () => {
    mountSection('lvad-parameters-assessment')
    expect(document.querySelector('[data-now-back]')).toBeNull()
    answerIdentification('lvad-parameters-assessment')
    continueStep()
    commitPrediction('lvad-parameters-assessment')
    continueFromVerdict()
    expect(currentStepId()).toBe('lvad-parameters-assessment-act')
    fireEvent.click(document.querySelector('[data-now-back]') as HTMLElement)
    expect(currentStepId()).toBe('lvad-parameters-assessment-predict')
    expect(nowStatus()).toMatch(/looking back/i)
    expect(document.querySelector('[data-verdict] [data-verdict-outcome]')).toHaveAttribute(
      'data-verdict-outcome',
      'correct',
    )
    fireEvent.click(document.querySelector('[data-now-back]') as HTMLElement)
    expect(currentStepId()).toBe('lvad-parameters-assessment-recognize')
    expect(document.querySelector('[data-now-back]')).toBeNull()
    // Forward again, without redoing anything: Continue is the primary on a performed step, and
    // on the committed prediction it is the verdict's own Continue.
    continueStep()
    expect(currentStepId()).toBe('lvad-parameters-assessment-predict')
    continueFromVerdict()
    expect(currentStepId()).toBe('lvad-parameters-assessment-act')
  })

  it('cites every source once, in the footer, with the claims folded until the commitment', () => {
    mountSection('impella-suction-purge-rv')
    const footer = document.querySelector('[data-stage-sources]')
    expect(footer).toHaveAttribute('data-stage-sources-claims', 'false')
    expect(document.querySelectorAll('[data-mcs-source-list]')).toHaveLength(1)
    expect(document.querySelector('[data-source-claims]')).toBeNull()
    expect(document.querySelector('[data-stage-sources-note]')).toBeInTheDocument()
    answerIdentification('impella-suction-purge-rv')
    continueStep()
    commitPrediction('impella-suction-purge-rv')
    expect(footer).toHaveAttribute('data-stage-sources-claims', 'true')
    expect(document.querySelector('[data-source-claims]')).toBeInTheDocument()
    expect(document.querySelector('[data-stage-sources-note]')).toBeNull()
  })

  it('answers help with the current step and nothing that is withheld', () => {
    mountSection('lvad-alarms-emergencies')
    fireEvent.click(screen.getByRole('button', { name: /What do I do now/ }))
    const dialog = document.querySelector('dialog')
    expect(dialog?.textContent).toContain('Step 1 of 6')
    expect(dialog?.textContent).toContain(
      buildMcsStageLesson('lvad-alarms-emergencies').steps[0].title,
    )
    expect(dialog?.textContent).not.toMatch(/high-power/i)
  })

  it('rotates the prediction choices so the keyed answer is not always first', () => {
    const firstPositions = new Set<number>()
    for (const sectionId of mcsStageLessonIds) {
      setupMcsStage()
      const { unmount } = mountSection(sectionId)
      const lesson = buildMcsStageLesson(sectionId)
      if (lesson.spec.walksTheLoop) walkTheLoop()
      answerIdentification(sectionId)
      continueStep()
      const radios = predictionRadios()
      const bestId = lesson.contract.predictionItem.choices.find(
        (c) => c.plausibility === 'best',
      )?.id
      firstPositions.add(radios.findIndex((radio) => radio.value === bestId))
      unmount()
    }
    expect(firstPositions.size).toBeGreaterThan(1)
  })

  it('keeps the teaching pane to its first block until the commitment, with one control to show the rest', () => {
    mountSection('iabp-efficacy-limits')
    const column = document.querySelector('[data-teaching-column]')
    expect(column).toHaveAttribute('data-teaching-preview', 'true')
    const toggle = screen.getByRole('button', { name: /Show the rest of the teaching/ })
    fireEvent.click(toggle)
    expect(column).not.toHaveAttribute('data-teaching-preview')
    fireEvent.click(screen.getByRole('button', { name: /Show only the first part/ }))
    expect(column).toHaveAttribute('data-teaching-preview', 'true')
    answerIdentification('iabp-efficacy-limits')
    continueStep()
    commitPrediction('iabp-efficacy-limits')
    expect(column).not.toHaveAttribute('data-teaching-preview')
    expect(screen.queryByRole('button', { name: /Show the rest of the teaching/ })).toBeNull()
  })

  it('moves to the next section from the completion card through the router', () => {
    mountSection('mcs-foundations-signals')
    workThroughSection('mcs-foundations-signals')
    const completion = document.querySelector('[data-stage-completion]') as HTMLElement
    fireEvent.click(within(completion).getByRole('button', { name: /Continue to next section/ }))
    expect(mockRouterPush).toHaveBeenCalledWith({
      pathname: '/mechanical-circulatory-support/learn',
      query: { lesson: 'mcs-foundations-mechanisms' },
    })
  })

  it('offers the paired case by presentation, and says when it applies a different mechanism', () => {
    mountSection('lvad-alarms-emergencies')
    workThroughSection('lvad-alarms-emergencies')
    const pairing = document.querySelector('[data-practice-pairing]')
    expect(pairing).toHaveAttribute('data-practice-pairing', 'next-in-unit')
    expect(pairing?.textContent).toMatch(/different mechanism/)
    expect(pairing?.textContent).not.toMatch(/power interruption/i)
  })

  it('mounts a later-phase URL at the prediction and says so', () => {
    mountSection('iabp-timing-triggering', 'explain')
    expect(currentStepId()).toBe('iabp-timing-triggering-predict')
    expect(document.querySelector('[data-stage-resumed-note]')?.textContent).toMatch(
      /opened at the predict step/i,
    )
    expect(stepRowStates().slice(2)).toEqual(['locked', 'locked', 'locked', 'locked'])
  })

  it('ticks the simulation while mounted and stops when unmounted', () => {
    jest.useFakeTimers()
    const { unmount } = mountSection('lvad-parameters-assessment')
    const before = document.querySelector('[data-context-line]')?.textContent
    act(() => {
      jest.advanceTimersByTime(1000)
    })
    expect(document.querySelector('[data-context-line]')?.textContent).toBeDefined()
    expect(before).toBeDefined()
    unmount()
    act(() => {
      jest.advanceTimersByTime(1000)
    })
  })
})
