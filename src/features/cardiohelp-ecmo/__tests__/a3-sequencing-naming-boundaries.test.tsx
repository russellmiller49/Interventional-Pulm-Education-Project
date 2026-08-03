import { render } from '@testing-library/react'

import { criticalCareLearningPathway } from '@/features/critical-care/content/learningPathways'
import { allCriticalCareDerivedValueGuides } from '@/features/critical-care/content/derivedValueGuides'

import { EcmoFoundationTeachingPanel } from '../components/teaching/EcmoFoundationTeachingPanel'
import { ecmoDerivedValueGuides } from '../content/ecmoValueGuides'
import { isEcmoFoundationSectionId } from '../content/foundationLessons'
import { cardiohelpLearnLessonsBySupportMode } from '../content/learnLessons'
import { createReferenceSimulationState, ecmoSimulationReducer } from '../engine'

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
    [ecmoDerivedValueGuides.circuitBloodFlow, /return limb/i],
    [ecmoDerivedValueGuides.pVen, /drainage limb/i],
    [ecmoDerivedValueGuides.pInt, /between the pump outlet and the membrane lung/i],
    [ecmoDerivedValueGuides.pArt, /return limb/i],
  ])('expands $label by physical location and points at local values', (guide, location) => {
    const references = guide.references.map((reference) => reference.statement).join(' ')
    expect(references).toMatch(location)
    expect(references).toMatch(/CARDIOHELP\/Getinge label/i)
    expect(references).toMatch(/not standard ECMO vocabulary/i)
    // The plan's exact ask: send the learner to their own unit rather than to a number invented here.
    expect(references).toMatch(/Your unit will have local reference values\. Ask for them\./)
  })

  it('separates pArt from the patient’s arterial pressure wherever it is introduced', () => {
    const references = ecmoDerivedValueGuides.pArt.references
      .map((reference) => `${reference.statement} ${reference.caveat ?? ''}`)
      .join(' ')
    expect(references).toMatch(/not the patient’s systemic arterial pressure/i)
    expect(references).toMatch(/return limb is venous/i)
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
    expect(vocabulary?.textContent).toMatch(/CARDIOHELP\/Getinge channel labels/i)
    expect(vocabulary?.textContent).toMatch(/pArt is not the patient’s arterial pressure/i)
    expect(vocabulary?.textContent).toMatch(/Ask for them/i)
  })
})

describe('A3.3: the stopped pump is one question, not the whole tour', () => {
  const orientation = cardiohelpLearnLessonsBySupportMode.vv[0]

  it('asks which channels remain interpretable while the pump is stopped', () => {
    const step = orientation.steps.find((item) => item.id === 'startup-screen-parameters')
    expect(step).toBeDefined()
    expect(step?.title).toMatch(/which channels still mean anything/i)
    expect(step?.instruction).toMatch(/unavailable indication rather than a number/i)
    expect(step?.expectedResponse.join(' ')).toMatch(/no blood is moving/i)
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
