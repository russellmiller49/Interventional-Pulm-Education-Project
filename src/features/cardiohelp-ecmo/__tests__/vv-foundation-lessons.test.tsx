import { render } from '@testing-library/react'

import { allCriticalCareDerivedValueGuides } from '@/features/critical-care/content/derivedValueGuides'
import { assertTeachingPanelContract } from '@/features/critical-care/test-support/teachingPanelContract'

import { EcmoFoundationTeachingPanel } from '../components/teaching/EcmoFoundationTeachingPanel'
import { VV_BASELINE_DISPLAY_DEADBANDS } from '../components/teaching/VvNormalStatePanel'
import { direction } from '../components/teaching/shared'
import { ecmoDerivedValueGuides } from '../content/ecmoValueGuides'
import { ecmoFoundationLearningItems } from '../content/foundationLearningItems'
import {
  ecmoFoundationLessonRuntime,
  ecmoFoundationVariant,
  ecmoVvOnlyFoundationSectionIds,
  type EcmoVvOnlyFoundationSectionId,
} from '../content/foundationLessonRuntime'
import { ecmoFoundationSectionById } from '../content/foundationLessons'
import { createFoundationVariantState, ecmoFoundationSnapshot } from '../session/foundationSession'
import { createReferenceSimulationState, ecmoSimulationReducer } from '../engine'
import type { EcmoSimulationState } from '../engine/types'

function advance(state: EcmoSimulationState, seconds: number): EcmoSimulationState {
  let current = state
  for (let tick = 0; tick < seconds; tick += 1) {
    current = ecmoSimulationReducer(current, { type: 'STEP' })
  }
  return current
}

function variantState(
  sectionId: EcmoVvOnlyFoundationSectionId,
  variantId: string,
): EcmoSimulationState {
  const runtime = ecmoFoundationLessonRuntime(sectionId)
  const variant = ecmoFoundationVariant(runtime, 'vv', variantId)
  if (!variant) throw new Error(`${sectionId}: no variant ${variantId}`)
  return createFoundationVariantState(variant)
}

const vvReference = advance(createReferenceSimulationState('vv-reference'), 12)

/** Phrasings that would turn a contextual value into a clinical band. */
const clinicalBandPatterns: readonly RegExp[] = [
  /normal range/i,
  /\bnormal values?\b/i,
  /\bwithin range\b/i,
  /\bout of range\b/i,
  /\bgreen\b/i,
  /\byellow\b/i,
  /\bred (zone|band)\b/i,
  /\bsafe because\b/i,
  /\bacceptable range\b/i,
]

function assertNoClinicalBandLanguage(text: string): void {
  for (const pattern of clinicalBandPatterns) {
    expect(text).not.toMatch(pattern)
  }
}

describe('vv-series-physiology panel', () => {
  const state = variantState('vv-series-physiology', 'recirculation-preview')

  it('traces the series circuit from systemic venous return to the systemic circulation', () => {
    const { container } = render(
      <EcmoFoundationTeachingPanel sectionId="vv-series-physiology" state={vvReference} />,
    )
    const stages = [...container.querySelectorAll('[data-series-stage]')].map((node) =>
      node.getAttribute('data-series-stage'),
    )
    expect(stages).toEqual([
      'systemic-venous-return',
      'drainage',
      'oxygenator',
      'venous-return-to-patient',
      'right-heart',
      'native-lung',
      'left-heart-systemic',
    ])
  })

  it('shows each quantity separately rather than collapsing them', () => {
    const { container } = render(
      <EcmoFoundationTeachingPanel sectionId="vv-series-physiology" state={state} />,
    )
    const signals = [...container.querySelectorAll('[data-series-signal]')].map((node) =>
      node.getAttribute('data-series-signal'),
    )
    expect(signals.sort()).toEqual(
      [
        'adjusted-circuit-flow',
        'displayed-circuit-flow',
        'native-cardiac-output',
        'patient-spo2',
        'post-oxygenator-saturation',
        'recirculation-fraction',
        'systemic-venous-estimate',
        'venous-line-saturation',
      ].sort(),
    )
  })

  it('renders the live engine values for the displayed and adjusted flows', () => {
    const { container } = render(
      <EcmoFoundationTeachingPanel sectionId="vv-series-physiology" state={state} />,
    )
    expect(
      container.querySelector('[data-series-signal="displayed-circuit-flow"]')?.textContent,
    ).toContain(state.circuit.bloodFlow.toFixed(2))
    expect(
      container.querySelector('[data-series-signal="adjusted-circuit-flow"]')?.textContent,
    ).toContain(state.circuit.recirculationAdjustedCircuitFlowLpm.toFixed(2))
    // The whole lesson depends on these two being different in an established re-drainage state.
    expect(state.circuit.recirculationAdjustedCircuitFlowLpm).toBeLessThan(
      state.circuit.bloodFlow - 1,
    )
  })

  it('states that native cardiac output is the systemic pump in VV', () => {
    const { container } = render(
      <EcmoFoundationTeachingPanel sectionId="vv-series-physiology" state={state} />,
    )
    expect(container.querySelector('[data-systemic-pump-claim]')?.textContent).toMatch(
      /native cardiac output is the systemic pump/i,
    )
  })

  it('refuses to let the adjusted flow read as a second systemic cardiac output', () => {
    const { container } = render(
      <EcmoFoundationTeachingPanel sectionId="vv-series-physiology" state={state} />,
    )
    expect(
      container.querySelector('[data-series-signal="adjusted-circuit-flow"]')?.textContent,
    ).toMatch(/not a second systemic cardiac output/i)
    expect(
      container
        .querySelector('[data-derived-value="ecmo.recirculationAdjustedCircuitFlow"]')
        ?.querySelector('[data-do-not-infer]')?.textContent,
    ).toMatch(/do not call the VA value effective systemic flow/i)
  })

  it('names the venous-line value as the device measurement and the systemic value as an estimate', () => {
    const { container } = render(
      <EcmoFoundationTeachingPanel sectionId="vv-series-physiology" state={state} />,
    )
    expect(
      container.querySelector('[data-series-signal="venous-line-saturation"]')?.textContent,
    ).toMatch(/device-displayed/i)
    expect(
      container.querySelector('[data-series-signal="venous-line-saturation"]')?.textContent,
    ).toMatch(/measuring cell/i)
    const estimate = container.querySelector('[data-series-signal="systemic-venous-estimate"]')
    expect(estimate?.textContent).toMatch(/model estimate/i)
    expect(estimate?.textContent).toMatch(/no sensor on the circuit reads it/i)
    expect(estimate?.textContent).toMatch(/never displays it/i)
  })

  it('reproduces the engine recirculation fraction from raw values, within rounding tolerance', () => {
    const { container } = render(
      <EcmoFoundationTeachingPanel sectionId="vv-series-physiology" state={state} />,
    )
    const shown = container.querySelector('[data-implied-fraction]')?.textContent ?? ''
    expect(shown).not.toBe('not separable here')
    expect(Number(shown)).toBeCloseTo(state.circuit.recirculationFraction, 2)
  })

  it('puts the loaded state beside the reference circuit for the observe comparison', () => {
    const { container } = render(
      <EcmoFoundationTeachingPanel sectionId="vv-series-physiology" state={state} />,
    )
    const rows = [...container.querySelectorAll('[data-comparison-row]')].map((node) =>
      node.getAttribute('data-comparison-row'),
    )
    expect(rows).toEqual([
      'displayed-circuit-flow',
      'adjusted-circuit-flow',
      'venous-line-saturation',
      'systemic-venous-estimate',
      'patient-spo2',
    ])

    // The comparison must show the divergence the lesson exists for: in the preview the displayed
    // flow is higher than the reference while the adjusted flow is lower.
    const flowRow = container.querySelector('[data-comparison-row="displayed-circuit-flow"]')
    const adjustedRow = container.querySelector('[data-comparison-row="adjusted-circuit-flow"]')
    expect(flowRow?.querySelector('[data-comparison-direction]')).toHaveAttribute(
      'data-comparison-direction',
      'higher',
    )
    expect(adjustedRow?.querySelector('[data-comparison-direction]')).toHaveAttribute(
      'data-comparison-direction',
      'lower',
    )

    // Venous-line saturation rises while the systemic estimate falls: the central clue.
    expect(
      container
        .querySelector('[data-comparison-row="venous-line-saturation"] [data-comparison-direction]')
        ?.getAttribute('data-comparison-direction'),
    ).toBe('higher')
    expect(
      container
        .querySelector(
          '[data-comparison-row="systemic-venous-estimate"] [data-comparison-direction]',
        )
        ?.getAttribute('data-comparison-direction'),
    ).toBe('lower')

    // Every reference value is the engine's, not a number copied into content.
    expect(
      container.querySelector(
        '[data-comparison-row="displayed-circuit-flow"] [data-reference-value]',
      )?.textContent,
    ).toContain(vvReference.circuit.bloodFlow.toFixed(2))
  })

  it('labels the mixture relationship as this simulation’s, not a bedside method', () => {
    const { container } = render(
      <EcmoFoundationTeachingPanel sectionId="vv-series-physiology" state={state} />,
    )
    expect(container.querySelector('[data-mixture-formula]')?.textContent).toContain(
      'pre-oxygenator = systemic + fraction × (post-oxygenator − systemic)',
    )
    const boundaries = [...container.querySelectorAll('[data-model-boundary]')]
      .map((node) => node.textContent ?? '')
      .join(' ')
    expect(boundaries).toMatch(/not a validated bedside method/i)
    expect(boundaries).toMatch(/model estimate rather than anything the CARDIOHELP measures/i)
  })

  it('states the limitation rather than implying pump speed changes the modeled fraction', () => {
    const { container } = render(
      <EcmoFoundationTeachingPanel sectionId="vv-series-physiology" state={state} />,
    )
    const text = container.textContent ?? ''
    expect(text).toMatch(/authored by the case/i)
    expect(text).toMatch(/[Rr]aising the pump speed here does not move it/)
    expect(text).not.toMatch(
      /raising (the )?(pump )?speed (increases|raises|worsens) (the )?recirculation fraction/i,
    )
  })

  it('carries no recirculation band, and only the guides this lesson is allowed', () => {
    const { container } = render(
      <EcmoFoundationTeachingPanel sectionId="vv-series-physiology" state={state} />,
    )
    const rendered = [...container.querySelectorAll('[data-derived-value]')].map((node) =>
      node.getAttribute('data-derived-value'),
    )
    expect(rendered.sort()).toEqual([
      'ecmo.recirculationAdjustedCircuitFlow',
      'ecmo.recirculationFraction',
      'ecmo.systemicVenousSaturationEstimate',
      'ecmo.venousLineSaturation',
    ])
    expect(ecmoDerivedValueGuides.recirculationFraction.rules).toBeUndefined()
    assertNoClinicalBandLanguage(container.textContent ?? '')
  })
})

describe('vv-normal-state panel', () => {
  const opening = createReferenceSimulationState('vv-reference')
  const later = advance(opening, 20)
  const snapshot = ecmoFoundationSnapshot(opening)

  it('organises the review into drainage, membrane, gas side, and patient', () => {
    const { container } = render(
      <EcmoFoundationTeachingPanel sectionId="vv-normal-state" state={later} />,
    )
    const groups = [...container.querySelectorAll('[data-baseline-group]')].map((node) =>
      node.getAttribute('data-baseline-group'),
    )
    expect(groups).toEqual(['drainage-and-load', 'membrane-and-return', 'gas-side', 'patient'])
  })

  it('shows every signal the section asks for', () => {
    const { container } = render(
      <EcmoFoundationTeachingPanel sectionId="vv-normal-state" state={later} />,
    )
    const rows = [...container.querySelectorAll('[data-baseline-row]')].map((node) =>
      node.getAttribute('data-baseline-row'),
    )
    expect(rows.sort()).toEqual(
      [
        'bloodFlow',
        'deltaP',
        'nativeCardiacOutputLpm',
        'pArt',
        'pH',
        'pInt',
        'pVen',
        'paCO2',
        'recirculationAdjustedCircuitFlowLpm',
        'rpmSetpoint',
        'spo2',
        'sweepLpm',
        'venousLineSaturation',
      ].sort(),
    )
  })

  it('shows the current value, this circuit’s reference value, and the raw change', () => {
    const { container } = render(
      <EcmoFoundationTeachingPanel sectionId="vv-normal-state" state={later} snapshot={snapshot} />,
    )
    const flowRow = container.querySelector('[data-baseline-row="bloodFlow"]')
    expect(flowRow?.querySelector('[data-current-value]')?.textContent).toContain(
      later.circuit.bloodFlow.toFixed(2),
    )
    expect(flowRow?.querySelector('[data-reference-value]')?.textContent).toContain(
      vvReference.circuit.bloodFlow.toFixed(2),
    )
    // The raw change is always printed, whatever the word beside it says.
    expect(flowRow?.querySelector('[data-change]')?.textContent).toMatch(/[+−]?\d/)
  })

  it('never prints a reference value the model does not produce', () => {
    const { container } = render(
      <EcmoFoundationTeachingPanel sectionId="vv-normal-state" state={later} />,
    )
    // Only the pump speed, the sweep and the native cardiac output are authored inputs; every other
    // reference value has to be read off the model rather than off a bound-check window.
    const authoredRows = [...container.querySelectorAll('[data-reference-provenance]')]
      .filter((node) => node.getAttribute('data-reference-provenance') === 'authored-input')
      .map((node) => node.closest('[data-baseline-row]')?.getAttribute('data-baseline-row'))
    expect(authoredRows.sort()).toEqual(
      ['nativeCardiacOutputLpm', 'rpmSetpoint', 'sweepLpm'].sort(),
    )

    for (const [rowId, produced] of [
      ['pInt', vvReference.circuit.readouts.pInt.displayed],
      ['pArt', vvReference.circuit.readouts.pArt.displayed],
      ['deltaP', vvReference.circuit.readouts.deltaP.displayed],
      ['spo2', vvReference.patient.spo2],
      [
        'recirculationAdjustedCircuitFlowLpm',
        vvReference.circuit.recirculationAdjustedCircuitFlowLpm,
      ],
    ] as const) {
      const cell = container.querySelector(`[data-baseline-row="${rowId}"] [data-reference-value]`)
      expect(cell).toHaveAttribute('data-reference-provenance', 'model-derived')
      expect(cell?.textContent).toContain(
        typeof produced === 'number'
          ? produced.toFixed(
              rowId === 'recirculationAdjustedCircuitFlowLpm' ? 2 : rowId === 'spo2' ? 1 : 0,
            )
          : '--',
      )
    }
  })

  it('authors the display deadbands in a guide with its own provenance', () => {
    const { container } = render(
      <EcmoFoundationTeachingPanel sectionId="vv-normal-state" state={later} snapshot={snapshot} />,
    )
    const readout = container.querySelector(
      '[data-derived-value="ecmo.baselineChangeFromEarlierValue"]',
    )
    expect(readout).toBeTruthy()
    const kinds = [...(readout?.querySelectorAll('[data-reference-kind]') ?? [])].map((node) =>
      node.getAttribute('data-reference-kind'),
    )
    expect(kinds).toEqual(['patient-baseline', 'educational-model-boundary'])
    // The guide states the very numbers the panel classifies with, so the two cannot drift.
    const statement = readout?.textContent ?? ''
    for (const [key, deadband] of Object.entries(VV_BASELINE_DISPLAY_DEADBANDS)) {
      expect(statement).toContain(String(deadband))
      expect(key).toBeTruthy()
    }
    expect(statement).toMatch(/exactly equal to a deadband reads as unchanged/i)
    expect(statement).toMatch(/not a clinical tolerance/i)
  })

  it('uses the required baseline wording', () => {
    const { container } = render(
      <EcmoFoundationTeachingPanel sectionId="vv-normal-state" state={later} snapshot={snapshot} />,
    )
    const text = container.textContent ?? ''
    expect(text).toMatch(/this modeled circuit/i)
    expect(text).toMatch(/unchanged from the earlier value/i)
    expect(text).toMatch(/drift from this patient–circuit baseline/i)
  })

  it('treats the display deadband inclusively at its own boundary', () => {
    for (const deadband of Object.values(VV_BASELINE_DISPLAY_DEADBANDS)) {
      expect(direction(deadband, deadband)).toBe('flat')
      expect(direction(-deadband, deadband)).toBe('flat')
      expect(direction(deadband + 0.001, deadband)).toBe('up')
      expect(direction(-deadband - 0.001, deadband)).toBe('down')
    }
  })

  it('labels the deadbands as a simulation display aid, not a clinical tolerance', () => {
    const { container } = render(
      <EcmoFoundationTeachingPanel sectionId="vv-normal-state" state={later} />,
    )
    const boundaries = [...container.querySelectorAll('[data-model-boundary]')]
      .map((node) => node.textContent ?? '')
      .join(' ')
    expect(boundaries).toMatch(/display aid only/i)
    expect(boundaries).toMatch(/not clinical tolerances/i)
    expect(boundaries).toMatch(/mark no boundary of safety/i)
  })

  it('compares against a captured snapshot when the learner has taken one', () => {
    const { container } = render(
      <EcmoFoundationTeachingPanel sectionId="vv-normal-state" state={later} snapshot={snapshot} />,
    )
    expect(container.textContent).toMatch(/the snapshot captured in this session/i)
  })

  it('falls back to the retained samples when no snapshot has been taken', () => {
    const { container } = render(
      <EcmoFoundationTeachingPanel sectionId="vv-normal-state" state={later} />,
    )
    expect(container.textContent).toMatch(/this circuit’s starting state/i)
    expect(container.querySelectorAll('[data-trend-sample]').length).toBeGreaterThan(0)
  })

  it('names what belongs to the state beyond the circuit display', () => {
    const { container } = render(
      <EcmoFoundationTeachingPanel sectionId="vv-normal-state" state={later} />,
    )
    const context = container.querySelector('[data-patient-context]')?.textContent ?? ''
    expect(context).toMatch(/native lungs/i)
    expect(context).toMatch(/native cardiac output remains essential/i)
    expect(context).toMatch(/ventilator/i)
    expect(context).toMatch(/sedation/i)
    expect(context).toMatch(/temperature/i)
    expect(context).toMatch(/hemoglobin/i)
    expect(context).toMatch(/volume state/i)
  })

  it('renders no clinical band and no anti-Xa disagreement', () => {
    const { container } = render(
      <EcmoFoundationTeachingPanel sectionId="vv-normal-state" state={later} />,
    )
    assertNoClinicalBandLanguage(container.textContent ?? '')
    expect(container.textContent).not.toMatch(/anti-xa/i)
    expect(container.querySelector('[data-held-disagreement]')).toBeNull()
    expect(ecmoFoundationSectionById.get('vv-normal-state')?.heldDisagreementId).toBeUndefined()
  })
})

describe('vv-integration-capstone panel', () => {
  const beforeChange = variantState('vv-integration-capstone', 'gas-source-before-change')
  const afterChange = variantState('vv-integration-capstone', 'gas-source-after-change')
  const resistance = variantState('vv-integration-capstone', 'oxygenator-resistance-preview')

  const matrixRowIds = [
    'displayed-circuit-flow',
    'pVen',
    'pInt-and-pArt',
    'deltaP-trend',
    'venous-line-svo2',
    'systemic-venous-estimate',
    'post-oxygenator-saturation',
    'paco2-and-ph',
    'patient-spo2',
    'gas-source-status',
    'bedside-and-ventilator-findings',
  ]
  const hypothesisIds = [
    'recirculation',
    'membrane-dysfunction',
    'gas-side-interruption',
    'patient-side-change',
  ]

  it('carries every authored row against every authored explanation', () => {
    const { container } = render(
      <EcmoFoundationTeachingPanel sectionId="vv-integration-capstone" state={afterChange} />,
    )
    const rows = [...container.querySelectorAll('[data-matrix-row]')].map((node) =>
      node.getAttribute('data-matrix-row'),
    )
    expect(rows).toEqual(matrixRowIds)
    const columns = [...container.querySelectorAll('[data-hypothesis-column]')].map((node) =>
      node.getAttribute('data-hypothesis-column'),
    )
    expect(columns).toEqual(hypothesisIds)
    for (const rowId of matrixRowIds) {
      for (const hypothesisId of hypothesisIds) {
        const cell = container.querySelector(`[data-matrix-cell="${rowId}:${hypothesisId}"]`)
        expect(cell?.textContent?.trim()).toBeTruthy()
      }
    }
    expect(container.querySelectorAll('[data-matrix-cell]')).toHaveLength(
      matrixRowIds.length * hypothesisIds.length,
    )
  })

  it('puts the live findings for the loaded case beside the matrix', () => {
    const { container } = render(
      <EcmoFoundationTeachingPanel sectionId="vv-integration-capstone" state={afterChange} />,
    )
    for (const rowId of matrixRowIds) {
      expect(container.querySelector(`[data-live-finding="${rowId}"]`)?.textContent).toBeTruthy()
    }
    expect(
      container.querySelector('[data-live-finding="displayed-circuit-flow"]')?.textContent,
    ).toContain(afterChange.circuit.bloodFlow.toFixed(2))
    expect(container.querySelector('[data-live-finding="gas-source-status"]')?.textContent).toMatch(
      /interrupted/i,
    )
  })

  it('keeps the reason-specific text when a channel reports no number', () => {
    const held = ecmoSimulationReducer(beforeChange, { type: 'PRESS_SAFETY' })
    const stopped = ecmoSimulationReducer(held, { type: 'TOGGLE_ZERO_FLOW' })
    const settled = advance(stopped, 3)
    expect(settled.circuit.readouts.pVen.status).toBe('simulation-unmodeled')

    const { container } = render(
      <EcmoFoundationTeachingPanel sectionId="vv-integration-capstone" state={settled} />,
    )
    const cell = container.querySelector('[data-live-finding="pVen"]')
    expect(cell?.textContent).toContain('--')
    expect(cell?.textContent).toContain(settled.circuit.readouts.pVen.reason)
    expect(cell?.textContent).toMatch(/limitation of this educational simulation/i)
  })

  it('gives every explanation a complete text equivalent', () => {
    const { container } = render(
      <EcmoFoundationTeachingPanel sectionId="vv-integration-capstone" state={afterChange} />,
    )
    const equivalents = [...container.querySelectorAll('[data-text-equivalent]')].map(
      (node) => node.textContent ?? '',
    )
    for (const hypothesisLabel of [
      'Recirculation has risen',
      'The membrane is failing',
      'The gas side is interrupted',
      'The patient has changed',
    ]) {
      const equivalent = equivalents.find((text) => text.startsWith(hypothesisLabel))
      expect(equivalent).toBeDefined()
      for (const rowLabel of [
        'Displayed circuit flow',
        'pVen (drainage)',
        'pInt and pArt',
        'ΔP across the membrane, over time',
        'Venous-line SvO₂ (device-displayed)',
        'Systemic venous saturation (model estimate)',
        'Post-oxygenator saturation',
        'PaCO₂ and pH',
        'Patient SpO₂',
        'Gas-source connection and sweep setting',
        'Bedside and ventilator findings',
      ]) {
        expect(equivalent).toContain(rowLabel)
      }
    }
  })

  it('never labels an explanation excluded on one absent value', () => {
    const { container } = render(
      <EcmoFoundationTeachingPanel sectionId="vv-integration-capstone" state={afterChange} />,
    )
    // No cell may declare its explanation off the list; the caution is stated once, up front.
    for (const cell of container.querySelectorAll('[data-matrix-cell]')) {
      const text = cell.textContent ?? ''
      expect(text).not.toMatch(/\bexcluded\b/i)
      expect(text).not.toMatch(/\bruled out\b/i)
      expect(text).not.toMatch(/\bcannot be\b[^.]{0,20}\bthe cause\b/i)
    }
    expect(container.textContent).toMatch(/is not excluded because one modeled value is absent/i)
  })

  it('renders the patient-side explanation as a source-backed hypothesis card', () => {
    const { container } = render(
      <EcmoFoundationTeachingPanel sectionId="vv-integration-capstone" state={afterChange} />,
    )
    const card = container.querySelector('[data-patient-side-hypothesis]')
    expect(card?.textContent).toMatch(/native lung injury can progress/i)
    expect(card?.textContent).toMatch(/ventilator mechanics/i)
    expect(card?.textContent).toMatch(/not a diagnosis of exclusion/i)
  })

  it('logs the two model limitations this section runs into', () => {
    const { container } = render(
      <EcmoFoundationTeachingPanel sectionId="vv-integration-capstone" state={afterChange} />,
    )
    const limitations = [...container.querySelectorAll('[data-model-limitation]')].map((node) =>
      node.getAttribute('data-model-limitation'),
    )
    expect(limitations.sort()).toEqual([
      'membrane-preset-also-constrains-flow',
      'no-isolated-patient-side-preset',
    ])
    expect(
      container.querySelector('[data-model-limitation="no-isolated-patient-side-preset"]')
        ?.textContent,
    ).toMatch(/no state in this simulation isolates a patient-side deterioration/i)
  })

  it('does not claim the membrane preview leaves the displayed flow unchanged', () => {
    // The engine is the arbiter here: this preset constrains flow as well as raising the gradient.
    expect(resistance.circuit.bloodFlow).toBeLessThan(vvReference.circuit.bloodFlow - 0.5)
    expect(resistance.circuit.readouts.deltaP.displayed).toBeGreaterThan(100)

    const variant = ecmoFoundationVariant(
      ecmoFoundationLessonRuntime('vv-integration-capstone'),
      'vv',
      'oxygenator-resistance-preview',
    )!
    expect(variant.modelBoundary).toMatch(/displayed flow does fall here/i)

    const { container } = render(
      <EcmoFoundationTeachingPanel sectionId="vv-integration-capstone" state={resistance} />,
    )
    expect(
      container.querySelector('[data-matrix-cell="displayed-circuit-flow:membrane-dysfunction"]')
        ?.textContent,
    ).toMatch(/falls in this simulation/i)
  })

  it('holds the gas-source case to the pattern the section is built on', () => {
    expect(afterChange.circuit.bloodFlow).toBeCloseTo(beforeChange.circuit.bloodFlow, 2)
    expect(afterChange.circuit.readouts.pInt.displayed).toBe(
      beforeChange.circuit.readouts.pInt.displayed,
    )
    expect(afterChange.circuit.postOxygenatorSaturation).toBeLessThan(
      beforeChange.circuit.postOxygenatorSaturation - 10,
    )
    expect(afterChange.patient.paCO2).toBeGreaterThan(beforeChange.patient.paCO2 + 10)
    expect(afterChange.patient.pH).toBeLessThan(beforeChange.patient.pH)
  })
})

describe('the three VV lessons as a set', () => {
  const authoredGuideIds = new Set(allCriticalCareDerivedValueGuides().map((guide) => guide.id))

  const states: Readonly<Record<EcmoVvOnlyFoundationSectionId, EcmoSimulationState>> = {
    'vv-series-physiology': variantState('vv-series-physiology', 'recirculation-preview'),
    'vv-normal-state': advance(createReferenceSimulationState('vv-reference'), 20),
    'vv-integration-capstone': variantState('vv-integration-capstone', 'gas-source-after-change'),
  }

  it.each(ecmoVvOnlyFoundationSectionIds)(
    '%s satisfies the teaching-panel contract',
    (sectionId) => {
      const { container } = render(
        <EcmoFoundationTeachingPanel sectionId={sectionId} state={states[sectionId]} />,
      )
      assertTeachingPanelContract(
        container,
        sectionId === 'vv-integration-capstone' ? 'integration' : 'foundation',
      )
      expect(container.querySelector(`[data-teaching-panel="${sectionId}"]`)).toBeInTheDocument()
      expect(container.querySelector('[data-text-equivalent]')).toBeInTheDocument()
      expect(container.querySelector('[data-model-boundary]')).toBeInTheDocument()
    },
  )

  it.each(ecmoVvOnlyFoundationSectionIds)(
    '%s resolves every rendered derived value to an authored guide',
    (sectionId) => {
      const { container } = render(
        <EcmoFoundationTeachingPanel sectionId={sectionId} state={states[sectionId]} />,
      )
      for (const node of container.querySelectorAll('[data-derived-value]')) {
        expect(authoredGuideIds).toContain(node.getAttribute('data-derived-value') ?? '')
      }
    },
  )

  it.each(ecmoVvOnlyFoundationSectionIds)('%s preserves the full source prose', (sectionId) => {
    const section = ecmoFoundationSectionById.get(sectionId)!
    expect(section.paragraphs.length).toBeGreaterThan(0)
    expect(section.bullets?.length).toBeGreaterThan(0)
    expect(section.sourceIds.length).toBeGreaterThan(0)
    // The activity renders the whole record; nothing is shortened into a different claim.
    for (const paragraph of section.paragraphs) expect(paragraph.trim()).toBe(paragraph)
  })

  it.each(ecmoVvOnlyFoundationSectionIds)(
    '%s keeps a materially different transfer item with a mechanism-level explanation',
    (sectionId) => {
      const items = ecmoFoundationLearningItems[sectionId]
      expect(items.transfer.transferVariantId).toBeTruthy()
      expect(items.transfer.itemType).toBe('transfer-case')
      expect(items.transfer.stem).not.toEqual(items.prediction.stem)
      for (const item of [items.prediction, items.transfer]) {
        expect(item.explanation.length).toBeGreaterThan(120)
        expect(item.correctChoiceIds).toHaveLength(1)
        expect(item.contextRequirement).toBe('context-independent')
        expect(item.learnerCopyOverrideReason).toBeUndefined()
        for (const choice of item.choices) {
          expect(choice.id.trim()).toBeTruthy()
          expect(choice.label.trim()).toBeTruthy()
          expect(choice.rationale.trim()).toBeTruthy()
          expect(['best', 'reasonable-but-incomplete', 'unsafe', 'incorrect-mechanism']).toContain(
            choice.plausibility,
          )
        }
        expect(item.choices.filter((choice) => choice.plausibility === 'best')).toHaveLength(1)
      }
    },
  )

  it('offers all four explanations in the capstone prediction', () => {
    const choiceIds = ecmoFoundationLearningItems['vv-integration-capstone'].prediction.choices.map(
      (choice) => choice.id,
    )
    expect(choiceIds).toEqual([
      'gas-side-interrupted',
      'recirculation-risen',
      'membrane-failing',
      'patient-side-change',
    ])
  })

  it('makes no readiness or competency claim anywhere in the VV items', () => {
    for (const sectionId of ecmoVvOnlyFoundationSectionIds) {
      const items = ecmoFoundationLearningItems[sectionId]
      const text = [items.prediction, items.transfer]
        .flatMap((item) => [
          item.stem,
          item.explanation,
          ...item.choices.flatMap((choice) => [choice.label, choice.rationale]),
        ])
        .join(' ')
      expect(text).not.toMatch(/competen|certif|ready to (practice|manage)|mastery/i)
      assertNoClinicalBandLanguage(text)
    }
  })
})
