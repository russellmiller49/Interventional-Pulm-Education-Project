import { fireEvent, screen, waitFor } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import { resolveGuidedLesson } from '../components/stage/adapters/drillStageAdapter'
import { ecmoLearnPredictionFor } from '../content/learnPredictionItems'
import {
  createInitialSimulationState,
  ecmoSimulationReducer,
  type EcmoSimulationState,
} from '../engine'
import {
  latestState,
  mountDrill,
  resetStageHarness,
  walkOrientationToPrediction,
  predictionRadios,
} from '../test-support/learnStageHarness'

/**
 * The console tour has to be read on the circuit it says it is being read on.
 *
 * A3 split the orientation lesson so the stopped circuit is worth exactly one recognition question
 * and the rest of the tour happens on a running one. The sequence said that; the simulator did not.
 * `SET_RPM` moves a setpoint and nothing else: this model restarts the pump and recomputes flow and
 * the pressure channels inside `advance`, so on a paused scenario with no `STEP` the learner reached
 * "read the parameter list again, now that it reports" with the pump still stopped, flow at zero and
 * all four pressure channels still showing the unavailable indication — the exact state the previous
 * step had just taught them to recognise.
 *
 * The startup prediction had the mirror-image problem. Left at 3200 rpm on a flowing circuit, it
 * asked the learner to plan a pre-use sequence for a circuit that was already running, and its stem
 * described a stopped one.
 *
 * These tests read the engine state at each point in the real stage sequence, so the fix has to be
 * a state the simulator actually reaches rather than prose that describes one.
 */

jest.setTimeout(30_000)

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string; query?: Record<string, string> }
    children: ReactNode
  }) => (
    <a href={typeof href === 'string' ? href : href.pathname} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn() }),
  usePathname: () => '/cardiohelp-ecmo/learn',
}))

interface StateProbe {
  rpmSetpoint: number
  pumpRunning: boolean
  selfTest: string
  paused: boolean
  flow: number
  circuitInspected: boolean
  startupInspectionOutstanding: boolean
  gasSourceConnected: boolean
  sweepLpm: number
  gasFio2: number
  rightRadialSpo2: number
  femoralArterialSpo2: number
  meanArterialPressure: number
  pulsePressure: number
  pVen: string
  pInt: string
  pArt: string
  deltaP: string
}

/** The engine state as the stage holds it, flattened for the assertions below. */
function probe(state: EcmoSimulationState): StateProbe {
  return {
    rpmSetpoint: state.device.rpmSetpoint,
    pumpRunning: state.device.pumpRunning,
    selfTest: state.device.selfTest,
    paused: state.paused,
    flow: state.circuit.bloodFlow,
    circuitInspected: state.circuit.circuitInspected,
    startupInspectionOutstanding: state.scenario.activeFaults.includes('startup-inspection'),
    gasSourceConnected: state.gas.sourceConnected,
    sweepLpm: state.gas.sweepLpm,
    gasFio2: state.gas.fio2,
    rightRadialSpo2: state.patient.rightRadialSpo2,
    femoralArterialSpo2: state.patient.femoralArterialSpo2,
    meanArterialPressure: state.patient.meanArterialPressure,
    pulsePressure: state.patient.pulsePressure,
    pVen: state.circuit.readouts.pVen.status,
    pInt: state.circuit.readouts.pInt.status,
    pArt: state.circuit.readouts.pArt.status,
    deltaP: state.circuit.readouts.deltaP.status,
  }
}

beforeEach(() => {
  resetStageHarness()
  Object.defineProperty(global, 'fetch', {
    configurable: true,
    writable: true,
    value: jest.fn().mockResolvedValue({ ok: true }),
  })
})

/**
 * The numbers each stem quotes, and where the state holds them.
 *
 * A stem that cites a value the scenario does not produce is the same defect as a stem that
 * describes the wrong pump state, only harder to see. Retuning a scenario constant fails here
 * rather than leaving a plausible-sounding number in the question.
 */
const quotedValues: Readonly<Record<string, readonly [string, (probe: StateProbe) => number][]>> = {
  'startup-sensor-orientation': [['sweep of 4.0 L/min', (state) => state.sweepLpm]],
  'va-startup-sensor-orientation': [
    ['right-arm saturation of 96', (state) => state.rightRadialSpo2],
    ['femoral arterial saturation of 98.5', (state) => state.femoralArterialSpo2],
    ['mean arterial pressure of 71 mmHg', (state) => state.meanArterialPressure],
    ['pulse pressure of 18 mmHg', (state) => state.pulsePressure],
  ],
}

async function walk(scenarioId: string) {
  await mountDrill(scenarioId)
  // 2 — the stopped-pump recognition question. A3 put this here deliberately and it stays.
  const opening = probe(latestState())
  expect(opening).toMatchObject({
    rpmSetpoint: 0,
    pumpRunning: false,
    flow: 0,
    pVen: 'simulation-unmodeled',
    pInt: 'simulation-unmodeled',
    pArt: 'simulation-unmodeled',
    deltaP: 'simulation-unmodeled',
  })
  const { running, atPrediction } = await walkOrientationToPrediction()
  return { running: probe(running), atPrediction: probe(atPrediction) }
}

describe.each([
  ['VV', 'startup-sensor-orientation'],
  ['VA', 'va-startup-sensor-orientation'],
] as const)('%s console orientation runs on the circuit it describes', (_mode, scenarioId) => {
  it('reaches the tour on a running circuit and the prediction on a stopped one', async () => {
    const { running, atPrediction } = await walk(scenarioId)

    // The tour proper. Before this correction every one of these read as a stopped circuit.
    expect(running.pumpRunning).toBe(true)
    expect(running.flow).toBeGreaterThan(0)
    expect(running.rpmSetpoint).toBe(3200)
    expect(running.pVen).toBe('valid')
    expect(running.pInt).toBe('valid')
    expect(running.pArt).toBe('valid')
    expect(running.deltaP).toBe('valid')
    // A reference demonstration, not a completed startup: nothing about it has been verified.
    expect(running.selfTest).toBe('pending')
    expect(running.circuitInspected).toBe(false)
    expect(running.startupInspectionOutstanding).toBe(true)

    // The prediction. The learner plans a pre-use sequence for a circuit that is not running.
    expect(atPrediction).toMatchObject({
      rpmSetpoint: 0,
      pumpRunning: false,
      flow: 0,
      selfTest: 'pending',
      circuitInspected: false,
      startupInspectionOutstanding: true,
      pVen: 'simulation-unmodeled',
      pInt: 'simulation-unmodeled',
      pArt: 'simulation-unmodeled',
      deltaP: 'simulation-unmodeled',
    })
  })

  it('asks the authored question of a state that matches every claim in its stem', async () => {
    const { atPrediction } = await walk(scenarioId)
    const prediction = ecmoLearnPredictionFor(scenarioId)
    if (!prediction) throw new Error(`No authored prediction for ${scenarioId}`)
    const stem = prediction.item.stem.toLowerCase()

    expect(predictionRadios()).toHaveLength(prediction.item.choices.length)

    /*
     * Each claim the stems make about the machine, checked against the state the learner is looking
     * at. Editing a stem to describe a state the simulator does not reach fails here rather than
     * shipping as a plausible-sounding contradiction.
     */
    expect(stem).toMatch(/the pump is stopped|brought .* to a stop/)
    expect(atPrediction.pumpRunning).toBe(false)

    expect(stem).toMatch(/flow reads zero|reads zero/)
    expect(atPrediction.flow).toBe(0)

    expect(stem).toMatch(/startup diagnostic has not/)
    expect(atPrediction.selfTest).toBe('pending')

    expect(stem).toMatch(/unavailable indication/)
    expect([atPrediction.pVen, atPrediction.pInt, atPrediction.pArt]).toEqual([
      'simulation-unmodeled',
      'simulation-unmodeled',
      'simulation-unmodeled',
    ])

    // The gas source is connected in this scenario's authored opening state, so no stem may imply
    // an unconnected one.
    expect(atPrediction.gasSourceConnected).toBe(true)
    expect(stem).not.toMatch(/gas (line|source)[^.]*(hanging|disconnected|not connected|closed)/)

    // Every number the stem quotes is a number the state actually holds.
    for (const [phrase, read] of quotedValues[scenarioId]) {
      expect(prediction.item.stem).toContain(phrase)
      const quoted = Number(phrase.match(/-?\d+(?:\.\d+)?(?=\s*(?:mmHg|L\/min)?$)/)?.[0])
      expect(Number.isNaN(quoted)).toBe(false)
      expect(read(atPrediction)).toBeCloseTo(quoted, 1)
    }
  })

  it('still requires the physical check after the plan is committed', async () => {
    await walk(scenarioId)
    const prediction = ecmoLearnPredictionFor(scenarioId)
    if (!prediction) throw new Error('missing prediction')
    const best = prediction.item.choices.find((choice) => choice.plausibility === 'best')
    if (!best) throw new Error('missing best choice')

    fireEvent.click(screen.getByRole('radio', { name: best.label }))
    fireEvent.click(screen.getByRole('button', { name: /Commit this prediction/i }))
    // Committing a plan is not the same as having done it.
    expect(probe(latestState()).circuitInspected).toBe(false)
    expect(probe(latestState()).startupInspectionOutstanding).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    // The check is done on the real circuit control, not on a button in the lesson pane.
    fireEvent.click(
      screen.getByRole('button', { name: /Perform tip-to-tip circuit and sensor check/i }),
    )
    await waitFor(() => expect(probe(latestState()).circuitInspected).toBe(true))
    expect(probe(latestState()).startupInspectionOutstanding).toBe(false)
  })
})

describe('the orientation lessons keep their own support-mode scenario', () => {
  it.each([
    ['startup-sensor-orientation', 'vv'],
    ['va-startup-sensor-orientation', 'va'],
  ] as const)('%s stays on its own circuit throughout', (scenarioId, supportMode) => {
    const lesson = resolveGuidedLesson(scenarioId)
    expect(lesson.scenarioId).toBe(scenarioId)
    expect(lesson.supportMode).toBe(supportMode)

    const predictionSteps = lesson.steps.filter((step) => step.predictionScenarioId)
    expect(predictionSteps).toHaveLength(1)
    expect(predictionSteps[0].predictionScenarioId).toBe(scenarioId)

    // The restore step reloads this lesson's own scenario. The VA lesson remaps the venovenous
    // tour, so a missed override here would silently drop the learner onto a VV circuit.
    const reloads = lesson.steps.flatMap((step) =>
      step.actions.filter(
        (action): action is Extract<typeof action, { type: 'LOAD_SCENARIO' }> =>
          action.type === 'LOAD_SCENARIO',
      ),
    )
    expect(reloads).toHaveLength(1)
    expect(reloads[0].scenarioId).toBe(scenarioId)

    let state: EcmoSimulationState = createInitialSimulationState(scenarioId, 'guided')
    state = ecmoSimulationReducer(state, reloads[0])
    expect(state.supportMode).toBe(supportMode)
    expect(state.scenario.scenarioId).toBe(scenarioId)
  })
})

describe('why the settling step exists', () => {
  /*
   * The root cause, at the level it actually lives. Keeping this here means a future reader who
   * wonders why an orientation lesson advances the model by hand does not have to reconstruct it —
   * and a change to when the model restarts its pump shows up as a failure here rather than as a
   * console full of dashes under a heading that says it reports.
   */
  it.each(['startup-sensor-orientation', 'va-startup-sensor-orientation'])(
    '%s: raising the setpoint changes a setting, and advancing the model changes the circuit',
    (scenarioId) => {
      const opened = createInitialSimulationState(scenarioId, 'guided')
      expect(opened.paused).toBe(true)

      const raised = ecmoSimulationReducer(opened, { type: 'SET_RPM', rpm: 3200 })
      expect(raised.device.rpmSetpoint).toBe(3200)
      // Nothing else moved: the setpoint is a request the model has not acted on yet.
      expect(raised.device.pumpRunning).toBe(false)
      expect(raised.circuit.bloodFlow).toBe(0)
      expect(raised.circuit.readouts.pVen.status).toBe('simulation-unmodeled')

      // And a tick cannot stand in for it, because the scenario opens paused.
      const ticked = ecmoSimulationReducer(raised, { type: 'TICK', seconds: 1 })
      expect(ticked.device.pumpRunning).toBe(false)
      expect(ticked.circuit.bloodFlow).toBe(0)

      // Two explicit advances are what the lesson performs, and what the tour needs.
      let settled = raised
      for (let index = 0; index < 2; index += 1) {
        settled = ecmoSimulationReducer(settled, { type: 'STEP' })
      }
      expect(settled.device.pumpRunning).toBe(true)
      expect(settled.circuit.bloodFlow).toBeGreaterThan(0)
      for (const channel of ['pVen', 'pInt', 'pArt', 'deltaP'] as const) {
        expect(settled.circuit.readouts[channel].status).toBe('valid')
      }
    },
  )
})
