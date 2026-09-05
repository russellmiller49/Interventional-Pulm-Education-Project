import { act, renderHook } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import { recordSiteModuleEvent } from '@/lib/analytics'

import { resolveScenarioDefinition } from '../components/PracticeCasePlayer'
import { clinicalPracticeScenarios } from '../content/clinicalCases'
import { orderedCaseScenarioIds } from '../content/curriculum'
import {
  createDefaultProgress,
  readProgress,
  recordScenarioResult,
  setLastCaseForMode,
  writeProgress,
  type ProgressV2,
} from '../engine'
import {
  capstoneUnlockedEvent,
  guidedLessonLoadedEvent,
  guidedWalkthroughCompletedEvent,
  practiceScenarioLoadedEvent,
  roundSubmittedEvents,
  supportModeSelectedEvent,
} from '../session/ecmoSessionAnalytics'
import { useEcmoSessionCore } from '../session/useEcmoSessionCore'

const mockRouterPush = jest.fn()

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...rest
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string; query?: Record<string, string> }
    children: ReactNode
  }) => {
    const resolved =
      typeof href === 'string'
        ? href
        : `${href.pathname}?${new URLSearchParams(href.query ?? {}).toString()}`
    return (
      <a href={resolved} {...rest}>
        {children}
      </a>
    )
  },
  useRouter: () => ({ push: mockRouterPush, replace: jest.fn(), refresh: jest.fn() }),
  usePathname: () => '/cardiohelp-ecmo/practice',
}))

jest.mock('@/lib/analytics', () => ({
  ...jest.requireActual('@/lib/analytics'),
  recordSiteModuleEvent: jest.fn(),
}))

const recordSiteModuleEventMock = recordSiteModuleEvent as jest.MockedFunction<
  typeof recordSiteModuleEvent
>

function setUrl(path: string) {
  window.history.replaceState(null, '', path)
}

function completed(progress: ProgressV2, scenarioIds: readonly string[]): ProgressV2 {
  return scenarioIds.reduce(
    (current, scenarioId) =>
      recordScenarioResult(current, {
        scenarioId,
        score: 100,
        criticalError: false,
        completed: true,
      }),
    progress,
  )
}

/**
 * The session core is what every ECMO surface renders over. These tests pin the contract the
 * workbench used to carry inline: the site-event shapes `/api/analytics` validates strictly, the
 * hydration order (stored progress, then the URL, then one canonical `replaceState`), the writes
 * a load performs, and the writes it does not.
 */
describe('ECMO session analytics builders', () => {
  it('builds the load, track and lesson events with the section strings the schema expects', () => {
    expect(
      practiceScenarioLoadedEvent(
        { id: 'clinical-vv-occult-hemorrhage', supportMode: 'vv', stationId: 'flow-pressure' },
        'guided',
      ),
    ).toEqual({
      eventType: 'module_interaction',
      moduleId: 'cardiohelp-ecmo',
      section: 'flow-pressure',
      eventPayload: {
        interaction: 'practice_scenario_loaded',
        scenarioId: 'clinical-vv-occult-hemorrhage',
        supportMode: 'vv',
        experience: 'practice',
        simulationMode: 'guided',
      },
    })
    expect(supportModeSelectedEvent('va', 'practice')).toEqual({
      eventType: 'module_interaction',
      moduleId: 'cardiohelp-ecmo',
      section: 'va:practice',
      eventPayload: {
        interaction: 'support_mode_selected',
        supportMode: 'va',
        experience: 'practice',
      },
    })
    expect(capstoneUnlockedEvent('vv')).toEqual({
      eventType: 'section_completed',
      moduleId: 'cardiohelp-ecmo',
      section: 'vv:capstone-unlocked',
      eventPayload: {
        completionId: 'cardiohelp-ecmo-vv-capstone-unlocked-v1',
        supportMode: 'vv',
        experience: 'learn',
      },
    })
    expect(
      guidedLessonLoadedEvent({ scenarioId: 'preload-drainage-collapse', supportMode: 'vv' }),
    ).toEqual({
      eventType: 'module_interaction',
      moduleId: 'cardiohelp-ecmo',
      section: 'learn',
      eventPayload: {
        interaction: 'guided_lesson_loaded',
        scenarioId: 'preload-drainage-collapse',
        supportMode: 'vv',
        experience: 'learn',
      },
    })
    expect(guidedWalkthroughCompletedEvent('va-lv-loading', 'va')).toEqual({
      eventType: 'module_interaction',
      moduleId: 'cardiohelp-ecmo',
      section: 'learn',
      eventPayload: {
        interaction: 'guided_walkthrough_completed',
        scenarioId: 'va-lv-loading',
        supportMode: 'va',
        experience: 'learn',
      },
    })
  })

  it('reports a first round as one quiz_submitted event keyed by track and station', () => {
    const scenario = clinicalPracticeScenarios.find((item) => item.supportMode === 'vv')!
    const current = createDefaultProgress()
    const next = completed(current, [scenario.id])
    const events = roundSubmittedEvents({
      current,
      next,
      scenario,
      outcome: { score: 100, criticalErrors: [], mastery: true },
    })
    const stationIds = clinicalPracticeScenarios
      .filter((item) => item.supportMode === 'vv' && item.stationId === scenario.stationId)
      .map((item) => item.id)
    const stationNowComplete = stationIds.every((id) => next.completedLabs.includes(id))
    expect(events[0]).toEqual({
      eventType: 'quiz_submitted',
      moduleId: 'cardiohelp-ecmo',
      section: `vv:${scenario.stationId}`,
      percentComplete: expect.any(Number),
      eventPayload: {
        scenarioId: scenario.id,
        supportMode: 'vv',
        experience: 'practice',
        score: 100,
        criticalErrorCount: 0,
        roundMastery: true,
        modeMastery: false,
        modePercentComplete: expect.any(Number),
        aggregatePercentComplete: expect.any(Number),
      },
    })
    expect(events[0]?.percentComplete).toBeLessThanOrEqual(99)
    expect(events).toHaveLength(stationNowComplete ? 2 : 1)
  })

  it('adds the station, track and module completions on the round that finishes each', () => {
    const vv = orderedCaseScenarioIds('vv')
    const va = orderedCaseScenarioIds('va')
    const lastVv = resolveScenarioDefinition(vv[vv.length - 1]!)
    const stationIds = clinicalPracticeScenarios
      .filter((item) => item.supportMode === 'vv' && item.stationId === lastVv.stationId)
      .map((item) => item.id)

    const beforeTrack = completed(createDefaultProgress(), vv.slice(0, -1))
    const trackDone = completed(beforeTrack, [lastVv.id])
    const trackEvents = roundSubmittedEvents({
      current: beforeTrack,
      next: trackDone,
      scenario: lastVv,
      outcome: { score: 100, criticalErrors: [], mastery: true },
    })
    expect(trackEvents.map((event) => event.section)).toEqual(
      expect.arrayContaining([`vv:${lastVv.stationId}`, 'vv:mastery']),
    )
    const stationEvent = trackEvents.find(
      (event) =>
        event.eventType === 'section_completed' && event.section === `vv:${lastVv.stationId}`,
    )
    if (stationIds.every((id) => beforeTrack.completedLabs.includes(id) || id === lastVv.id)) {
      expect(stationEvent?.eventPayload).toMatchObject({
        completionId: `vv-${lastVv.stationId}-complete`,
      })
    }
    expect(trackEvents.find((event) => event.section === 'vv:mastery')?.eventPayload).toMatchObject(
      { completionId: 'cardiohelp-ecmo-vv-mastery-v1', modePercentComplete: 100 },
    )
    expect(trackEvents.some((event) => event.eventType === 'module_completed')).toBe(false)

    const lastVa = resolveScenarioDefinition(va[va.length - 1]!)
    const beforeModule = completed(trackDone, va.slice(0, -1))
    const moduleDone = completed(beforeModule, [lastVa.id])
    const moduleEvents = roundSubmittedEvents({
      current: beforeModule,
      next: moduleDone,
      scenario: lastVa,
      outcome: { score: 100, criticalErrors: [], mastery: true },
    })
    expect(moduleEvents.find((event) => event.eventType === 'module_completed')).toEqual({
      eventType: 'module_completed',
      moduleId: 'cardiohelp-ecmo',
      percentComplete: 100,
      eventPayload: {
        completionId: 'cardiohelp-ecmo-vv-va-mastery-v1',
        supportMode: 'va',
        experience: 'practice',
        masteredSupportModes: ['vv', 'va'],
      },
    })
    expect(moduleEvents[0]?.percentComplete).toBe(100)
  })
})

describe('ECMO session core', () => {
  beforeEach(() => {
    window.localStorage.clear()
    recordSiteModuleEventMock.mockClear()
    mockRouterPush.mockClear()
    setUrl('/en/cardiohelp-ecmo/practice')
  })

  it('hydrates a Practice case from the URL, canonicalises the query, and writes nothing', () => {
    setUrl('/en/cardiohelp-ecmo/practice?track=vv&case=clinical-vv-tension-pneumothorax')
    const onPracticeCaseLoaded = jest.fn()
    const { result } = renderHook(() =>
      useEcmoSessionCore({ section: 'practice', onPracticeCaseLoaded }),
    )
    expect(result.current.hydrated).toBe(true)
    expect(result.current.state.scenario.scenarioId).toBe('clinical-vv-tension-pneumothorax')
    expect(result.current.supportMode).toBe('vv')
    expect(result.current.activityMode).toBe('practice')
    expect(result.current.resumedFromStorage).toBe(false)
    expect(window.location.search).toBe('?case=clinical-vv-tension-pneumothorax&track=vv')
    expect(onPracticeCaseLoaded).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'clinical-vv-tension-pneumothorax' }),
      'hydrate',
      { requestedPhase: null },
    )
    expect(window.localStorage.getItem('cardiohelp-ecmo-progress-v1')).toBeNull()
  })

  it('records the last case, the visit pointer and the load event when a case is opened', () => {
    const onPracticeCaseLoaded = jest.fn()
    const { result } = renderHook(() =>
      useEcmoSessionCore({ section: 'practice', onPracticeCaseLoaded }),
    )
    act(() => {
      result.current.loadPracticeScenario('clinical-vv-occult-hemorrhage')
    })
    expect(result.current.state.scenario.scenarioId).toBe('clinical-vv-occult-hemorrhage')
    const stored = readProgress()
    expect(stored.lastCaseScenarioIdByMode.vv).toBe('clinical-vv-occult-hemorrhage')
    expect(stored.lastVisited).toMatchObject({
      section: 'practice',
      scenarioId: 'clinical-vv-occult-hemorrhage',
      supportMode: 'vv',
    })
    expect(window.location.search).toBe('?case=clinical-vv-occult-hemorrhage&track=vv')
    expect(recordSiteModuleEventMock).toHaveBeenCalledWith(
      practiceScenarioLoadedEvent(
        resolveScenarioDefinition('clinical-vv-occult-hemorrhage'),
        'guided',
      ),
    )
    expect(onPracticeCaseLoaded).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 'clinical-vv-occult-hemorrhage' }),
      'navigate',
      { requestedPhase: null },
    )
  })

  it('reopens the stored case when the URL names none, and says so', () => {
    writeProgress(
      setLastCaseForMode(createDefaultProgress(), 'vv', 'clinical-vv-occult-hemorrhage'),
    )
    const { result } = renderHook(() => useEcmoSessionCore({ section: 'practice' }))
    expect(result.current.state.scenario.scenarioId).toBe('clinical-vv-occult-hemorrhage')
    expect(result.current.resumedFromStorage).toBe(true)
  })

  it('switches track to the first case of the other track and reports the selection', () => {
    const { result } = renderHook(() => useEcmoSessionCore({ section: 'practice' }))
    act(() => {
      result.current.selectTrack('va')
    })
    expect(result.current.supportMode).toBe('va')
    expect(result.current.state.scenario.scenarioId).toBe(orderedCaseScenarioIds('va')[0])
    expect(window.location.search).toContain('track=va')
    expect(recordSiteModuleEventMock).toHaveBeenCalledWith(
      supportModeSelectedEvent('va', 'practice'),
    )
  })

  it('records the round and emits the quiz_submitted event when the debrief is revealed', () => {
    const { result } = renderHook(() => useEcmoSessionCore({ section: 'practice' }))
    const scenarioId = result.current.state.scenario.scenarioId
    const stationId = result.current.scenario.stationId
    act(() => {
      result.current.revealDebrief()
    })
    expect(readProgress().completedLabs).toContain(scenarioId)
    expect(recordSiteModuleEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'quiz_submitted', section: `vv:${stationId}` }),
    )
  })

  it('hydrates a Learn lesson from the URL and names the guided catalog activity', () => {
    setUrl('/en/cardiohelp-ecmo/learn?lesson=preload-drainage-collapse&track=vv')
    const onLearnLessonLoaded = jest.fn()
    const { result } = renderHook(() =>
      useEcmoSessionCore({ section: 'learn', onLearnLessonLoaded }),
    )
    expect(result.current.learnScenarioId).toBe('preload-drainage-collapse')
    expect(result.current.state.scenario.scenarioId).toBe('preload-drainage-collapse')
    expect(result.current.activityMode).toBe('guided')
    expect(result.current.lifecycleActivityId).toBe('ecmo:learn:preload-drainage-collapse')
    expect(onLearnLessonLoaded).toHaveBeenCalledWith(
      expect.objectContaining({ scenarioId: 'preload-drainage-collapse' }),
      'hydrate',
      { requestedPhase: null },
    )
    expect(window.location.search).toBe('?lesson=preload-drainage-collapse&track=vv')
  })

  it('hydrates the Challenge capstone for the requested track in challenge mode', () => {
    setUrl('/en/cardiohelp-ecmo/assess?track=va')
    const { result } = renderHook(() => useEcmoSessionCore({ section: 'assess' }))
    expect(result.current.state.scenario.scenarioId).toBe('va-mixed-circulation-capstone')
    expect(result.current.state.simulationMode).toBe('challenge')
    expect(result.current.supportMode).toBe('va')
    expect(result.current.activityMode).toBe('challenge')
    expect(window.location.search).toBe('?track=va')
  })

  it('saves and leaves through the module hub', () => {
    const { result } = renderHook(() => useEcmoSessionCore({ section: 'practice' }))
    act(() => {
      result.current.saveAndExit()
    })
    expect(mockRouterPush).toHaveBeenCalledWith('/cardiohelp-ecmo')
  })
})
