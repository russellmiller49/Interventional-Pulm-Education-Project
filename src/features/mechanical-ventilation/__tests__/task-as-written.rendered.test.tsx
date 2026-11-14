import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { act, cleanup, render } from '@testing-library/react'

import { VentilationStageHost } from '../components/stage/VentilationStageHost'
import { ventilationPartSetupLine } from '../content/learnerMap'
import {
  ventilationExperimentByUnit,
  ventilationLearningExperiments,
} from '../content/learningExperiments'
import {
  createLabSession,
  labGoalAction,
  labReadyToCompare,
  learningLabReducer,
  type LabAction,
  type LabSession,
} from '../engine/learningLab'
import type { VentilationAction } from '../engine/types'
import { chooseStep, pressClock, setConsoleControl } from '../test-support/stageHost'

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string }
    children: ReactNode
  }) => (
    <a href={typeof href === 'string' ? href : href.pathname} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: jest.fn() }),
}))

/**
 * A learner who does exactly what a task asks gets a clean result.
 *
 * Section 7's first part says "Raise the set rate from 12 to 26/min". Its patient's peak pressure
 * started at 37 cmH₂O under the teaching patient's limit of 40, and the trapped gas the task is
 * about (intrinsic PEEP 0.7 to 4.9) took the peak over it. The high-pressure alarm sounded over a
 * breath the simulator delivers in full, and the lesson held the capture: "this comparison no
 * longer isolates one change". The round's limit is now 60, the value the other high-resistance
 * patients use (owner ruling, 2026-11-12).
 */
const DEVICE = 'hamilton-c6'
type RoundIndex = 0 | 1
const engine = (action: VentilationAction): LabAction => ({ type: 'ENGINE', action })
const tick = engine({ type: 'TICK', seconds: 0.1 })
const reduce = (session: LabSession, ...actions: LabAction[]) =>
  actions.reduce(learningLabReducer, session)
const roundOf = (unitId: string, round: RoundIndex) =>
  ventilationExperimentByUnit.get(unitId)!.rounds[round]

/** The round opened, started, and given every change, maneuver or bedside action it asks for. */
function asWritten(unitId: string, round: RoundIndex): LabSession {
  let session = reduce(createLabSession(unitId, DEVICE), { type: 'OPEN_ROUND', round })
  session = reduce(session, { type: 'START_EXPERIMENT' })
  session = reduce(session, engine({ type: 'SET_PAUSED', paused: false, origin: 'learner' }))
  for (const goal of roundOf(unitId, round).goals) {
    const action = labGoalAction(goal)
    if (action) session = reduce(session, engine(action))
  }
  for (let steps = 0; !labReadyToCompare(session) && steps < 6000; steps += 1)
    session = reduce(session, tick)
  return session
}
const pressureAlarms = (session: LabSession) =>
  session.simulation.alarms
    .filter((alarm) => alarm.active && /PRESSURE/.test(alarm.code))
    .map((alarm) => alarm.code)

const SECTION_7 = 'expiration-and-air-trapping'
const rateOf = (session: LabSession) => {
  const settings = session.simulation.ventilator.settings
  return 'ratePerMin' in settings ? settings.ratePerMin : null
}

describe('Section 7, part 1: the rate change as the task writes it', () => {
  it('starts from a limit of 60, as the other high-resistance patients do', () => {
    const opened = reduce(createLabSession(SECTION_7, DEVICE), { type: 'OPEN_ROUND', round: 0 })
    expect(opened.simulation.ventilator.settings.highPressureLimitCmH2O).toBe(60)
    expect(rateOf(opened)).toBe(12)
  })

  it('says so where the part says what it starts from', () => {
    expect(ventilationPartSetupLine(SECTION_7, 0)).toMatch(
      /rate 12\/min and high-pressure alarm limit 60 cmH₂O\.$/,
    )
    // No setting is named by its internal key, in this part or any other.
    for (const experiment of ventilationLearningExperiments)
      for (const round of [0, 1] as const)
        expect(ventilationPartSetupLine(experiment.unitId, round)).not.toMatch(
          /[a-z]+[A-Z]\w*H2O|PerMin|LMin/,
        )
  })

  it('raises the peak past the old limit of 40, with no alarm and nothing held', () => {
    const done = asWritten(SECTION_7, 0)
    expect(labReadyToCompare(done)).toBe(true)
    expect(rateOf(done)).toBe(26)
    // The reason for the ruling: this is where the alarm came from.
    expect(done.simulation.measurements.peakPressureCmH2O).toBeGreaterThan(40)
    expect(done.simulation.measurements.peakPressureCmH2O).toBeLessThan(57)
    expect(pressureAlarms(done)).toEqual([])
    expect(done.confounds ?? []).toEqual([])
  })

  it('rendered: the result is captured automatically', () => {
    localStorage.clear()
    jest.useFakeTimers()
    try {
      render(<VentilationStageHost unitId={SECTION_7} />)
      act(() => jest.advanceTimersByTime(10))
      chooseStep(2)
      setConsoleControl('ratePerMin', 26)
      pressClock('run')
      act(() => jest.advanceTimersByTime(25_000))
      expect(document.querySelector('[data-auto-capture-held]')).toBeNull()
      const alarm = document.querySelector('[data-ventilation-console] [class*="alarmBar"]')
      expect(alarm?.textContent).toBe('No active alarm')
      expect(document.querySelector('[data-captured-result]')).not.toBeNull()
    } finally {
      cleanup()
      jest.useRealTimers()
    }
  })
})

/*
 * The same check on every part of every section, so the next one is caught here and not by a
 * learner: what each task asks for, done and run to its result, sets off no pressure alarm and
 * leaves no "additional input" on the record.
 */
describe('every part of every section, done as written', () => {
  const every = ventilationLearningExperiments.flatMap((experiment) =>
    ([0, 1] as const).map((round) => [experiment.unitId, round] as const),
  )
  // A part that asks only for a pause or an inspection of the trace has nothing to set or press.
  const rounds = every.filter(([unitId, round]) =>
    roundOf(unitId, round).goals.some((goal) => labGoalAction(goal) !== null),
  )

  it('covers every part but Section 1’s two, which ask only for a reading of the trace', () => {
    expect(every).toHaveLength(28)
    expect(every.filter((entry) => !rounds.includes(entry))).toEqual([
      ['breathing-with-support', 0],
      ['breathing-with-support', 1],
    ])
  })

  it.each(rounds)('%s part %i: no pressure alarm, nothing held', (unitId, round) => {
    const done = asWritten(unitId, round)
    expect(labReadyToCompare(done)).toBe(true)
    expect({ alarms: pressureAlarms(done), confounds: done.confounds ?? [] }).toEqual({
      alarms: [],
      confounds: [],
    })
  })
})
