import { act, fireEvent, render, within } from '@testing-library/react'

import { criticalCareLearningPathway } from '@/features/critical-care/content/learningPathways'
import { allCriticalCareDerivedValueGuides } from '@/features/critical-care/content/derivedValueGuides'

import { EcmoFoundationTeachingPanel } from '../components/teaching/EcmoFoundationTeachingPanel'
import { ecmoDerivedValueGuides } from '../content/ecmoValueGuides'
import { isEcmoFoundationSectionId } from '../content/foundationLessons'
import { cardiohelpLearnLessonsBySupportMode } from '../content/learnLessons'
import { CardiohelpConsole } from '../components/CardiohelpConsole'
import {
  createInitialSimulationState,
  createReferenceSimulationState,
  ecmoSimulationReducer,
} from '../engine'

function settledReference(profileId: 'vv-reference' | 'va-reference') {
  let state = createReferenceSimulationState(profileId)
  for (let tick = 0; tick < 12; tick += 1) state = ecmoSimulationReducer(state, { type: 'STEP' })
  return state
}

/**
 * A3 — sequence, naming, and first console exposure.
 *
 * Each block pins one of the plan's sub-items against the surface a learner actually meets, so a
 * later content edit cannot quietly undo the ordering or drop a boundary.
 */

describe('A3.1: stable reference before detailed departure', () => {
  it.each(['vv', 'va'] as const)(
    'puts the %s normal state before the section that departs from it',
    (track) => {
      const order = criticalCareLearningPathway('cardiohelp-ecmo', track).sections.map(
        (section) => section.id,
      )
      const normal = order.indexOf(`${track}-normal-state`)
      const mechanism = order.indexOf(
        track === 'vv' ? 'vv-series-physiology' : 'va-parallel-physiology',
      )
      expect(normal).toBeGreaterThan(-1)
      expect(mechanism).toBeGreaterThan(-1)
      expect(normal).toBeLessThan(mechanism)

      // The shared topology sections still come first, and the console tour still follows both.
      expect(order.indexOf('circuit-flow-path')).toBeLessThan(normal)
      const consoleIndex = order.findIndex((id) => id.includes('startup-sensor-orientation'))
      expect(mechanism).toBeLessThan(consoleIndex)
    },
  )

  it.each([
    ['vv', 'vv-normal-state', 'in series'],
    ['va', 'va-normal-state', 'in parallel'],
  ] as const)(
    'gives the %s normal state a short topology lead, since the detail now comes after it',
    (track, sectionId, relationship) => {
      const { container } = render(
        <EcmoFoundationTeachingPanel
          sectionId={sectionId}
          state={settledReference(track === 'vv' ? 'vv-reference' : 'va-reference')}
        />,
      )
      const lead = container.querySelector('[data-topology-lead]')
      expect(lead).not.toBeNull()
      expect(lead?.textContent).toMatch(new RegExp(relationship, 'i'))
    },
  )

  it('keeps the arc sentence and the section order telling the same story', () => {
    for (const track of ['vv', 'va'] as const) {
      const pathway = criticalCareLearningPathway('cardiohelp-ecmo', track)
      // "learn the normal state, then work what goes wrong" — the order used to contradict this.
      expect(pathway.arcSentence).toMatch(/normal .*state, then work what goes wrong/i)
    }
  })
})

describe('A3.2: CARDIOHELP channel names are named as this manufacturer’s', () => {
  it('authors a primary-channel guide for flow and all three pressure channels', () => {
    const ids = allCriticalCareDerivedValueGuides().map((guide) => guide.id)
    for (const id of ['ecmo.circuitBloodFlow', 'ecmo.pVen', 'ecmo.pInt', 'ecmo.pArt']) {
      expect(ids).toContain(id)
    }
  })

  it.each([
    [ecmoDerivedValueGuides.circuitBloodFlow, /sensor sits on the return limb|sensor sits/i],
    [ecmoDerivedValueGuides.pVen, /drainage limb/i],
    [ecmoDerivedValueGuides.pInt, /between the pump outlet and the membrane lung/i],
    [ecmoDerivedValueGuides.pArt, /post-oxygenator, return-side circuit tubing|return limb/i],
  ])('expands $label by physical location and points at local values', (guide, location) => {
    const references = guide.references.map((reference) => reference.statement).join(' ')
    expect(references).toMatch(location)
    // The plan's exact ask: send the learner to their own unit rather than to a number invented here.
    expect(references).toMatch(/Your unit will have local reference values\. Ask for them\./)
  })

  it.each([
    ['pVen', ecmoDerivedValueGuides.pVen],
    ['pInt', ecmoDerivedValueGuides.pInt],
    ['pArt', ecmoDerivedValueGuides.pArt],
  ])('names %s as a CARDIOHELP/Getinge channel label', (_channel, guide) => {
    const references = guide.references.map((reference) => reference.statement).join(' ')
    expect(references).toMatch(/CARDIOHELP\/Getinge label/i)
    expect(references).toMatch(/not standard ECMO vocabulary/i)
  })

  it('does not call circuit blood flow a manufacturer term', () => {
    // "Flow" is ECMO vocabulary, not Getinge's word. What is device-specific is the measurement:
    // where the sensor sits, what is displayed, and when the value is available.
    const references = ecmoDerivedValueGuides.circuitBloodFlow.references
      .map((reference) => reference.statement)
      .join(' ')
    expect(references).not.toMatch(/CARDIOHELP\/Getinge label/i)
    expect(references).not.toMatch(/not standard ECMO vocabulary/i)
    expect(references).toMatch(/general ECMO concept rather than a manufacturer term/i)
    expect(references).toMatch(/specific to the CARDIOHELP is the measurement/i)
    expect(references).toMatch(/when the value is available/i)
  })

  it('separates pArt from the patient’s arterial blood pressure wherever it is introduced', () => {
    const references = ecmoDerivedValueGuides.pArt.references
      .map((reference) => `${reference.statement} ${reference.caveat ?? ''}`)
      .join(' ')
    expect(references).toMatch(/post-oxygenator, return-side circuit tubing/i)
    expect(references).toMatch(/not the patient’s arterial blood pressure/i)
    // The VV nuance must be stated as where the cannula returns to, not as a claim that nothing
    // arterial is involved — the returned blood is oxygenated.
    expect(references).toMatch(
      /return cannula enters the venous circulation even though the returned blood is oxygenated/i,
    )
    expect(references).not.toMatch(/not a blood-pressure measurement of any kind/i)
    expect(references).not.toMatch(/return limb is venous/i)
    expect(references).not.toMatch(/not measuring anything arterial at all/i)
    expect(ecmoDerivedValueGuides.pArt.doNotInfer).toMatch(/do not read it as the patient/i)
  })

  it('states the vocabulary caveat on the panel where the channels are first met', () => {
    const { container } = render(
      <EcmoFoundationTeachingPanel
        sectionId="circuit-flow-path"
        state={settledReference('vv-reference')}
      />,
    )
    const vocabulary = container.querySelector('[data-channel-vocabulary]')
    expect(vocabulary).not.toBeNull()
    expect(vocabulary?.textContent).toMatch(
      /pVen, pInt and pArt are CARDIOHELP\/Getinge channel labels/i,
    )
    expect(vocabulary?.textContent).toMatch(/pArt is not the patient’s arterial blood pressure/i)
    expect(vocabulary?.textContent).toMatch(
      /return cannula enters the venous circulation even though the returned blood is oxygenated/i,
    )
    // Flow is named as the general concept it is, on the same surface.
    expect(vocabulary?.textContent).toMatch(/Circuit blood flow is different in kind/i)
    expect(vocabulary?.textContent).toMatch(/general ECMO vocabulary/i)
    expect(vocabulary?.textContent).toMatch(/Ask for them/i)
  })
})

describe('A3.3: the stopped pump is one question, not the whole tour', () => {
  const orientation = cardiohelpLearnLessonsBySupportMode.vv[0]

  it('asks what the console can still tell you in the settled pump-off state', () => {
    const step = orientation.steps.find((item) => item.id === 'startup-screen-parameters')
    expect(step).toBeDefined()
    expect(step?.title).toMatch(/which channels still mean anything/i)
    expect(step?.instruction).toMatch(/unavailable indication rather than a number/i)

    const answers = step?.expectedResponse.join(' ') ?? ''
    // Flow is interpretable here: zero is a reading, not an absence, while its sensor is connected.
    expect(answers).toMatch(/flow reads zero/i)
    expect(answers).toMatch(/sensor connected that is a real value/i)
    // Speed, power and alarm/device state — not timers — are the other interpretable information.
    expect(answers).toMatch(/speed setpoint, power source and alarm or device state/i)
    expect(answers).not.toMatch(/timers/i)
    // Flow-dependent patterns this model does not report, rather than an absolute claim.
    expect(answers).toMatch(/flow-dependent patterns this model does not produce/i)

    const settledLanguage = `${step?.instruction ?? ''} ${step?.rationale ?? ''} ${answers}`
    expect(settledLanguage).toMatch(/settled pump-off state/i)
    expect(settledLanguage).not.toMatch(/while the pump is stopped/i)
    expect(settledLanguage).not.toMatch(/each is a pressure produced by flow/i)
  })

  it('brings the circuit up before the rest of the console tour', () => {
    const ids = orientation.steps.map((step) => step.id)
    const rampIndex = ids.indexOf('startup-bring-circuit-up')
    expect(rampIndex).toBeGreaterThan(ids.indexOf('startup-screen-parameters'))

    // Every remaining screen tour step must come after the ramp, so no tile is met on a dead circuit.
    for (const screenStepId of [
      'startup-screen-parameters-running',
      'startup-screen-blood',
      'startup-screen-transport',
      'startup-screen-interventions',
      'startup-screen-timers',
      'startup-screen-alarm-history',
    ]) {
      expect(ids.indexOf(screenStepId)).toBeGreaterThan(rampIndex)
    }
  })

  it('describes the ramp as a simulated progressive climb, not as bedside technique', () => {
    const step = orientation.steps.find((item) => item.id === 'startup-bring-circuit-up')
    expect(step?.instruction).toMatch(/climbs progressively while it is held/i)
    const copy = `${step?.instruction ?? ''} ${step?.rationale ?? ''}`
    expect(copy).toMatch(/simulates a ramp/i)
    // The removed claim: holding a computer key is not how a bedside pump is brought up.
    expect(copy).not.toMatch(/the way speed is brought up at the bedside/i)
  })

  it('re-reads the parameter list once the channels report', () => {
    const step = orientation.steps.find((item) => item.id === 'startup-screen-parameters-running')
    expect(step?.actions).toEqual([{ type: 'SET_SCREEN', screen: 'parameters' }])
    expect(step?.expectedResponse.join(' ')).toMatch(/pArt is a circuit pressure/i)
  })
})

describe('A3.4: boundaries sit beside the thing they constrain', () => {
  it('puts the recirculation algebra behind a disclosure, warning first', () => {
    const { container } = render(
      <EcmoFoundationTeachingPanel
        sectionId="vv-series-physiology"
        state={settledReference('vv-reference')}
      />,
    )
    const working = container.querySelector('[data-disclosed-working]')
    expect(working).not.toBeNull()

    // The caution is outside the <details>, so it is read whether or not the learner opens it.
    const lead = working?.querySelector('[data-do-not-infer-lead]')
    expect(lead?.textContent).toMatch(/do not infer a bedside recirculation fraction/i)

    const details = working?.querySelector('details')
    expect(details).not.toBeNull()
    expect(details?.querySelector('[data-mixture-formula]')).not.toBeNull()
    // And the formula must be inside the disclosure rather than beside it.
    expect(lead?.querySelector('[data-mixture-formula]')).toBeNull()
  })

  it.each([
    ['sweep-linearity', 'blood-flow-versus-sweep'],
    ['demand-and-native-lung-fixed', 'blood-flow-versus-sweep'],
  ] as const)('states the %s boundary on the %s panel', (boundary, sectionId) => {
    const { container } = render(
      <EcmoFoundationTeachingPanel
        sectionId={sectionId}
        state={settledReference('vv-reference')}
      />,
    )
    const node = container.querySelector(`[data-local-model-boundary="${boundary}"]`)
    expect(node).not.toBeNull()
    expect(node?.textContent?.length ?? 0).toBeGreaterThan(60)
  })

  it('describes real CO₂ removal as diminishing and multiply limited, not as saturation', () => {
    const { container } = render(
      <EcmoFoundationTeachingPanel
        sectionId="blood-flow-versus-sweep"
        state={settledReference('vv-reference')}
      />,
    )
    const sweep = container.querySelector('[data-local-model-boundary="sweep-linearity"]')
    const text = sweep?.textContent ?? ''
    // The central boundary survives...
    expect(text).toMatch(/straight line in this simulation, by construction/i)
    expect(text).toMatch(/read the direction here, not the slope/i)
    // ...and the reason real removal differs is stated properly.
    expect(text).toMatch(/diminishing returns/i)
    expect(text).toMatch(/blood flow through the membrane/i)
    expect(text).toMatch(/membrane performance/i)
    expect(text).toMatch(/remaining gas-side gradient/i)
    expect(text).not.toMatch(/a real membrane saturates/i)
  })

  it('keeps every boundary phrased as a statement about this simulation', () => {
    // The shared teaching-panel contract requires it, and it is the difference between "the model
    // does not do this" and an unsourced claim about real circuits.
    const { container } = render(
      <EcmoFoundationTeachingPanel
        sectionId="blood-flow-versus-sweep"
        state={settledReference('vv-reference')}
      />,
    )
    for (const node of container.querySelectorAll('[data-model-boundary]')) {
      expect(node.textContent).toMatch(/simulation/i)
    }
  })
})

describe('A3: nothing that identifies an activity moved', () => {
  it('keeps every pathway section id and activity id stable', () => {
    // Reordering is allowed; renaming is not. These are the public identifiers.
    for (const track of ['vv', 'va'] as const) {
      const sections = criticalCareLearningPathway('cardiohelp-ecmo', track).sections
      for (const section of sections) {
        expect(section.activityId).toBe(`ecmo:learn:${section.id}`)
      }
      const ids = sections.map((section) => section.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('leaves the orientation lesson on its own scenario and activity', () => {
    const orientation = cardiohelpLearnLessonsBySupportMode.vv[0]
    expect(orientation.id).toBe('learn-startup-sensor-orientation')
    expect(orientation.scenarioId).toBe('startup-sensor-orientation')
  })
})

describe('A3: the panels still render for every foundation section', () => {
  it.each([
    ['vv', 'vv-reference'],
    ['va', 'va-reference'],
  ] as const)('renders every %s foundation section without throwing', (track, profileId) => {
    const state = settledReference(profileId)
    // Drill sections in the pathway have no teaching panel; they open the guided workbench instead.
    const sections = criticalCareLearningPathway('cardiohelp-ecmo', track).sections.filter(
      (section) => isEcmoFoundationSectionId(section.id),
    )
    expect(sections.length).toBeGreaterThan(0)
    for (const section of sections) {
      const panel = render(
        <EcmoFoundationTeachingPanel sectionId={section.id as never} state={state} />,
      )
      expect(panel.container.querySelector('[data-teaching-panel]')).not.toBeNull()
      panel.unmount()
    }
  })
})

describe('A3.5-adjacent: the rotary ramp is reachable by pointer as well as keyboard', () => {
  function mountConsole() {
    let state = createInitialSimulationState('startup-sensor-orientation')
    const rerenderRef: { current: (next: typeof state) => void } = { current: () => {} }
    const dispatch = (action: Parameters<typeof ecmoSimulationReducer>[1]) => {
      state = ecmoSimulationReducer(state, action)
      rerenderRef.current(state)
    }
    const view = render(<CardiohelpConsole state={state} dispatch={dispatch} controlsEnabled />)
    rerenderRef.current = (next) =>
      view.rerender(<CardiohelpConsole state={next} dispatch={dispatch} controlsEnabled />)
    return {
      view,
      rpm: () => state.device.rpmSetpoint,
    }
  }

  it('steps once on a plain pointer tap, without double-counting the click', () => {
    const { view, rpm } = mountConsole()
    const increase = within(view.container).getByRole('button', { name: /Increase setpoint/i })
    fireEvent.pointerDown(increase)
    fireEvent.pointerUp(increase)
    fireEvent.click(increase)
    // One tap is one rotary step, even though pointerdown and click both fire.
    expect(rpm()).toBe(50)
  })

  it('ramps while the pointer is held, so 0 to 3200 is not sixty-four clicks', () => {
    jest.useFakeTimers()
    try {
      const { view, rpm } = mountConsole()
      const increase = within(view.container).getByRole('button', { name: /Increase setpoint/i })
      fireEvent.pointerDown(increase)
      act(() => {
        jest.advanceTimersByTime(3000)
      })
      fireEvent.pointerUp(increase)
      expect(rpm()).toBeGreaterThanOrEqual(3200)

      // And the hold stops when the pointer is released.
      const settled = rpm()
      act(() => {
        jest.advanceTimersByTime(1000)
      })
      expect(rpm()).toBe(settled)
    } finally {
      jest.useRealTimers()
    }
  })

  it('still steps once for a keyboard activation of the stepper', () => {
    const { view, rpm } = mountConsole()
    const decrease = within(view.container).getByRole('button', { name: /Decrease setpoint/i })
    // Enter or Space on a button fires click without any pointer event.
    fireEvent.click(decrease)
    expect(rpm()).toBe(0)

    const increase = within(view.container).getByRole('button', { name: /Increase setpoint/i })
    fireEvent.click(increase)
    fireEvent.click(increase)
    expect(rpm()).toBe(100)
  })

  it('tells the learner both ways of driving the dial', () => {
    const { view } = mountConsole()
    const hint = view.container.querySelector('#cardiohelp-rotary-hold-hint')
    expect(hint?.textContent).toMatch(/press and hold to ramp/i)
    expect(hint?.textContent).toMatch(/hold an arrow key/i)
    for (const name of [/Increase setpoint/i, /Decrease setpoint/i]) {
      expect(within(view.container).getByRole('button', { name })).toHaveAttribute(
        'aria-describedby',
        'cardiohelp-rotary-hold-hint',
      )
    }
  })
})
