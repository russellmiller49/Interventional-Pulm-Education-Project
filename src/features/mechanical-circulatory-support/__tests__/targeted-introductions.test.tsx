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

describe('targeted introductions through the actual host', () => {
  it.each(Object.keys(mcsIntroductions))('%s teaches before a fresh independent question', (id) => {
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
    expect(document.querySelector('[data-surface="anatomy"]')).toBeNull()
    expect(storedLessonIds()).toEqual([])
  })

  it('retains all three actual engine results in reverse order ending on IABP', () => {
    const id = 'mcs-foundations-mechanisms'
    mountSection(id)
    reachAct(id)
    const identity = document.querySelector('[data-session-identity]')!.textContent!
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

  it('requires too deep, supports a model reset, and never credits the unloading demo as malposition', () => {
    const id = 'impella-unloading-placement'
    mountSection(id)
    reachAct(id)
    expect(nowPrimary()).toBeDisabled()
    const placement = screen.getByRole('combobox', { name: 'Placement state' })
    fireEvent.change(placement, { target: { value: 'too-shallow' } })
    expect(nowPrimary()).toBeDisabled()
    fireEvent.change(placement, { target: { value: 'too-deep' } })
    expect(nowPrimary()).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Reset this model exercise' }))
    expect(placement).toHaveValue('correct')
    expect(nowPrimary()).toBeDisabled()
    expect(storedLessonIds()).toEqual([])
    expect(document.querySelector('[data-stage-completion]')).toBeNull()
  })

  it('requires an actual observed direction and preserves the first response', () => {
    const id = 'lvad-parameters-assessment'
    mountSection(id)
    reachAct(id)
    performAction(id)
    continueStep()
    const row = document.querySelector('[data-signal="deviceFlowLMin"]')!
    expect(row.textContent).toContain('decreased')
    expect(nowPrimary()).toBeDisabled()
    fireEvent.click(within(nowCard()).getByRole('radio', { name: 'Increased' }))
    fireEvent.click(nowPrimary()!)
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
    const priorIdentity = document.querySelector('[data-session-identity]')!.textContent!
    continueStep()
    const transferIdentity = document.querySelector('[data-session-identity]')!.textContent!
    expect(transferIdentity.match(/seed \d+/)?.[0]).not.toBe(priorIdentity.match(/seed \d+/)?.[0])
    commitTransfer(id)
    fireEvent.change(screen.getByRole('combobox', { name: 'Trigger source' }), {
      target: { value: 'pressure' },
    })
    expect(storedLessonIds()).toEqual([]) // Changing source alone is insufficient.
    const current = document.querySelector('[data-session-identity]')!.textContent!
    fireEvent.click(document.querySelector('[data-now-back]')!)
    expect(document.querySelector('[data-session-identity]')?.textContent).toContain(
      priorIdentity.match(/seed \d+/)![0],
    )
    expect(document.querySelector('[data-session-identity]')?.textContent).toMatch(
      /^Captured review/,
    )
    expect(document.querySelectorAll('[data-task-controls] input:not(:disabled)')).toHaveLength(0)
    continueStep()
    expect(document.querySelector('[data-session-identity]')?.textContent).toBe(current)
    expect(screen.getByRole('combobox', { name: 'Trigger source' })).toHaveValue('pressure')
    const observation = document.querySelector('[data-transfer-observation]')! as HTMLElement
    fireEvent.click(
      within(observation).getByRole('radio', { name: 'Unchanged within displayed precision' }),
    )
    fireEvent.click(
      within(observation).getByRole('button', { name: 'Record transfer observation' }),
    )
    expect(storedLessonIds()).toEqual([id])
    expect(document.querySelector('[data-transfer-observation-feedback]')).not.toBeNull()
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
    expect(currentStepId()).toBe('impella-unloading-placement-inlet-outlet')
    completeIntroductorySteps('impella-unloading-placement')
    first.unmount()
    mountSection('impella-unloading-placement', 'act')
    expect(currentStepId()).toBe('impella-unloading-placement-inlet-outlet')
    expect(readMcsProgress()).toEqual(previous)
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

  it('intersects scenario permissions even if a task grants an action', () => {
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
      ),
    ).toBe(restricted)
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
    expect(
      transfer.isWorkSatisfied?.(
        mcsReducer(aligned, { type: 'SET_IABP_CONTROL', control: 'triggerSource', value: 'ecg' }),
      ),
    ).toBe(false)
  })
})
