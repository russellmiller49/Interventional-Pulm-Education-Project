import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import { CardiohelpConsole } from '../components/CardiohelpConsole'
import { EcmoCircuitControls } from '../components/EcmoCircuitControls'
import { GasBlenderPanel } from '../components/CircuitAndMonitors'
import { EcmoCaseDebrief } from '../components/practice/EcmoCaseDebrief'
import { EcmoContextStrip } from '../components/shell/EcmoContextStrip'
import { resolveNowCard } from '../components/practice/nowCard'
import { describeSafetyEvent } from '../components/practice/safetyLabels'
import { resolvePracticeStages } from '../components/practice/stages'
import { clinicalPracticeScenarioById } from '../content/clinicalCases'
import { pairedLessonIdsForCase } from '../content/curriculum'
import { cardiohelpLearnLessonByScenarioId } from '../content/learnLessons'
import { ecmoSafetyEventLabels } from '../content/safetyEventLabels'
import { cardiohelpScenarioById } from '../content/scenarios'
import {
  createInitialSimulationState,
  ecmoSimulationReducer,
  resolveBubbleResumption,
  resolvePumpStopExplanation,
  selectScenarioOutcome,
} from '../engine'
import type { EcmoSimulationState, SimulationAction } from '../engine/types'

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...rest
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string; query?: Record<string, string> }
    children: ReactNode
  }) => (
    <a
      href={typeof href === 'string' ? href : `${href.pathname}?${new URLSearchParams(href.query)}`}
      {...rest}
    >
      {children}
    </a>
  ),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn() }),
  usePathname: () => '/cardiohelp-ecmo/practice',
}))

const AIR_CASES = ['clinical-vv-circuit-air-embolism', 'va-clinical-circuit-air-embolism'] as const

function run(
  scenarioId: string,
  actions: readonly SimulationAction[],
  mode: EcmoSimulationState['simulationMode'] = 'guided',
): EcmoSimulationState {
  let state = createInitialSimulationState(scenarioId, mode)
  for (const action of actions) state = ecmoSimulationReducer(state, action)
  return state
}

/** The clinical air case, walked exactly as its authored required sequence walks it. */
function isolatedAndDeAired(caseId: string): EcmoSimulationState {
  const prefix = caseId.startsWith('va-') ? 'va-' : ''
  return run(caseId, [
    { type: 'TOGGLE_CIRCUIT_CLAMP', limb: 'return', closed: true },
    { type: 'TOGGLE_CIRCUIT_CLAMP', limb: 'drainage', closed: true },
    { type: 'APPLY_CLINICAL_INTERVENTION', interventionId: `${prefix}air-deair` },
  ])
}

function resumeButton(): HTMLButtonElement {
  const button = document.getElementById('cardiohelp-resume-support')
  expect(button).not.toBeNull()
  return button as HTMLButtonElement
}

describe('B · the clinical air cases reach resumed support through the rendered control', () => {
  it.each(AIR_CASES)(
    '%s: the rendered Resume control is operable once the circuit is isolated and de-aired',
    (caseId) => {
      const state = isolatedAndDeAired(caseId)
      // Preconditions the reducer itself accepts.
      expect(state.circuit.arterialBubbleDetected).toBe(false)
      expect(state.circuit.bubbleResetRequired).toBe(false)
      expect(state.circuit.drainageClampClosed).toBe(true)
      expect(state.circuit.returnClampClosed).toBe(true)

      const dispatch = jest.fn()
      render(<EcmoCircuitControls state={state} dispatch={dispatch} controlsEnabled />)
      expect(resumeButton().disabled).toBe(false)
      fireEvent.click(resumeButton())
      expect(dispatch).toHaveBeenCalledWith({ type: 'RESUME_SUPPORT_AFTER_BUBBLE' })
    },
  )

  it.each(AIR_CASES)('%s: a repeated resumption is idempotent and charges nothing', (caseId) => {
    const resumed = ecmoSimulationReducer(isolatedAndDeAired(caseId), {
      type: 'RESUME_SUPPORT_AFTER_BUBBLE',
    })
    expect(resumed.scenario.criticalErrors).toEqual([])
    const again = ecmoSimulationReducer(resumed, { type: 'RESUME_SUPPORT_AFTER_BUBBLE' })
    expect(again).toBe(resumed)
    expect(again.scenario.criticalErrors).toEqual([])
    expect(again.device.pumpRunning).toBe(true)
    expect(again.circuit.drainageClampClosed).toBe(false)
    expect(again.circuit.returnClampClosed).toBe(false)
  })

  it.each(AIR_CASES)(
    '%s refuses an unsafe direct dispatch that bypasses the rendered control',
    (caseId) => {
      const notIsolated = run(caseId, [{ type: 'RESUME_SUPPORT_AFTER_BUBBLE' }])
      expect(notIsolated.scenario.criticalErrors).toContain('premature-bubble-reset')
      expect(notIsolated.device.pumpRunning).toBe(false)
      expect(notIsolated.scenario.penalties).toBe(50)
    },
  )

  it('gives a disabled Resume control an accurate accessible reason', () => {
    const fresh = createInitialSimulationState('clinical-vv-circuit-air-embolism', 'guided')
    render(<EcmoCircuitControls state={fresh} dispatch={jest.fn()} controlsEnabled />)
    const button = resumeButton()
    expect(button.disabled).toBe(true)
    const describedBy = button.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    const reason = document.getElementById(describedBy!)
    expect(reason?.textContent ?? '').toMatch(/air/i)
  })
})

describe('C · a safety event never removes access to the explanation', () => {
  it('offers the case explanation as well as a restart', () => {
    const scenario = clinicalPracticeScenarioById.get('clinical-vv-circuit-air-embolism')!
    const state = run('clinical-vv-circuit-air-embolism', [
      { type: 'TOGGLE_CIRCUIT_CLAMP', limb: 'return', closed: true },
      { type: 'TOGGLE_CIRCUIT_CLAMP', limb: 'return', closed: false },
    ])
    expect(state.scenario.criticalErrors).toContain('unsafe-unclamp-before-deair')
    const facts = resolvePracticeStages(state, scenario, true)
    const reveal = jest.fn()
    const restart = jest.fn()
    const model = resolveNowCard({
      facts,
      activeStage: facts.currentStage,
      activityMode: 'practice',
      safety: {
        labels: ['Opened a circuit clamp before the air source was corrected and cleared'],
      },
      actions: {
        beginCase: jest.fn(),
        focusControl: jest.fn(),
        openStage: jest.fn(),
        advanceSeconds: jest.fn(),
        reveal,
        restart,
        replay: jest.fn(),
      },
    })
    expect(model.tone).toBe('safety')
    model.primary?.onActivate?.()
    expect(reveal).toHaveBeenCalled()
    expect(model.secondary).toBeDefined()
    model.secondary?.onActivate?.()
    expect(restart).toHaveBeenCalled()
  })

  it('names a premature-resumption safety event instead of describing it generically', () => {
    for (const caseId of AIR_CASES) {
      const scenario = clinicalPracticeScenarioById.get(caseId)!
      expect(describeSafetyEvent(scenario, 'premature-bubble-reset')).not.toMatch(
        /^A safety stop was recorded/,
      )
    }
    const drill = cardiohelpScenarioById.get('arterial-bubble-stop')!
    expect(describeSafetyEvent(drill, 'unsafe-unclamp-before-deair')).not.toMatch(
      /^A safety stop was recorded/,
    )
  })
})

describe('D · operational state is not laundered through the display', () => {
  it('names the device scope of an empty alarm chip', () => {
    render(
      <EcmoContextStrip
        line={{
          mode: 'VA practice',
          flow: '4.05 L/min',
          rpm: '3400 rpm',
          sweep: '4.0 L/min',
          alarm: { priority: 'none', text: 'No active device alarm' },
        }}
      />,
    )
    expect(screen.queryByText('No alarm')).toBeNull()
    expect(screen.getByText('No device alarm')).toBeInTheDocument()
  })
})

describe('E · recognition and escalation are not reported as treatment', () => {
  it('does not log a refused clinical intervention as applied', () => {
    // `air-deair` requires both clamps; attempted first, it is refused.
    const refused = run('clinical-vv-circuit-air-embolism', [
      { type: 'TOGGLE_CIRCUIT_CLAMP', limb: 'return', closed: true },
      { type: 'TOGGLE_CIRCUIT_CLAMP', limb: 'drainage', closed: true },
      { type: 'APPLY_CLINICAL_INTERVENTION', interventionId: 'air-deair' },
      { type: 'APPLY_CLINICAL_INTERVENTION', interventionId: 'air-deair' },
    ])
    const applied = refused.history.filter((entry) =>
      entry.label.startsWith('Applied clinical intervention:'),
    )
    expect(applied).toHaveLength(1)
  })

  it('does not claim upper-body oxygenation recovered when only escalation occurred', () => {
    const scenario = clinicalPracticeScenarioById.get('va-clinical-differential-hypoxemia')!
    const escalate = scenario.clinicalCase!.interventions.find(
      (item) => item.id === 'differential-escalate-config',
    )!
    expect(escalate.response).not.toMatch(/begins to recover/i)
    expect(scenario.clinicalCase!.completionResponse).not.toMatch(/recovers after/i)
  })
})

describe('A · the air-case state machine, by canonical registry id', () => {
  /*
   * The two clinical air cases and the two guided bubble drills are the four surfaces this repair
   * touches. Menu numbers in the source report are locators; these are the identifiers.
   */
  const AIR_LESSONS = ['arterial-bubble-stop', 'va-arterial-bubble-stop'] as const

  it.each(AIR_CASES)('%s is a registered clinical case with the authored air sequence', (id) => {
    const scenario = clinicalPracticeScenarioById.get(id)
    expect(scenario?.expectation.correctiveFault).toBe('arterial-bubble')
    const required = scenario?.clinicalCase?.requiredInterventionIds ?? []
    expect(required.at(-1)).toMatch(/air-resume-support$/)
  })

  it.each(AIR_LESSONS)('%s is a registered guided lesson on the same fault', (id) => {
    expect(cardiohelpLearnLessonByScenarioId.get(id)).toBeDefined()
    expect(cardiohelpScenarioById.get(id)?.expectation.correctiveFault).toBe('arterial-bubble')
  })

  it('reports one eligibility answer for both readers of the resumption', () => {
    // Fresh clinical case: air present, nothing clamped. The console latch is set, which is what
    // the button used to read, and it is not what makes resumption available.
    const fresh = createInitialSimulationState('clinical-vv-circuit-air-embolism', 'guided')
    expect(fresh.circuit.bubbleResetRequired).toBe(true)
    expect(resolveBubbleResumption(fresh).status).toBe('air-outstanding')

    const isolated = isolatedAndDeAired('clinical-vv-circuit-air-embolism')
    expect(isolated.circuit.bubbleResetRequired).toBe(false)
    expect(resolveBubbleResumption(isolated).status).toBe('eligible')

    const resumed = ecmoSimulationReducer(isolated, { type: 'RESUME_SUPPORT_AFTER_BUBBLE' })
    expect(resolveBubbleResumption(resumed).status).toBe('already-resumed')

    /*
     * Correcting the air without isolating first is refused upstream, so the air stays outstanding
     * and `never-isolated` is never reached through a legitimate path — which is the point. It is
     * asserted against a hand-built state so the refusal that guards it cannot be removed silently.
     */
    const correctedWithoutIsolating = run('clinical-vv-circuit-air-embolism', [
      { type: 'CORRECT_FAULT', fault: 'arterial-bubble' },
    ])
    expect(correctedWithoutIsolating.scenario.criticalErrors).toContain(
      'air-correction-before-isolation',
    )
    expect(resolveBubbleResumption(correctedWithoutIsolating).status).toBe('air-outstanding')
    const handBuilt: EcmoSimulationState = {
      ...fresh,
      circuit: { ...fresh.circuit, arterialBubbleDetected: false, bubbleResetRequired: false },
    }
    expect(resolveBubbleResumption(handBuilt).status).toBe('never-isolated')

    // A circuit with no air event at all is neither eligible nor a safety event.
    const ordinary = run('afterload-oxygenator-resistance', [{ type: 'STEP' }])
    expect(resolveBubbleResumption(ordinary).status).toBe('not-applicable')
  })
})

describe('B · the whole air sequence, clean and recovered', () => {
  it.each(AIR_CASES)('%s reaches resumed support and completes its required list', (caseId) => {
    const resumed = ecmoSimulationReducer(isolatedAndDeAired(caseId), {
      type: 'RESUME_SUPPORT_AFTER_BUBBLE',
    })
    const settled = ecmoSimulationReducer(resumed, { type: 'STEP' })
    expect(settled.device.pumpRunning).toBe(true)
    expect(settled.circuit.bloodFlow).toBeGreaterThan(0)
    expect(settled.scenario.criticalErrors).toEqual([])
    const applied = new Set(
      (settled.scenario.clinical?.appliedInterventions ?? []).map((r) => r.interventionId),
    )
    for (const required of clinicalPracticeScenarioById.get(caseId)!.clinicalCase!
      .requiredInterventionIds) {
      expect(applied).toContain(required)
    }
  })

  it.each(AIR_CASES)('%s recovers to resumed support after an unsafe early attempt', (caseId) => {
    const prefix = caseId.startsWith('va-') ? 'va-' : ''
    const recovered = run(caseId, [
      // The unsafe card first: reopen before de-airing.
      { type: 'APPLY_CLINICAL_INTERVENTION', interventionId: `${prefix}air-resume-early` },
      { type: 'TOGGLE_CIRCUIT_CLAMP', limb: 'return', closed: true },
      { type: 'TOGGLE_CIRCUIT_CLAMP', limb: 'drainage', closed: true },
      { type: 'APPLY_CLINICAL_INTERVENTION', interventionId: `${prefix}air-deair` },
      { type: 'RESUME_SUPPORT_AFTER_BUBBLE' },
      { type: 'STEP' },
    ])
    expect(recovered.device.pumpRunning).toBe(true)
    // The safety event stands; recovering from it does not erase it.
    expect(recovered.scenario.criticalErrors.length).toBeGreaterThan(0)
  })

  it('refuses a resumption whose prerequisite de-airing never happened', () => {
    const onlyClamped = run('clinical-vv-circuit-air-embolism', [
      { type: 'TOGGLE_CIRCUIT_CLAMP', limb: 'return', closed: true },
      { type: 'TOGGLE_CIRCUIT_CLAMP', limb: 'drainage', closed: true },
      { type: 'RESUME_SUPPORT_AFTER_BUBBLE' },
    ])
    expect(onlyClamped.device.pumpRunning).toBe(false)
    expect(onlyClamped.scenario.criticalErrors).toContain('premature-bubble-reset')
  })

  it('restarting resets this case only, and carries no prerequisite across', () => {
    const resumed = ecmoSimulationReducer(isolatedAndDeAired('clinical-vv-circuit-air-embolism'), {
      type: 'RESUME_SUPPORT_AFTER_BUBBLE',
    })
    const restarted = ecmoSimulationReducer(resumed, {
      type: 'LOAD_SCENARIO',
      scenarioId: 'clinical-vv-circuit-air-embolism',
    })
    expect(resolveBubbleResumption(restarted).status).toBe('air-outstanding')
    expect(restarted.scenario.criticalErrors).toEqual([])
    // And the other air case starts from its own opening state, not this one's.
    const other = ecmoSimulationReducer(resumed, {
      type: 'LOAD_SCENARIO',
      scenarioId: 'va-clinical-circuit-air-embolism',
    })
    expect(resolveBubbleResumption(other).status).toBe('air-outstanding')
    expect(other.scenario.correctedFaults).toEqual([])
    expect(other.scenario.clinical?.appliedInterventions).toEqual([])
  })

  it.each(['arterial-bubble-stop', 'va-arterial-bubble-stop'] as const)(
    '%s keeps its existing guided bubble workflow',
    (lessonId) => {
      // Learn 15: correcting the source leaves the console latch set on purpose, and the guided
      // resumption must stay available exactly there.
      const corrected = run(lessonId, [
        { type: 'STEP' },
        { type: 'STEP' },
        { type: 'STEP' },
        { type: 'STEP' },
        { type: 'TOGGLE_CIRCUIT_CLAMP', limb: 'return', closed: true },
        { type: 'TOGGLE_CIRCUIT_CLAMP', limb: 'drainage', closed: true },
        { type: 'CORRECT_FAULT', fault: 'arterial-bubble' },
      ])
      expect(corrected.circuit.bubbleResetRequired).toBe(true)
      expect(resolveBubbleResumption(corrected).eligible).toBe(true)
      render(<EcmoCircuitControls state={corrected} dispatch={jest.fn()} controlsEnabled />)
      expect(resumeButton().disabled).toBe(false)
      const resumed = ecmoSimulationReducer(corrected, { type: 'RESUME_SUPPORT_AFTER_BUBBLE' })
      expect(resumed.device.pumpRunning).toBe(true)
      expect(resumed.circuit.drainageClampClosed).toBe(false)
      expect(resumed.circuit.returnClampClosed).toBe(false)
      expect(resumed.scenario.criticalErrors).toEqual([])
      expect(ecmoSimulationReducer(resumed, { type: 'RESUME_SUPPORT_AFTER_BUBBLE' })).toBe(resumed)
    },
  )
})

describe('C · both safety-event debrief paths', () => {
  function safetyModel(state: EcmoSimulationState, scenarioId: string) {
    const scenario =
      clinicalPracticeScenarioById.get(scenarioId) ?? cardiohelpScenarioById.get(scenarioId)!
    const facts = resolvePracticeStages(state, scenario, true)
    const calls = { reveal: 0, restart: 0 }
    const model = resolveNowCard({
      facts,
      activeStage: facts.currentStage,
      activityMode: 'practice',
      safety: {
        labels: state.scenario.criticalErrors.map((id) => describeSafetyEvent(scenario, id)),
      },
      actions: {
        beginCase: jest.fn(),
        focusControl: jest.fn(),
        openStage: jest.fn(),
        advanceSeconds: jest.fn(),
        reveal: () => {
          calls.reveal += 1
        },
        restart: () => {
          calls.restart += 1
        },
        replay: jest.fn(),
      },
    })
    return { model, calls }
  }

  it('offers the explanation after a premature resumption on the VA air case', () => {
    const state = run('va-clinical-circuit-air-embolism', [{ type: 'RESUME_SUPPORT_AFTER_BUBBLE' }])
    const { model, calls } = safetyModel(state, 'va-clinical-circuit-air-embolism')
    expect(model.body).toContain('air source')
    model.primary?.onActivate?.()
    expect(calls.reveal).toBe(1)
    expect(calls.restart).toBe(0)
  })

  it('offers the explanation after an RPM escalation during drainage collapse', () => {
    const state = run('clinical-vv-tension-pneumothorax', [
      { type: 'STEP' },
      { type: 'SET_RPM', rpm: 3600 },
    ])
    expect(state.scenario.criticalErrors).toContain('rpm-during-collapse')
    const { model, calls } = safetyModel(state, 'clinical-vv-tension-pneumothorax')
    expect(model.tone).toBe('safety')
    model.primary?.onActivate?.()
    expect(calls.reveal).toBe(1)
  })

  it('reading the debrief clears no event, runs no treatment and records no observation', () => {
    const before = run('clinical-vv-tension-pneumothorax', [
      { type: 'STEP' },
      { type: 'SET_RPM', rpm: 3600 },
    ])
    const after = ecmoSimulationReducer(before, { type: 'REVEAL_DEBRIEF' })
    expect(after.scenario.criticalErrors).toEqual(before.scenario.criticalErrors)
    expect(after.scenario.correctedFaults).toEqual(before.scenario.correctedFaults)
    expect(after.scenario.activeFaults).toEqual(before.scenario.activeFaults)
    expect(after.scenario.clinical?.appliedInterventions).toEqual(
      before.scenario.clinical?.appliedInterventions,
    )
    expect(after.scenario.credit).toEqual(before.scenario.credit)
    expect(after.scenario.penalties).toBe(before.scenario.penalties)
    expect(after.simulationTime).toBe(before.simulationTime)
    expect(after.patient).toEqual(before.patient)
  })

  it('names every safety identifier the engine can raise', () => {
    // Grepped from the reducer rather than asserted by hand, so a new identifier fails here.
    const source = readFileSync(join(__dirname, '..', 'engine', 'reducer.ts'), 'utf8')
    const raised = new Set(
      [...source.matchAll(/addCriticalError\([^,]+,\s*'([a-z-]+)'/g)].map((m) => m[1]),
    )
    const fromPenalties = new Set(
      [...source.matchAll(/addPenalty\([^,]+,\s*'([a-z-]+)'/g)].map((m) => m[1]),
    )
    expect(raised.size).toBeGreaterThan(0)
    for (const id of [...raised, ...fromPenalties]) {
      expect(Object.keys(ecmoSafetyEventLabels)).toContain(id)
    }
  })
})

describe('D · requested settings, running state, and alarm scope', () => {
  it('describes the stop transition truthfully while its last calculated pressure is still visible', () => {
    const stopped = run('clinical-vv-tension-pneumothorax', [
      { type: 'SET_RPM', rpm: 3600 },
      { type: 'STEP' },
    ])
    expect(stopped.device.pumpRunning).toBe(false)
    expect(stopped.circuit.readouts.pVen.displayed).not.toBeNull()
    expect(resolvePumpStopExplanation(stopped).detail).toContain('calculated before the stop')
    const next = ecmoSimulationReducer(stopped, { type: 'STEP' })
    expect(next.circuit.readouts.pVen.displayed).toBeNull()
  })

  it('C3-1: the escalation path stops the pump and says so, without inventing a device alarm', () => {
    const collapsed = run('clinical-vv-tension-pneumothorax', [
      { type: 'STEP' },
      { type: 'SET_RPM', rpm: 3600 },
      { type: 'STEP' },
      { type: 'STEP' },
    ])
    // The state the walkthrough photographed: speed held, no flow, channels unavailable.
    expect(collapsed.device.rpmSetpoint).toBe(3600)
    expect(collapsed.device.pumpRunning).toBe(false)
    expect(collapsed.circuit.bloodFlow).toBe(0)
    expect(collapsed.circuit.readouts.pVen.displayed).toBeNull()

    const stop = resolvePumpStopExplanation(collapsed)
    expect(stop.running).toBe(false)
    expect(stop.cause).toBe('pressure-protection')
    // Named as this model's protection, not as a CARDIOHELP alarm, and with no pressure number.
    expect(stop.detail).toMatch(/this simulation's pressure interlock/i)
    expect(stop.detail).not.toMatch(/\d+\s*mm\s*Hg/i)

    // It is in the record the debrief timeline reads.
    expect(
      collapsed.history.some((entry) => /pressure interlock stopped the pump/i.test(entry.label)),
    ).toBe(true)

    const view = render(
      <CardiohelpConsole state={collapsed} dispatch={jest.fn()} controlsEnabled />,
    )
    expect(view.container.querySelector('[data-pump-stop="pressure-protection"]')).not.toBeNull()
    expect(within(view.container).getAllByText(/Speed \(requested\)/i).length).toBeGreaterThan(0)
  })

  it('a normal running circuit is unqualified and shows no stop banner', () => {
    const running = run('afterload-oxygenator-resistance', [{ type: 'STEP' }])
    expect(running.device.pumpRunning).toBe(true)
    expect(resolvePumpStopExplanation(running).cause).toBe('running')
    const view = render(<CardiohelpConsole state={running} dispatch={jest.fn()} controlsEnabled />)
    expect(view.container.querySelector('[data-pump-stop]')).toBeNull()
    expect(within(view.container).queryByText(/Speed \(requested\)/i)).toBeNull()
  })

  it('a paused case that has not started support calls its speed a request', () => {
    const notStarted = createInitialSimulationState('clinical-vv-initiation-ards', 'guided')
    expect(notStarted.scenario.clinical?.supportStatus).toBe('not-on-ecmo')
    expect(resolvePumpStopExplanation(notStarted).cause).toBe('support-not-started')
  })

  it('IA-4: an independent-monitor alert is not a device alarm, and neither surface says otherwise', () => {
    const differential = run('va-mixed-circulation-capstone', [{ type: 'STEP' }])
    const monitorAlarms = differential.alarms.filter((a) => a.source === 'patient-monitor')
    const deviceAlarms = differential.alarms.filter((a) => a.source === 'device')
    expect(monitorAlarms.some((a) => a.priority === 'high')).toBe(true)
    expect(deviceAlarms).toEqual([])
    // Every independent alert names its source in its own message.
    for (const alarm of monitorAlarms) expect(alarm.message).toMatch(/independent monitor/i)
  })

  it('IA-4: the integrated cases point at the lesson that teaches their mechanism', () => {
    expect(pairedLessonIdsForCase('va-mixed-circulation-capstone')).toContain(
      'va-differential-hypoxemia',
    )
    expect(pairedLessonIdsForCase('vv-off-sweep-capstone')).toContain('compensated-hypercapnia')
  })

  it('S7-2: a held stepper stops when the window loses focus', () => {
    jest.useFakeTimers()
    try {
      let state = createInitialSimulationState('startup-sensor-orientation')
      const rerender: { current: (next: EcmoSimulationState) => void } = { current: () => {} }
      const dispatch = (action: SimulationAction) => {
        state = ecmoSimulationReducer(state, action)
        rerender.current(state)
      }
      const view = render(<CardiohelpConsole state={state} dispatch={dispatch} controlsEnabled />)
      rerender.current = (next) =>
        view.rerender(<CardiohelpConsole state={next} dispatch={dispatch} controlsEnabled />)
      const increase = within(view.container).getByRole('button', { name: /Increase setpoint/i })
      fireEvent.pointerDown(increase)
      act(() => {
        jest.advanceTimersByTime(500)
      })
      act(() => {
        window.dispatchEvent(new Event('blur'))
      })
      const settled = state.device.rpmSetpoint
      act(() => {
        jest.advanceTimersByTime(2000)
      })
      expect(state.device.rpmSetpoint).toBe(settled)

      // And the abandoned hold does not swallow the next keyboard activation of the stepper.
      fireEvent.click(increase)
      expect(state.device.rpmSetpoint).toBe(settled + 50)
    } finally {
      jest.useRealTimers()
    }
  })
})

describe('E · no-action and explanation-only paths fabricate nothing', () => {
  it('does not present modeled gas availability as a measurement at an assumed flowmeter', () => {
    const state = createInitialSimulationState('clinical-vv-gas-disconnection', 'guided')
    const view = render(<GasBlenderPanel state={state} dispatch={jest.fn()} controlsEnabled />)
    expect(view.container.textContent).toContain('Modeled gas availability')
    expect(view.container.textContent).toContain('not a measured flowmeter reading')
    expect(state.gas.sourceConnected).toBe(false)
  })

  it('recognition debrief reports current readings without claiming the opening physiology persists unchanged', () => {
    const initial = createInitialSimulationState('va-mixed-circulation-capstone', 'guided')
    const state = run('va-mixed-circulation-capstone', [
      { type: 'CORRECT_FAULT', fault: 'differential-hypoxemia' },
      ...Array.from({ length: 10 }, (): SimulationAction => ({ type: 'STEP' })),
      { type: 'REVEAL_DEBRIEF' },
    ])
    expect(state.patient.paCO2).not.toBe(initial.patient.paCO2)
    const view = render(
      <EcmoCaseDebrief
        state={state}
        scenario={cardiohelpScenarioById.get('va-mixed-circulation-capstone')!}
        outcome={selectScenarioOutcome(state)}
        supportMode="va"
        onReplay={jest.fn()}
      />,
    )
    expect(view.container.querySelector('[data-recognition-only]')?.textContent).not.toContain(
      'still the physiology the case opened with',
    )
    expect(
      within(view.container).getByLabelText('Patient state at the reveal').textContent,
    ).toContain(state.patient.rightRadialSpo2.toFixed(1))
  })

  it('keeps air resumption unavailable on a clamped circuit that has no air event', () => {
    const state = run('afterload-oxygenator-resistance', [
      { type: 'STEP' },
      { type: 'TOGGLE_CIRCUIT_CLAMP', limb: 'return', closed: true },
    ])
    render(<EcmoCircuitControls state={state} dispatch={jest.fn()} controlsEnabled />)
    expect(resumeButton()).toBeDisabled()
    expect(resolveBubbleResumption(state).status).toBe('not-applicable')
    expect(ecmoSimulationReducer(state, { type: 'RESUME_SUPPORT_AFTER_BUBBLE' })).toBe(state)
  })

  it('opening the explanation without acting records no intervention and no time', () => {
    const opened = run('clinical-vv-oxygenator-thrombosis', [{ type: 'REVEAL_DEBRIEF' }])
    expect(opened.scenario.clinical?.appliedInterventions ?? []).toEqual([])
    expect(opened.simulationTime).toBe(0)
    expect(opened.scenario.causeCorrectedAt).toBeNull()
    expect(opened.scenario.criticalErrors).toEqual([])
  })

  it('S10-2: the exchange step is named as a teaching transition, not as a performed exchange', () => {
    for (const lessonId of [
      'afterload-oxygenator-resistance',
      'va-afterload-oxygenator-resistance',
    ] as const) {
      const lesson = cardiohelpLearnLessonByScenarioId.get(lessonId)!
      const step = lesson.steps.find((item) =>
        item.actions.some(
          (action) => action.type === 'CORRECT_FAULT' && action.fault === 'oxygenator-resistance',
        ),
      )!
      expect(step.rationale).toMatch(/teaching transition/i)
      expect(step.rationale).toMatch(/not simulated/i)
    }
  })

  it('S14-1: the gas readout does not claim confirmed membrane delivery', () => {
    const source = readFileSync(
      join(__dirname, '..', 'components', 'CircuitAndMonitors.tsx'),
      'utf8',
    )
    expect(source).not.toContain('Sweep flow reaching the membrane, read against the setting')
    expect(source.replace(/\s+/g, ' ')).toContain('cannot tell you what reaches the membrane')
  })

  it('no run of any of these paths writes a score, a first-attempt record or a legacy field', () => {
    const before = createInitialSimulationState('clinical-vv-circuit-air-embolism', 'guided')
    const after = ecmoSimulationReducer(isolatedAndDeAired('clinical-vv-circuit-air-embolism'), {
      type: 'RESUME_SUPPORT_AFTER_BUBBLE',
    })
    expect(after.scenario.attempts).toBe(before.scenario.attempts)
    expect(after.scenario.hintPenalty).toBe(before.scenario.hintPenalty)
    expect(after.scenario.usedHintIds).toEqual(before.scenario.usedHintIds)
    expect(localStorage.length).toBe(0)
  })
})
