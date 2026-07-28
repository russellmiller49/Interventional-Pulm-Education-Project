import { act, render } from '@testing-library/react'

import { recordCriticalCareEvent } from '@/features/critical-care/analytics'

import { useCriticalCareActivityAnalytics } from '../analytics'
import type { CriticalCareActivityPhase } from '../types'

jest.mock('@/features/critical-care/analytics', () => ({
  recordCriticalCareEvent: jest.fn(),
}))

const recordEvent = jest.mocked(recordCriticalCareEvent)

function Harness({
  phase = 'recognize',
  activityId = 'ventilation:practice:MV-01',
}: {
  readonly phase?: CriticalCareActivityPhase
  readonly activityId?: string
}) {
  const analytics = useCriticalCareActivityAnalytics({
    moduleId: 'mechanical-ventilation',
    activityId,
    mode: 'practice',
    phase,
    qualificationDelayMs: 30_000,
  })
  return (
    <div>
      <button type="button" onClick={analytics.recordPredictionSubmitted}>
        prediction
      </button>
      <button type="button" onClick={analytics.recordHintUsed}>
        hint
      </button>
      <button type="button" onClick={analytics.recordSafetyEvent}>
        safety
      </button>
      <button type="button" onClick={analytics.recordGoalMet}>
        goal
      </button>
      <button type="button" onClick={analytics.recordDebriefViewed}>
        debrief
      </button>
      <button type="button" onClick={analytics.recordTransferCompleted}>
        transfer
      </button>
      <button type="button" onClick={() => analytics.recordActivityCompleted(true)}>
        mastered
      </button>
    </div>
  )
}

describe('critical-care activity lifecycle analytics', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    recordEvent.mockClear()
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('emits an opened event and qualifies only after 30 visible seconds', () => {
    render(<Harness />)

    expect(recordEvent).toHaveBeenCalledWith({
      interaction: 'critical_care_activity_opened',
      moduleId: 'mechanical-ventilation',
      activityId: 'ventilation:practice:MV-01',
      mode: 'practice',
    })

    act(() => jest.advanceTimersByTime(29_999))
    expect(recordEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ interaction: 'critical_care_qualified_start' }),
    )

    act(() => jest.advanceTimersByTime(1))
    expect(recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        interaction: 'critical_care_qualified_start',
        qualification: '30-visible-seconds',
      }),
    )
  })

  it('records the first meaningful interaction, semantic phases, and bounded lifecycle events once', () => {
    const view = render(<Harness />)

    view.getByRole('button', { name: 'prediction' }).click()
    view.getByRole('button', { name: 'prediction' }).click()
    view.rerender(<Harness phase="predict" />)
    view.getByRole('button', { name: 'hint' }).click()
    view.getByRole('button', { name: 'hint' }).click()
    view.getByRole('button', { name: 'safety' }).click()
    view.getByRole('button', { name: 'safety' }).click()
    view.getByRole('button', { name: 'goal' }).click()
    view.getByRole('button', { name: 'goal' }).click()
    view.getByRole('button', { name: 'debrief' }).click()
    view.getByRole('button', { name: 'transfer' }).click()
    view.getByRole('button', { name: 'mastered' }).click()

    expect(recordEvent.mock.calls.map(([event]) => event.interaction)).toEqual([
      'critical_care_activity_opened',
      'critical_care_qualified_start',
      'critical_care_prediction_submitted',
      'critical_care_phase_completed',
      'critical_care_hint_used',
      'critical_care_hint_used',
      'critical_care_safety_event',
      'critical_care_safety_event',
      'critical_care_goal_met',
      'critical_care_debrief_viewed',
      'critical_care_transfer_completed',
      'critical_care_activity_mastered',
    ])
    expect(recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        interaction: 'critical_care_phase_completed',
        phase: 'recognize',
      }),
    )
    for (const [event] of recordEvent.mock.calls) {
      expect(Object.keys(event).sort()).toEqual(
        expect.arrayContaining(['activityId', 'interaction', 'mode', 'moduleId']),
      )
      expect(event).not.toHaveProperty('text')
      expect(event).not.toHaveProperty('truth')
      expect(event).not.toHaveProperty('waveform')
      expect(event).not.toHaveProperty('command')
    }
  })

  it('pauses qualification while hidden and resets the lifecycle for a new activity identity', () => {
    const view = render(<Harness />)
    act(() => jest.advanceTimersByTime(10_000))

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    })
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    act(() => jest.advanceTimersByTime(30_000))
    expect(recordEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ interaction: 'critical_care_qualified_start' }),
    )

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    })
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    act(() => jest.advanceTimersByTime(20_000))
    expect(recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        interaction: 'critical_care_qualified_start',
        qualification: '30-visible-seconds',
      }),
    )

    view.rerender(<Harness activityId="ventilation:practice:MV-02" />)
    const opened = recordEvent.mock.calls
      .map(([event]) => event)
      .filter((event) => event.interaction === 'critical_care_activity_opened')
    expect(opened).toHaveLength(2)
    expect(opened.at(-1)).toEqual(
      expect.objectContaining({ activityId: 'ventilation:practice:MV-02' }),
    )
  })
})
