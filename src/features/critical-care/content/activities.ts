import {
  criticalCareActivityDefinitionSchema,
  type CriticalCareActivityDefinition,
  type CriticalCareActivityMode,
  type CriticalCareCompletionEvidenceAuthority,
  type CriticalCareCreditPolicy,
  type CriticalCareCurriculumStage,
  type CriticalCareDifficulty,
  type CriticalCareReviewStatus,
} from '@/features/learning-module/activity'

import { criticalCareAssets } from './assets'
import { criticalCareCompetencies } from './competencies'
import { criticalCareConceptById, criticalCareConceptMetadataForActivity } from './concepts'
import {
  criticalCareModuleById,
  criticalCareModuleCatalog,
  type CriticalCareCatalogModuleId,
} from './modules'
import { criticalCarePathways } from './pathways'
import { criticalCareReferences } from './references'
import { criticalCareEvidenceById } from './evidenceRegistry'
import {
  validateCriticalCareLearningPathways,
  validateLearningPathwayCoverage,
} from './learningPathways'

type ActivitySection = 'learn' | 'practice' | 'assess'
type EcmoTrack = 'vv' | 'va'

/**
 * Every seed authors `difficulty`, `curriculumStage`, and `stageOrder`. There is deliberately no
 * section-derived default: a section-constant difficulty carried no signal and silently degraded
 * every "sort by difficulty" surface into a sort by title. Difficulty calls in modules whose
 * clinical content pass is still pending are explicit editorial judgements, not inherited values.
 */
interface ActivitySeed {
  readonly sourceId: string
  readonly title: string
  readonly description?: string
  readonly competencyIds: readonly string[]
  readonly pathwayIds: readonly string[]
  readonly evidenceIds: readonly string[]
  readonly prerequisiteActivityIds?: readonly string[]
  readonly teachesConceptIds?: readonly string[]
  readonly assumedConceptIds?: readonly string[]
  readonly estimatedMinutes?: number
  readonly difficulty: CriticalCareDifficulty
  readonly curriculumStage: CriticalCareCurriculumStage
  /** Authored ordinal within (moduleId, curriculumStage); unique, not necessarily contiguous. */
  readonly stageOrder: number
  readonly track?: EcmoTrack
  readonly reviewStatus?: CriticalCareReviewStatus
  readonly creditPolicy?: CriticalCareCreditPolicy
  readonly completionEvidenceAuthority?: CriticalCareCompletionEvidenceAuthority
}

const reviewStatusByModule: Readonly<
  Record<CriticalCareCatalogModuleId, CriticalCareReviewStatus>
> = {
  'icu-hemodynamics': 'sme-review',
  'mechanical-ventilation': 'sme-review',
  'mechanical-circulatory-support': 'sme-review',
  'cardiohelp-ecmo': 'draft',
  'baxter-crrt': 'sme-review',
  'icu-simulation': 'draft',
}

const contentVersionByModule: Readonly<Record<CriticalCareCatalogModuleId, string>> = {
  'icu-hemodynamics': 'hemodynamics-recovery.1',
  'mechanical-ventilation': 'ventilation-recovery.1',
  'mechanical-circulatory-support': 'mcs-recovery.1',
  'cardiohelp-ecmo': 'ecmo-recovery.1',
  'baxter-crrt': 'crrt-recovery.1',
  'icu-simulation': 'icu-recovery.1',
}

function activityGovernance(
  moduleId: CriticalCareCatalogModuleId,
  section: ActivitySection,
  seed: ActivitySeed,
): {
  readonly reviewStatus: CriticalCareReviewStatus
  readonly creditPolicy: CriticalCareCreditPolicy
  readonly completionEvidenceAuthority: CriticalCareCompletionEvidenceAuthority
} {
  const reviewStatus = seed.reviewStatus ?? reviewStatusByModule[moduleId]
  if (seed.creditPolicy && seed.completionEvidenceAuthority) {
    return {
      reviewStatus,
      creditPolicy: seed.creditPolicy,
      completionEvidenceAuthority: seed.completionEvidenceAuthority,
    }
  }
  if (section === 'learn') {
    return {
      reviewStatus,
      creditPolicy: 'non-credit',
      completionEvidenceAuthority: 'none',
    }
  }
  return {
    reviewStatus,
    creditPolicy: reviewStatus === 'draft' ? 'completion-only' : 'competency-eligible',
    completionEvidenceAuthority: 'reviewed-engine-score',
  }
}

const assetsByModule: Readonly<Record<CriticalCareCatalogModuleId, readonly string[]>> = {
  'icu-hemodynamics': ['hemodynamics-bedside-waveforms'],
  'mechanical-ventilation': ['ventilation-console-workspace'],
  'mechanical-circulatory-support': ['mcs-cardiac-3d'],
  'cardiohelp-ecmo': ['ecmo-cardiohelp-circuit'],
  'baxter-crrt': ['crrt-prismax-console'],
  'icu-simulation': ['icu-integrated-bedside'],
}

function activityModes(section: ActivitySection): readonly CriticalCareActivityMode[] {
  if (section === 'learn') return ['guided']
  if (section === 'assess') return ['challenge']
  return ['guided', 'practice']
}

function activityQuery(
  moduleId: CriticalCareCatalogModuleId,
  section: ActivitySection,
  seed: ActivitySeed,
): Readonly<Record<string, string>> | undefined {
  if (moduleId === 'baxter-crrt' && section === 'assess') return undefined
  if (moduleId === 'baxter-crrt' && section === 'learn') return { lesson: seed.sourceId }
  if (moduleId === 'icu-hemodynamics' && section === 'assess') return { start: '1' }
  if (moduleId === 'cardiohelp-ecmo') {
    return section === 'learn'
      ? { lesson: seed.sourceId, track: seed.track ?? 'vv' }
      : { case: seed.sourceId, track: seed.track ?? 'vv' }
  }
  if (moduleId === 'mechanical-circulatory-support') {
    return section === 'learn' ? { lesson: seed.sourceId } : { case: seed.sourceId }
  }
  if (moduleId === 'mechanical-ventilation' && section === 'assess') {
    return {
      case: seed.sourceId,
      seed: 'catalog-challenge-v1',
      device: 'hamilton-c6',
    }
  }
  if (section === 'learn') return { activity: seed.sourceId }
  return { case: seed.sourceId }
}

function defaultDescription(section: ActivitySection, title: string): string {
  if (section === 'learn') {
    return `Explore ${title} with guided cues and a focused transfer step.`
  }
  if (section === 'assess') {
    return `A harder ${title} case with less help. Teaching feedback comes at the end so you can work through it uninterrupted.`
  }
  return `Work through the ${title} case, observe the modeled consequences, and review the mechanism-level feedback.`
}

function defineActivities(
  moduleId: CriticalCareCatalogModuleId,
  section: ActivitySection,
  seeds: readonly ActivitySeed[],
): readonly CriticalCareActivityDefinition[] {
  const moduleDefinition = criticalCareModuleById.get(moduleId)
  if (!moduleDefinition) throw new Error(`Unknown critical-care module: ${moduleId}`)

  return seeds.map((seed) => {
    const id = `${moduleDefinition.activityIdPrefix}:${section}:${seed.sourceId}`
    const governance = activityGovernance(moduleId, section, seed)
    const description = seed.description ?? defaultDescription(section, seed.title)
    const conceptMetadata = criticalCareConceptMetadataForActivity({
      moduleId,
      section,
      title: seed.title,
      description,
    })
    return criticalCareActivityDefinitionSchema.parse({
      id,
      moduleId,
      title: seed.title,
      description,
      kind:
        section === 'learn'
          ? seed.sourceId === 'pac-signal-validation'
            ? 'interactive-lab'
            : 'micro-lesson'
          : section === 'assess'
            ? 'assessment'
            : 'practice-case',
      supportedModes: activityModes(section),
      pathname: `${moduleDefinition.href}/${section}`,
      query: activityQuery(moduleId, section, seed),
      pathwayIds: seed.pathwayIds,
      competencyIds: seed.competencyIds,
      prerequisiteActivityIds: seed.prerequisiteActivityIds ?? [],
      teachesConceptIds: seed.teachesConceptIds ?? conceptMetadata.teachesConceptIds,
      assumedConceptIds: seed.assumedConceptIds ?? conceptMetadata.assumedConceptIds,
      estimatedMinutes:
        seed.estimatedMinutes ?? (section === 'learn' ? 12 : section === 'assess' ? 25 : 15),
      difficulty: seed.difficulty,
      curriculumStage: seed.curriculumStage,
      stageOrder: seed.stageOrder,
      completionRuleId: `${moduleDefinition.activityIdPrefix}:completion:${section}-existing`,
      ...(section === 'assess'
        ? {
            masteryRuleId: `${moduleDefinition.activityIdPrefix}:mastery:existing-assessment`,
          }
        : {}),
      assetIds:
        moduleId === 'mechanical-circulatory-support' && section === 'assess'
          ? ['mcs-cardiac-text-summary']
          : assetsByModule[moduleId],
      reviewStatus: governance.reviewStatus,
      evidenceIds: seed.evidenceIds,
      contentVersion: contentVersionByModule[moduleId],
      creditPolicy: governance.creditPolicy,
      completionEvidenceAuthority: governance.completionEvidenceAuthority,
    }) as CriticalCareActivityDefinition
  })
}

const hemodynamicsEvidence = [
  'pac-waveforms-part-1-2021',
  'pac-derived-part-2-2021',
  'esicm-shock-2025',
  'icu-hemodynamics-model-v1',
] as const

const hemodynamicsLearnSeeds: readonly ActivitySeed[] = [
  // H0/H1: signal validity now opens the hemodynamics runway. `stageOrder` is the authored ordinal
  // within (module, stage) and `validateCriticalCareLearningPathways` requires the pathway to visit
  // a stage in that order, so the ordinals and the prerequisite chain move with the pathway rather
  // than contradicting it. Ids, routes, storage keys, and progress payloads are untouched.
  //
  // H1.1: seed position is itself curriculum. `getCriticalCareRecommendations` breaks ties on
  // catalog index, and the shared Critical Care hub asks it for one start with no module or
  // pathway preference — so whichever hemodynamics Learn seed is written first is what the hub
  // calls "Start here". H0/H1 moved the ordinals and the pathway but left `catheter-advancement`
  // sitting at index 0, and the hub went on recommending catheter manipulation as a novice's first
  // activity while the module's own runway opened on the pressure system. This array is therefore
  // kept in the pathway's order (`content/learningPathways`, icu-hemodynamics), not in
  // (stage, stageOrder) order: the pathway deliberately interleaves stages — a mechanism station
  // teaches the normal reference before the second foundation station advances a catheter against
  // it. `hub-pathway-start-alignment.test.ts` pins the two together so neither can drift alone.
  {
    sourceId: 'pressure-system',
    difficulty: 'foundation',
    curriculumStage: 'foundation',
    stageOrder: 1,
    title: 'Level, zero, and dynamic response',
    competencyIds: ['signal-validation', 'critical-care-safety'],
    pathwayIds: ['shock-and-perfusion'],
    prerequisiteActivityIds: [],
    evidenceIds: [
      ...hemodynamicsEvidence,
      'monitor-workflow-supplied',
      'arterial-pressure-five-step-2020',
    ],
  },
  {
    sourceId: 'waveform-interpretation',
    difficulty: 'intermediate',
    curriculumStage: 'mechanism',
    stageOrder: 1,
    title: 'Interpret normal and abnormal waveforms',
    competencyIds: ['signal-validation', 'hemodynamic-reassessment'],
    pathwayIds: ['shock-and-perfusion', 'cardiogenic-and-rv-shock'],
    prerequisiteActivityIds: ['hemodynamics:learn:pressure-system'],
    evidenceIds: [...hemodynamicsEvidence, 'clinical-hemodynamics-waveforms'],
    estimatedMinutes: 18,
  },
  {
    sourceId: 'catheter-advancement',
    difficulty: 'foundation',
    curriculumStage: 'foundation',
    stageOrder: 2,
    title: 'Advance the PAC by waveform',
    competencyIds: ['signal-validation', 'critical-care-safety'],
    pathwayIds: ['shock-and-perfusion'],
    prerequisiteActivityIds: ['hemodynamics:learn:waveform-interpretation'],
    evidenceIds: [...hemodynamicsEvidence, 'monitor-workflow-supplied'],
    estimatedMinutes: 15,
  },
  {
    sourceId: 'pawp-capture',
    difficulty: 'intermediate',
    curriculumStage: 'mechanism',
    stageOrder: 2,
    title: 'Brief end-expiratory PAWP capture',
    competencyIds: ['signal-validation', 'critical-care-safety'],
    pathwayIds: ['shock-and-perfusion'],
    prerequisiteActivityIds: ['hemodynamics:learn:catheter-advancement'],
    evidenceIds: [...hemodynamicsEvidence, 'monitor-workflow-supplied'],
    estimatedMinutes: 15,
  },
  {
    sourceId: 'thermodilution-series',
    difficulty: 'intermediate',
    curriculumStage: 'mechanism',
    stageOrder: 3,
    title: 'Cardiac output: thermodilution and Fick',
    competencyIds: ['signal-validation', 'hemodynamic-reassessment'],
    pathwayIds: ['shock-and-perfusion'],
    prerequisiteActivityIds: ['hemodynamics:learn:pawp-capture'],
    evidenceIds: hemodynamicsEvidence,
    estimatedMinutes: 18,
  },
  {
    sourceId: 'derived-hemodynamics',
    difficulty: 'intermediate',
    curriculumStage: 'application',
    stageOrder: 1,
    title: 'Derived hemodynamics and validity',
    competencyIds: ['hemodynamic-reassessment', 'critical-care-safety'],
    pathwayIds: ['shock-and-perfusion', 'cardiogenic-and-rv-shock'],
    prerequisiteActivityIds: ['hemodynamics:learn:thermodilution-series'],
    evidenceIds: hemodynamicsEvidence,
    estimatedMinutes: 15,
  },
  {
    sourceId: 'pac-signal-validation',
    difficulty: 'advanced',
    curriculumStage: 'integration',
    stageOrder: 1,
    title: 'PAC signal-validation capstone',
    description:
      'Integrate setup, catheter position, curve quality, derived values, and reassessment in one discordant-signal case.',
    competencyIds: ['signal-validation', 'hemodynamic-reassessment', 'critical-care-safety'],
    pathwayIds: ['shock-and-perfusion'],
    prerequisiteActivityIds: [
      'hemodynamics:learn:catheter-advancement',
      'hemodynamics:learn:pressure-system',
      'hemodynamics:learn:waveform-interpretation',
      'hemodynamics:learn:pawp-capture',
      'hemodynamics:learn:thermodilution-series',
      'hemodynamics:learn:derived-hemodynamics',
    ],
    evidenceIds: [
      ...hemodynamicsEvidence,
      'monitor-workflow-supplied',
      'arterial-pressure-five-step-2020',
    ],
    estimatedMinutes: 20,
    creditPolicy: 'competency-eligible',
    completionEvidenceAuthority: 'validated-interaction',
  },
]

const hemodynamicsCaseSeeds: readonly ActivitySeed[] = [
  ['HD-01', 'A narrow pulse pressure after volume loss', ['shock-and-perfusion']],
  ['HD-02', 'Warm shock with a low diastolic pressure', ['shock-and-perfusion']],
  [
    'HD-03',
    'Low flow with pulmonary congestion',
    ['shock-and-perfusion', 'cardiogenic-and-rv-shock'],
  ],
  ['HD-04', 'Abrupt RV pressure overload', ['shock-and-perfusion', 'cardiogenic-and-rv-shock']],
  [
    'HD-05',
    'Decompensated pre-capillary PH with RV failure',
    ['shock-and-perfusion', 'cardiogenic-and-rv-shock'],
  ],
  [
    'HD-06',
    'Post-capillary PH with biventricular congestion',
    ['shock-and-perfusion', 'cardiogenic-and-rv-shock'],
  ],
  [
    'HD-07',
    'Pressure equalization with a falling pulse pressure',
    ['shock-and-perfusion', 'cardiogenic-and-rv-shock'],
  ],
  ['HD-08', 'The numbers do not fit the patient', ['shock-and-perfusion']],
].map(([sourceId, title, pathwayIds], index) => ({
  sourceId: sourceId as string,
  title: title as string,
  // HD-08 asks the learner to distrust the measurement itself while a phenotype is still open.
  difficulty: (sourceId === 'HD-08' ? 'advanced' : 'intermediate') as CriticalCareDifficulty,
  curriculumStage: 'application' as const,
  stageOrder: index + 2,
  competencyIds:
    sourceId === 'HD-08'
      ? ['signal-validation', 'hemodynamic-reassessment', 'critical-care-safety']
      : [
          'shock-mechanism',
          'hemodynamic-prioritization',
          'hemodynamic-reassessment',
          'critical-care-safety',
        ],
  pathwayIds: pathwayIds as readonly string[],
  evidenceIds:
    sourceId === 'HD-08'
      ? [...hemodynamicsEvidence, 'monitor-workflow-supplied']
      : hemodynamicsEvidence,
}))

const hemodynamicsAssessSeeds: readonly ActivitySeed[] = [
  {
    sourceId: 'masked-seeded',
    title: 'HD-07 pressure-equalization challenge',
    description:
      'A harder HD-07 hemodynamics case with less help. Teaching feedback comes at the end so you can work through it uninterrupted.',
    competencyIds: [
      'signal-validation',
      'shock-mechanism',
      'hemodynamic-prioritization',
      'hemodynamic-reassessment',
      'critical-care-safety',
    ],
    pathwayIds: ['shock-and-perfusion', 'cardiogenic-and-rv-shock'],
    prerequisiteActivityIds: [
      'hemodynamics:learn:pac-signal-validation',
      ...hemodynamicsCaseSeeds.map((seed) => `hemodynamics:practice:${seed.sourceId}`),
    ],
    evidenceIds: hemodynamicsEvidence,
    estimatedMinutes: 25,
    difficulty: 'advanced',
    curriculumStage: 'integration',
    stageOrder: 2,
  },
]

const ventilationCaseSeeds: readonly ActivitySeed[] = [
  [
    'MV-01',
    'ARDS hypoxemia: recruitment versus overdistension',
    ['ventilator-setup', 'ventilator-mechanics', 'ventilator-safety'],
  ],
  [
    'MV-02',
    'Volume-control flow starvation during high respiratory drive',
    ['ventilator-waveform-interpretation', 'ventilator-troubleshooting', 'ventilator-safety'],
  ],
  [
    'MV-03',
    'Double triggering and breath stacking in ARDS',
    ['ventilator-waveform-interpretation', 'ventilator-troubleshooting', 'ventilator-safety'],
  ],
  [
    'MV-04',
    'Reverse triggering in a deeply sedated patient',
    ['ventilator-waveform-interpretation', 'ventilator-troubleshooting', 'ventilator-safety'],
  ],
  [
    'MV-05',
    'COPD: dynamic hyperinflation with ineffective efforts',
    [
      'ventilator-mechanics',
      'ventilator-waveform-interpretation',
      'ventilator-troubleshooting',
      'ventilator-safety',
    ],
  ],
  [
    'MV-06',
    'Severe asthma: auto-PEEP with obstructive shock',
    [
      'ventilator-mechanics',
      'ventilator-waveform-interpretation',
      'ventilator-troubleshooting',
      'ventilator-safety',
    ],
  ],
  [
    'MV-07',
    'Neuromuscular weakness with trigger delay and missed efforts',
    ['ventilator-waveform-interpretation', 'ventilator-troubleshooting', 'ventilator-safety'],
  ],
  [
    'MV-08',
    'Autotriggering from condensate or circuit leak',
    ['ventilator-waveform-interpretation', 'ventilator-troubleshooting', 'ventilator-safety'],
  ],
  [
    'MV-09',
    'Premature cycling on pressure support',
    ['ventilator-waveform-interpretation', 'ventilator-troubleshooting'],
  ],
  [
    'MV-10',
    'Delayed cycling on pressure support in COPD',
    ['ventilator-waveform-interpretation', 'ventilator-troubleshooting'],
  ],
  [
    'MV-11',
    'Rise-time mismatch: too slow, then too fast',
    ['ventilator-waveform-interpretation', 'ventilator-troubleshooting'],
  ],
  [
    'MV-12',
    'Over-assistance with low drive and periodic breathing',
    ['ventilator-waveform-interpretation', 'ventilator-troubleshooting', 'ventilator-safety'],
  ],
  [
    'MV-13',
    'High airway pressure: secretions, tube obstruction, or bronchospasm',
    ['ventilator-mechanics', 'ventilator-troubleshooting', 'ventilator-safety'],
  ],
  [
    'MV-14',
    'Sudden loss of compliance: tension pneumothorax',
    ['ventilator-mechanics', 'ventilator-troubleshooting', 'ventilator-safety'],
  ],
  [
    'MV-15',
    'Air hunger, anxiety, pain, and delirium in an awake ventilated patient',
    ['ventilator-troubleshooting', 'ventilator-safety'],
  ],
].map(([sourceId, title, competencyIds], index) => ({
  sourceId: sourceId as string,
  title: title as string,
  // Advanced where the case forces two competing mechanisms to be held at once (recruitment
  // versus overdistension, patient effort versus machine timing, hyperinflation versus shock).
  difficulty: (['MV-01', 'MV-04', 'MV-05', 'MV-06', 'MV-12', 'MV-14'].includes(sourceId as string)
    ? 'advanced'
    : 'intermediate') as CriticalCareDifficulty,
  curriculumStage: 'application' as const,
  stageOrder: index + 2,
  competencyIds: competencyIds as readonly string[],
  pathwayIds: ['acute-respiratory-failure'],
  evidenceIds: ['mechanical-ventilation-source-boundary'],
}))

/**
 * Ordered per WP10 §5.4: mechanics and a repeatable waveform-reading sequence are the causal
 * model; modes are device-facing and follow the physiology they operate on.
 */
const ventilationLearnSeeds: readonly ActivitySeed[] = [
  {
    // Opens the pathway: what the three traces are, and how a volume-targeted breath differs from
    // a pressure-targeted one. Everything after this assumes the learner can read a breath.
    sourceId: 'waveform-anatomy',
    title: 'Waveform anatomy: three traces, one breath',
    competencyIds: ['ventilator-waveform-interpretation'],
    difficulty: 'foundation' as const,
    curriculumStage: 'orientation' as const,
    stageOrder: 1,
  },
  {
    sourceId: 'mechanics-load-and-pressure',
    title: 'Mechanics: load, pressure, and volume',
    competencyIds: ['ventilator-mechanics'],
    difficulty: 'foundation' as const,
    curriculumStage: 'foundation' as const,
    stageOrder: 1,
  },
  {
    sourceId: 'waveform-reading-sequence',
    title: 'Waveforms: a repeatable reading sequence',
    competencyIds: ['ventilator-waveform-interpretation'],
    difficulty: 'foundation' as const,
    curriculumStage: 'foundation' as const,
    stageOrder: 2,
  },
  {
    sourceId: 'modes-and-breath-delivery',
    title: 'Modes: trigger, target, cycle, and expiration',
    competencyIds: ['ventilator-setup'],
    difficulty: 'foundation' as const,
    curriculumStage: 'orientation' as const,
    stageOrder: 2,
  },
  {
    sourceId: 'triggering-and-cycling',
    title: 'Triggering and cycling',
    competencyIds: ['ventilator-waveform-interpretation', 'ventilator-troubleshooting'],
    difficulty: 'intermediate' as const,
    curriculumStage: 'mechanism' as const,
    stageOrder: 1,
  },
  {
    sourceId: 'dyssynchrony-mechanisms',
    title: 'Dyssynchrony: mechanism before label',
    competencyIds: ['ventilator-waveform-interpretation', 'ventilator-troubleshooting'],
    difficulty: 'intermediate' as const,
    curriculumStage: 'mechanism' as const,
    stageOrder: 2,
  },
  {
    sourceId: 'oxygenation-response',
    title: 'Oxygenation: action and consequence',
    competencyIds: ['ventilator-setup', 'ventilator-safety'],
    difficulty: 'intermediate' as const,
    curriculumStage: 'mechanism' as const,
    stageOrder: 3,
  },
  {
    sourceId: 'ventilation-and-co2',
    title: 'Ventilation: measured response over time',
    competencyIds: ['ventilator-mechanics', 'ventilator-safety'],
    difficulty: 'intermediate' as const,
    curriculumStage: 'mechanism' as const,
    stageOrder: 4,
  },
  {
    sourceId: 'safety-reassessment-and-human-factors',
    title: 'Safety, reassessment, and the whole patient',
    competencyIds: ['ventilator-troubleshooting', 'ventilator-safety'],
    difficulty: 'intermediate' as const,
    curriculumStage: 'application' as const,
    stageOrder: 1,
  },
  {
    sourceId: 'high-peak-pressure-integration',
    title: 'High peak pressure: resistance, compliance, auto-PEEP, or patient effort?',
    description:
      'Separate the four mechanisms behind one high-pressure alarm using the peak-to-plateau split, the expiratory limb, and the patient.',
    competencyIds: [
      'ventilator-mechanics',
      'ventilator-waveform-interpretation',
      'ventilator-troubleshooting',
      'ventilator-safety',
    ],
    difficulty: 'advanced' as const,
    curriculumStage: 'integration' as const,
    stageOrder: 1,
    estimatedMinutes: 14,
    prerequisiteActivityIds: [
      'ventilation:learn:waveform-anatomy',
      'ventilation:learn:mechanics-load-and-pressure',
      'ventilation:learn:waveform-reading-sequence',
      'ventilation:learn:modes-and-breath-delivery',
      'ventilation:learn:triggering-and-cycling',
      'ventilation:learn:dyssynchrony-mechanisms',
      'ventilation:learn:oxygenation-response',
      'ventilation:learn:ventilation-and-co2',
      'ventilation:learn:safety-reassessment-and-human-factors',
    ],
  },
].map((seed) => ({
  estimatedMinutes: 8,
  ...seed,
  pathwayIds: ['acute-respiratory-failure'],
  evidenceIds: ['mechanical-ventilation-source-boundary'],
  reviewStatus: 'draft' as const,
  creditPolicy: 'non-credit' as const,
  completionEvidenceAuthority: 'none' as const,
}))

const ventilationAssessSeeds: readonly ActivitySeed[] = [
  {
    sourceId: 'masked-seeded',
    title: 'Seeded ventilation challenge',
    description:
      'A harder locally varied ventilation case with less help. Teaching feedback comes at the end so you can work through it uninterrupted.',
    competencyIds: [
      'ventilator-setup',
      'ventilator-mechanics',
      'ventilator-waveform-interpretation',
      'ventilator-troubleshooting',
      'ventilator-safety',
    ],
    pathwayIds: ['acute-respiratory-failure'],
    evidenceIds: ['mechanical-ventilation-source-boundary'],
    estimatedMinutes: 25,
    difficulty: 'advanced',
    curriculumStage: 'integration',
    stageOrder: 2,
  },
]

/**
 * Two shared foundation lessons, then three device pairs. Within each pair the first lesson
 * isolates the mechanism the device manipulates and the second applies it at the bedside.
 */
const mcsLessonSeeds: readonly ActivitySeed[] = (
  [
    ['mcs-foundations-signals', 'Validate the signal before the device', 'foundation', 1],
    ['mcs-foundations-mechanisms', 'Unloading, augmentation, and total flow', 'foundation', 2],
    ['iabp-timing-triggering', 'IABP timing and triggering', 'mechanism', 1],
    ['iabp-efficacy-limits', 'IABP efficacy, limits, and escalation', 'application', 1],
    ['impella-unloading-placement', 'Impella unloading and placement signals', 'mechanism', 2],
    [
      'impella-suction-purge-rv',
      'Impella suction, purge, hemolysis, and RV delivery',
      'application',
      2,
    ],
    ['lvad-parameters-assessment', 'Durable LVAD parameters and ICU review', 'mechanism', 3],
    [
      'lvad-alarms-emergencies',
      'Durable LVAD low flow, high power, and power emergencies',
      'application',
      3,
    ],
    [
      'mcs-device-selection-integration',
      'Choosing among IABP, Impella, and durable LVAD for a shock phenotype',
      'integration',
      1,
    ],
  ] as const
).map(([sourceId, title, curriculumStage, stageOrder]) => ({
  sourceId,
  title,
  difficulty: (curriculumStage === 'foundation'
    ? 'foundation'
    : curriculumStage === 'integration'
      ? 'advanced'
      : 'intermediate') as CriticalCareDifficulty,
  curriculumStage,
  stageOrder,
  estimatedMinutes: curriculumStage === 'integration' ? 18 : 12,
  ...(curriculumStage === 'integration'
    ? {
        description:
          'Compare counterpulsation, direct LV unloading, and durable continuous flow against one shock phenotype, and let the limiting problem select the mechanism.',
        prerequisiteActivityIds: [
          'mcs:learn:mcs-foundations-signals',
          'mcs:learn:mcs-foundations-mechanisms',
          'mcs:learn:iabp-timing-triggering',
          'mcs:learn:iabp-efficacy-limits',
          'mcs:learn:impella-unloading-placement',
          'mcs:learn:impella-suction-purge-rv',
          'mcs:learn:lvad-parameters-assessment',
          'mcs:learn:lvad-alarms-emergencies',
        ],
      }
    : {}),
  competencyIds: ['mcs-device-management', 'mcs-patient-assessment', 'mcs-safety'],
  pathwayIds: ['cardiogenic-and-rv-shock', 'shock-and-perfusion'],
  evidenceIds: ['mcs-device-source-registry'],
}))

const mcsPracticeSeeds: readonly ActivitySeed[] = [
  ['IABP-01', 'The balloon that stays inflated too long'],
  ['IABP-02', 'Irregular rhythm, unreliable trigger'],
  ['IABP-03', 'Timing aligned, circulation still inadequate'],
  ['IMP-01', 'High support, underfilled LV'],
  ['IMP-02', 'Malposition with blood-trauma risk'],
  ['IMP-03', 'Low flow across high afterload'],
  ['LVAD-01', 'Low flow with severe hypertension'],
  ['LVAD-02', 'Low flow with a failing right ventricle'],
  ['LVAD-03', 'Controller alarm after power interruption'],
].map(([sourceId, title], index) => ({
  sourceId,
  title,
  // Advanced where the device is doing what it was asked to and perfusion is still inadequate.
  difficulty: (['IABP-03', 'IMP-03', 'LVAD-02'].includes(sourceId)
    ? 'advanced'
    : 'intermediate') as CriticalCareDifficulty,
  curriculumStage: 'application' as const,
  stageOrder: index + 4,
  competencyIds: ['mcs-device-management', 'mcs-patient-assessment', 'mcs-safety'],
  pathwayIds: ['cardiogenic-and-rv-shock', 'shock-and-perfusion'],
  evidenceIds: ['mcs-device-source-registry', 'mcs-educational-model-v1'],
}))

const mcsCapstonePrerequisites: Readonly<Record<string, readonly string[]>> = {
  'CAP-IABP-01': [
    'mcs:learn:mcs-foundations-signals',
    'mcs:learn:mcs-foundations-mechanisms',
    'mcs:learn:iabp-timing-triggering',
    'mcs:learn:iabp-efficacy-limits',
  ],
  'CAP-IMP-01': [
    'mcs:learn:mcs-foundations-signals',
    'mcs:learn:mcs-foundations-mechanisms',
    'mcs:learn:impella-unloading-placement',
    'mcs:learn:impella-suction-purge-rv',
  ],
  'CAP-LVAD-01': [
    'mcs:learn:mcs-foundations-signals',
    'mcs:learn:mcs-foundations-mechanisms',
    'mcs:learn:lvad-parameters-assessment',
    'mcs:learn:lvad-alarms-emergencies',
  ],
}

const mcsAssessSeeds: readonly ActivitySeed[] = [
  ['CAP-IABP-01', 'Unseen IABP counterpulsation capstone'],
  ['CAP-IMP-01', 'Unseen Impella effective-flow capstone'],
  ['CAP-LVAD-01', 'Unseen durable-LVAD constrained-filling capstone'],
].map(([sourceId, title], index) => ({
  sourceId,
  title,
  difficulty: 'advanced' as const,
  curriculumStage: 'integration' as const,
  // stageOrder 1 is reserved for the cross-device integration lesson (WP10 §5.3).
  stageOrder: index + 2,
  competencyIds: ['mcs-device-management', 'mcs-patient-assessment', 'mcs-safety'],
  pathwayIds: ['cardiogenic-and-rv-shock', 'shock-and-perfusion'],
  prerequisiteActivityIds: mcsCapstonePrerequisites[sourceId] ?? [],
  evidenceIds: ['mcs-device-source-registry', 'mcs-educational-model-v1'],
}))

/**
 * Every existing ECMO Learn lesson wraps a failure-mode drill on the live circuit, so they stage
 * as `application`; the two console tours are `orientation`. The shared physiology foundation
 * that should precede them is authored in WP10 §5.1.
 */
const ecmoLessonSeeds: readonly ActivitySeed[] = (
  [
    // The physiology foundation authored in WP10 §5.1. These precede the console tour: a learner
    // previously met the CARDIOHELP screen before learning what a membrane lung does. The four
    // shared sections carry track 'vv' only so they have one canonical deep link; both track
    // pathways reference the same activity.
    [
      'why-extracorporeal-support',
      'Why extracorporeal support: content, delivery, consumption, and the failure it addresses',
      'vv',
      'orientation',
      1,
      'foundation',
      12,
    ],
    [
      'circuit-flow-path',
      'Drainage → pump → membrane lung → return: the circuit as a flow path',
      'vv',
      'foundation',
      1,
      'foundation',
      12,
    ],
    [
      'pump-and-pressure-zones',
      'Centrifugal pump preload and afterload, and the circuit pressure zones',
      'vv',
      'foundation',
      2,
      'foundation',
      12,
    ],
    [
      'blood-flow-versus-sweep',
      'Blood flow versus sweep: oxygen versus CO₂ transfer',
      'vv',
      'mechanism',
      1,
      'intermediate',
      12,
    ],
    [
      'vv-series-physiology',
      'VV series physiology, effective flow, and recirculation',
      'vv',
      'mechanism',
      2,
      'intermediate',
      14,
    ],
    [
      'vv-normal-state',
      'The normal VV patient–circuit state',
      'vv',
      'foundation',
      3,
      'foundation',
      12,
    ],
    [
      'va-parallel-physiology',
      'VA parallel circulation, LV loading, and differential oxygenation',
      'va',
      'mechanism',
      3,
      'intermediate',
      14,
    ],
    [
      'va-normal-state',
      'The normal VA patient–circuit state',
      'va',
      'foundation',
      4,
      'foundation',
      12,
    ],
    [
      'startup-sensor-orientation',
      'Console, circuit, and external-control orientation',
      'vv',
      'orientation',
      2,
      'foundation',
    ],
    [
      'preload-drainage-collapse',
      'Preload-limited flow and drainage collapse',
      'vv',
      'application',
      1,
      'intermediate',
    ],
    [
      'afterload-return-obstruction',
      'Return-side obstruction',
      'vv',
      'application',
      2,
      'intermediate',
    ],
    [
      'afterload-oxygenator-resistance',
      'Oxygenator resistance or dysfunction pattern',
      'vv',
      'application',
      3,
      'intermediate',
    ],
    [
      'vv-recirculation',
      'VV recirculation despite high displayed flow',
      'vv',
      'application',
      4,
      'advanced',
    ],
    ['acute-hypercapnia', 'Acute hypercapnic acidemia', 'vv', 'application', 5, 'intermediate'],
    [
      'compensated-hypercapnia',
      'Compensated hypercapnia during maintenance',
      'vv',
      'application',
      6,
      'intermediate',
    ],
    [
      'gas-source-interruption',
      'Gas-source interruption with preserved blood flow',
      'vv',
      'application',
      7,
      'intermediate',
    ],
    [
      'arterial-bubble-stop',
      'Arterial bubble intervention and cause-before-reset',
      'vv',
      'application',
      8,
      'advanced',
    ],
    [
      'transport-power-loss',
      'Transport power loss and backup readiness',
      'vv',
      'application',
      9,
      'intermediate',
    ],
    [
      'va-startup-sensor-orientation',
      'VA console, femoral circuit, and independent-monitor orientation',
      'va',
      'orientation',
      3,
      'foundation',
    ],
    [
      'va-preload-drainage-collapse',
      'VA preload-limited drainage and falling systemic support',
      'va',
      'application',
      10,
      'intermediate',
    ],
    [
      'va-afterload-arterial-return-obstruction',
      'VA arterial-return resistance',
      'va',
      'application',
      11,
      'intermediate',
    ],
    [
      'va-afterload-oxygenator-resistance',
      'VA oxygenator resistance pattern',
      'va',
      'application',
      12,
      'intermediate',
    ],
    [
      'va-differential-hypoxemia',
      'Peripheral VA differential upper-body oxygenation',
      'va',
      'application',
      13,
      'advanced',
    ],
    ['va-lv-loading', 'VA LV-loading recognition', 'va', 'application', 14, 'advanced'],
    [
      'va-acute-hypercapnia',
      'VA phase-aware sweep adjustment',
      'va',
      'application',
      15,
      'intermediate',
    ],
    [
      'va-gas-source-interruption',
      'VA gas-source interruption with continued arterial flow',
      'va',
      'application',
      16,
      'intermediate',
    ],
    [
      'va-arterial-bubble-stop',
      'VA arterial-return bubble and cause-before-reset',
      'va',
      'application',
      17,
      'advanced',
    ],
    [
      'va-transport-power-loss',
      'VA transport power loss and circulatory backup',
      'va',
      'application',
      18,
      'intermediate',
    ],
    [
      'vv-integration-capstone',
      'VV integration: displayed flow unchanged, patient deteriorating',
      'vv',
      'integration',
      1,
      'advanced',
      18,
    ],
    [
      'va-integration-capstone',
      'VA integration: displayed flow unchanged, patient deteriorating',
      'va',
      'integration',
      2,
      'advanced',
      18,
    ],
  ] as const
).map(([sourceId, title, track, curriculumStage, stageOrder, difficulty, estimatedMinutes]) => ({
  sourceId,
  title,
  track,
  difficulty,
  curriculumStage,
  stageOrder,
  ...(estimatedMinutes === undefined ? {} : { estimatedMinutes }),
  competencyIds: [
    'ecmo-circuit-assessment',
    'ecmo-device-management',
    'ecmo-patient-management',
    'ecmo-safety',
  ],
  pathwayIds:
    track === 'vv'
      ? ['acute-respiratory-failure', 'multiorgan-critical-illness']
      : ['cardiogenic-and-rv-shock', 'shock-and-perfusion', 'multiorgan-critical-illness'],
  evidenceIds: ['cardiohelp-i-us-2025'],
}))

const ecmoPracticeSeeds: readonly ActivitySeed[] = [
  ['clinical-vv-initiation-ards', 'Initiate VV ECMO for refractory severe ARDS', 'vv'],
  ['clinical-vv-occult-hemorrhage', 'Occult hemorrhage with drainage insufficiency', 'vv'],
  ['clinical-vv-tension-pneumothorax', 'Tension pneumothorax causing obstructive low flow', 'vv'],
  ['clinical-vv-recirculation-migration', 'Refractory hypoxemia from VV recirculation', 'vv'],
  ['clinical-vv-gas-disconnection', 'Sweep-gas disconnection with rapid hypercapnia', 'vv'],
  ['clinical-vv-oxygenator-thrombosis', 'Oxygenator thrombosis with worsening gas transfer', 'vv'],
  ['clinical-vv-circuit-air-embolism', 'Air entrainment with emergency circuit isolation', 'vv'],
  [
    'va-clinical-initiation-shock',
    'Initiate peripheral VA ECMO for refractory cardiogenic shock',
    'va',
  ],
  ['va-clinical-differential-hypoxemia', 'Differential hypoxemia during cardiac recovery', 'va'],
  ['va-clinical-tamponade', 'Postcardiotomy tamponade with low VA flow', 'va'],
  ['va-clinical-vasoplegia', 'Recovered cardiac function with persistent vasoplegia', 'va'],
  ['va-clinical-limb-ischemia', 'Cannulated-limb ischemia from distal-perfusion failure', 'va'],
  ['va-clinical-oxygenator-thrombosis', 'VA oxygenator thrombosis with falling support', 'va'],
  ['va-clinical-circuit-air-embolism', 'VA circuit air with emergency arterial isolation', 'va'],
].map(([sourceId, title, track], index) => ({
  sourceId,
  title,
  track: track as EcmoTrack,
  // Advanced where the displayed circuit numbers stay reassuring while the patient deteriorates.
  difficulty: ([
    'clinical-vv-recirculation-migration',
    'clinical-vv-circuit-air-embolism',
    'va-clinical-differential-hypoxemia',
    'va-clinical-vasoplegia',
    'va-clinical-circuit-air-embolism',
  ].includes(sourceId)
    ? 'advanced'
    : 'intermediate') as CriticalCareDifficulty,
  curriculumStage: 'application' as const,
  stageOrder: index + 19,
  competencyIds: [
    'ecmo-circuit-assessment',
    'ecmo-device-management',
    'ecmo-patient-management',
    'ecmo-safety',
  ],
  pathwayIds:
    track === 'vv'
      ? ['acute-respiratory-failure', 'multiorgan-critical-illness']
      : ['cardiogenic-and-rv-shock', 'shock-and-perfusion', 'multiorgan-critical-illness'],
  evidenceIds: ['cardiohelp-i-us-2025', 'attached-ecmo-case-curriculum'],
}))

const ecmoLearnActivityIdsByTrack: Readonly<Record<EcmoTrack, readonly string[]>> = {
  vv: ecmoLessonSeeds
    .filter((lesson) => lesson.track === 'vv')
    .map((lesson) => `ecmo:learn:${lesson.sourceId}`),
  va: ecmoLessonSeeds
    .filter((lesson) => lesson.track === 'va')
    .map((lesson) => `ecmo:learn:${lesson.sourceId}`),
}

const ecmoAssessSeeds: readonly ActivitySeed[] = [
  {
    sourceId: 'vv-off-sweep-capstone',
    title: 'Unseen capstone: VV off-sweep trial',
    track: 'vv',
    difficulty: 'advanced',
    curriculumStage: 'integration',
    // stageOrder 1 and 2 are reserved for the per-track integration lessons (WP10 §5.1).
    stageOrder: 3,
    competencyIds: ['ecmo-circuit-assessment', 'ecmo-device-management', 'ecmo-safety'],
    pathwayIds: ['acute-respiratory-failure', 'multiorgan-critical-illness'],
    prerequisiteActivityIds: ecmoLearnActivityIdsByTrack.vv,
    evidenceIds: ['cardiohelp-i-us-2025'],
  },
  {
    sourceId: 'va-mixed-circulation-capstone',
    title: 'Unseen capstone: VA mixed-circulation mismatch',
    track: 'va',
    difficulty: 'advanced',
    curriculumStage: 'integration',
    stageOrder: 4,
    competencyIds: [
      'ecmo-circuit-assessment',
      'ecmo-device-management',
      'ecmo-patient-management',
      'ecmo-safety',
    ],
    pathwayIds: ['cardiogenic-and-rv-shock', 'shock-and-perfusion', 'multiorgan-critical-illness'],
    prerequisiteActivityIds: ecmoLearnActivityIdsByTrack.va,
    evidenceIds: ['cardiohelp-i-us-2025'],
  },
]

/**
 * Ordered per WP10 §5.2. Circuit anatomy moves ahead of transport and prescription because both
 * of those assume the blood path: a learner should be shown where the filter is before being
 * asked to reason about diffusion versus convection across it.
 *
 * C2 §4 — pressure localization now precedes citrate, so `crrt-alarms-troubleshooting` and
 * `crrt-anticoagulation` swap both their array position and their `application` ordinal. Neither
 * could stay: `validateCriticalCareLearningPathways` requires the pathway to visit a stage in
 * ascending `stageOrder` (the catalog throws at import otherwise), and
 * `getCriticalCareRecommendations` breaks ties on catalog index, so the seed array is what the
 * shared hub actually reads. This array therefore stays in the pathway's order, exactly as the
 * hemodynamics seeds do. Only these two CRRT entries move; ids, routes, query keys, storage,
 * progress payloads, scoring, prerequisites, content version, and publication status are
 * untouched, and no other module's entries are reordered.
 * `src/features/baxter-crrt/__tests__/pathwaySequencing.test.ts` pins the reason.
 */
const crrtLessonSeeds: readonly ActivitySeed[] = (
  [
    [
      'crrt-indications-modality',
      'CRRT indications and modality selection',
      ['crrt-prescription'],
      'orientation',
      1,
      'foundation',
      12,
    ],
    [
      'crrt-circuit-pressures',
      'Circuit anatomy and pressure localization',
      ['crrt-pressure-localization'],
      'foundation',
      1,
      'foundation',
      14,
    ],
    [
      'crrt-solute-transport',
      'Solute and water transport',
      ['crrt-prescription'],
      'foundation',
      2,
      'foundation',
      12,
    ],
    [
      'crrt-prescription-dosing',
      'Prescription and delivered dose',
      ['crrt-prescription'],
      'mechanism',
      1,
      'intermediate',
      15,
    ],
    [
      'crrt-alarms-troubleshooting',
      'Alarms and cause-first troubleshooting',
      ['crrt-device-management', 'crrt-safety'],
      'application',
      1,
      'intermediate',
      12,
    ],
    [
      'crrt-anticoagulation',
      'Anticoagulation and citrate safety',
      ['crrt-safety'],
      'application',
      2,
      'intermediate',
      12,
    ],
    [
      'crrt-fluid-liberation',
      'Fluid management and liberation',
      ['crrt-fluid-management'],
      'application',
      3,
      'intermediate',
      12,
    ],
    [
      'crrt-pressure-profile-integration',
      'Read the pressure profile: where in the circuit is the problem?',
      ['crrt-pressure-localization', 'crrt-device-management', 'crrt-fluid-management'],
      'integration',
      1,
      'advanced',
      18,
    ],
  ] as const
).map(
  ([
    sourceId,
    title,
    competencyIds,
    curriculumStage,
    stageOrder,
    difficulty,
    estimatedMinutes,
  ]) => ({
    sourceId,
    title,
    difficulty,
    curriculumStage,
    stageOrder,
    estimatedMinutes,
    ...(sourceId === 'crrt-pressure-profile-integration'
      ? {
          description:
            'Localize a deteriorating run from its pressure profile, then reconcile the prescription, anticoagulation plan, and fluid ledger before deciding what to change.',
          prerequisiteActivityIds: [
            'crrt:learn:crrt-indications-modality',
            'crrt:learn:crrt-circuit-pressures',
            'crrt:learn:crrt-solute-transport',
            'crrt:learn:crrt-prescription-dosing',
            'crrt:learn:crrt-alarms-troubleshooting',
            'crrt:learn:crrt-anticoagulation',
            'crrt:learn:crrt-fluid-liberation',
          ],
        }
      : {}),
    competencyIds: [...competencyIds, 'critical-care-safety'],
    pathwayIds: ['renal-support-and-fluid-management', 'multiorgan-critical-illness'],
    evidenceIds: ['REVIEW-CKRT-CORE-2025', 'DEV-PM-009'],
  }),
)

const crrtCaseSeeds: readonly ActivitySeed[] = [
  ['CRRT-01', 'Set CRRT priorities in septic shock, AKI, and fluid accumulation', 1],
  ['CRRT-02', 'Prioritize hyperkalemia and acidemia during hemodynamic instability', 1],
  ['CRRT-03', 'Controlled solute trajectory in acute brain or liver failure', 1],
  ['CRRT-04', 'Build a CVVHD prescription and distinguish prescribed from delivered therapy', 2],
  ['CRRT-05', 'Compare pre- and post-filter replacement flow in CVVH', 2],
  ['CRRT-06', 'Compare prescribed and delivered CVVHDF during an interruption', 2],
  ['CRRT-08', 'Verify the set, bags, solutions, lines, prime, and prescription', 3],
  ['CRRT-07', 'Verify weight and hematocrit entries before treatment', 3],
  ['CRRT-09', 'Anticoagulation protocol selection and verification', 3],
  ['CRRT-11', 'Respond to hemodynamic intolerance during fluid removal', 4],
  ['CRRT-10', 'Reconcile machine PFR with whole-patient fluid balance', 4],
  ['CRRT-12', 'Electrolyte, temperature, medication, and nutrition consequences', 4],
  ['CRRT-13', 'Localize and resolve a worsening access-pressure pattern', 5],
  ['CRRT-15', 'Localize rising filter and effluent pressure trends', 5],
  ['CRRT-14', 'High return pressure versus return disconnection', 5],
  ['CRRT-17', 'Recognize and escalate a citrate-calcium safety concern', 6],
  ['CRRT-18', 'Renal recovery, discontinuation, and transition', 6],
].map(([sourceId, title, station], index) => {
  const competencyIds =
    station === 5
      ? ['crrt-pressure-localization', 'crrt-device-management', 'crrt-safety']
      : station === 4
        ? ['crrt-prescription', 'crrt-fluid-management', 'crrt-safety']
        : station === 6
          ? ['crrt-fluid-management', 'crrt-safety']
          : ['crrt-prescription', 'crrt-device-management', 'crrt-safety']
  return {
    sourceId: sourceId as string,
    title: title as string,
    // Pressure localization (station 5) and the citrate-calcium escalation ask the learner to
    // separate location from value, so they carry the module's advanced calls.
    difficulty: (station === 5 || sourceId === 'CRRT-17'
      ? 'advanced'
      : 'intermediate') as CriticalCareDifficulty,
    curriculumStage: 'application' as const,
    stageOrder: index + 4,
    competencyIds,
    pathwayIds: ['renal-support-and-fluid-management', 'multiorgan-critical-illness'],
    evidenceIds: ['REVIEW-CKRT-CORE-2025', 'DEV-PM-009'],
  }
})

const crrtCoreCaseIds = [
  'CRRT-01',
  'CRRT-02',
  'CRRT-04',
  'CRRT-05',
  'CRRT-08',
  'CRRT-11',
  'CRRT-13',
  'CRRT-15',
  'CRRT-17',
  'CRRT-18',
] as const

const crrtAssessSeeds: readonly ActivitySeed[] = [
  {
    sourceId: 'MASTERY-PRISMAX-01',
    title: 'PrisMax troubleshooting challenge',
    difficulty: 'advanced',
    curriculumStage: 'integration',
    // stageOrder 1 is reserved for the pressure-profile integration lesson (WP10 §5.2).
    stageOrder: 2,
    competencyIds: [
      'crrt-device-management',
      'crrt-pressure-localization',
      'crrt-fluid-management',
      'crrt-safety',
    ],
    pathwayIds: ['renal-support-and-fluid-management', 'multiorgan-critical-illness'],
    prerequisiteActivityIds: crrtCoreCaseIds.map((id) => `crrt:practice:${id}`),
    evidenceIds: ['DEV-PM-009', 'DEV-PM-010', 'REVIEW-CKRT-CORE-2025'],
  },
]

/**
 * Ordered per WP10 §5.5 by interacting-system count and duration: one dominant mechanism first,
 * the twelve-hour multisystem scenarios last. Previously the longest, most multi-system scenario
 * was the entry point.
 */
const icuScenarioSeeds = [
  {
    sourceId: 'hemorrhagic',
    title: 'Active hemorrhagic hypovolemic shock',
    pathwayIds: ['shock-and-perfusion', 'multiorgan-critical-illness'],
    evidenceIds: ['ICU-TRAUMA-HEMORRHAGE', 'ICU-ESICM-SHOCK', 'ICU-SCENARIO-MODEL'],
    curriculumStage: 'foundation',
    stageOrder: 1,
    difficulty: 'intermediate',
  },
  {
    sourceId: 'tamponade',
    title: 'Evolving cardiac tamponade',
    pathwayIds: ['shock-and-perfusion', 'cardiogenic-and-rv-shock', 'multiorgan-critical-illness'],
    evidenceIds: ['ICU-ESC-PERICARDIAL', 'ICU-ESICM-SHOCK', 'ICU-SCENARIO-MODEL'],
    curriculumStage: 'mechanism',
    stageOrder: 1,
    difficulty: 'intermediate',
  },
  {
    sourceId: 'lv-cardiogenic',
    title: 'LV cardiogenic shock with pulmonary edema',
    pathwayIds: ['shock-and-perfusion', 'cardiogenic-and-rv-shock', 'multiorgan-critical-illness'],
    evidenceIds: ['ICU-ACC-CARDIOGENIC', 'ICU-MCS-ENGINE', 'ICU-SCENARIO-MODEL'],
    curriculumStage: 'mechanism',
    stageOrder: 2,
    difficulty: 'intermediate',
  },
  {
    sourceId: 'massive-pe-rv',
    title: 'Massive pulmonary embolism with acute RV shock',
    pathwayIds: [
      'shock-and-perfusion',
      'acute-respiratory-failure',
      'cardiogenic-and-rv-shock',
      'multiorgan-critical-illness',
    ],
    evidenceIds: ['ICU-ESC-PE', 'ICU-ESICM-SHOCK', 'ICU-MCS-ENGINE'],
    curriculumStage: 'application',
    stageOrder: 1,
    difficulty: 'advanced',
  },
  {
    sourceId: 'septic-ards-aki',
    title: 'Septic shock with ARDS and evolving AKI',
    pathwayIds: [
      'shock-and-perfusion',
      'acute-respiratory-failure',
      'renal-support-and-fluid-management',
      'multiorgan-critical-illness',
    ],
    evidenceIds: ['ICU-SSC-2026', 'ICU-ATS-ARDS', 'ICU-KDIGO-AKI', 'ICU-SCENARIO-MODEL'],
    curriculumStage: 'application',
    stageOrder: 2,
    difficulty: 'advanced',
  },
  {
    sourceId: 'mixed-cardiogenic-vasodilatory',
    title: 'Mixed cardiogenic–vasodilatory shock capstone',
    pathwayIds: ['shock-and-perfusion', 'cardiogenic-and-rv-shock', 'multiorgan-critical-illness'],
    evidenceIds: ['ICU-SSC-2026', 'ICU-ECMO-ENGINE', 'ICU-SCENARIO-MODEL'],
    curriculumStage: 'integration',
    stageOrder: 1,
    difficulty: 'advanced',
  },
] as const

/**
 * The module's only Learn activity and its missing foundation (WP10 §5.5): every scenario assumes
 * the integrated workspace and the Review → Classify → Intervene → Advance → Reassess loop, and
 * none of it was taught anywhere.
 */
const icuLearnSeeds: readonly ActivitySeed[] = [
  {
    sourceId: 'workspace-orientation',
    title: 'The integrated workspace and the reassessment loop',
    description:
      'Meet the shared patient and clock, learn the Review, Classify, Intervene, Advance, and Reassess loop, and see why the limiting support is expected to change.',
    competencyIds: [
      'multiorgan-prioritization',
      'cross-system-reassessment',
      'integrated-device-management',
      'critical-care-safety',
    ],
    pathwayIds: ['multiorgan-critical-illness'],
    evidenceIds: ['ICU-SCENARIO-MODEL'],
    estimatedMinutes: 10,
    difficulty: 'foundation',
    curriculumStage: 'orientation',
    stageOrder: 1,
  },
]

const icuCompetencyIds = [
  'multiorgan-prioritization',
  'cross-system-reassessment',
  'integrated-device-management',
  'critical-care-safety',
] as const

const icuPracticeSeeds: readonly ActivitySeed[] = icuScenarioSeeds.map((scenario) => ({
  ...scenario,
  competencyIds: icuCompetencyIds,
}))

/**
 * The Challenge catalog runs the same six scenarios in challenge mode: coaching is withheld and
 * teaching feedback is deferred to the debrief (v5.1 §4.2). Both ID families are kept for link
 * compatibility; they differ in supported mode, difficulty, and the copy below — not in scenario.
 */
const icuAssessSeeds: readonly ActivitySeed[] = icuScenarioSeeds.map((scenario) => ({
  ...scenario,
  description: `Run the ${scenario.title.toLocaleLowerCase()} scenario in challenge mode. Coaching prompts are withheld and all teaching feedback is deferred to the debrief.`,
  competencyIds: icuCompetencyIds,
  // Every challenge run removes the guided coaching layer, so all six sit at the same level.
  difficulty: 'advanced' as const,
  // Continue each stage's ordinals past the Practice run of the same scenario.
  stageOrder:
    scenario.stageOrder +
    icuScenarioSeeds.filter((other) => other.curriculumStage === scenario.curriculumStage).length,
}))

export const criticalCareActivities: readonly CriticalCareActivityDefinition[] = Object.freeze([
  ...defineActivities('icu-hemodynamics', 'learn', hemodynamicsLearnSeeds),
  ...defineActivities('icu-hemodynamics', 'practice', hemodynamicsCaseSeeds),
  ...defineActivities('icu-hemodynamics', 'assess', hemodynamicsAssessSeeds),
  ...defineActivities('mechanical-ventilation', 'learn', ventilationLearnSeeds),
  ...defineActivities('mechanical-ventilation', 'practice', ventilationCaseSeeds),
  ...defineActivities('mechanical-ventilation', 'assess', ventilationAssessSeeds),
  ...defineActivities('mechanical-circulatory-support', 'learn', mcsLessonSeeds),
  ...defineActivities('mechanical-circulatory-support', 'practice', mcsPracticeSeeds),
  ...defineActivities('mechanical-circulatory-support', 'assess', mcsAssessSeeds),
  ...defineActivities('cardiohelp-ecmo', 'learn', ecmoLessonSeeds),
  ...defineActivities('cardiohelp-ecmo', 'practice', ecmoPracticeSeeds),
  ...defineActivities('cardiohelp-ecmo', 'assess', ecmoAssessSeeds),
  ...defineActivities('baxter-crrt', 'learn', crrtLessonSeeds),
  ...defineActivities('baxter-crrt', 'practice', crrtCaseSeeds),
  ...defineActivities('baxter-crrt', 'assess', crrtAssessSeeds),
  ...defineActivities('icu-simulation', 'learn', icuLearnSeeds),
  ...defineActivities('icu-simulation', 'practice', icuPracticeSeeds),
  ...defineActivities('icu-simulation', 'assess', icuAssessSeeds),
])

export const criticalCareActivityById: ReadonlyMap<string, CriticalCareActivityDefinition> =
  new Map(criticalCareActivities.map((activity) => [activity.id, activity]))

export const criticalCareActivitiesByModule: ReadonlyMap<
  CriticalCareCatalogModuleId,
  readonly CriticalCareActivityDefinition[]
> = new Map(
  criticalCareModuleCatalog.map((module) => [
    module.id,
    criticalCareActivities.filter((activity) => activity.moduleId === module.id),
  ]),
)

export function validateCriticalCareActivityCatalog(
  activities: readonly CriticalCareActivityDefinition[] = criticalCareActivities,
): readonly string[] {
  const errors: string[] = []
  const moduleIds = new Set<string>(criticalCareModuleCatalog.map((module) => module.id))
  const pathwayIds = new Set<string>(criticalCarePathways.map((pathway) => pathway.id))
  const competencyIds = new Set<string>(criticalCareCompetencies.map((competency) => competency.id))
  const assetIds = new Set<string>(criticalCareAssets.map((asset) => asset.id))
  const activityIds = new Set(activities.map((activity) => activity.id))
  const conceptIds = new Set(criticalCareConceptById.keys())
  const evidenceIds = new Set(criticalCareEvidenceById.keys())

  if (activityIds.size !== activities.length) errors.push('Activity IDs must be unique.')

  for (const activity of activities) {
    const parsed = criticalCareActivityDefinitionSchema.safeParse(activity)
    if (!parsed.success) errors.push(`${activity.id}: invalid activity definition`)
    const moduleDefinition = criticalCareModuleById.get(
      activity.moduleId as CriticalCareCatalogModuleId,
    )
    if (!moduleIds.has(activity.moduleId as CriticalCareCatalogModuleId) || !moduleDefinition) {
      errors.push(`${activity.id}: unknown module ${activity.moduleId}`)
      continue
    }
    const [, section] = activity.id.split(':')
    if (
      !activity.id.startsWith(`${moduleDefinition.activityIdPrefix}:`) ||
      !['learn', 'practice', 'assess'].includes(section ?? '')
    ) {
      errors.push(`${activity.id}: activity ID does not match its module prefix and section`)
    }
    for (const pathwayId of activity.pathwayIds) {
      if (!pathwayIds.has(pathwayId)) errors.push(`${activity.id}: unknown pathway ${pathwayId}`)
    }
    for (const competencyId of activity.competencyIds) {
      if (!competencyIds.has(competencyId)) {
        errors.push(`${activity.id}: unknown competency ${competencyId}`)
      }
    }
    for (const assetId of activity.assetIds) {
      if (!assetIds.has(assetId)) errors.push(`${activity.id}: unknown asset ${assetId}`)
    }
    for (const prerequisiteId of activity.prerequisiteActivityIds) {
      if (!activityIds.has(prerequisiteId)) {
        errors.push(`${activity.id}: unknown prerequisite ${prerequisiteId}`)
      }
    }
    for (const conceptId of activity.teachesConceptIds) {
      if (!conceptIds.has(conceptId)) {
        errors.push(`${activity.id}: unknown taught concept ${conceptId}`)
      }
    }
    for (const conceptId of activity.assumedConceptIds) {
      if (!conceptIds.has(conceptId)) {
        errors.push(`${activity.id}: unknown assumed concept ${conceptId}`)
      }
      if (activity.teachesConceptIds.includes(conceptId)) {
        errors.push(`${activity.id}: cannot both teach and assume ${conceptId}`)
      }
    }
    if (activity.reviewStatus === 'released' && activity.evidenceIds.length === 0) {
      errors.push(`${activity.id}: released activity requires evidence`)
    }
    for (const evidenceId of activity.evidenceIds) {
      if (!evidenceIds.has(evidenceId)) {
        errors.push(`${activity.id}: unknown evidence ${evidenceId}`)
      }
    }
    if (activity.kind === 'assessment' && !activity.masteryRuleId) {
      errors.push(`${activity.id}: assessment requires a mastery rule`)
    }
  }

  errors.push(...validateCurriculumStaging(activities))

  const prerequisiteEdges = new Map(
    activities.map((activity) => [activity.id, activity.prerequisiteActivityIds]),
  )
  errors.push(...detectDirectedCycles(prerequisiteEdges, 'prerequisite activity'))

  const conceptDependencyEdges = new Map<string, readonly string[]>()
  for (const activity of activities) {
    for (const taughtConceptId of activity.teachesConceptIds) {
      conceptDependencyEdges.set(
        taughtConceptId,
        Array.from(
          new Set([
            ...(conceptDependencyEdges.get(taughtConceptId) ?? []),
            ...activity.assumedConceptIds,
          ]),
        ),
      )
    }
  }
  errors.push(...detectDirectedCycles(conceptDependencyEdges, 'assumed concept'))

  return errors
}

/**
 * Curriculum-staging invariants (WP10 §2.3). `stageOrder` uniqueness is what lets every ordered
 * surface sort by (stage, stageOrder) instead of falling back to a title comparison.
 *
 * "Exactly one integration activity per track" and "every module has a foundation activity" are
 * enforced over the declared learning pathways (`content/learningPathways`), because a track is a
 * property of a pathway — ECMO declares one per support mode — not of the flat activity list.
 */
export function validateCurriculumStaging(
  activities: readonly CriticalCareActivityDefinition[],
): readonly string[] {
  const errors: string[] = []
  const seenStageOrders = new Set<string>()
  const firstFoundationIndexByModule = new Map<string, number>()
  const indexWithinModule = new Map<string, number>()

  for (const activity of activities) {
    const key = `${activity.moduleId}:${activity.curriculumStage}:${activity.stageOrder}`
    if (seenStageOrders.has(key)) {
      errors.push(
        `${activity.id}: duplicate stageOrder ${activity.stageOrder} within ${activity.moduleId}/${activity.curriculumStage}`,
      )
    }
    seenStageOrders.add(key)

    const position = indexWithinModule.get(activity.moduleId) ?? 0
    indexWithinModule.set(activity.moduleId, position + 1)

    if (
      activity.curriculumStage === 'foundation' &&
      !firstFoundationIndexByModule.has(activity.moduleId)
    ) {
      firstFoundationIndexByModule.set(activity.moduleId, position)
    }
  }

  indexWithinModule.clear()
  for (const activity of activities) {
    const position = indexWithinModule.get(activity.moduleId) ?? 0
    indexWithinModule.set(activity.moduleId, position + 1)
    if (activity.curriculumStage !== 'integration') continue
    const firstFoundation = firstFoundationIndexByModule.get(activity.moduleId)
    if (firstFoundation !== undefined && position < firstFoundation) {
      errors.push(`${activity.id}: integration activity precedes its module's first foundation`)
    }
  }

  return errors
}

function detectDirectedCycles(
  edges: ReadonlyMap<string, readonly string[]>,
  label: string,
): readonly string[] {
  const errors: string[] = []
  const visited = new Set<string>()
  const visiting = new Set<string>()
  const path: string[] = []

  const visit = (id: string) => {
    if (visiting.has(id)) {
      const cycleStart = path.indexOf(id)
      const cycle = [...path.slice(Math.max(0, cycleStart)), id]
      errors.push(`${label} cycle: ${cycle.join(' -> ')}`)
      return
    }
    if (visited.has(id)) return

    visiting.add(id)
    path.push(id)
    for (const dependency of edges.get(id) ?? []) {
      if (edges.has(dependency)) visit(dependency)
    }
    path.pop()
    visiting.delete(id)
    visited.add(id)
  }

  for (const id of edges.keys()) visit(id)
  return [...new Set(errors)]
}

export function validateCriticalCareCatalogs(): readonly string[] {
  const errors = [
    ...validateCriticalCareActivityCatalog(),
    ...validateCriticalCareLearningPathways(criticalCareActivities),
    ...validateLearningPathwayCoverage(),
  ]
  const moduleIds = new Set<string>(criticalCareModuleCatalog.map((module) => module.id))
  const competencyIds = new Set<string>(criticalCareCompetencies.map((competency) => competency.id))
  const activityIds = new Set(criticalCareActivities.map((activity) => activity.id))
  const evidenceIds = new Set(criticalCareEvidenceById.keys())

  for (const pathway of criticalCarePathways) {
    for (const moduleId of pathway.moduleIds) {
      if (!moduleIds.has(moduleId)) errors.push(`${pathway.id}: unknown module ${moduleId}`)
    }
    for (const competencyId of pathway.competencyIds) {
      if (!competencyIds.has(competencyId)) {
        errors.push(`${pathway.id}: unknown competency ${competencyId}`)
      }
    }
  }

  for (const asset of criticalCareAssets) {
    if (!moduleIds.has(asset.moduleId as CriticalCareCatalogModuleId)) {
      errors.push(`${asset.id}: unknown module ${asset.moduleId}`)
    }
    for (const competencyId of asset.competencyIds) {
      if (!competencyIds.has(competencyId)) {
        errors.push(`${asset.id}: unknown competency ${competencyId}`)
      }
    }
  }

  for (const reference of criticalCareReferences) {
    for (const moduleId of reference.moduleIds) {
      if (!moduleIds.has(moduleId)) errors.push(`${reference.id}: unknown module ${moduleId}`)
    }
    for (const competencyId of reference.competencyIds) {
      if (!competencyIds.has(competencyId)) {
        errors.push(`${reference.id}: unknown competency ${competencyId}`)
      }
    }
    for (const activityId of reference.relatedActivityIds) {
      if (!activityIds.has(activityId)) {
        errors.push(`${reference.id}: unknown related activity ${activityId}`)
      }
    }
    for (const evidenceId of reference.evidenceIds) {
      if (!evidenceIds.has(evidenceId)) {
        errors.push(`${reference.id}: unknown evidence ${evidenceId}`)
      }
    }
  }

  for (const conceptDefinition of criticalCareConceptById.values()) {
    for (const relatedConceptId of conceptDefinition.relatedConceptIds) {
      if (!criticalCareConceptById.has(relatedConceptId)) {
        errors.push(`${conceptDefinition.id}: unknown related concept ${relatedConceptId}`)
      }
    }
    for (const evidenceId of conceptDefinition.evidenceIds) {
      if (!evidenceIds.has(evidenceId)) {
        errors.push(`${conceptDefinition.id}: unknown evidence ${evidenceId}`)
      }
    }
  }

  return errors
}

const catalogErrors = validateCriticalCareCatalogs()
if (catalogErrors.length > 0) {
  throw new Error(`Invalid critical-care catalogs: ${catalogErrors.join('; ')}`)
}
