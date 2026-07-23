import { criticalCareCatalogModuleIds, type CriticalCareCatalogModuleId } from './modules'

export const criticalCareCompetencyDomains = [
  'assessment',
  'mechanism',
  'prioritization',
  'therapy',
  'device-management',
  'reassessment',
  'safety',
] as const

export type CriticalCareCompetencyDomain = (typeof criticalCareCompetencyDomains)[number]

export interface CriticalCareCompetencyDefinition {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly domain: CriticalCareCompetencyDomain
  readonly moduleIds: readonly CriticalCareCatalogModuleId[]
}

export const criticalCareCompetencies = [
  {
    id: 'signal-validation',
    title: 'Signal validation',
    description: 'Validate measurement quality before interpreting or acting on displayed data.',
    domain: 'assessment',
    moduleIds: ['icu-hemodynamics'],
  },
  {
    id: 'hemodynamic-reassessment',
    title: 'Hemodynamic reassessment',
    description:
      'Reassess pressure, flow, perfusion, and signal consistency after an intervention.',
    domain: 'reassessment',
    moduleIds: ['icu-hemodynamics', 'icu-simulation'],
  },
  {
    id: 'shock-mechanism',
    title: 'Shock mechanism',
    description: 'Build and update a mechanism-based explanation of a synthetic shock state.',
    domain: 'mechanism',
    moduleIds: ['icu-hemodynamics', 'mechanical-circulatory-support', 'icu-simulation'],
  },
  {
    id: 'hemodynamic-prioritization',
    title: 'Hemodynamic prioritization',
    description: 'Choose a defensible immediate priority from the complete simulated context.',
    domain: 'prioritization',
    moduleIds: ['icu-hemodynamics', 'mechanical-circulatory-support', 'icu-simulation'],
  },
  {
    id: 'ventilator-setup',
    title: 'Ventilator setup',
    description: 'Configure the selected training console for the authored learning objective.',
    domain: 'device-management',
    moduleIds: ['mechanical-ventilation'],
  },
  {
    id: 'ventilator-mechanics',
    title: 'Respiratory mechanics',
    description: 'Interpret modeled mechanics and their interaction with ventilator support.',
    domain: 'mechanism',
    moduleIds: ['mechanical-ventilation', 'icu-simulation'],
  },
  {
    id: 'ventilator-waveform-interpretation',
    title: 'Ventilator waveform interpretation',
    description: 'Recognize the authored pressure, flow, and volume waveform patterns.',
    domain: 'assessment',
    moduleIds: ['mechanical-ventilation'],
  },
  {
    id: 'ventilator-troubleshooting',
    title: 'Ventilator troubleshooting',
    description: 'Localize a modeled patient, tube, circuit, or settings problem before acting.',
    domain: 'therapy',
    moduleIds: ['mechanical-ventilation', 'icu-simulation'],
  },
  {
    id: 'ventilator-safety',
    title: 'Ventilator safety',
    description: 'Recognize and avoid safety-critical actions in the authored ventilation cases.',
    domain: 'safety',
    moduleIds: ['mechanical-ventilation', 'icu-simulation'],
  },
  {
    id: 'mcs-device-management',
    title: 'MCS device management',
    description: 'Interpret and operate the modeled IABP, Impella, and durable-LVAD interfaces.',
    domain: 'device-management',
    moduleIds: ['mechanical-circulatory-support', 'icu-simulation'],
  },
  {
    id: 'mcs-patient-assessment',
    title: 'MCS patient assessment',
    description: 'Relate device behavior to the modeled patient and whole-circulation context.',
    domain: 'assessment',
    moduleIds: ['mechanical-circulatory-support', 'icu-simulation'],
  },
  {
    id: 'mcs-safety',
    title: 'MCS safety',
    description: 'Recognize the authored device and patient safety constraints before intervening.',
    domain: 'safety',
    moduleIds: ['mechanical-circulatory-support', 'icu-simulation'],
  },
  {
    id: 'ecmo-circuit-assessment',
    title: 'ECMO circuit assessment',
    description: 'Inspect circuit order, pressure patterns, gas path, flow, and active alarms.',
    domain: 'assessment',
    moduleIds: ['cardiohelp-ecmo', 'icu-simulation'],
  },
  {
    id: 'ecmo-device-management',
    title: 'ECMO device management',
    description: 'Use the modeled console and circuit controls for the authored objective.',
    domain: 'device-management',
    moduleIds: ['cardiohelp-ecmo', 'icu-simulation'],
  },
  {
    id: 'ecmo-patient-management',
    title: 'ECMO patient management',
    description: 'Integrate patient and circuit findings when selecting a modeled action.',
    domain: 'therapy',
    moduleIds: ['cardiohelp-ecmo', 'icu-simulation'],
  },
  {
    id: 'ecmo-safety',
    title: 'ECMO safety',
    description: 'Recognize and respond to the authored circuit and transport safety events.',
    domain: 'safety',
    moduleIds: ['cardiohelp-ecmo', 'icu-simulation'],
  },
  {
    id: 'crrt-device-management',
    title: 'CRRT device management',
    description: 'Use the modeled PrisMax workflow while preserving its educational limits.',
    domain: 'device-management',
    moduleIds: ['baxter-crrt', 'icu-simulation'],
  },
  {
    id: 'crrt-prescription',
    title: 'CRRT prescription and delivery',
    description: 'Relate an authored treatment goal to prescription and delivered therapy.',
    domain: 'therapy',
    moduleIds: ['baxter-crrt', 'icu-simulation'],
  },
  {
    id: 'crrt-pressure-localization',
    title: 'CRRT pressure localization',
    description: 'Interpret circuit pressure trends as locations rather than isolated thresholds.',
    domain: 'mechanism',
    moduleIds: ['baxter-crrt'],
  },
  {
    id: 'crrt-fluid-management',
    title: 'CRRT fluid management',
    description: 'Reconcile machine removal with the modeled whole-patient fluid ledger.',
    domain: 'reassessment',
    moduleIds: ['baxter-crrt', 'icu-simulation'],
  },
  {
    id: 'crrt-safety',
    title: 'CRRT safety',
    description: 'Preserve a safe state and verify the modeled cause before resuming therapy.',
    domain: 'safety',
    moduleIds: ['baxter-crrt', 'icu-simulation'],
  },
  {
    id: 'multiorgan-prioritization',
    title: 'Multiorgan prioritization',
    description: 'Prioritize interacting problems in one longitudinal synthetic ICU patient.',
    domain: 'prioritization',
    moduleIds: ['icu-simulation'],
  },
  {
    id: 'cross-system-reassessment',
    title: 'Cross-system reassessment',
    description: 'Reassess coupled organ-support effects after advancing the shared clock.',
    domain: 'reassessment',
    moduleIds: ['icu-simulation'],
  },
  {
    id: 'integrated-device-management',
    title: 'Integrated device management',
    description: 'Coordinate modeled organ-support devices without replacing causal diagnosis.',
    domain: 'device-management',
    moduleIds: ['icu-simulation'],
  },
  {
    id: 'critical-care-safety',
    title: 'Critical-care simulation safety',
    description: 'Avoid authored critical errors and preserve the educational safety boundary.',
    domain: 'safety',
    moduleIds: [...criticalCareCatalogModuleIds],
  },
] as const satisfies readonly CriticalCareCompetencyDefinition[]

export type CriticalCareCompetencyId = (typeof criticalCareCompetencies)[number]['id']

export const criticalCareCompetencyById: ReadonlyMap<
  CriticalCareCompetencyId,
  CriticalCareCompetencyDefinition
> = new Map(criticalCareCompetencies.map((competency) => [competency.id, competency]))
