import type { CriticalCareCompetencyId } from './competencies'
import { criticalCareCatalogModuleIds, type CriticalCareCatalogModuleId } from './modules'
import type { IcuScenarioFamily } from '@/features/icu-simulation/engine/types'

export interface CriticalCarePathwayDefinition {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly moduleIds: readonly CriticalCareCatalogModuleId[]
  readonly competencyIds: readonly CriticalCareCompetencyId[]
  readonly recommendedIcuScenarioIds: readonly IcuScenarioFamily[]
}

export const criticalCarePathways = [
  {
    id: 'shock-and-perfusion',
    title: 'Shock and perfusion',
    description:
      'Connect signal quality, shock mechanism, perfusion priorities, therapy, and reassessment.',
    moduleIds: [
      'icu-hemodynamics',
      'mechanical-circulatory-support',
      'cardiohelp-ecmo',
      'icu-simulation',
    ],
    competencyIds: [
      'signal-validation',
      'shock-mechanism',
      'hemodynamic-prioritization',
      'hemodynamic-reassessment',
    ],
    recommendedIcuScenarioIds: [
      'septic-ards-aki',
      'lv-cardiogenic',
      'massive-pe-rv',
      'hemorrhagic',
      'tamponade',
      'mixed-cardiogenic-vasodilatory',
    ],
  },
  {
    id: 'acute-respiratory-failure',
    title: 'Acute respiratory failure',
    description:
      'Progress from mechanics and ventilator interaction to extracorporeal and multiorgan support.',
    moduleIds: ['mechanical-ventilation', 'cardiohelp-ecmo', 'icu-simulation'],
    competencyIds: [
      'ventilator-mechanics',
      'ventilator-waveform-interpretation',
      'ventilator-troubleshooting',
      'ecmo-patient-management',
      'cross-system-reassessment',
    ],
    recommendedIcuScenarioIds: ['septic-ards-aki', 'massive-pe-rv'],
  },
  {
    id: 'cardiogenic-and-rv-shock',
    title: 'Cardiogenic and right-ventricular shock',
    description:
      'Link hemodynamic phenotype to modeled MCS, VA ECMO, and integrated ICU decisions.',
    moduleIds: [
      'icu-hemodynamics',
      'mechanical-circulatory-support',
      'cardiohelp-ecmo',
      'icu-simulation',
    ],
    competencyIds: [
      'shock-mechanism',
      'mcs-patient-assessment',
      'mcs-device-management',
      'ecmo-patient-management',
      'hemodynamic-reassessment',
    ],
    recommendedIcuScenarioIds: [
      'lv-cardiogenic',
      'massive-pe-rv',
      'tamponade',
      'mixed-cardiogenic-vasodilatory',
    ],
  },
  {
    id: 'renal-support-and-fluid-management',
    title: 'Renal support and fluid management',
    description:
      'Connect CRRT goals, delivery, pressure localization, fluid balance, safety, and reassessment.',
    moduleIds: ['baxter-crrt', 'icu-simulation'],
    competencyIds: [
      'crrt-prescription',
      'crrt-pressure-localization',
      'crrt-fluid-management',
      'crrt-safety',
      'cross-system-reassessment',
    ],
    recommendedIcuScenarioIds: ['septic-ards-aki'],
  },
  {
    id: 'multiorgan-critical-illness',
    title: 'Multiorgan critical illness',
    description:
      'Prepare for longitudinal cases with one synthetic patient, one clock, and interacting support systems.',
    moduleIds: [...criticalCareCatalogModuleIds],
    competencyIds: [
      'multiorgan-prioritization',
      'cross-system-reassessment',
      'integrated-device-management',
      'critical-care-safety',
    ],
    recommendedIcuScenarioIds: [
      'septic-ards-aki',
      'lv-cardiogenic',
      'massive-pe-rv',
      'hemorrhagic',
      'tamponade',
      'mixed-cardiogenic-vasodilatory',
    ],
  },
] as const satisfies readonly CriticalCarePathwayDefinition[]

export type CriticalCarePathwayId = (typeof criticalCarePathways)[number]['id']

export const criticalCarePathwayById: ReadonlyMap<
  CriticalCarePathwayId,
  CriticalCarePathwayDefinition
> = new Map(criticalCarePathways.map((pathway) => [pathway.id, pathway]))

export interface CriticalCareIcuPreparationRequirement {
  readonly id: string
  readonly label: string
  readonly rationale: string
  /** A learner satisfies this requirement by completing any one catalog activity in the group. */
  readonly anyOfActivityIds: readonly string[]
}

export interface CriticalCareIcuScenarioPreparation {
  readonly scenarioId: IcuScenarioFamily
  readonly pathwayIds: readonly CriticalCarePathwayId[]
  readonly assessRequirements: readonly CriticalCareIcuPreparationRequirement[]
}

/**
 * Catalog-only preparation metadata for integrated ICU capstones.
 *
 * These stable activity identifiers are the entire focused-module boundary. Focused simulator
 * state, device commands, waveforms, patient state, and replay data never enter the ICU engine.
 */
export const criticalCareIcuScenarioPreparation = [
  {
    scenarioId: 'septic-ards-aki',
    pathwayIds: [
      'shock-and-perfusion',
      'acute-respiratory-failure',
      'renal-support-and-fluid-management',
      'multiorgan-critical-illness',
    ],
    assessRequirements: [
      {
        id: 'septic-hemodynamics',
        label: 'Distributive-shock hemodynamics',
        rationale:
          'Establish a focused shock-mechanism and perfusion reassessment foundation before the masked multiorgan assessment.',
        anyOfActivityIds: ['hemodynamics:practice:HD-02'],
      },
      {
        id: 'septic-ventilation',
        label: 'ARDS mechanics and sudden compliance change',
        rationale:
          'Demonstrate a focused respiratory assessment before ventilator decisions are combined with shock and renal support.',
        anyOfActivityIds: ['ventilation:practice:MV-01', 'ventilation:practice:MV-14'],
      },
      {
        id: 'septic-renal',
        label: 'CRRT priorities or fluid balance',
        rationale:
          'Complete one focused renal-support case before the integrated course adds evolving AKI and fluid management.',
        anyOfActivityIds: ['crrt:practice:CRRT-01', 'crrt:practice:CRRT-10'],
      },
    ],
  },
  {
    scenarioId: 'lv-cardiogenic',
    pathwayIds: ['shock-and-perfusion', 'cardiogenic-and-rv-shock', 'multiorgan-critical-illness'],
    assessRequirements: [
      {
        id: 'lv-hemodynamics',
        label: 'LV congestion and low-flow hemodynamics',
        rationale:
          'Recognize a low-output congested phenotype before selecting and reassessing advanced support.',
        anyOfActivityIds: ['hemodynamics:practice:HD-03', 'hemodynamics:practice:HD-06'],
      },
      {
        id: 'lv-mcs',
        label: 'Effective MCS flow',
        rationale:
          'Complete one focused MCS case that separates a displayed device setting from effective systemic support.',
        anyOfActivityIds: ['mcs:practice:IMP-01', 'mcs:practice:IMP-03', 'mcs:practice:IABP-03'],
      },
    ],
  },
  {
    scenarioId: 'massive-pe-rv',
    pathwayIds: [
      'shock-and-perfusion',
      'acute-respiratory-failure',
      'cardiogenic-and-rv-shock',
      'multiorgan-critical-illness',
    ],
    assessRequirements: [
      {
        id: 'pe-rv-hemodynamics',
        label: 'Acute RV pressure overload',
        rationale:
          'Recognize the RV-obstructive hemodynamic pattern before entering a masked cross-system assessment.',
        anyOfActivityIds: ['hemodynamics:practice:HD-04', 'hemodynamics:practice:HD-05'],
      },
      {
        id: 'pe-rv-support',
        label: 'RV-sensitive advanced support',
        rationale:
          'Complete a focused support case involving preload-sensitive flow or VA support before the integrated capstone.',
        anyOfActivityIds: ['mcs:practice:IMP-01', 'ecmo:practice:va-clinical-initiation-shock'],
      },
    ],
  },
  {
    scenarioId: 'hemorrhagic',
    pathwayIds: ['shock-and-perfusion', 'multiorgan-critical-illness'],
    assessRequirements: [
      {
        id: 'hemorrhagic-hemodynamics',
        label: 'Volume-loss hemodynamics',
        rationale:
          'Recognize the volume-loss phenotype and its reassessment priorities before the longitudinal assessment.',
        anyOfActivityIds: ['hemodynamics:practice:HD-01'],
      },
    ],
  },
  {
    scenarioId: 'tamponade',
    pathwayIds: ['shock-and-perfusion', 'cardiogenic-and-rv-shock', 'multiorgan-critical-illness'],
    assessRequirements: [
      {
        id: 'tamponade-hemodynamics',
        label: 'Pressure equalization and falling pulse pressure',
        rationale:
          'Complete the focused tamponade-pattern case before the masked course tests recognition and definitive escalation.',
        anyOfActivityIds: ['hemodynamics:practice:HD-07'],
      },
    ],
  },
  {
    scenarioId: 'mixed-cardiogenic-vasodilatory',
    pathwayIds: ['shock-and-perfusion', 'cardiogenic-and-rv-shock', 'multiorgan-critical-illness'],
    assessRequirements: [
      {
        id: 'mixed-hemodynamics',
        label: 'Mixed low-flow and vasodilatory hemodynamics',
        rationale:
          'Complete a focused distributive or cardiogenic phenotype before combining both mechanisms longitudinally.',
        anyOfActivityIds: ['hemodynamics:practice:HD-02', 'hemodynamics:practice:HD-03'],
      },
      {
        id: 'mixed-mcs',
        label: 'MCS under changing loading conditions',
        rationale:
          'Demonstrate that effective support depends on preload and afterload before the integrated device course.',
        anyOfActivityIds: ['mcs:practice:IMP-03', 'mcs:practice:IABP-03'],
      },
      {
        id: 'mixed-ecmo',
        label: 'VA ECMO shock or vasoplegia management',
        rationale:
          'Complete a focused VA course before the assessment combines circuit support with persistent vasodilation.',
        anyOfActivityIds: [
          'ecmo:practice:va-clinical-initiation-shock',
          'ecmo:practice:va-clinical-vasoplegia',
        ],
      },
    ],
  },
] as const satisfies readonly CriticalCareIcuScenarioPreparation[]

export const criticalCareIcuScenarioPreparationById: ReadonlyMap<
  IcuScenarioFamily,
  CriticalCareIcuScenarioPreparation
> = new Map(
  criticalCareIcuScenarioPreparation.map((preparation) => [preparation.scenarioId, preparation]),
)
