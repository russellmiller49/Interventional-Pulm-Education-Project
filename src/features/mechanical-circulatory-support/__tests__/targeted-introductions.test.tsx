import { cleanup, fireEvent, screen, within } from '@testing-library/react'

jest.mock('@/i18n/navigation', () =>
  jest.requireActual('../test-support/mcsWorkbenchStubs').navigationModule(),
)
jest.mock('../components/McsAnatomy3D', () =>
  jest.requireActual('../test-support/mcsWorkbenchStubs').anatomyModule(),
)

import { mcsIntroductions } from '../content/introductorySteps'
import { mcsPracticeScenarios } from '../content/scenarios'
import { mcsSectionLearningContractById } from '../content/sectionLearningContracts'
import { mcsLessonTransferByLessonId } from '../content/lessonTransfers'
import {
  advanceMcsSimulation,
  createInitialMcsState,
  deriveBaselineMeasurements,
} from '../engine/model'
import { mcsReducer } from '../engine/reducer'
import {
  applyMcsLearningAction,
  captureMcsDeviceComparison,
  mcsTeachingSetup,
} from '../engine/learningSession'
import { createDefaultMcsProgress, readMcsProgress, writeMcsProgress } from '../engine/progress'
import type { McsAction } from '../engine/types'
import {
  answerIdentification,
  commitPrediction,
  commitTransfer,
  completeIntroductorySteps,
  continueFromVerdict,
  continueStep,
  currentStepId,
  mountSection,
  nowCard,
  nowPrimary,
  performAction,
  setupMcsStage,
  storedLessonIds,
  teardownMcsStage,
} from '../test-support/mcsStage'

beforeEach(() => setupMcsStage())
afterEach(() => {
  cleanup()
  teardownMcsStage()
})

function reachAct(id: string) {
  answerIdentification(id)
  continueStep()
  commitPrediction(id)
  continueFromVerdict()
}

/**
 * The run's identity line with its seed. MCS-PRE-REVIEW-03 moved the seed out of the always-visible
 * line into the step bar's "Run details" disclosure (F03); the identity these assertions compare is
 * unchanged, so the helper reads the seed from where it now lives.
 */
function sessionIdentity(): string {
  const line = document.querySelector('[data-session-identity]')?.textContent ?? ''
  const seed = document.querySelector('[data-run-details] p')?.textContent?.match(/Seed (\d+)/)?.[1]
  return seed ? `${line} seed ${seed}` : line
}

describe('targeted introductions through the actual host', () => {
  it.each(Object.keys(mcsIntroductions))(
    '%s offers introductory teaching and an optional question',
    (id) => {
      mountSection(id)
      const teaching = document.querySelector('[data-intro-teaching]')!
      expect(teaching.textContent).toContain(mcsIntroductions[id][0].paragraphs[0])
      expect(document.querySelector('[data-prediction-choices]')).toBeNull()
      expect(document.querySelector('[data-surface="anatomy"]')).not.toBeNull()
      expect(document.querySelector('[data-stage-completion]')).toBeNull()
      completeIntroductorySteps(id)
      expect(currentStepId()).toBe(`${id}-recognize`)
      expect(document.querySelector('[data-intro-teaching]')).toBeNull()
      expect(document.querySelector('[data-identify-feedback]')).toBeNull()
      expect(document.querySelector('[data-surface="anatomy"]')).not.toBeNull()
      expect(storedLessonIds()).toEqual([])
    },
  )

  it('retains all three actual engine results in reverse order ending on IABP', () => {
    const id = 'mcs-foundations-mechanisms'
    mountSection(id)
    reachAct(id)
    const identity = sessionIdentity()
    const seed = Number(identity.match(/seed (\d+)/)![1])
    for (const [device, label] of [
      ['lvad', /Select the durable/],
      ['impella', /Select the transvalvular/],
      ['iabp', /Select the counterpulsation/],
    ] as const) {
      fireEvent.click(within(nowCard()).getByRole('button', { name: label }))
      const row = document.querySelector(`[data-comparison-device="${device}"]`)!
      const actual = advanceMcsSimulation(createInitialMcsState('learn', device, null, seed), 8)
      expect(
        document.querySelector(
          `[data-comparison-metric="nativeFlowLMin"] [data-device="${device}"]`,
        )?.textContent,
      ).toBe(actual.metrics.nativeFlowLMin.toFixed(2))
      expect(
        document.querySelector(
          `[data-comparison-metric="effectiveSystemicFlowLMin"] [data-device="${device}"]`,
        )?.textContent,
      ).toBe(actual.metrics.effectiveSystemicFlowLMin.toFixed(2))
      expect(row.textContent).toContain(`Seed ${seed} · captured at 8.00 s`)
    }
    expect(nowPrimary()).toBeEnabled()
    continueStep()
    expect(document.querySelectorAll('[data-comparison-device]')).toHaveLength(3)
    expect(document.querySelector('[data-retained-comparison]')?.textContent).toContain(
      'no separate pump-flow stream',
    )
    expect(document.querySelector('[data-before-after-labels]')).toBeNull()
    expect(document.querySelector('[data-retained-comparison]')?.textContent).not.toMatch(
      /pump now|extra stream from the balloon/i,
    )
  })

  it('allows either placement fault and resets the model without claiming completion', () => {
    const id = 'impella-unloading-placement'
    mountSection(id)
    reachAct(id)
    expect(nowPrimary()).toBeEnabled()
    const placement = screen.getByRole('combobox', { name: 'Placement state' })
    fireEvent.change(placement, { target: { value: 'too-shallow' } })
    expect(nowPrimary()).toBeEnabled()
    fireEvent.change(placement, { target: { value: 'too-deep' } })
    expect(nowPrimary()).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Reset this model exercise' }))
    expect(placement).toHaveValue('correct')
    expect(nowPrimary()).toBeEnabled()
    expect(storedLessonIds()).toEqual([])
    expect(document.querySelector('[data-stage-completion]')).toBeNull()
  })

  it('compares an optional direction against actual captured readings', () => {
    const id = 'lvad-parameters-assessment'
    mountSection(id)
    reachAct(id)
    performAction(id)
    continueStep()
    const row = document.querySelector('[data-signal="deviceFlowLMin"]')!
    expect(row.textContent).toContain('decreased')
    expect(nowPrimary()).toBeEnabled()
    fireEvent.click(within(nowCard()).getByRole('radio', { name: 'Increased' }))
    fireEvent.click(within(nowCard()).getByRole('button', { name: 'Compare answer' }))
    expect(document.querySelector('[data-observation-feedback]')).toHaveAttribute(
      'data-correct',
      'false',
    )
    expect(document.querySelector('[data-observation-feedback]')?.textContent).toContain(
      'Not correct.',
    )
    expect(within(nowCard()).getByRole('radio', { name: 'Decreased' })).toBeDisabled()
  })

  it('reviews captured patient identity after transfer and returns without losing transfer work', () => {
    const id = 'iabp-timing-triggering'
    mountSection(id)
    reachAct(id)
    performAction(id)
    continueStep()
    continueStep()
    const priorIdentity = sessionIdentity()
    continueStep()
    const transferIdentity = sessionIdentity()
    expect(transferIdentity.match(/seed \d+/)?.[0]).not.toBe(priorIdentity.match(/seed \d+/)?.[0])
    commitTransfer(id)
    fireEvent.change(screen.getByRole('combobox', { name: 'Trigger source' }), {
      target: { value: 'pressure' },
    })
    expect(storedLessonIds()).toEqual([]) // Changing source alone is insufficient.
    const current = sessionIdentity()
    fireEvent.click(document.querySelector('[data-now-back]')!)
    expect(sessionIdentity()).toContain(priorIdentity.match(/seed \d+/)![0])
    expect(sessionIdentity()).toMatch(/^Captured review/)
    expect(document.querySelectorAll('[data-task-controls] input:not(:disabled)')).toHaveLength(0)
    continueStep()
    expect(sessionIdentity()).toBe(current)
    expect(screen.getByRole('combobox', { name: 'Trigger source' })).toHaveValue('pressure')
    const observation = document.querySelector('[data-transfer-observation]')! as HTMLElement
    fireEvent.click(
      within(observation).getByRole('radio', { name: 'Unchanged within displayed precision' }),
    )
    fireEvent.click(
      within(observation).getByRole('button', { name: 'Record transfer observation' }),
    )
    expect(storedLessonIds()).toEqual([])
    expect(document.querySelector('[data-transfer-observation-feedback]')).not.toBeNull()
    fireEvent.click(within(nowCard()).getByRole('button', { name: 'Try again' }))
    expect(document.querySelector('[data-transfer-observation-feedback]')).toBeNull()
    expect(within(observation).getByRole('radio', { name: 'Increased' })).toBeEnabled()
    expect(document.querySelectorAll('input[type="radio"]:checked')).toHaveLength(0)
  })

  it('keeps existing completion and attempt history across direct-link entry and a remount', () => {
    const previous = {
      ...createDefaultMcsProgress(),
      completedLessonIds: ['iabp-efficacy-limits'],
      completedCaseIds: ['historical-case'],
      bestScores: { 'historical-case': 85 },
    }
    writeMcsProgress(previous)
    const first = mountSection('impella-unloading-placement', 'transfer')
    expect(currentStepId()).toBe('impella-unloading-placement-transfer')
    first.unmount()
    mountSection('impella-unloading-placement', 'act')
    expect(currentStepId()).toBe('impella-unloading-placement-act')
    expect(readMcsProgress()).toMatchObject(previous)
    expect(document.querySelector('[data-stage-completion]')).toBeNull()
  })
})

describe('real model and feature-local policy', () => {
  it.each(['impella', 'lvad'] as const)(
    '%s combines concurrent parallel components and subtracts represented recirculation',
    (device) => {
      const state = mcsTeachingSetup(device, [
        { type: 'SET_PATIENT_CONTROL', control: 'aorticInsufficiencySeverity', value: 0.45 },
      ])
      const m = state.metrics
      expect(m.recirculatingFlowLMin).toBeGreaterThan(0)
      expect(m.effectiveSystemicFlowLMin).toBeCloseTo(
        m.nativeFlowLMin + m.leftDeviceFlowLMin - m.recirculatingFlowLMin,
        1,
      )
      expect(m.nativeFlowLMin).not.toBeCloseTo(
        deriveBaselineMeasurements(state.patient).cardiacOutputLMin,
        1,
      )
    },
  )

  it('does not add serial RP flow to systemic flow, or invent a separate IABP pump stream', () => {
    const state = mcsTeachingSetup('impella', [
      { type: 'SET_IMPELLA_CONFIGURATION', control: 'rightEnabled', value: true },
    ])
    const m = state.metrics
    expect(m.rightDeviceFlowLMin).toBeGreaterThan(0)
    expect(m.effectiveSystemicFlowLMin).toBeCloseTo(
      m.nativeFlowLMin + m.leftDeviceFlowLMin - m.recirculatingFlowLMin,
      1,
    )
    const iabp = mcsTeachingSetup('iabp')
    expect(iabp.metrics.deviceFlowLMin).toBe(0)
    expect(iabp.metrics.effectiveSystemicFlowLMin).toBe(iabp.metrics.nativeFlowLMin)
    expect(mcsReducer(iabp, { type: 'INSPECT', id: 'device' }).responseMessage).toContain(
      'no separate pump-flow stream',
    )
  })

  it('enforces task scope for alternate dispatch, review, setup and reset actions', () => {
    const state = mcsTeachingSetup('lvad')
    const actions: McsAction[] = [
      { type: 'SET_PATIENT_CONTROL', control: 'systemicVascularResistanceDynSecCm5', value: 2000 },
      { type: 'SET_LVAD_CONTROL', control: 'speedChangeAuthorized', value: true },
      { type: 'SELECT_DEVICE', device: 'impella' },
      { type: 'TICK', seconds: 30 },
      { type: 'CLEAR_ACTION_LOG' },
    ]
    for (const action of actions)
      expect(applyMcsLearningAction(state, action, ['inspect:device'])).toBe(state)
    expect(
      applyMcsLearningAction(state, { type: 'INSPECT', id: 'device' }, ['inspect:device'], true),
    ).toBe(state)
    expect(
      applyMcsLearningAction(
        state,
        { type: 'SET_LVAD_CONTROL', control: 'speedRpm', value: 6000 },
        ['lvad:set-speed'],
      ),
    ).toBe(state)
    expect(
      mcsTeachingSetup('iabp', [
        { type: 'SET_IABP_CONTROL', control: 'inflationOffsetMs', value: -120 },
      ]).actionIds,
    ).toEqual([])
  })

  it('opens supported patient changes despite old case permissions and preserves scenario topology', () => {
    const scenario = mcsPracticeScenarios[0]
    const state = createInitialMcsState('practice', scenario.device, scenario)
    const restricted = {
      ...state,
      scenario: { ...scenario, permittedActionIds: ['inspect:device'] },
    }
    expect(
      applyMcsLearningAction(
        restricted,
        { type: 'SET_PATIENT_CONTROL', control: 'preloadPercent', value: 180 },
        ['patient:set-preload'],
      ).patient.preloadPercent,
    ).toBe(145)
    expect(
      applyMcsLearningAction(restricted, { type: 'SELECT_DEVICE', device: 'lvad' }, [
        'device:select:lvad',
      ]),
    ).toBe(restricted)
  })

  it('matches comparison patient, configuration, interval and seed without carrying extra changes', () => {
    const changed = mcsTeachingSetup(
      'impella',
      [{ type: 'SET_PATIENT_CONTROL', control: 'preloadPercent', value: 70 }],
      99,
    )
    const lvad = captureMcsDeviceComparison(changed, 'lvad')
    const iabp = captureMcsDeviceComparison(lvad.state, 'iabp')
    expect(lvad.patient).toEqual(iabp.patient)
    expect(lvad.patient.preloadPercent).not.toBe(70)
    expect([lvad.seed, iabp.seed]).toEqual([99, 99])
    expect([lvad.observationSeconds, iabp.observationSeconds]).toEqual([8, 8])
    expect(lvad.configuration.kind).toBe('lvad')
    expect(lvad.additionalVariablesChanged).toBe(false)
  })

  it('does not announce IABP correction for stopped support or a second timing fault', () => {
    const contract = mcsSectionLearningContractById.get('iabp-timing-triggering')!
    const aligned = mcsReducer(mcsTeachingSetup('iabp'), {
      type: 'SET_IABP_CONTROL',
      control: 'inflationOffsetMs',
      value: 0,
    })
    expect(contract.isActionSatisfied(aligned)).toBe(true)
    expect(
      contract.isActionSatisfied(
        mcsReducer(aligned, { type: 'SET_IABP_CONTROL', control: 'running', value: false }),
      ),
    ).toBe(false)
    expect(
      contract.isActionSatisfied(
        mcsReducer(aligned, { type: 'SET_IABP_CONTROL', control: 'deflationOffsetMs', value: 100 }),
      ),
    ).toBe(false)
    const transfer = mcsLessonTransferByLessonId.get('iabp-timing-triggering')!
    // MCS-03-05 changed this contract. It used to assert that ending on ECG triggering left the
    // transfer work undone, which rewarded the model's atrial-fibrillation trigger rating against the
    // supplied Cardiosave material. The genuine prerequisite — a running balloon — is still held.
    expect(
      transfer.isWorkSatisfied?.(
        mcsReducer(aligned, { type: 'SET_IABP_CONTROL', control: 'triggerSource', value: 'ecg' }),
      ),
    ).toBe(true)
    expect(
      transfer.isWorkSatisfied?.(
        mcsReducer(aligned, { type: 'SET_IABP_CONTROL', control: 'running', value: false }),
      ),
    ).toBe(false)
  })
})
