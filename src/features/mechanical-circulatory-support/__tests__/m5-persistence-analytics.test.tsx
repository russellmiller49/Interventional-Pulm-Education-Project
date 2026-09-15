// MCS-01 replaces graded writes and detailed lifecycle collection. Existing clock/cleanup tests remain.
import { act, fireEvent, screen } from '@testing-library/react'
jest.mock('@/i18n/navigation', () =>
  jest.requireActual('../test-support/mcsWorkbenchStubs').navigationModule(),
)
jest.mock('../components/McsAnatomy3D', () =>
  jest.requireActual('../test-support/mcsWorkbenchStubs').anatomyModule(),
)

import { createDefaultMcsProgress } from '../engine/progress'
import {
  readMcsLearningProgress,
  recordMcsVisit,
  MCS_LOCAL_PROGRESS_KEY,
} from '../engine/learningProgress'
import { nextIncompleteMcsSectionLink } from '../content/pathwayResolver'
import {
  renderWorkbench,
  renderWorkbenchWithoutSettling,
  renderWorkbenchOnFakeTimers,
  setupMcsWorkbenchEnvironment,
  teardownMcsWorkbenchEnvironment,
  capturedIntervalDelays,
  everyInstalledIntervalCleared,
  pendingAnimationFrameCount,
  flushAnimationFrames,
  seedStoredProgress,
  capturedAnalyticsEvents,
} from '../test-support/mcsWorkbench'

beforeEach(setupMcsWorkbenchEnvironment)
afterEach(teardownMcsWorkbenchEnvironment)
it('preserves every legacy value and unknown field through visits, help, reset and explanation', async () => {
  const legacy = {
    ...createDefaultMcsProgress(),
    bestScores: { 'IABP-01': 91 },
    masteredCaseIds: ['IABP-01'],
    completedLessonIds: ['old-lesson'],
    unknown: { firstAttempt: 'untouched' },
  }
  localStorage.setItem(MCS_LOCAL_PROGRESS_KEY, JSON.stringify(legacy))
  await renderWorkbench({ section: 'practice', initialActivityId: 'IABP-01' })
  fireEvent.click(screen.getByRole('button', { name: 'Hint' }))
  fireEvent.click(screen.getByRole('button', { name: 'Show explanation' }))
  fireEvent.click(screen.getAllByRole('button', { name: 'Reset' })[0])
  const saved = JSON.parse(localStorage.getItem(MCS_LOCAL_PROGRESS_KEY)!)
  const { selfPaced, ...historical } = saved
  expect(historical).toEqual(legacy)
  expect(Object.keys(selfPaced).sort()).toEqual(
    [
      'lastActivityId',
      'lastDevice',
      'lastPhase',
      'locationUpdatedAt',
      'lastSection',
      'visitedCaseIds',
      'visitedLessonIds',
    ].sort(),
  )
  expect(capturedAnalyticsEvents()).toEqual([])
})
it('never infers visits or recommendations from legacy grades', () => {
  seedStoredProgress({
    completedLessonIds: ['mcs-foundations-signals'],
    masteredCaseIds: ['IABP-01'],
    bestScores: { 'IABP-01': 100 },
  })
  const progress = readMcsLearningProgress()
  expect(progress.visitedLessonIds).toEqual([])
  expect(progress.visitedCaseIds).toEqual([])
  expect(nextIncompleteMcsSectionLink(progress).state).toBe('start')
})
it.each(['{ bad json', JSON.stringify({ version: 99 }), JSON.stringify(null)])(
  'leaves unreadable or newer storage intact: %s',
  (raw) => {
    localStorage.setItem(MCS_LOCAL_PROGRESS_KEY, raw)
    expect(recordMcsVisit('IABP-01', 'practice', 'iabp')).toBe(false)
    expect(localStorage.getItem(MCS_LOCAL_PROGRESS_KEY)).toBe(raw)
  },
)
it('handles unavailable storage without blocking learning', () => {
  const spy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('storage disabled')
  })
  expect(recordMcsVisit('IABP-01', 'practice', 'iabp')).toBe(false)
  spy.mockRestore()
})
it('deduplicates actual topic visits and resumes the last location', () => {
  recordMcsVisit('mcs-foundations-signals', 'learn', 'iabp', 'predict')
  recordMcsVisit('mcs-foundations-signals', 'learn', 'iabp', 'explain')
  expect(readMcsLearningProgress().visitedLessonIds).toEqual(['mcs-foundations-signals'])
  expect(nextIncompleteMcsSectionLink(readMcsLearningProgress()).href).toContain('phase=explain')
})
it('retains no responses or model actions across a reload', async () => {
  const view = await renderWorkbench({ section: 'practice', initialActivityId: 'IABP-01' })
  fireEvent.change(screen.getByRole('slider', { name: 'Preload' }), { target: { value: '135' } })
  view.unmount()
  await renderWorkbench({ section: 'practice', initialActivityId: 'IABP-01' })
  expect(screen.getByRole('slider', { name: 'Preload' })).not.toHaveValue('135')
  fireEvent.click(screen.getByRole('button', { name: 'Show explanation' }))
  expect(document.querySelector('[data-worked-explanation]')).toHaveTextContent(
    'No actions performed.',
  )
})
describe('MCS M5 — the simulation interval and unmount cleanup', () => {
  beforeEach(() => setupMcsWorkbenchEnvironment())
  afterEach(() => teardownMcsWorkbenchEnvironment())

  it('installs exactly one interval, at the normal cadence', async () => {
    await renderWorkbenchOnFakeTimers({ section: 'practice' })

    expect(capturedIntervalDelays()).toEqual([100])
  })

  it('installs the reduced-motion cadence when the media query matches', async () => {
    setupMcsWorkbenchEnvironment({ reducedMotion: true })
    await renderWorkbenchOnFakeTimers({ section: 'practice' })

    expect(capturedIntervalDelays()).toEqual([250])
  })

  it('still installs the simulation interval where matchMedia does not exist', async () => {
    // Not every embedding browser exposes matchMedia; the reduced-motion read is optional for that
    // reason, and losing it must cost the reduced cadence rather than the simulation.
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: undefined })

    await renderWorkbenchOnFakeTimers({ section: 'practice' })

    expect(capturedIntervalDelays()).toEqual([100])
  })

  it('clears the interval it installed on unmount', async () => {
    const view = await renderWorkbenchOnFakeTimers({ section: 'practice' })
    expect(capturedIntervalDelays()).toHaveLength(1)

    view.unmount()

    expect(everyInstalledIntervalCleared()).toBe(true)
  })

  it('produces no state update when the timers run after unmount', async () => {
    const errors: unknown[] = []
    const consoleError = jest.spyOn(console, 'error').mockImplementation((...args) => {
      errors.push(args[0])
    })
    const view = await renderWorkbenchOnFakeTimers({ section: 'practice' })

    view.unmount()
    act(() => {
      jest.advanceTimersByTime(5_000)
    })

    expect(errors).toEqual([])
    consoleError.mockRestore()
  })

  it('drops a queued animation-frame callback rather than updating an unmounted workbench', async () => {
    const errors: unknown[] = []
    const consoleError = jest.spyOn(console, 'error').mockImplementation((...args) => {
      errors.push(args[0])
    })
    const view = await renderWorkbench({ section: 'practice', initialActivityId: 'IABP-01' })

    fireEvent.click(screen.getByRole('button', { name: 'Open Act phase' }))
    expect(pendingAnimationFrameCount()).toBe(1)
    view.unmount()
    flushAnimationFrames()

    expect(errors).toEqual([])
    consoleError.mockRestore()
  })

  it('unmounts before the deferred read without a late state update', async () => {
    const errors: unknown[] = []
    const consoleError = jest.spyOn(console, 'error').mockImplementation((...args) => {
      errors.push(args[0])
    })
    seedStoredProgress({ masteredCaseIds: ['IABP-01'] })
    const view = renderWorkbenchWithoutSettling({ section: 'practice' })

    view.unmount()
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(errors).toEqual([])
    consoleError.mockRestore()
  })
})
