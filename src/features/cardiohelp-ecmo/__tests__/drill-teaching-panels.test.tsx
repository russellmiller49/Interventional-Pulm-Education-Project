import { render } from '@testing-library/react'

import {
  assertModelBoundariesAreLabelled,
  assertNoUniversalTargetLanguage,
  assertTeachingPanelContract,
} from '@/features/critical-care/test-support/teachingPanelContract'

import { ecmoFoundationSections } from '../content/foundationLessons'
import { cardiohelpLearnLessonByScenarioId } from '../content/learnLessons'
import { requireEcmoLearnPrediction } from '../content/learnPredictionItems'
import {
  cardiohelpScenarioById,
  cardiohelpScenarios,
  predictionControls,
  predictionDirections,
  predictionGoals,
} from '../content/scenarios'
import { createInitialSimulationState, ecmoSimulationReducer } from '../engine'
import type { EcmoSimulationState } from '../engine/types'
import { DRILL_SIGNAL_KINDS } from '../components/teaching/drills/drillPanelPrimitives'
import {
  EcmoDrillTeachingPanel,
  ecmoDrillTeachingPanelScenarioIds,
  hasEcmoDrillTeachingPanel,
  validateEcmoDrillPanelRegistry,
} from '../components/teaching/EcmoDrillTeachingPanel'

/**
 * The B4 pilot slice: six live drill teaching panels.
 *
 * Two things are being pinned here. The registry has to stay exactly six known drills — a foundation
 * section registered as a drill would take a section's own teaching off the guided workbench, and a
 * seventh id added without a panel would render nothing at all. And each panel has to teach how to
 * read the circuit without answering the prediction: everything the authored item holds back until
 * a commitment must still be absent from the panel beside it.
 */

const PILOT_IDS = [
  'startup-sensor-orientation',
  'preload-drainage-collapse',
  'vv-recirculation',
  'gas-source-interruption',
  'arterial-bubble-stop',
  'va-differential-hypoxemia',
] as const

function settled(scenarioId: string, steps = 12): EcmoSimulationState {
  let state = createInitialSimulationState(scenarioId, 'guided')
  for (let tick = 0; tick < steps; tick += 1) {
    state = ecmoSimulationReducer(state, { type: 'STEP' })
  }
  return state
}

/** The state after the learner has committed the authored best option. */
function afterCommitment(state: EcmoSimulationState): EcmoSimulationState {
  const prediction = requireEcmoLearnPrediction(state.scenario.scenarioId)
  const best = prediction.item.choices.find((choice) => choice.plausibility === 'best')
  if (!best) throw new Error(`No best choice for ${state.scenario.scenarioId}`)
  const commitment = prediction.commitments[best.id]
  return ecmoSimulationReducer(state, {
    type: 'COMMIT_PREDICTION',
    goalId: commitment.goalId,
    control: commitment.control,
    direction: commitment.direction,
  })
}

describe('B4: the drill teaching-panel registry', () => {
  it('registers exactly the six pilot drills, and validates itself at import', () => {
    expect(validateEcmoDrillPanelRegistry()).toEqual([])
    expect([...ecmoDrillTeachingPanelScenarioIds].sort()).toEqual([...PILOT_IDS].sort())
    expect(ecmoDrillTeachingPanelScenarioIds).toHaveLength(6)
  })

  it('registers no duplicate id', () => {
    expect(new Set(ecmoDrillTeachingPanelScenarioIds).size).toBe(
      ecmoDrillTeachingPanelScenarioIds.length,
    )
  })

  it('registers only ids that are authored drill scenarios', () => {
    for (const id of ecmoDrillTeachingPanelScenarioIds) {
      expect(cardiohelpScenarioById.get(id)).toBeDefined()
      expect(cardiohelpLearnLessonByScenarioId.has(id)).toBe(true)
      expect(requireEcmoLearnPrediction(id)).toBeDefined()
    }
  })

  it('registers no foundation section as a drill panel', () => {
    for (const section of ecmoFoundationSections) {
      expect(hasEcmoDrillTeachingPanel(section.id)).toBe(false)
    }
  })

  it('leaves the other fourteen drills without a panel rather than borrowing one', () => {
    const unregistered = cardiohelpScenarios.filter(
      (scenario) => !hasEcmoDrillTeachingPanel(scenario.id),
    )
    expect(unregistered.length).toBeGreaterThan(0)
    const state = settled(unregistered[0].id)
    const { container } = render(<EcmoDrillTeachingPanel state={state} />)
    expect(container.querySelector('[data-drill-panel-unavailable]')).not.toBeNull()
    expect(container.querySelector('[data-drill-panel]')).toBeNull()
  })

  it('refuses a VA panel against a VV circuit, and the reverse', () => {
    // The scenario id and the live support mode are two separate facts, and a panel that described
    // the wrong flow topology would be describing a circuit that is not on screen.
    const vaOnVv: EcmoSimulationState = {
      ...settled('va-differential-hypoxemia'),
      supportMode: 'vv',
    }
    const vvOnVa: EcmoSimulationState = { ...settled('vv-recirculation'), supportMode: 'va' }

    for (const mismatched of [vaOnVv, vvOnVa]) {
      const view = render(<EcmoDrillTeachingPanel state={mismatched} />)
      expect(view.container.querySelector('[data-drill-panel]')).toBeNull()
      expect(view.container.querySelector('[data-drill-panel-unavailable]')).not.toBeNull()
      view.unmount()
    }
  })
})

describe('B4: every pilot panel satisfies the teaching-panel contract', () => {
  it.each(PILOT_IDS)('%s renders for its own support mode and satisfies the contract', (id) => {
    const state = settled(id)
    const { container } = render(<EcmoDrillTeachingPanel state={state} />)

    expect(container.querySelector(`[data-drill-panel="${id}"]`)).not.toBeNull()
    expect(
      container.querySelector('[data-drill-panel]')?.getAttribute('data-drill-support-mode'),
    ).toBe(cardiohelpScenarioById.get(id)?.supportMode)

    assertTeachingPanelContract(container, 'mechanism')
  })

  it.each(PILOT_IDS)('%s carries a text equivalent and a model boundary', (id) => {
    const { container } = render(<EcmoDrillTeachingPanel state={settled(id)} />)
    expect(container.querySelectorAll('[data-text-equivalent]').length).toBeGreaterThan(0)
    expect(container.querySelectorAll('[data-model-boundary]').length).toBeGreaterThan(0)
    assertModelBoundariesAreLabelled(container)
    for (const boundary of container.querySelectorAll('[data-model-boundary]')) {
      expect(boundary.textContent ?? '').toMatch(/simulation|model/i)
    }
  })

  it.each(PILOT_IDS)('%s introduces no universal bedside target', (id) => {
    const before = render(<EcmoDrillTeachingPanel state={settled(id)} />)
    assertNoUniversalTargetLanguage(before.container.textContent ?? '')
    before.unmount()

    const after = render(<EcmoDrillTeachingPanel state={afterCommitment(settled(id))} />)
    assertNoUniversalTargetLanguage(after.container.textContent ?? '')
    after.unmount()
  })

  it.each(PILOT_IDS)('%s classifies every signal it shows as an authored kind', (id) => {
    const { container } = render(<EcmoDrillTeachingPanel state={settled(id)} />)
    const rows = container.querySelectorAll('[data-signal-kind]')
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      expect(DRILL_SIGNAL_KINDS).toContain(row.getAttribute('data-signal-kind'))
      // The kind is spelled out, never carried by colour or an attribute alone.
      expect(row.querySelector('[data-signal-kind-label]')?.textContent?.trim()).toBeTruthy()
      expect(row.querySelector('[data-signal-site]')?.textContent?.trim()).toBeTruthy()
    }
  })

  it.each(PILOT_IDS)('%s does not call a bedside or blender value a console reading', (id) => {
    /*
     * `valid` says this console measures and displays it. The other three of the four domains the
     * startup drill exists to keep apart must never carry it.
     *
     * This was a site allowlist, which meant it only ever checked rows whose wording someone had
     * remembered to add to the pattern — a row sited at the "bedside circuit" was skipped entirely
     * and could claim to be a console reading with nothing to stop it. The check now runs the other
     * way round: every row is examined, and a row is only allowed to be `valid` if its site names a
     * place this console actually measures.
     */
    const consoleSites =
      /console|circuit tubing|drainage limb|return limb|between pump and oxygenator|across the membrane|derived across|flow probe|oxygenator inlet/i
    const nonConsoleSites =
      /pulse oximeter|blood gas|blender|arterial line|echocardiograph|bedside|by hand|after the membrane|patient/i

    const { container } = render(<EcmoDrillTeachingPanel state={settled(id)} />)
    const rows = [...container.querySelectorAll('[data-signal]')]
    expect(rows.length).toBeGreaterThan(0)

    for (const row of rows) {
      const site = row.querySelector('[data-signal-site]')?.textContent ?? ''
      const kind = row.getAttribute('data-signal-kind')
      expect(site.trim()).not.toBe('')

      // A site that names somewhere off the console may never be sold as a console reading …
      if (nonConsoleSites.test(site) && !consoleSites.test(site)) {
        expect({ signal: row.getAttribute('data-signal'), site, kind }).toMatchObject({
          kind: expect.not.stringMatching(/^valid$/),
        })
      }

      // … and a row that claims to be on the console must name a place the console measures, so a
      // new row cannot default its way to `valid` from a site nobody classified.
      if (kind === 'valid') {
        expect({ signal: row.getAttribute('data-signal'), site }).toMatchObject({
          site: expect.stringMatching(consoleSites),
        })
      }
    }
  })
})

describe('B4: no pilot panel leaks the authored answer before commitment', () => {
  it.each(PILOT_IDS)('%s withholds the mechanism, the response, and the reflex', (id) => {
    const { container } = render(<EcmoDrillTeachingPanel state={settled(id)} />)

    expect(container.querySelector('[data-withheld-until-commitment]')).not.toBeNull()
    expect(container.querySelector('[data-after-commitment]')).toBeNull()
    for (const selector of [
      '[data-drill-mechanism]',
      '[data-drill-competing]',
      '[data-drill-fitting-response]',
      '[data-drill-domains]',
      '[data-harmful-reflex]',
      '[data-committed-choice]',
    ]) {
      expect(container.querySelector(selector)).toBeNull()
    }
  })

  it.each(PILOT_IDS)('%s prints none of the authored answer text before commitment', (id) => {
    const { container } = render(<EcmoDrillTeachingPanel state={settled(id)} />)
    const text = container.textContent ?? ''
    const prediction = requireEcmoLearnPrediction(id)
    const scenario = cardiohelpScenarioById.get(id)
    if (!scenario) throw new Error(`No scenario ${id}`)

    // Every authored choice label and rationale, the explanation, and the debrief causal chain.
    for (const choice of prediction.item.choices) {
      expect(text).not.toContain(choice.label)
      if (choice.rationale) expect(text).not.toContain(choice.rationale)
    }
    expect(text).not.toContain(prediction.item.explanation)
    for (const link of scenario.debrief.causalChain) expect(text).not.toContain(link)
    for (const step of scenario.debrief.correctWorkflow) expect(text).not.toContain(step)

    // The diagnosis itself, and the shape of sentence that states it. The first draft of these
    // panels leaked exactly this way: not by quoting an authored string, but by ending a
    // pre-commitment summary with "a recirculation state is active on this circuit".
    expect(text).not.toContain(scenario.debrief.diagnosis)
    expect(text).not.toMatch(/\bis active on this circuit\b/i)
    expect(text).not.toMatch(/\bhas been corrected on this circuit\b/i)

    // And the expectation's own triple, in the words the Practice surface uses for it.
    const goalLabel = predictionGoals.find((goal) => goal.id === scenario.expectation.goalId)?.label
    const controlLabel = predictionControls.find(
      (control) => control.value === scenario.expectation.control,
    )?.label
    const directionLabel = predictionDirections.find(
      (direction) => direction.value === scenario.expectation.direction,
    )?.label
    for (const label of [goalLabel, controlLabel, directionLabel]) {
      if (label) expect(text).not.toContain(label)
    }
  })

  it.each(PILOT_IDS)('%s opens the mechanism only once the engine holds a commitment', (id) => {
    const { container } = render(<EcmoDrillTeachingPanel state={afterCommitment(settled(id))} />)

    expect(container.querySelector('[data-withheld-until-commitment]')).toBeNull()
    expect(container.querySelector('[data-after-commitment]')).not.toBeNull()
    for (const selector of [
      '[data-drill-mechanism]',
      '[data-drill-competing]',
      '[data-drill-fitting-response]',
      '[data-drill-domains]',
      '[data-harmful-reflex]',
    ]) {
      expect(container.querySelector(selector)).not.toBeNull()
    }
    // All three domains, always, and always separately.
    for (const domain of ['device', 'circuit-or-gas', 'patient']) {
      expect(container.querySelector(`[data-domain="${domain}"]`)).not.toBeNull()
    }
  })

  it('reads the learner’s own committed choice back rather than the authored best one', () => {
    // A learner who commits the unsafe option must see their own commitment named, and must still
    // not be told here whether it was right — that belongs beside the question, in AnswerVerdict.
    const prediction = requireEcmoLearnPrediction('preload-drainage-collapse')
    const unsafe = prediction.item.choices.find((choice) => choice.plausibility === 'unsafe')
    if (!unsafe) throw new Error('No unsafe choice authored for preload-drainage-collapse')
    const commitment = prediction.commitments[unsafe.id]
    const state = ecmoSimulationReducer(settled('preload-drainage-collapse'), {
      type: 'COMMIT_PREDICTION',
      goalId: commitment.goalId,
      control: commitment.control,
      direction: commitment.direction,
    })

    const { container } = render(<EcmoDrillTeachingPanel state={state} />)
    const committed = container.querySelector('[data-committed-choice]')?.textContent ?? ''
    expect(committed).toContain(
      predictionControls.find((control) => control.value === commitment.control)?.label,
    )
    expect(committed).not.toMatch(/correct|incorrect|right answer|well done/i)
  })

  it('closes the mechanism again when the scenario is reloaded and the commitment is cleared', () => {
    const state = ecmoSimulationReducer(afterCommitment(settled('vv-recirculation')), {
      type: 'LOAD_SCENARIO',
      scenarioId: 'vv-recirculation',
      mode: 'guided',
    })
    expect(state.scenario.prediction.committed).toBe(false)
    const { container } = render(<EcmoDrillTeachingPanel state={state} />)
    expect(container.querySelector('[data-withheld-until-commitment]')).not.toBeNull()
    expect(container.querySelector('[data-drill-mechanism]')).toBeNull()
  })
})

describe('B4: the panels read the live circuit rather than static prose', () => {
  it('follows the settled pump-off state, the running reference, and the recorded inspection', () => {
    const stopped = settled('startup-sensor-orientation', 2)
    const stoppedView = render(<EcmoDrillTeachingPanel state={stopped} />)
    expect(stoppedView.container.querySelector('[data-startup-stage]')?.textContent).toMatch(
      /Stopped/i,
    )
    // A1: flow is a valid zero with the sensor connected, while the pressure channels are unmodeled.
    const stoppedKinds = new Map(
      [...stoppedView.container.querySelectorAll('[data-signal]')].map((row) => [
        row.getAttribute('data-signal'),
        row.getAttribute('data-signal-kind'),
      ]),
    )
    expect(stoppedKinds.get('Flow')).toBe('valid')
    expect(stoppedKinds.get('pVen')).toBe('simulation-unmodeled')
    expect(stoppedKinds.get('pInt')).toBe('simulation-unmodeled')
    stoppedView.unmount()

    let running = ecmoSimulationReducer(stopped, { type: 'SET_RPM', rpm: 3200 })
    for (let tick = 0; tick < 6; tick += 1) {
      running = ecmoSimulationReducer(running, { type: 'STEP' })
    }
    const runningView = render(<EcmoDrillTeachingPanel state={running} />)
    expect(runningView.container.querySelector('[data-startup-stage]')?.textContent).toMatch(
      /demonstration/i,
    )
    const runningKinds = new Map(
      [...runningView.container.querySelectorAll('[data-signal]')].map((row) => [
        row.getAttribute('data-signal'),
        row.getAttribute('data-signal-kind'),
      ]),
    )
    expect(runningKinds.get('pVen')).toBe('valid')
    // Bringing a reference circuit up is not completion of the pre-use sequence.
    expect(
      runningView.container.querySelector('[data-startup-inspection-outstanding]'),
    ).not.toBeNull()
    runningView.unmount()

    // Back to a stopped, unchecked circuit: the same claim as at the start, deliberately.
    const returned = ecmoSimulationReducer(running, {
      type: 'LOAD_SCENARIO',
      scenarioId: 'startup-sensor-orientation',
      mode: 'guided',
    })
    const returnedView = render(<EcmoDrillTeachingPanel state={returned} />)
    expect(returnedView.container.querySelector('[data-startup-stage]')?.textContent).toMatch(
      /Stopped/i,
    )
    expect(
      returnedView.container.querySelector('[data-startup-inspection-outstanding]'),
    ).not.toBeNull()
  })

  it('moves the recirculation panel with the circuit rather than restating the case', () => {
    const opening = afterCommitment(settled('vv-recirculation'))
    const openingView = render(<EcmoDrillTeachingPanel state={opening} />)
    const openingText = openingView.container.textContent ?? ''
    openingView.unmount()

    let escalated = ecmoSimulationReducer(opening, { type: 'SET_RPM', rpm: 4400 })
    for (let tick = 0; tick < 8; tick += 1) {
      escalated = ecmoSimulationReducer(escalated, { type: 'STEP' })
    }
    const escalatedView = render(<EcmoDrillTeachingPanel state={escalated} />)

    // A2 in the panel's own words: displayed flow up, effective flow down.
    expect(escalated.circuit.bloodFlow).toBeGreaterThan(opening.circuit.bloodFlow)
    expect(escalated.circuit.recirculationAdjustedCircuitFlowLpm).toBeLessThan(
      opening.circuit.recirculationAdjustedCircuitFlowLpm,
    )
    expect(escalatedView.container.textContent).not.toBe(openingText)
    expect(
      escalatedView.container.querySelector('[data-live-effective-support]')?.textContent,
    ).toContain(escalated.circuit.recirculationAdjustedCircuitFlowLpm.toFixed(2))
  })

  it('tracks the bubble sequence one state flag at a time', () => {
    let state = afterCommitment(settled('arterial-bubble-stop', 6))
    const before = render(<EcmoDrillTeachingPanel state={state} />)
    const doneBefore = [...before.container.querySelectorAll('[data-pattern-reading]')].filter(
      (node) => node.textContent === 'Done',
    ).length
    before.unmount()

    state = ecmoSimulationReducer(state, {
      type: 'TOGGLE_CIRCUIT_CLAMP',
      limb: 'return',
      closed: true,
    })
    state = ecmoSimulationReducer(state, {
      type: 'TOGGLE_CIRCUIT_CLAMP',
      limb: 'drainage',
      closed: true,
    })
    const after = render(<EcmoDrillTeachingPanel state={state} />)
    const doneAfter = [...after.container.querySelectorAll('[data-pattern-reading]')].filter(
      (node) => node.textContent === 'Done',
    ).length
    expect(doneAfter).toBeGreaterThan(doneBefore)
  })

  it('holds the venoarterial mixing-region boundary as a limitation of the lab, not a clinical claim', () => {
    const state = afterCommitment(settled('va-differential-hypoxemia'))
    const { container } = render(<EcmoDrillTeachingPanel state={state} />)
    const boundaries = [...container.querySelectorAll('[data-model-boundary]')]
      .map((node) => node.textContent ?? '')
      .join(' ')

    expect(boundaries).toMatch(/does not derive or move a mixing point/i)
    expect(boundaries).toMatch(/limitation of the lab, not a statement that flow does not matter/i)
    expect(container.textContent).toMatch(/femoral|post-membrane/i)
    expect(container.textContent).toMatch(/pArt/)
  })
})
