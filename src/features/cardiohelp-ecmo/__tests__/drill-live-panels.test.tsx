import { render } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import { assertModelBoundariesAreLabelled } from '@/features/critical-care/test-support/teachingPanelContract'

import {
  EcmoDrillLivePanel,
  ecmoDrillLivePanelScenarioIds,
  hasEcmoDrillLivePanel,
  validateEcmoDrillLivePanelRegistry,
} from '../components/teaching/EcmoDrillLivePanel'
import {
  ecmoDrillTeachingPanelScenarioIds,
  hasEcmoDrillTeachingPanel,
} from '../components/teaching/EcmoDrillTeachingPanel'
import { arterialTracePath } from '../components/monitor/arterialTrace'
import { StageTeachingScope } from '../components/stage/StageTeachingScope'
import { STAGE_PHASES, type StagePhase } from '../components/stage/stageModel'
import { ecmoDrillSpecs } from '../content/drillSpecs'
import { cardiohelpLearnLessons } from '../content/learnLessons'
import { cardiohelpScenarioById } from '../content/scenarios'
import {
  LV_UNLOADING_RESPONSE,
  createInitialSimulationState,
  ecmoSimulationReducer,
} from '../engine'
import type { EcmoSimulationState } from '../engine/types'
import { mountDrill, resetStageHarness } from '../test-support/learnStageHarness'

jest.setTimeout(30_000)

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...rest
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string; query?: Record<string, string> }
    children: ReactNode
  }) => (
    <a href={typeof href === 'string' ? href : href.pathname} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn() }),
  usePathname: () => '/cardiohelp-ecmo/learn',
}))

/**
 * Live readings panels for three patterns (November 2026).
 *
 * Fourteen of the twenty drills had nothing live beside their written explanation. Left-ventricular
 * loading on VA, and return obstruction and oxygenator resistance on both tracks, now carry a live
 * panel: a live picture where the drill has one, the readings in the order they are read, and the
 * questions that separate the possibilities. Two things are held here. The panel is additive: the
 * drill's explanation stays on the page, open, exactly as it was, so nothing about what a learner
 * may read before answering has moved. And the panel says nothing its drill's own question holds
 * back.
 */

const LIVE_IDS = [
  'va-lv-loading',
  'afterload-return-obstruction',
  'va-afterload-arterial-return-obstruction',
  'afterload-oxygenator-resistance',
  'va-afterload-oxygenator-resistance',
] as const

function settled(scenarioId: string, steps = 12): EcmoSimulationState {
  let state = createInitialSimulationState(scenarioId, 'guided')
  for (let tick = 0; tick < steps; tick += 1) {
    state = ecmoSimulationReducer(state, { type: 'STEP' })
  }
  return state
}

describe('the live-panel registry', () => {
  it('registers the three patterns, on the tracks that have them', () => {
    expect(validateEcmoDrillLivePanelRegistry()).toEqual([])
    expect([...ecmoDrillLivePanelScenarioIds].sort()).toEqual([...LIVE_IDS].sort())
    for (const id of LIVE_IDS) {
      expect(cardiohelpScenarioById.get(id)).toBeDefined()
      expect(cardiohelpLearnLessons.some((lesson) => lesson.scenarioId === id)).toBe(true)
    }
  })

  it('gives no drill both an authored panel and a live panel', () => {
    for (const id of LIVE_IDS) expect(hasEcmoDrillTeachingPanel(id)).toBe(false)
    for (const id of ecmoDrillTeachingPanelScenarioIds)
      expect(hasEcmoDrillLivePanel(id)).toBe(false)
  })

  it('leaves nine guided drills with neither, and says which', () => {
    const neither = cardiohelpLearnLessons
      .map((lesson) => lesson.scenarioId)
      .filter((id) => !hasEcmoDrillTeachingPanel(id) && !hasEcmoDrillLivePanel(id))
      .sort()
    expect(neither).toEqual([
      'acute-hypercapnia',
      'compensated-hypercapnia',
      'transport-power-loss',
      'va-acute-hypercapnia',
      'va-arterial-bubble-stop',
      'va-gas-source-interruption',
      'va-preload-drainage-collapse',
      'va-startup-sensor-orientation',
      'va-transport-power-loss',
    ])
  })

  it('draws nothing over a circuit of the other support configuration', () => {
    const mismatched: EcmoSimulationState = { ...settled('va-lv-loading'), supportMode: 'vv' }
    const { container } = render(<EcmoDrillLivePanel state={mismatched} />)
    expect(container).toBeEmptyDOMElement()
    const none = render(<EcmoDrillLivePanel state={settled('acute-hypercapnia')} />)
    expect(none.container).toBeEmptyDOMElement()
  })
})

describe('every live panel', () => {
  it.each(LIVE_IDS)('%s renders for its own track, marked as a live panel', (id) => {
    const { container } = render(<EcmoDrillLivePanel state={settled(id)} />)
    const panel = container.querySelector(`[data-drill-live-panel="${id}"]`)
    expect(panel).not.toBeNull()
    expect(panel).toHaveAttribute(
      'data-drill-support-mode',
      cardiohelpScenarioById.get(id)!.supportMode,
    )
    // Not an authored panel: it does not stand in for the explanation.
    expect(container.querySelector('[data-drill-panel]')).toBeNull()
    for (const selector of [
      '[data-clinical-question]',
      '[data-drill-pattern]',
      '[data-drill-discriminators]',
    ]) {
      expect(container.querySelector(selector)).not.toBeNull()
    }
    // Short on purpose: the readings once, grouped, and no signal table in a 26 rem column.
    expect(container.querySelector('[data-signal-register]')).toBeNull()
    expect(container.querySelectorAll('[data-pattern-row]').length).toBeGreaterThanOrEqual(3)
    expect(container.querySelectorAll('[data-pattern-row]').length).toBeLessThanOrEqual(6)
    // And none of the half that explains: that stays in the written explanation.
    for (const selector of [
      '[data-drill-mechanism]',
      '[data-drill-fitting-response]',
      '[data-harmful-reflex]',
      '[data-after-commitment]',
    ]) {
      expect(container.querySelector(selector)).toBeNull()
    }
  })

  it.each(LIVE_IDS)('%s carries a text equivalent and one labelled model limit', (id) => {
    const { container } = render(<EcmoDrillLivePanel state={settled(id)} />)
    expect(container.querySelectorAll('[data-text-equivalent]').length).toBeGreaterThan(0)
    const boundaries = container.querySelectorAll('[data-model-boundary]')
    expect(boundaries).toHaveLength(1)
    assertModelBoundariesAreLabelled(container)
    expect(boundaries[0].textContent ?? '').toMatch(/simulation|model/i)
  })

  it.each(LIVE_IDS)('%s gives every reading a value and a prompt for reading it', (id) => {
    const { container } = render(<EcmoDrillLivePanel state={settled(id)} />)
    for (const row of container.querySelectorAll('[data-pattern-row]')) {
      expect(row.querySelector('[data-pattern-reading]')?.textContent?.trim()).toBeTruthy()
      expect(row.querySelector('[data-pattern-movement]')?.textContent?.trim()).toBeTruthy()
    }
    // The circuit's return pressure is never offered as the patient's pressure.
    const text = container.textContent ?? ''
    if (cardiohelpScenarioById.get(id)!.supportMode === 'va' && id !== 'va-lv-loading') {
      expect(text).toContain('Read from its own monitor beside the circuit pressures')
    }
  })

  it.each(LIVE_IDS)('%s says nothing its own question holds back', (id) => {
    const { container } = render(<EcmoDrillLivePanel state={settled(id)} />)
    const text = container.textContent ?? ''
    for (const pattern of ecmoDrillSpecs[id].precommitDenyPatterns) {
      expect(text).not.toMatch(pattern)
    }
    // The discriminators are questions.
    for (const item of container.querySelectorAll('[data-discriminator] > p:first-child')) {
      expect(item.textContent?.trim().endsWith('?')).toBe(true)
    }
    // No verdict words and no scoring words. ("Correct" as a verb is in the reused questions.)
    expect(text).not.toMatch(/\b(incorrect|wrong|right answer|score|points)\b/i)
  })
})

describe('the panels read the live circuit', () => {
  const reading = (container: HTMLElement, label: string) =>
    container.querySelector(`[data-pattern-row="${label}"] [data-pattern-reading]`)?.textContent ??
    ''

  it('follows a return-side load from its opening pressures to the corrected ones', () => {
    const opening = settled('afterload-return-obstruction')
    const first = render(<EcmoDrillLivePanel state={opening} />)
    expect(reading(first.container, 'Flow against speed')).toBe(
      `Flow ${opening.circuit.bloodFlow.toFixed(2)} L/min at ${opening.device.rpmSetpoint} rpm`,
    )
    expect(reading(first.container, 'Downstream of the pump')).toBe(
      `pInt ${opening.circuit.readouts.pInt.displayed!.toFixed(0)} mmHg, pArt ${opening.circuit.readouts.pArt.displayed!.toFixed(0)} mmHg`,
    )
    expect(reading(first.container, 'Across the membrane')).toBe(
      `Δp ${opening.circuit.readouts.deltaP.displayed!.toFixed(0)} mmHg`,
    )
    first.unmount()

    let corrected = ecmoSimulationReducer(opening, {
      type: 'CORRECT_FAULT',
      fault: 'return-obstruction',
    })
    for (let tick = 0; tick < 12; tick += 1) {
      corrected = ecmoSimulationReducer(corrected, { type: 'STEP' })
    }
    expect(corrected.circuit.bloodFlow).toBeGreaterThan(opening.circuit.bloodFlow)
    const second = render(<EcmoDrillLivePanel state={corrected} />)
    expect(reading(second.container, 'Flow against speed')).toBe(
      `Flow ${corrected.circuit.bloodFlow.toFixed(2)} L/min at ${corrected.device.rpmSetpoint} rpm`,
    )
    expect(reading(second.container, 'Downstream of the pump')).toBe(
      `pInt ${corrected.circuit.readouts.pInt.displayed!.toFixed(0)} mmHg, pArt ${corrected.circuit.readouts.pArt.displayed!.toFixed(0)} mmHg`,
    )
  })

  it('adds the membrane’s own output to the oxygenator drill, and the patient’s pressure on VA', () => {
    const rows = (id: string) => {
      const view = render(<EcmoDrillLivePanel state={settled(id)} />)
      const labels = [...view.container.querySelectorAll('[data-pattern-row]')].map((row) =>
        row.getAttribute('data-pattern-row'),
      )
      view.unmount()
      return labels
    }
    expect(rows('afterload-oxygenator-resistance')).toContain('Leaving the membrane')
    expect(rows('afterload-return-obstruction')).not.toContain('Leaving the membrane')
    expect(rows('va-afterload-arterial-return-obstruction')).toContain('The patient’s own pressure')
    expect(rows('afterload-return-obstruction')).not.toContain('The patient’s own pressure')
  })

  it('draws the arterial line for LV loading, flat at first and opening with the lesson’s moves', () => {
    const opening = settled('va-lv-loading', 3)
    const first = render(<EcmoDrillLivePanel state={opening} />)
    const trace = () => document.querySelector('[data-lv-arterial] [data-arterial-trace]')!
    expect(trace()).toHaveAttribute('data-low-pulsatility', 'true')
    expect(trace()).toHaveAttribute('data-compact', 'true')
    expect(trace().querySelector('[data-trace-line]')).toHaveAttribute(
      'd',
      arterialTracePath(opening.patient),
    )
    const move = (name: string) =>
      document.querySelector(`[data-lv-move="${name}"]`)?.getAttribute('data-done')
    expect(move('flow')).toBe('false')
    expect(move('inotrope')).toBe('false')
    expect(move('plan')).toBe('false')
    first.unmount()

    let treated = ecmoSimulationReducer(opening, { type: 'SET_RPM', rpm: 2400 })
    treated = ecmoSimulationReducer(treated, { type: 'START_INOTROPE' })
    for (let tick = 0; tick < 12; tick += 1) {
      treated = ecmoSimulationReducer(treated, { type: 'STEP' })
    }
    expect(treated.circuit.bloodFlow).toBeLessThanOrEqual(LV_UNLOADING_RESPONSE.loweredFlowLpm)
    expect(treated.patient.pulsePressure).toBeGreaterThan(opening.patient.pulsePressure)
    render(<EcmoDrillLivePanel state={treated} />)
    expect(move('flow')).toBe('true')
    expect(move('inotrope')).toBe('true')
    expect(trace()).not.toHaveAttribute('data-low-pulsatility')
    expect(trace().querySelector('[data-trace-line]')).toHaveAttribute(
      'd',
      arterialTracePath(treated.patient),
    )
    expect(
      document.querySelector(
        '[data-pattern-row="What the ventricle is doing"] [data-pattern-reading]',
      ),
    ).toHaveTextContent('aortic valve opening')
    // The picture leads the panel: it comes before the question.
    const question = document.querySelector('[data-clinical-question]')!
    expect(
      trace().compareDocumentPosition(question) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })
})

/**
 * Clinical review, 2026-11-13: what a live panel has open before the learner has answered.
 *
 * A panel is on the page from the first step. At Recognize and Predict its open part may hold the
 * readings and questions about them, and nothing of the response the drill asks the learner to
 * choose. What a step folds to a heading is the stage's own rule and is left alone here; these
 * tests read only what is open.
 */
describe('before the learner has answered', () => {
  const atStep = (id: string, phase: StagePhase, state = settled(id)) =>
    render(
      <StageTeachingScope value={{ phase, predictionCommitted: false, stepId: `${id}.${phase}` }}>
        <EcmoDrillLivePanel state={state} />
      </StageTeachingScope>,
    )

  /** The words on the page at this step, without what the step folds to a heading. */
  const openText = (container: HTMLElement) => {
    const copy = container.cloneNode(true) as HTMLElement
    for (const folded of copy.querySelectorAll('details[data-stage-collapsed]')) {
      const heading = folded.querySelector(':scope > summary')?.textContent ?? ''
      folded.replaceWith(document.createTextNode(` ${heading} `))
    }
    return copy.textContent ?? ''
  }

  /** The response the LV drill keys, in the words the panel could have used for it. */
  const LV_RESPONSE =
    /turn(?:ed|ing)?\s+(?:circuit\s+)?(?:flow\s+)?down|lower(?:ed|ing)?\s+(?:circuit\s+)?flow|inotrope|\bvent\b|volume removal|diure/i
  /** The mechanism the LV drill explains after the answer. */
  const LV_MECHANISM = /ejects against|into the aorta|toward the valve|afterload|retrograde/i

  it.each(['recognize', 'predict'] as const)(
    'LV loading at %s lists none of the moves the learner is asked to choose',
    (phase) => {
      const { container } = atStep('va-lv-loading', phase)
      expect(container.querySelector('[data-lv-moves]')).toBeNull()
      const text = openText(container)
      expect(text).not.toMatch(LV_RESPONSE)
      expect(text).not.toMatch(LV_MECHANISM)
      // The readings and the strip are there: the panel is not emptied, only its moves held back.
      expect(container.querySelector('[data-lv-arterial] [data-arterial-trace]')).not.toBeNull()
      expect(container.querySelectorAll('[data-pattern-row]')).toHaveLength(3)
    },
  )

  it.each(['act', 'observe', 'explain', 'transfer'] as const)(
    'LV loading at %s shows which moves are in place',
    (phase) => {
      const { container } = atStep('va-lv-loading', phase)
      expect(container.querySelector('[data-lv-moves]')).not.toBeNull()
      expect(container.querySelectorAll('[data-lv-move]')).toHaveLength(3)
    },
  )

  it('covers every step of the stage, so a new one cannot open the moves by default', () => {
    expect([...STAGE_PHASES].sort()).toEqual(
      ['act', 'explain', 'observe', 'predict', 'recognize', 'transfer'].sort(),
    )
  })

  it('LV loading asks where to look and does not say what more flow would do', () => {
    const { container } = atStep('va-lv-loading', 'predict')
    const questions = [...container.querySelectorAll('[data-discriminator]')].map(
      (item) => item.textContent ?? '',
    )
    expect(questions).toHaveLength(3)
    for (const question of questions) {
      expect(question).not.toMatch(LV_MECHANISM)
      expect(question).not.toMatch(/more circuit flow|less circuit flow/i)
    }
    // The question that asks which readings cannot tell does not then name them.
    const cannotTell = questions.find((question) => /would look the same/.test(question))!
    expect(cannotTell).not.toMatch(/circuit flow|mean arterial pressure/i)
  })

  const RESISTANCE_IDS = LIVE_IDS.filter((id) => id !== 'va-lv-loading')

  it.each(RESISTANCE_IDS)(
    '%s does not say whether a setting is what the circuit is short of',
    (id) => {
      for (const phase of ['recognize', 'predict'] as const) {
        const view = atStep(id, phase)
        const text = openText(view.container)
        expect(text).not.toMatch(/setting the circuit is short of/i)
        // Nor where the problem is, nor which component, nor what to do about it.
        for (const pattern of ecmoDrillSpecs[id].precommitDenyPatterns) {
          expect(text).not.toMatch(pattern)
        }
        expect(text).not.toMatch(
          /kink|clamp|clot|exchange|backup|perfusionist|raise the (?:pump )?speed/i,
        )
        expect(view.container.querySelector('[data-clinical-question]')?.textContent ?? '').toMatch(
          /where the limitation is\?$/,
        )
        view.unmount()
      }
    },
  )

  it.each(RESISTANCE_IDS)('%s tells the learner to read the gradient at similar flow', (id) => {
    const { container } = atStep(id, 'predict')
    expect(container.textContent ?? '').toContain(
      'Read it at similar blood flow, against this circuit’s own earlier value.',
    )
    // And the flow it is to be read against is on the same panel, live.
    const state = settled(id)
    expect(
      container.querySelector('[data-pattern-row="Flow against speed"] [data-pattern-reading]'),
    ).toHaveTextContent(`Flow ${state.circuit.bloodFlow.toFixed(2)} L/min`)
  })
})

/**
 * Clinical review, 2026-11-13: the LV drill's last action records a plan for volume removal and a
 * vent. Neither is carried out in this simulation, so recording it must move no reading on the
 * panel, on the monitor or on the circuit.
 */
describe('a plan that is recorded and not carried out', () => {
  const readings = (state: EcmoSimulationState) => ({
    flow: state.circuit.bloodFlow,
    pVen: state.circuit.readouts.pVen.displayed,
    pInt: state.circuit.readouts.pInt.displayed,
    pArt: state.circuit.readouts.pArt.displayed,
    deltaP: state.circuit.readouts.deltaP.displayed,
    meanArterialPressure: state.patient.meanArterialPressure,
    pulsePressure: state.patient.pulsePressure,
    aorticValveOpening: state.patient.aorticValveOpening,
    nativeCardiacOutputLpm: state.patient.nativeCardiacOutputLpm,
    pulmonaryCongestion: state.patient.pulmonaryCongestion,
    spo2: state.patient.spo2,
  })

  const run = (state: EcmoSimulationState, ticks: number) => {
    let next = state
    for (let tick = 0; tick < ticks; tick += 1) {
      next = ecmoSimulationReducer(next, { type: 'STEP' })
    }
    return next
  }

  const panelRows = (state: EcmoSimulationState) => {
    const view = render(<EcmoDrillLivePanel state={state} />)
    const rows = [...view.container.querySelectorAll('[data-pattern-reading]')].map(
      (row) => row.textContent,
    )
    const trace = view.container.querySelector('[data-trace-line]')?.getAttribute('d')
    const plan = view.container.querySelector('[data-lv-move="plan"]')?.getAttribute('data-done')
    const planText = view.container.querySelector('[data-lv-move="plan"] dd')?.textContent
    view.unmount()
    return { rows, trace, plan, planText }
  }

  it('changes no reading on an untreated ventricle', () => {
    // Long enough for the opening state to settle, so the comparison is between two steady states.
    const before = run(createInitialSimulationState('va-lv-loading', 'guided'), 72)
    const control = run(before, 72)
    const planned = run(
      ecmoSimulationReducer(before, { type: 'CORRECT_FAULT', fault: 'lv-loading' }),
      72,
    )
    expect(planned.scenario.correctedFaults).toContain('lv-loading')
    expect(readings(planned)).toEqual(readings(control))

    const withoutPlan = panelRows(control)
    const withPlan = panelRows(planned)
    expect(withPlan.rows).toEqual(withoutPlan.rows)
    expect(withPlan.trace).toBe(withoutPlan.trace)
    // The panel says the plan is a plan.
    expect(withoutPlan.plan).toBe('false')
    expect(withPlan.plan).toBe('true')
    expect(withPlan.planText).toBe('planned, not carried out')
    // The lungs are as the case opened them.
    expect(planned.patient.pulmonaryCongestion).toBe('marked')
  })

  it('adds nothing to what lower flow and the inotrope have already done', () => {
    let treated = run(createInitialSimulationState('va-lv-loading', 'guided'), 3)
    treated = ecmoSimulationReducer(treated, { type: 'SET_RPM', rpm: 2400 })
    treated = ecmoSimulationReducer(treated, { type: 'START_INOTROPE' })
    treated = run(treated, 72)
    const control = run(treated, 72)
    const planned = run(
      ecmoSimulationReducer(treated, { type: 'CORRECT_FAULT', fault: 'lv-loading' }),
      72,
    )
    expect(readings(planned)).toEqual(readings(control))
    expect(panelRows(planned).rows).toEqual(panelRows(control).rows)
    // The two moves that are modelled did move the readings; the plan is what did not.
    expect(control.patient.pulsePressure).toBe(
      LV_UNLOADING_RESPONSE.settledByMoves[2].pulsePressure,
    )
  })
})

describe('on the Learn stage, beside the explanation that was already there', () => {
  beforeEach(() => {
    resetStageHarness()
    global.fetch = jest.fn().mockResolvedValue({ ok: true }) as unknown as typeof fetch
  })

  it.each(LIVE_IDS)('%s shows the live panel above its unchanged, open explanation', async (id) => {
    await mountDrill(id)
    const live = document.querySelector(`[data-drill-live-panel="${id}"]`)
    const explain = document.querySelector(`[data-drill-explain="${id}"]`)
    expect(live).not.toBeNull()
    expect(explain).not.toBeNull()
    expect(live!.compareDocumentPosition(explain!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // The explanation is the drill's own, from its data, and not folded away.
    const scenario = cardiohelpScenarioById.get(id)!
    expect(explain).toHaveTextContent('What explains it')
    expect(explain).toHaveTextContent(scenario.debrief.diagnosis)
    expect(explain).toHaveTextContent('The response that fits')
    expect(explain?.closest('details')).toBeNull()
  })
})
