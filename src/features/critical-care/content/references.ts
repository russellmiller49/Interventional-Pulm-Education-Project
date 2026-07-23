import type { CriticalCareCompetencyId } from './competencies'
import type { CriticalCareCatalogModuleId } from './modules'

export const criticalCareReferenceCategories = [
  'definitions',
  'waveform-patterns',
  'formulas',
  'normal-and-abnormal-states',
  'alarm-differentials',
  'troubleshooting-sequences',
  'device-controls',
  'safety-considerations',
  'references-and-model-limits',
] as const

export type CriticalCareReferenceCategory = (typeof criticalCareReferenceCategories)[number]

export interface CriticalCareReferenceDefinition {
  readonly id: string
  readonly title: string
  readonly summary: string
  readonly category: CriticalCareReferenceCategory
  readonly moduleIds: readonly CriticalCareCatalogModuleId[]
  readonly competencyIds: readonly CriticalCareCompetencyId[]
  readonly relatedActivityIds: readonly string[]
  readonly evidenceIds: readonly string[]
}

/**
 * Reference cards remain compact catalog records. Full reviewed prose stays in
 * the source modules until the reference-card renderer migration.
 */
export const criticalCareReferences = [
  {
    id: 'reference:hemodynamics:signal-validation',
    title: 'PAC signal-validation sequence',
    summary:
      'A shared entry point to the existing leveling, zeroing, dynamic-response, and position material.',
    category: 'troubleshooting-sequences',
    moduleIds: ['icu-hemodynamics'],
    competencyIds: ['signal-validation'],
    relatedActivityIds: ['hemodynamics:learn:pac-signal-validation', 'hemodynamics:practice:HD-08'],
    evidenceIds: [
      'pac-waveforms-part-1-2021',
      'monitor-workflow-supplied',
      'arterial-pressure-five-step-2020',
    ],
  },
  {
    id: 'reference:hemodynamics:formulas',
    title: 'Hemodynamic formulas and model limits',
    summary:
      'Links to the existing derived-value formulas, source notes, and educational-model limits.',
    category: 'formulas',
    moduleIds: ['icu-hemodynamics'],
    competencyIds: ['hemodynamic-reassessment'],
    relatedActivityIds: ['hemodynamics:practice:HD-01'],
    evidenceIds: ['pac-derived-part-2-2021', 'icu-hemodynamics-model-v1'],
  },
  {
    id: 'reference:hemodynamics:waveform-sequence',
    title: 'PAC waveform and position sequence',
    summary:
      'Links the preserved introducer, RA, RV, PA, and brief PAWP waveform material with its position-safety boundaries.',
    category: 'waveform-patterns',
    moduleIds: ['icu-hemodynamics'],
    competencyIds: ['signal-validation', 'critical-care-safety'],
    relatedActivityIds: [
      'hemodynamics:learn:catheter-advancement',
      'hemodynamics:learn:pawp-capture',
    ],
    evidenceIds: ['pac-waveforms-part-1-2021', 'monitor-workflow-supplied'],
  },
  {
    id: 'reference:hemodynamics:derived-values',
    title: 'Derived values and validity screens',
    summary:
      'Indexes the preserved SV, SVR, PVR, CPO, PAPi, compliance, and PPV formulas and the conditions that make them uninterpretable.',
    category: 'formulas',
    moduleIds: ['icu-hemodynamics'],
    competencyIds: ['hemodynamic-reassessment', 'critical-care-safety'],
    relatedActivityIds: [
      'hemodynamics:learn:thermodilution-series',
      'hemodynamics:learn:derived-hemodynamics',
    ],
    evidenceIds: ['pac-derived-part-2-2021', 'icu-hemodynamics-model-v1'],
  },
  {
    id: 'reference:hemodynamics:artifact-recognition',
    title: 'Pressure-system artifact recognition',
    summary:
      'Compares hydrostatic offset, over- and underdamping, catheter whip, wall contact, and false-wedge patterns.',
    category: 'waveform-patterns',
    moduleIds: ['icu-hemodynamics'],
    competencyIds: ['signal-validation', 'critical-care-safety'],
    relatedActivityIds: [
      'hemodynamics:learn:pac-signal-validation',
      'hemodynamics:learn:pressure-system',
      'hemodynamics:practice:HD-08',
    ],
    evidenceIds: ['pac-waveforms-part-1-2021', 'monitor-workflow-supplied'],
  },
  {
    id: 'reference:ventilation:waveforms',
    title: 'Ventilator waveform patterns',
    summary:
      'Indexes the existing mechanics, triggering, cycling, and whole-patient waveform teaching.',
    category: 'waveform-patterns',
    moduleIds: ['mechanical-ventilation'],
    competencyIds: ['ventilator-waveform-interpretation', 'ventilator-mechanics'],
    relatedActivityIds: ['ventilation:practice:MV-01', 'ventilation:practice:MV-09'],
    evidenceIds: ['mechanical-ventilation-source-boundary'],
  },
  {
    id: 'reference:ventilation:troubleshooting',
    title: 'Ventilator troubleshooting sequence',
    summary: 'Indexes the existing patient, airway, circuit, and settings troubleshooting content.',
    category: 'troubleshooting-sequences',
    moduleIds: ['mechanical-ventilation'],
    competencyIds: ['ventilator-troubleshooting', 'ventilator-safety'],
    relatedActivityIds: ['ventilation:practice:MV-13', 'ventilation:practice:MV-14'],
    evidenceIds: ['mechanical-ventilation-source-boundary'],
  },
  {
    id: 'reference:mcs:device-controls',
    title: 'MCS controls and safety context',
    summary: 'Indexes the existing IABP, Impella, and durable-LVAD controls and model-limit notes.',
    category: 'device-controls',
    moduleIds: ['mechanical-circulatory-support'],
    competencyIds: ['mcs-device-management', 'mcs-safety'],
    relatedActivityIds: ['mcs:learn:mcs-foundations-mechanisms'],
    evidenceIds: ['mcs-device-source-registry'],
  },
  {
    id: 'reference:ecmo:circuit-assessment',
    title: 'ECMO circuit and alarm assessment',
    summary:
      'Indexes the existing circuit-order, pressure, flow, gas-path, alarm, and transport material.',
    category: 'alarm-differentials',
    moduleIds: ['cardiohelp-ecmo'],
    competencyIds: ['ecmo-circuit-assessment', 'ecmo-safety'],
    relatedActivityIds: [
      'ecmo:learn:startup-sensor-orientation',
      'ecmo:learn:arterial-bubble-stop',
    ],
    evidenceIds: ['cardiohelp-i-us-2025'],
  },
  {
    id: 'reference:crrt:pressure-localization',
    title: 'CRRT pressure localization',
    summary:
      'Indexes the existing circuit path, trend interpretation, and cause-first troubleshooting content.',
    category: 'alarm-differentials',
    moduleIds: ['baxter-crrt'],
    competencyIds: ['crrt-pressure-localization', 'crrt-safety'],
    relatedActivityIds: ['crrt:learn:crrt-circuit-pressures', 'crrt:practice:CRRT-13'],
    evidenceIds: ['DEV-PM-009', 'DEV-PM-010'],
  },
  {
    id: 'reference:crrt:fluid-ledgers',
    title: 'CRRT delivery and fluid ledgers',
    summary:
      'Indexes the existing prescribed-versus-delivered and whole-patient fluid-balance material.',
    category: 'formulas',
    moduleIds: ['baxter-crrt'],
    competencyIds: ['crrt-prescription', 'crrt-fluid-management'],
    relatedActivityIds: ['crrt:learn:crrt-fluid-liberation', 'crrt:practice:CRRT-10'],
    evidenceIds: ['DOSE-PM-001', 'FLUID-PM-001'],
  },
  {
    id: 'reference:icu:model-limits',
    title: 'Integrated ICU Simulator evidence and model limits',
    summary:
      'Links the existing scenario evidence, review status, and bounded synthetic-model limitations.',
    category: 'references-and-model-limits',
    moduleIds: ['icu-simulation'],
    competencyIds: ['multiorgan-prioritization', 'critical-care-safety'],
    relatedActivityIds: [
      'icu:practice:septic-ards-aki',
      'icu:assess:mixed-cardiogenic-vasodilatory',
    ],
    evidenceIds: ['ICU-SCENARIO-MODEL', 'ICU-HEMO-CORE'],
  },
] as const satisfies readonly CriticalCareReferenceDefinition[]

export type CriticalCareReferenceId = (typeof criticalCareReferences)[number]['id']

export const criticalCareReferenceById: ReadonlyMap<
  CriticalCareReferenceId,
  CriticalCareReferenceDefinition
> = new Map(criticalCareReferences.map((reference) => [reference.id, reference]))
