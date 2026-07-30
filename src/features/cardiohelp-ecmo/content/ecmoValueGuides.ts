import {
  registerCriticalCareDerivedValueGuides,
  type CriticalCareDerivedValueGuide,
} from '@/features/critical-care/content/derivedValueGuides'

/**
 * The minimum set of ECMO value guides the four shared foundation panels need.
 *
 * Deliberately small. A comprehensive ECMO threshold library is not part of this package, and
 * several of these quantities have no defensible universal cut point at all — the guide exists to
 * say *what kind of number this is*, not to draw a band around it.
 */

const deltaPTrend: CriticalCareDerivedValueGuide = {
  id: 'ecmo.transmembraneDeltaP',
  label: 'ΔP across the membrane',
  unit: 'mmHg',
  formula: 'pInt − pArt',
  liveValueType: 'derived',
  interpretation:
    'The gradient is a resistance multiplied by a flow, so it moves with blood flow even when the membrane has not changed. Read it against this circuit’s own earlier value at a similar flow rather than against a fixed number.',
  references: [
    {
      id: 'ecmo.deltaP.own-baseline',
      kind: 'patient-baseline',
      statement:
        'A change from this circuit’s own earlier gradient, compared at a similar blood flow, is the interpretable quantity.',
      appliesWhen:
        'Any single circuit followed over time. Comparing two different circuits, oxygenators, or flows compares different things.',
      evidenceIds: ['elso-circuit-2022', 'bounded-educational-model'],
      caveat: 'A gradient read without its flow is not interpretable.',
    },
    {
      id: 'ecmo.deltaP.no-standard-cutoff',
      kind: 'source-reported-range',
      statement:
        'The supplied sources describe trending the gradient rather than applying one standardized cutoff across oxygenators and flows.',
      appliesWhen:
        'Adult circuits in the supplied guideline and textbook set. No universal threshold is asserted here.',
      evidenceIds: ['elso-circuit-2022'],
    },
  ],
  caveats:
    'Blood flow, viscosity, hematocrit, temperature, and the specific oxygenator all move this number without any change in membrane health.',
  doNotInfer:
    'Do not read a single gradient as a membrane verdict, and do not carry a number from one circuit to another.',
  conceptIds: ['cc.membrane.resistance-and-aging', 'cc.circuit.pressure-zones'],
  reviewStatus: 'draft',
}

const venousLineSaturation: CriticalCareDerivedValueGuide = {
  id: 'ecmo.venousLineSaturation',
  label: 'SvO₂ (venous line)',
  unit: '%',
  liveValueType: 'device-displayed',
  interpretation:
    'The console reports oxygen saturation in the disposable’s measuring cell, on the venous inlet of the oxygenator pump unit. It is drainage blood, which in VV is systemic venous return mixed with whatever fraction of freshly oxygenated blood is drawn straight back in.',
  references: [
    {
      id: 'ecmo.svo2.measuring-cell-location',
      kind: 'device-specification',
      statement:
        'The venous probe measures the venous blood parameters in the measuring cell, which is integrated in the oxygenator pump unit.',
      appliesWhen:
        'CARDIOHELP-i with the HLS Set Advanced disposable, US Instructions for Use Revision 2.3 (January 2025), software 03.04.10.00 or higher.',
      evidenceIds: ['ifu-us-2025-scope', 'ifu-console-workflow'],
    },
    {
      id: 'ecmo.svo2.display-range',
      kind: 'device-specification',
      statement:
        'The console displays this parameter across 40.0–99.9%; a value outside that range shows the unavailable indication instead of a number.',
      appliesWhen: 'The same device revision and software release.',
      evidenceIds: ['ifu-us-2025-scope'],
    },
  ],
  caveats:
    'Recirculation raises this number while the patient does worse, so a rising drainage saturation is a sign to investigate rather than reassurance.',
  doNotInfer:
    'Do not read this as the patient’s systemic mixed-venous saturation. Under VV recirculation the two move in opposite directions.',
  conceptIds: ['cc.circuit.recirculation', 'cc.measurement.measurand'],
  reviewStatus: 'draft',
}

const systemicVenousEstimate: CriticalCareDerivedValueGuide = {
  id: 'ecmo.systemicVenousSaturationEstimate',
  label: 'Systemic venous saturation (estimated)',
  unit: '%',
  liveValueType: 'estimated',
  interpretation:
    'A whole-body value this simulation infers from its own oxygen balance. No sensor on the circuit reads it, and the console never displays it.',
  references: [
    {
      id: 'ecmo.systemic-venous.model-estimate',
      kind: 'educational-model-boundary',
      statement:
        'This simulation estimates systemic venous saturation from arterial saturation, hemoglobin, systemic flow, and an authored oxygen consumption.',
      appliesWhen:
        'Inside this simulation only. It exists so the drainage-versus-systemic distinction can be shown at all, and carries no clinical authority.',
      evidenceIds: ['bounded-educational-model'],
    },
  ],
  caveats:
    'Every input to the estimate is itself modeled. It is shown beside the device value to make a distinction visible, not to be acted on.',
  doNotInfer:
    'Do not treat this as a measurement, and do not compare it with a real patient’s mixed-venous sample.',
  conceptIds: ['cc.measurement.measured-estimated-inferred', 'cc.circuit.recirculation'],
  reviewStatus: 'draft',
}

const oxygenConsumption: CriticalCareDerivedValueGuide = {
  id: 'ecmo.oxygenConsumption',
  label: 'Oxygen consumption (model input)',
  unit: 'mL/min',
  liveValueType: 'configured',
  interpretation:
    'A setting this simulation is given so its oxygen balance closes. It is authored per reference profile, not observed.',
  references: [
    {
      id: 'ecmo.vo2.authored-input',
      kind: 'educational-model-boundary',
      statement:
        'The reference circuits author 150 mL/min so the module’s own baseline is internally consistent.',
      appliesWhen:
        'Inside this simulation only. It makes no claim about any patient’s metabolic rate.',
      evidenceIds: ['bounded-educational-model'],
    },
  ],
  caveats:
    'A real patient’s consumption varies with temperature, sedation, paralysis, agitation, and illness, none of which this model varies.',
  doNotInfer: 'Do not read this as a measured VO₂ or as a typical value to expect at the bedside.',
  conceptIds: ['cc.perfusion.oxygen-delivery-extraction'],
  reviewStatus: 'draft',
}

const recirculationAdjustedFlow: CriticalCareDerivedValueGuide = {
  id: 'ecmo.recirculationAdjustedCircuitFlow',
  label: 'Recirculation-adjusted circuit flow',
  unit: 'L/min',
  formula: 'circuit blood flow × (1 − recirculation fraction)',
  liveValueType: 'derived',
  interpretation:
    'Circuit flow with the immediately re-drained fraction removed. In VV it is the part of the pump’s output that does useful work; in VA the recirculation term is zero, so it simply equals displayed circuit flow.',
  references: [
    {
      id: 'ecmo.adjusted-flow.model-quantity',
      kind: 'educational-model-boundary',
      statement:
        'This simulation derives the adjusted flow from an authored recirculation fraction rather than from a measurement.',
      appliesWhen:
        'Inside this simulation only. It is not a quantity the console computes or displays.',
      evidenceIds: ['bounded-educational-model'],
    },
  ],
  caveats:
    'In VA this value says nothing about total systemic perfusion, which native cardiac output also contributes to.',
  doNotInfer:
    'Do not call the VA value effective systemic flow, and do not add it to native cardiac output to produce one.',
  conceptIds: ['cc.device.native-device-effective-flow', 'cc.circuit.recirculation'],
  reviewStatus: 'draft',
}

/**
 * Deliberately carries no band. The supplied sources do not give a universal "normal recirculation"
 * range, and this simulation does not derive the fraction from anything the learner can change — so
 * the guide's whole job is to say what kind of number it is and what it cannot be read as.
 */
const recirculationFraction: CriticalCareDerivedValueGuide = {
  id: 'ecmo.recirculationFraction',
  label: 'Recirculation fraction',
  formula: 'fraction of drained blood that is freshly returned circuit blood',
  liveValueType: 'configured',
  interpretation:
    'The share of what the circuit drains that is blood it returned a moment ago rather than systemic venous return. At the bedside it is a consequence of where the cannulae sit relative to one another, the volume state, and how hard the circuit is being asked to pull. In this simulation it is authored by the case rather than computed, and the observable it produces — the drainage-limb saturation — is derived from it.',
  references: [
    {
      id: 'ecmo.recirculation-fraction.authored-by-case',
      kind: 'educational-model-boundary',
      statement:
        'This simulation sets the recirculation fraction from the authored case. It does not vary it with pump speed, cannula position, or volume state.',
      appliesWhen:
        'Inside this simulation only. It exists so that the difference between displayed flow and the flow left after re-drainage can be shown at all.',
      evidenceIds: ['bounded-educational-model'],
      caveat:
        'Raising the pump speed here therefore does not move the modeled fraction, even though speed is one of the things that changes recirculation at the bedside.',
    },
    {
      id: 'ecmo.recirculation-fraction.mixture-relationship',
      kind: 'formula-definition',
      statement:
        'Drainage-limb saturation is modeled as the systemic venous value mixed with the returned post-membrane value in proportion to the recirculating share: pre-oxygenator = systemic + fraction × (post-oxygenator − systemic).',
      appliesWhen:
        'This simulation’s own mixing model. It is the definition the modeled numbers obey, not a validated bedside calculation for estimating recirculation from two saturations.',
      evidenceIds: ['bounded-educational-model'],
    },
  ],
  caveats:
    'The two saturations this relationship uses are themselves modeled, and one of them — the systemic venous value — has no sensor anywhere on the circuit.',
  doNotInfer:
    'Do not read this as a measured quantity, do not treat the rearranged relationship as a bedside formula for estimating recirculation, and do not conclude that changing pump speed changes the fraction this simulation uses.',
  conceptIds: ['cc.circuit.recirculation', 'cc.device.native-device-effective-flow'],
  reviewStatus: 'draft',
}

/**
 * Per-signal display deadbands for the baseline review.
 *
 * They exist so a value moving in its last decimal does not read as movement. **A display aid for
 * this simulation and nothing else** — not a clinical tolerance, not a boundary of anything. The
 * guide below carries the same numbers as its own provenance so the two cannot drift apart, and
 * the panel prints the raw change beside every word they produce.
 *
 * Inclusive: a change exactly equal to a deadband reads as unchanged.
 */
export const ECMO_BASELINE_DISPLAY_DEADBANDS = Object.freeze({
  bloodFlow: 0.05,
  rpmSetpoint: 0,
  pVen: 2,
  pInt: 3,
  pArt: 3,
  deltaP: 2,
  sweepLpm: 0.05,
  spo2: 0.5,
  paCO2: 0.5,
  pH: 0.02,
  venousLineSaturation: 0.5,
  nativeCardiacOutputLpm: 0.1,
  recirculationAdjustedCircuitFlowLpm: 0.05,
  // Added for the VA track, which reads several signals the VV panels never show. They live here
  // for the same reason the rest do: a panel that classified with a number authored beside the
  // markup could drift from the guide that tells the learner what the classification means.
  postOxygenatorSaturation: 0.5,
  systemicVenousSaturationEstimate: 0.5,
  recirculationFraction: 0.005,
  rightRadialSpo2: 0.5,
  femoralArterialSpo2: 0.5,
  upperToLowerSaturationGap: 2,
  pulsePressure: 1,
  meanArterialPressure: 2,
  distalLimbNirs: 2,
})

const deadbandLabels: Readonly<Record<keyof typeof ECMO_BASELINE_DISPLAY_DEADBANDS, string>> = {
  bloodFlow: 'circuit blood flow, L/min',
  rpmSetpoint: 'pump speed, rpm',
  pVen: 'pVen, mmHg',
  pInt: 'pInt, mmHg',
  pArt: 'pArt, mmHg',
  deltaP: 'the membrane gradient, mmHg',
  sweepLpm: 'sweep, L/min',
  spo2: 'patient SpO₂',
  paCO2: 'the arterial carbon dioxide value, mmHg',
  pH: 'pH',
  venousLineSaturation: 'venous-line SvO₂',
  nativeCardiacOutputLpm: 'native cardiac output, L/min',
  recirculationAdjustedCircuitFlowLpm: 'recirculation-adjusted circuit flow, L/min',
  postOxygenatorSaturation: 'post-oxygenator saturation',
  systemicVenousSaturationEstimate: 'the modeled systemic venous saturation estimate',
  recirculationFraction: 'the recirculating share of drainage',
  rightRadialSpo2: 'right radial saturation',
  femoralArterialSpo2: 'femoral arterial saturation',
  upperToLowerSaturationGap: 'the difference between the femoral and right radial saturations',
  pulsePressure: 'pulse pressure, mmHg',
  meanArterialPressure: 'mean arterial pressure, mmHg',
  distalLimbNirs: 'distal limb near-infrared saturation',
}

/** Built from the constants above so the guide's own statement cannot drift from the behaviour. */
const deadbandStatement = Object.entries(ECMO_BASELINE_DISPLAY_DEADBANDS)
  .map(
    ([key, value]) =>
      `${deadbandLabels[key as keyof typeof ECMO_BASELINE_DISPLAY_DEADBANDS]} ${value}`,
  )
  .join('; ')

const baselineChange: CriticalCareDerivedValueGuide = {
  id: 'ecmo.baselineChangeFromEarlierValue',
  label: 'Change from this circuit’s earlier value',
  formula: 'value now − value earlier in this session',
  liveValueType: 'derived',
  interpretation:
    'The quantity a baseline review actually reads. It is defined for one circuit against itself over a window in which nothing was deliberately changed, and it does not transfer to another circuit, another cannula configuration, or another patient.',
  references: [
    {
      id: 'ecmo.baseline-change.own-earlier-value',
      kind: 'patient-baseline',
      statement:
        'A change from this circuit’s own earlier value, over a window in which the settings were not altered, is the interpretable quantity. The absolute values themselves depend on cannula size and position, patient size, temperature, hemoglobin, volume state, the device configuration and local protocol.',
      appliesWhen:
        'A single patient–circuit followed over time. Comparing two circuits, two cannula configurations, or two patients compares different things.',
      evidenceIds: ['elso-adult-vv-2021', 'ecmo-book-ch18', 'bounded-educational-model'],
      caveat:
        'A change read without knowing what else was altered in the same window is not interpretable.',
    },
    {
      id: 'ecmo.baseline-change.display-deadbands',
      kind: 'educational-model-boundary',
      statement: `This simulation calls a change higher, lower, or unchanged using a per-signal display deadband: ${deadbandStatement}. A change exactly equal to a deadband reads as unchanged.`,
      appliesWhen:
        'Inside this simulation only, as a display aid so that a value moving in its last decimal does not read as movement. It is not a clinical tolerance and marks no boundary of safety.',
      evidenceIds: ['bounded-educational-model'],
      caveat: 'The raw change is printed beside every word these deadbands produce.',
    },
  ],
  caveats:
    'A window of modeled seconds is not a bedside window. A real baseline is established and re-read over hours, and the slow drift a real circuit shows over that time has no counterpart here.',
  doNotInfer:
    'Do not read a display deadband as a tolerance for acceptable drift, do not treat a change inside one as established stability, and do not carry any of these numbers to another circuit or to a bedside.',
  conceptIds: ['cc.circuit.pressure-zones', 'cc.measurement.measured-estimated-inferred'],
  reviewStatus: 'draft',
}

export const ecmoDerivedValueGuideList = registerCriticalCareDerivedValueGuides([
  deltaPTrend,
  venousLineSaturation,
  systemicVenousEstimate,
  oxygenConsumption,
  recirculationAdjustedFlow,
  recirculationFraction,
  baselineChange,
])

export const ecmoDerivedValueGuides = {
  transmembraneDeltaP: deltaPTrend,
  venousLineSaturation,
  systemicVenousSaturationEstimate: systemicVenousEstimate,
  oxygenConsumption,
  recirculationAdjustedCircuitFlow: recirculationAdjustedFlow,
  recirculationFraction,
  baselineChangeFromEarlierValue: baselineChange,
} as const
