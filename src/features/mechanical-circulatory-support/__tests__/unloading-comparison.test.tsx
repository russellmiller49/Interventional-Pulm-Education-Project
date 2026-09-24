import { cleanup, fireEvent, screen, within } from '@testing-library/react'

jest.mock('@/i18n/navigation', () =>
  jest.requireActual('../test-support/mcsWorkbenchStubs').navigationModule(),
)
jest.mock('../components/McsAnatomy3D', () =>
  jest.requireActual('../test-support/mcsWorkbenchStubs').anatomyModule(),
)

import { replayMcsUnloadingComparison } from '../engine/unloadingComparison'
import {
  advanceMcsSimulation,
  createInitialMcsState,
  totalMcsCirculatingVolume,
} from '../engine/model'
import { mcsReducer } from '../engine/reducer'
import { mcsUnloadingSignals, MCS_UNLOADING_COMPARISON_LEVELS } from '../content/unloadingExamples'
import { mcsPracticeScenarios } from '../content/scenarios'
import { createDefaultMcsProgress, readMcsProgress, writeMcsProgress } from '../engine/progress'
import {
  continueStep,
  currentStepId,
  mountSection,
  nowPrimary,
  setupMcsStage,
  teardownMcsStage,
} from '../test-support/mcsStage'

beforeEach(() => setupMcsStage())
afterEach(() => {
  cleanup()
  teardownMcsStage()
})

function openComparison() {
  const rendered = mountSection('impella-unloading-placement')
  for (let i = 0; i < 6 && !document.querySelector('[data-unloading-comparison]'); i++)
    continueStep()
  expect(currentStepId()).toBe('impella-unloading-placement-unloading-example')
  return rendered
}

function compareVisibleOutputs(level: 6 | 8) {
  for (const example of replayMcsUnloadingComparison(level)) {
    const card = document.querySelector(`[data-unloading-condition="${example.id}"]`) as HTMLElement
    expect(within(card).getByRole('table')).toHaveAccessibleName(
      `Provided outputs at ${example.changed.timeSeconds.toFixed(2)} simulated seconds`,
    )
    for (const [key, , unit, digits] of mcsUnloadingSignals) {
      const cells = within(
        card.querySelector(`[data-unloading-signal="${key}"]`) as HTMLElement,
      ).getAllByRole('cell')
      const difference = Number(
        (example.changed.metrics[key] - example.control.metrics[key]).toFixed(digits),
      )
      expect(cells.map((cell) => cell.textContent)).toEqual([
        example.control.metrics[key].toFixed(digits),
        example.changed.metrics[key].toFixed(digits),
        difference === 0
          ? 'No resolvable displayed change'
          : `${difference > 0 ? '+' : '−'}${Math.abs(difference).toFixed(digits)} ${unit}`,
      ])
    }
  }
}

describe('matched unloading replay over the real engine', () => {
  it.each(MCS_UNLOADING_COMPARISON_LEVELS)(
    'compares P5 with P%s at identical times, preserving volume and flow accounting',
    (level) => {
      const examples = replayMcsUnloadingComparison(level)
      const [filled, underfilled] = examples
      expect(underfilled.baseline.patient).toEqual({
        ...filled.baseline.patient,
        preloadPercent: 58,
      })
      expect(underfilled.baseline.device).toEqual(filled.baseline.device)
      expect(underfilled.changed.timeSeconds).toBe(filled.changed.timeSeconds)
      for (const { baseline, control, changed } of examples) {
        expect(changed.timeSeconds).toBe(control.timeSeconds)
        expect(changed.timeSeconds - baseline.timeSeconds).toBeCloseTo(8.02, 8)
        expect(changed.patient).toEqual(control.patient)
        expect(control.device).toMatchObject({
          kind: 'impella',
          left: { performanceLevel: 5, position: 'correct', purgeState: 'normal' },
          right: { enabled: false },
        })
        expect(changed.device).toMatchObject({
          kind: 'impella',
          left: { performanceLevel: level, position: 'correct', purgeState: 'normal' },
          right: { enabled: false },
        })
        for (const state of [baseline, control, changed]) {
          expect(totalMcsCirculatingVolume(state)).toBeCloseTo(
            totalMcsCirculatingVolume(baseline),
            3,
          )
          const m = state.metrics
          expect(
            Math.abs(
              m.effectiveSystemicFlowLMin -
                (m.nativeFlowLMin + m.leftDeviceFlowLMin - m.recirculatingFlowLMin),
            ),
          ).toBeLessThanOrEqual(0.02)
          expect(m.rightDeviceFlowLMin).toBe(0)
          expect(m.deviceFlowLMin).toBe(m.leftDeviceFlowLMin)
          expect(state.actionIds).toEqual([])
          expect(state.selectedPredictionId).toBeNull()
          expect(state.completed).toBe(false)
          expect(state.score).toBeNull()
        }
      }
      expect(replayMcsUnloadingComparison(level)).toEqual(examples)
    },
  )

  it('retains smaller volumes with flat displayed wedge pressure and persistent suction', () => {
    const [filled, underfilled] = replayMcsUnloadingComparison(6)
    expect([filled.control.metrics.lvedvMl, filled.changed.metrics.lvedvMl]).toEqual([118, 114])
    expect([filled.control.metrics.pcwpMmHg, filled.changed.metrics.pcwpMmHg]).toEqual([18, 18])
    expect([underfilled.control.metrics.lvedvMl, underfilled.changed.metrics.lvedvMl]).toEqual([
      95, 92,
    ])
    expect([underfilled.control.metrics.pcwpMmHg, underfilled.changed.metrics.pcwpMmHg]).toEqual([
      11, 11,
    ])
    for (const state of [underfilled.control, underfilled.changed])
      expect(
        state.alarms.some((alarm) => alarm.active && alarm.id === 'impella-left-suction'),
      ).toBe(true)
  })

  it('preserves the existing suction escalation warning in the real IMP-01 case', () => {
    const scenario = mcsPracticeScenarios.find((candidate) => candidate.id === 'IMP-01')!
    const state = advanceMcsSimulation(
      createInitialMcsState('practice', 'impella', scenario, 417),
      8,
    )
    const escalated = mcsReducer(state, {
      type: 'SET_IMPELLA_CONTROL',
      side: 'left',
      control: 'performanceLevel',
      value: 9,
    })
    expect(escalated.criticalErrors).toContain('impella-escalated-through-suction')
    expect(
      escalated.alarms.some((alarm) => alarm.active && alarm.id === 'impella-left-suction'),
    ).toBe(true)
  })

  it('reproduces the changed branch independently without carrying a prior run forward', () => {
    let expected = createInitialMcsState('learn', 'impella', null, 417)
    expected = mcsReducer(expected, {
      type: 'SET_PATIENT_CONTROL',
      control: 'preloadPercent',
      value: 58,
    })
    expected = mcsReducer(expected, {
      type: 'SET_IMPELLA_CONTROL',
      side: 'left',
      control: 'performanceLevel',
      value: 5,
    })
    expected = advanceMcsSimulation(expected, 8)
    expected = mcsReducer(expected, {
      type: 'SET_IMPELLA_CONTROL',
      side: 'left',
      control: 'performanceLevel',
      value: 8,
    })
    expected = advanceMcsSimulation(expected, 8)
    const changed = replayMcsUnloadingComparison(8)[1].changed
    expect(changed.metrics).toEqual(expected.metrics)
    expect(changed.compartments).toEqual(expected.compartments)
    expect(changed.alarms).toEqual(expected.alarms)
  })
})

describe('self-paced unloading example through the actual host', () => {
  it('shows both comparisons and the explanation with no answer or learner capture', () => {
    openComparison()
    compareVisibleOutputs(6)
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'How to read the comparison' })).toBeVisible()
    expect(screen.getByText(/Suction remains present at both settings/)).toBeVisible()
    expect(document.querySelector('[data-captured-results]')).toBeNull()
    expect(document.querySelector('[data-full-exploration]')).toBeNull()
    expect(nowPrimary()).toBeEnabled()
  })

  it('changes the provided comparison, replays and resets, leaving legacy progress untouched', () => {
    const legacy = {
      ...createDefaultMcsProgress(),
      completedCaseIds: ['historical-case'],
      bestScores: { 'historical-case': 85 },
    }
    writeMcsProgress(legacy)
    openComparison()
    const progress = readMcsProgress()
    fireEvent.click(screen.getByRole('button', { name: 'P8' }))
    compareVisibleOutputs(8)
    fireEvent.click(screen.getByRole('button', { name: 'Replay comparison' }))
    compareVisibleOutputs(8)
    fireEvent.click(screen.getByRole('button', { name: 'Reset comparison to P6' }))
    compareVisibleOutputs(6)
    expect(readMcsProgress()).toEqual(progress)
    expect(readMcsProgress()).toMatchObject(legacy)
    expect(global.fetch).not.toHaveBeenCalled()
    expect(document.querySelector('[data-unloading-comparison]')?.textContent).not.toMatch(
      /score|passed|mastered|correct answer/i,
    )
  })

  it('continues without interaction, reopens the provided example and preserves the fresh placement exercise', () => {
    openComparison()
    continueStep()
    expect(currentStepId()).toBe('impella-unloading-placement-recognize')
    const map = screen.getByRole('list', { name: 'All lesson tasks' })
    fireEvent.click(
      within(map).getByRole('button', { name: 'Guided example: ventricular unloading' }),
    )
    compareVisibleOutputs(6)
    expect(document.querySelector('[data-session-identity]')).toHaveTextContent(
      'Provided model comparison',
    )
    fireEvent.click(within(map).getByRole('button', { name: 'Move the inlet out of position' }))
    expect(screen.getByRole('combobox', { name: 'Placement state' })).toHaveValue('correct')
    expect(screen.getByRole('button', { name: 'Explore all supported controls' })).toBeEnabled()
    expect(document.querySelector('[data-unloading-comparison]')).toBeNull()
  })

  it('remounts with the documented topic boundary and no invented retained example or capture', () => {
    const first = openComparison()
    fireEvent.click(screen.getByRole('button', { name: 'P8' }))
    first.unmount()
    openComparison()
    compareVisibleOutputs(6)
    expect(document.querySelector('[data-captured-results]')).toBeNull()
    expect(readMcsProgress().completedLessonIds).toEqual([])
  })
})
