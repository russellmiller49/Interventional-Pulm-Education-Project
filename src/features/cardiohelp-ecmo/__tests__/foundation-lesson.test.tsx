import { render } from '@testing-library/react'

import { assertNoUniversalTargetLanguage } from '@/features/critical-care/test-support/teachingPanelContract'
import { allCriticalCareDerivedValueGuides } from '@/features/critical-care/content/derivedValueGuides'

import { EcmoFoundationTeachingPanel } from '../components/teaching/EcmoFoundationTeachingPanel'
import {
  ecmoFoundationTeachingPanelSectionIds,
  hasEcmoFoundationTeachingPanel,
  validateEcmoFoundationPanelRegistry,
} from '../components/teaching/EcmoFoundationTeachingPanel'
import { ecmoFoundationLearningItems } from '../content/foundationLearningItems'
import {
  ecmoFoundationLessonRuntimes,
  ecmoFoundationSupportMode,
  ecmoFoundationVariants,
  ecmoInteractiveFoundationSectionIds,
  ecmoSharedFoundationSectionIds,
  ecmoVaOnlyFoundationSectionIds,
  ecmoVvOnlyFoundationSectionIds,
  isEcmoInteractiveFoundationSectionId,
  isEcmoSharedFoundationSectionId,
} from '../content/foundationLessonRuntime'
import { createFoundationVariantState } from '../session/foundationSession'
import { ecmoFoundationSectionById } from '../content/foundationLessons'
import { ecmoReferenceProfileForMode } from '../content/referenceProfiles'
import '../content/ecmoValueGuides'
import { createReferenceSimulationState, ecmoSimulationReducer } from '../engine'
import type { EcmoSimulationState, SupportMode } from '../engine/types'

function settled(supportMode: SupportMode, seconds = 10): EcmoSimulationState {
  let state = createReferenceSimulationState(ecmoReferenceProfileForMode(supportMode).id)
  for (let tick = 0; tick < seconds; tick += 1) {
    state = ecmoSimulationReducer(state, { type: 'STEP' })
  }
  return state
}

describe('interactive foundation panel registry', () => {
  it('registers exactly the ten interactive sections', () => {
    expect(validateEcmoFoundationPanelRegistry()).toEqual([])
    expect(ecmoFoundationTeachingPanelSectionIds).toHaveLength(10)
    expect([...ecmoFoundationTeachingPanelSectionIds].sort()).toEqual(
      [...ecmoInteractiveFoundationSectionIds].sort(),
    )
    expect(ecmoSharedFoundationSectionIds).toHaveLength(4)
    expect(ecmoVvOnlyFoundationSectionIds).toHaveLength(3)
    expect(ecmoVaOnlyFoundationSectionIds).toHaveLength(3)
    expect(new Set(ecmoInteractiveFoundationSectionIds).size).toBe(10)
    // The invariant the registry validator checks: a repeat in the id list collapses into a single
    // object key, so comparing a deduplicated list against the registry would never see one.
    expect(ecmoInteractiveFoundationSectionIds).toHaveLength(
      new Set(ecmoInteractiveFoundationSectionIds).size,
    )
  })

  it('registers no drill section', () => {
    for (const excluded of [
      'startup-sensor-orientation',
      'vv-recirculation',
      'gas-source-interruption',
      'afterload-oxygenator-resistance',
      'vv-off-sweep-capstone',
      'va-differential-hypoxemia',
      'va-lv-loading',
      'va-mixed-circulation-capstone',
    ]) {
      expect(hasEcmoFoundationTeachingPanel(excluded)).toBe(false)
      expect(isEcmoInteractiveFoundationSectionId(excluded)).toBe(false)
    }
  })

  it('keeps the track-fixed sections out of the track-shared set', () => {
    for (const sectionId of [
      ...ecmoVvOnlyFoundationSectionIds,
      ...ecmoVaOnlyFoundationSectionIds,
    ]) {
      expect(isEcmoSharedFoundationSectionId(sectionId)).toBe(false)
      expect(isEcmoInteractiveFoundationSectionId(sectionId)).toBe(true)
      expect(hasEcmoFoundationTeachingPanel(sectionId)).toBe(true)
    }
  })

  it('fixes each track-fixed section to its own track, whichever track is asked for', () => {
    for (const requested of ['vv', 'va'] as const) {
      for (const sectionId of ecmoVvOnlyFoundationSectionIds) {
        expect(ecmoFoundationSupportMode(sectionId, requested)).toBe('vv')
      }
      for (const sectionId of ecmoVaOnlyFoundationSectionIds) {
        expect(ecmoFoundationSupportMode(sectionId, requested)).toBe('va')
      }
      for (const sectionId of ecmoSharedFoundationSectionIds) {
        expect(ecmoFoundationSupportMode(sectionId, requested)).toBe(requested)
      }
    }
  })

  it('never offers the other track’s reference circuit behind a track-fixed section', () => {
    for (const sectionId of ecmoVaOnlyFoundationSectionIds) {
      const runtime = ecmoFoundationLessonRuntimes[sectionId]
      expect(runtime.supportMode).toBe('va')
      for (const requested of ['vv', 'va'] as const) {
        for (const variant of ecmoFoundationVariants(runtime, requested)) {
          if (variant.source.kind === 'reference-profile') {
            expect(variant.source.profileId).toBe('va-reference')
          }
          expect(createFoundationVariantState(variant).supportMode).toBe('va')
        }
      }
    }
  })

  it('gives every interactive section a runtime, prediction, and transfer item', () => {
    for (const sectionId of ecmoInteractiveFoundationSectionIds) {
      const runtime = ecmoFoundationLessonRuntimes[sectionId]
      expect(runtime.sectionId).toBe(sectionId)
      expect(runtime.evidenceIds.length).toBeGreaterThan(0)
      const items = ecmoFoundationLearningItems[sectionId]
      expect(items.prediction.evidenceIds.length).toBeGreaterThan(0)
      expect(items.transfer.evidenceIds.length).toBeGreaterThan(0)
      expect(items.transfer.phase).toBe('transfer')
      // Transfer must be a different situation, not the prediction reworded.
      expect(items.transfer.stem).not.toEqual(items.prediction.stem)
    }
  })

  it('declares all six phases for every interactive section', () => {
    for (const sectionId of ecmoInteractiveFoundationSectionIds) {
      expect(Object.keys(ecmoFoundationLessonRuntimes[sectionId].phases).sort()).toEqual(
        ['act', 'explain', 'observe', 'predict', 'recognize', 'transfer'].sort(),
      )
    }
  })
})

describe('foundation reference state', () => {
  it.each(['vv', 'va'] as const)('%s loads its own fault-free running reference', (supportMode) => {
    const state = settled(supportMode)
    expect(state.scenario.scenarioId).toBe(ecmoReferenceProfileForMode(supportMode).id)
    expect(state.scenario.activeFaults).toHaveLength(0)
    expect(state.scenario.criticalErrors).toHaveLength(0)
    expect(state.scenario.clinical).toBeNull()
    expect(state.paused).toBe(false)
    expect(state.circuit.bloodFlow).toBeGreaterThan(0)
    expect(state.supportMode).toBe(supportMode)
  })

  it('never uses a startup scenario as the foundation baseline', () => {
    for (const supportMode of ['vv', 'va'] as const) {
      expect(settled(supportMode).scenario.scenarioId).not.toMatch(/startup/)
    }
  })

  it('stays inside the authored profile bounds after running', () => {
    for (const supportMode of ['vv', 'va'] as const) {
      const { circuit } = settled(supportMode, 12)
      const expected = ecmoReferenceProfileForMode(supportMode).expected
      expect(circuit.bloodFlow).toBeGreaterThanOrEqual(expected.bloodFlow.low)
      expect(circuit.bloodFlow).toBeLessThanOrEqual(expected.bloodFlow.high)
      expect(circuit.deltaP).toBeGreaterThanOrEqual(expected.deltaP.low)
      expect(circuit.deltaP).toBeLessThanOrEqual(expected.deltaP.high)
    }
  })
})

describe('VA foundation teaching panels', () => {
  const authoredIds = new Set(allCriticalCareDerivedValueGuides().map((guide) => guide.id))

  /**
   * Every state a VA lesson can actually put on screen, reached the way the lesson reaches it.
   *
   * Rendering a panel against a hand-built state would review something no learner can get to. This
   * walks the authored variants instead, so a panel that breaks on one of its own previews fails.
   */
  const vaStates = ecmoVaOnlyFoundationSectionIds.flatMap((sectionId) =>
    ecmoFoundationVariants(ecmoFoundationLessonRuntimes[sectionId], 'va').map((variant) => ({
      sectionId,
      variantId: variant.id,
      state: createFoundationVariantState(variant),
    })),
  )

  it('has every VA variant to render', () => {
    expect(vaStates.length).toBeGreaterThanOrEqual(9)
    for (const { state } of vaStates) expect(state.supportMode).toBe('va')
  })

  it.each(vaStates.map((entry) => [`${entry.sectionId}/${entry.variantId}`, entry] as const))(
    '%s renders, carries a text equivalent, and states its model boundary',
    (_label, entry) => {
      const { container } = render(
        <EcmoFoundationTeachingPanel sectionId={entry.sectionId} state={entry.state} />,
      )
      expect(
        container.querySelector(`[data-teaching-panel="${entry.sectionId}"]`),
      ).toBeInTheDocument()
      expect(container.querySelector('[data-text-equivalent]')).toBeInTheDocument()
      expect(container.querySelector('[data-model-boundary]')).toBeInTheDocument()
      assertNoUniversalTargetLanguage(container.textContent ?? '')
      for (const node of container.querySelectorAll('[data-derived-value]')) {
        expect(authoredIds).toContain(node.getAttribute('data-derived-value') ?? '')
      }
      // A model boundary must say it is describing the simulation, not a bedside claim.
      for (const node of container.querySelectorAll('[data-model-boundary]')) {
        expect(node.textContent ?? '').toMatch(/simulation/i)
      }
    },
  )

  it('never renders a VA panel against a VV circuit in any authored path', () => {
    for (const sectionId of ecmoVaOnlyFoundationSectionIds) {
      for (const requested of ['vv', 'va'] as const) {
        for (const variant of ecmoFoundationVariants(
          ecmoFoundationLessonRuntimes[sectionId],
          requested,
        )) {
          expect(createFoundationVariantState(variant).supportMode).toBe('va')
        }
      }
    }
  })

  /**
   * The variant that is deliberately not settled: it sits one modeled second before its authored
   * change, which is the whole reason it holds the lesson clock.
   */
  const UNSETTLED_BY_DESIGN = 'va-gas-source-before-change'

  it.each(
    vaStates
      .filter((entry) => entry.variantId !== UNSETTLED_BY_DESIGN)
      .map((entry) => [`${entry.sectionId}/${entry.variantId}`, entry] as const),
  )('%s opens on a settled state, not mid-equilibration', (_label, entry) => {
    // An earlier package shipped a reference profile that opened while the patient and gas side
    // were still ramping, so a baseline review reported drift that was only the profile settling.
    // The VA side ramps harder: at frame zero the reference has a pulse pressure and a femoral
    // saturation well away from where they end up, and the two arterial sites read the same.
    let later = entry.state
    for (let tick = 0; tick < 10; tick += 1) later = ecmoSimulationReducer(later, { type: 'STEP' })

    expect(later.circuit.bloodFlow).toBeCloseTo(entry.state.circuit.bloodFlow, 2)
    expect(later.patient.rightRadialSpo2).toBeCloseTo(entry.state.patient.rightRadialSpo2, 1)
    expect(later.patient.femoralArterialSpo2).toBeCloseTo(
      entry.state.patient.femoralArterialSpo2,
      1,
    )
    expect(later.patient.pulsePressure).toBeCloseTo(entry.state.patient.pulsePressure, 1)
    expect(later.patient.nativeCardiacOutputLpm).toBeCloseTo(
      entry.state.patient.nativeCardiacOutputLpm,
      2,
    )
    expect(later.circuit.preOxygenatorSaturation).toBeCloseTo(
      entry.state.circuit.preOxygenatorSaturation,
      1,
    )
  })

  it('leaves the held gas preview genuinely short of its authored change', () => {
    const held = vaStates.find((entry) => entry.variantId === UNSETTLED_BY_DESIGN)
    expect(held).toBeDefined()
    // Before: the gas path is intact, which is what makes it worth reading first.
    expect(held!.state.gas.sourceConnected).toBe(true)

    let later = held!.state
    for (let tick = 0; tick < 2; tick += 1) later = ecmoSimulationReducer(later, { type: 'STEP' })
    // It really is one modeled second away, which is why the variant has to hold the clock rather
    // than relying on the learner reading quickly.
    expect(later.gas.sourceConnected).toBe(false)
  })

  it('carries no VV recirculation term into VA teaching', () => {
    // Structural in the model: VA return is not in series with drainage. A VA panel that displayed
    // a nonzero recirculating share would be describing a mechanism this track does not have.
    for (const { state } of vaStates) {
      expect(state.circuit.recirculationFraction).toBe(0)
      expect(state.circuit.recirculationAdjustedCircuitFlowLpm).toBeCloseTo(
        state.circuit.bloodFlow,
        5,
      )
    }
  })
})

describe('foundation teaching panels', () => {
  const authoredIds = new Set(allCriticalCareDerivedValueGuides().map((guide) => guide.id))

  it.each(ecmoSharedFoundationSectionIds)('%s renders for both reference circuits', (sectionId) => {
    for (const supportMode of ['vv', 'va'] as const) {
      const { container, unmount } = render(
        <EcmoFoundationTeachingPanel sectionId={sectionId} state={settled(supportMode)} />,
      )
      expect(container.querySelector(`[data-teaching-panel="${sectionId}"]`)).toBeInTheDocument()
      // Every figure carries a textual equivalent and names what it simplifies.
      expect(container.querySelector('[data-text-equivalent]')).toBeInTheDocument()
      expect(container.querySelector('[data-model-boundary]')).toBeInTheDocument()
      assertNoUniversalTargetLanguage(container.textContent ?? '')
      unmount()
    }
  })

  it.each(ecmoSharedFoundationSectionIds)(
    '%s resolves every rendered derived value to an authored guide',
    (sectionId) => {
      const { container } = render(
        <EcmoFoundationTeachingPanel sectionId={sectionId} state={settled('vv')} />,
      )
      for (const node of container.querySelectorAll('[data-derived-value]')) {
        expect(authoredIds).toContain(node.getAttribute('data-derived-value') ?? '')
      }
    },
  )

  it('why-extracorporeal-support keeps content, flow, and consumption apart', () => {
    const { container } = render(
      <EcmoFoundationTeachingPanel sectionId="why-extracorporeal-support" state={settled('vv')} />,
    )
    const terms = [...container.querySelectorAll('[data-ledger-term]')].map((node) =>
      node.getAttribute('data-ledger-term'),
    )
    expect(terms).toEqual(expect.arrayContaining(['Content', 'Flow', 'Consumption']))
    // The configured model input must be labelled as configured, not as a measurement.
    expect(container.textContent).toMatch(/Configured setting/i)
  })

  it('circuit-flow-path places each pressure at its own location and separates the gas path', () => {
    const { container } = render(
      <EcmoFoundationTeachingPanel sectionId="circuit-flow-path" state={settled('vv')} />,
    )
    const order = [...container.querySelectorAll('[data-circuit-segment]')].map((node) =>
      node.getAttribute('data-circuit-segment'),
    )
    expect(order).toEqual([
      'drainage',
      'pump',
      'pre-membrane',
      'membrane',
      'post-membrane',
      'return',
    ])
    expect(container.querySelector('[data-gas-path]')?.textContent).toMatch(/sweep/i)
    expect(container.querySelector('[data-blood-path]')).toBeInTheDocument()
  })

  it('circuit-flow-path shows the venous-line value the console reads, beside the estimate', () => {
    const state = settled('vv')
    const { container } = render(
      <EcmoFoundationTeachingPanel sectionId="circuit-flow-path" state={state} />,
    )
    expect(container.querySelector('[data-derived-value="ecmo.venousLineSaturation"]')).toBeTruthy()
    expect(
      container.querySelector('[data-derived-value="ecmo.systemicVenousSaturationEstimate"]'),
    ).toBeTruthy()
  })

  it('circuit-flow-path returns to the arterial side under VA', () => {
    const { container } = render(
      <EcmoFoundationTeachingPanel sectionId="circuit-flow-path" state={settled('va')} />,
    )
    expect(container.textContent).toMatch(/Arterial return to the patient/i)
  })

  it('pump-and-pressure-zones compares with the authored reference, not a normal range', () => {
    const { container } = render(
      <EcmoFoundationTeachingPanel sectionId="pump-and-pressure-zones" state={settled('vv')} />,
    )
    expect(container.querySelector('[data-selected-setting]')?.textContent).toMatch(/rpm/i)
    expect(container.querySelector('[data-resulting-flow]')?.textContent).toMatch(/L\/min/i)
    expect(container.textContent).toMatch(/reference state/i)
    expect(container.querySelectorAll('[data-mechanism-preview]')).toHaveLength(3)

    // Any interpreted reference must be this circuit's own baseline, the sources' own reported
    // range, or a declared simulation boundary — never a guideline-style normal.
    const kinds = [...container.querySelectorAll('[data-reference-kind]')].map((node) =>
      node.getAttribute('data-reference-kind'),
    )
    expect(kinds.length).toBeGreaterThan(0)
    for (const kind of kinds) {
      expect(['patient-baseline', 'source-reported-range', 'educational-model-boundary']).toContain(
        kind,
      )
    }
  })

  it('blood-flow-versus-sweep separates the two response paths', () => {
    const { container } = render(
      <EcmoFoundationTeachingPanel sectionId="blood-flow-versus-sweep" state={settled('vv')} />,
    )
    const paths = [...container.querySelectorAll('[data-response-path]')].map((node) =>
      node.getAttribute('data-response-path'),
    )
    expect(paths).toEqual(['Blood path', 'Gas path'])
    expect(container.textContent).toMatch(/principally affects/i)
  })

  it('does not describe the VA adjusted flow as effective systemic flow', () => {
    const { container } = render(
      <EcmoFoundationTeachingPanel sectionId="blood-flow-versus-sweep" state={settled('va')} />,
    )
    // The phrase appears only inside the guide's own prohibition, never as the value's label.
    const readout = container.querySelector(
      '[data-derived-value="ecmo.recirculationAdjustedCircuitFlow"]',
    )
    expect(readout).toBeTruthy()
    expect(readout?.querySelector('h3, h4')?.textContent).not.toMatch(/effective systemic flow/i)
    expect(readout?.querySelector('[data-do-not-infer]')?.textContent).toMatch(
      /do not call the VA value effective systemic flow/i,
    )
  })

  it('carries no held disagreement in any shared foundation section', () => {
    for (const sectionId of ecmoSharedFoundationSectionIds) {
      expect(ecmoFoundationSectionById.get(sectionId)?.heldDisagreementId).toBeUndefined()
    }
  })
})

describe('engine responses the lessons depend on', () => {
  function afterAction(
    supportMode: SupportMode,
    action: Parameters<typeof ecmoSimulationReducer>[1],
    seconds: number,
  ): EcmoSimulationState {
    let state = settled(supportMode, 8)
    state = ecmoSimulationReducer(state, action)
    for (let tick = 0; tick < seconds; tick += 1) {
      state = ecmoSimulationReducer(state, { type: 'STEP' })
    }
    return state
  }

  it('raises circuit flow when the pump speed is raised', () => {
    const baseline = settled('vv', 8)
    const faster = afterAction('vv', { type: 'SET_RPM', rpm: baseline.device.rpmSetpoint + 200 }, 8)
    expect(faster.circuit.bloodFlow).toBeGreaterThan(baseline.circuit.bloodFlow)
  })

  it('lowers the carbon dioxide value when sweep is raised', () => {
    const baseline = settled('vv', 8)
    const sweptUp = afterAction('vv', { type: 'SET_SWEEP', sweep: baseline.gas.sweepLpm + 1 }, 14)
    expect(sweptUp.patient.paCO2).toBeLessThan(baseline.patient.paCO2)
  })

  it('keeps each comparison independent by restoring the reference first', () => {
    // Two comparisons run from the same baseline must not compound.
    const baseline = settled('vv', 8)
    const sweepOnly = afterAction('vv', { type: 'SET_SWEEP', sweep: baseline.gas.sweepLpm + 1 }, 12)
    const rpmOnly = afterAction(
      'vv',
      { type: 'SET_RPM', rpm: baseline.device.rpmSetpoint + 200 },
      12,
    )
    expect(sweepOnly.gas.sweepLpm).toBeGreaterThan(baseline.gas.sweepLpm)
    expect(rpmOnly.gas.sweepLpm).toBe(baseline.gas.sweepLpm)
    expect(rpmOnly.device.rpmSetpoint).toBeGreaterThan(baseline.device.rpmSetpoint)
    expect(sweepOnly.device.rpmSetpoint).toBe(baseline.device.rpmSetpoint)
  })
})
