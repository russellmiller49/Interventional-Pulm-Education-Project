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

export const ecmoDerivedValueGuideList = registerCriticalCareDerivedValueGuides([
  deltaPTrend,
  venousLineSaturation,
  systemicVenousEstimate,
  oxygenConsumption,
  recirculationAdjustedFlow,
])

export const ecmoDerivedValueGuides = {
  transmembraneDeltaP: deltaPTrend,
  venousLineSaturation,
  systemicVenousSaturationEstimate: systemicVenousEstimate,
  oxygenConsumption,
  recirculationAdjustedCircuitFlow: recirculationAdjustedFlow,
} as const
