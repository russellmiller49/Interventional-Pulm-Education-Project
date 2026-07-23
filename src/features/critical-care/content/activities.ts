import {
  criticalCareActivityDefinitionSchema,
  type CriticalCareActivityDefinition,
  type CriticalCareActivityMode,
  type CriticalCareDifficulty,
  type CriticalCareReviewStatus,
} from '@/features/learning-module/activity'

import { criticalCareAssets } from './assets'
import { criticalCareCompetencies } from './competencies'
import {
  criticalCareModuleById,
  criticalCareModuleCatalog,
  type CriticalCareCatalogModuleId,
} from './modules'
import { criticalCarePathways } from './pathways'
import { criticalCareReferences } from './references'

type ActivitySection = 'learn' | 'practice' | 'assess'
type EcmoTrack = 'vv' | 'va'

interface ActivitySeed {
  readonly sourceId: string
  readonly title: string
  readonly description?: string
  readonly competencyIds: readonly string[]
  readonly pathwayIds: readonly string[]
  readonly evidenceIds: readonly string[]
  readonly prerequisiteActivityIds?: readonly string[]
  readonly estimatedMinutes?: number
  readonly difficulty?: CriticalCareDifficulty
  readonly track?: EcmoTrack
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
  // Assessment cases are selected from a locally seeded, masked setup flow.
  // A catalog link must never expose or pretend to select that hidden case.
  if (moduleId === 'mechanical-ventilation' && section === 'assess') return undefined
  if (section === 'learn') return { activity: seed.sourceId }
  return { case: seed.sourceId }
}

function defaultDescription(section: ActivitySection, title: string): string {
  if (section === 'learn') {
    return `Complete the existing guided ${title} learning activity.`
  }
  if (section === 'assess') {
    return `Complete the existing masked ${title} assessment with its preserved mastery rules.`
  }
  return `Work through the existing ${title} case with its preserved engine and scoring rules.`
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
    return criticalCareActivityDefinitionSchema.parse({
      id,
      moduleId,
      title: seed.title,
      description: seed.description ?? defaultDescription(section, seed.title),
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
      estimatedMinutes:
        seed.estimatedMinutes ?? (section === 'learn' ? 12 : section === 'assess' ? 25 : 15),
      difficulty:
        seed.difficulty ??
        (section === 'learn' ? 'foundation' : section === 'assess' ? 'advanced' : 'intermediate'),
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
      reviewStatus: reviewStatusByModule[moduleId],
      evidenceIds: seed.evidenceIds,
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
  {
    sourceId: 'pac-signal-validation',
    title: 'PAC signal validation',
    description:
      'Recognize the monitoring setup, predict signal usability, validate the measurement chain, and transfer the sequence to an artifact variant.',
    competencyIds: ['signal-validation', 'hemodynamic-reassessment', 'critical-care-safety'],
    pathwayIds: ['shock-and-perfusion'],
    evidenceIds: [
      ...hemodynamicsEvidence,
      'monitor-workflow-supplied',
      'arterial-pressure-five-step-2020',
    ],
    estimatedMinutes: 15,
  },
  {
    sourceId: 'pressure-system',
    title: 'Level, zero, and dynamic response',
    competencyIds: ['signal-validation', 'critical-care-safety'],
    pathwayIds: ['shock-and-perfusion'],
    prerequisiteActivityIds: ['hemodynamics:learn:pac-signal-validation'],
    evidenceIds: [
      ...hemodynamicsEvidence,
      'monitor-workflow-supplied',
      'arterial-pressure-five-step-2020',
    ],
  },
  {
    sourceId: 'catheter-advancement',
    title: 'Advance the PAC by waveform',
    competencyIds: ['signal-validation', 'critical-care-safety'],
    pathwayIds: ['shock-and-perfusion'],
    prerequisiteActivityIds: ['hemodynamics:learn:pressure-system'],
    evidenceIds: [...hemodynamicsEvidence, 'monitor-workflow-supplied'],
    estimatedMinutes: 15,
  },
  {
    sourceId: 'pawp-capture',
    title: 'Brief end-expiratory PAWP capture',
    competencyIds: ['signal-validation', 'critical-care-safety'],
    pathwayIds: ['shock-and-perfusion'],
    prerequisiteActivityIds: ['hemodynamics:learn:catheter-advancement'],
    evidenceIds: [...hemodynamicsEvidence, 'monitor-workflow-supplied'],
    estimatedMinutes: 15,
  },
  {
    sourceId: 'thermodilution-series',
    title: 'Thermodilution technique and curve review',
    competencyIds: ['signal-validation', 'hemodynamic-reassessment'],
    pathwayIds: ['shock-and-perfusion'],
    prerequisiteActivityIds: ['hemodynamics:learn:pressure-system'],
    evidenceIds: hemodynamicsEvidence,
    estimatedMinutes: 18,
  },
  {
    sourceId: 'derived-hemodynamics',
    title: 'Derived values and interpretation limits',
    competencyIds: ['hemodynamic-reassessment', 'critical-care-safety'],
    pathwayIds: ['shock-and-perfusion', 'cardiogenic-and-rv-shock'],
    prerequisiteActivityIds: ['hemodynamics:learn:thermodilution-series'],
    evidenceIds: hemodynamicsEvidence,
    estimatedMinutes: 15,
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
].map(([sourceId, title, pathwayIds]) => ({
  sourceId: sourceId as string,
  title: title as string,
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
    title: 'Masked hemodynamics capstone',
    description:
      'Complete a seeded, masked hemodynamic case while retaining the existing 80% and no-critical-error mastery rule.',
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
  },
]

const ventilationCaseSeeds: readonly ActivitySeed[] = [
  ['MV-01', 'ARDS hypoxemia: recruitment versus overdistension'],
  ['MV-02', 'Volume-control flow starvation during high respiratory drive'],
  ['MV-03', 'Double triggering and breath stacking in ARDS'],
  ['MV-04', 'Reverse triggering in a deeply sedated patient'],
  ['MV-05', 'COPD: dynamic hyperinflation with ineffective efforts'],
  ['MV-06', 'Severe asthma: auto-PEEP with obstructive shock'],
  ['MV-07', 'Neuromuscular weakness with trigger delay and missed efforts'],
  ['MV-08', 'Autotriggering from condensate or circuit leak'],
  ['MV-09', 'Premature cycling on pressure support'],
  ['MV-10', 'Delayed cycling on pressure support in COPD'],
  ['MV-11', 'Rise-time mismatch: too slow, then too fast'],
  ['MV-12', 'Over-assistance with low drive and periodic breathing'],
  ['MV-13', 'High airway pressure: secretions, tube obstruction, or bronchospasm'],
  ['MV-14', 'Sudden loss of compliance: tension pneumothorax'],
  ['MV-15', 'Air hunger, anxiety, pain, and delirium in an awake ventilated patient'],
].map(([sourceId, title]) => ({
  sourceId,
  title,
  competencyIds: [
    'ventilator-setup',
    'ventilator-mechanics',
    'ventilator-waveform-interpretation',
    'ventilator-troubleshooting',
    'ventilator-safety',
  ],
  pathwayIds: ['acute-respiratory-failure'],
  evidenceIds: ['mechanical-ventilation-source-boundary'],
}))

const ventilationLearnSeeds: readonly ActivitySeed[] = [
  ['mechanics-load-and-pressure', 'Mechanics: load, pressure, and volume'],
  ['modes-and-breath-delivery', 'Modes: trigger, target, cycle, and expiration'],
  ['waveform-reading-sequence', 'Waveforms: a repeatable reading sequence'],
  ['triggering-and-cycling', 'Triggering and cycling'],
  ['dyssynchrony-mechanisms', 'Dyssynchrony: mechanism before label'],
  ['oxygenation-response', 'Oxygenation: action and consequence'],
  ['ventilation-and-co2', 'Ventilation: measured response over time'],
  ['safety-reassessment-and-human-factors', 'Safety, reassessment, and the whole patient'],
].map(([sourceId, title]) => ({
  sourceId,
  title,
  competencyIds: [
    'ventilator-setup',
    'ventilator-mechanics',
    'ventilator-waveform-interpretation',
    'ventilator-troubleshooting',
    'ventilator-safety',
  ],
  pathwayIds: ['acute-respiratory-failure'],
  evidenceIds: ['mechanical-ventilation-source-boundary'],
  estimatedMinutes: 8,
}))

const ventilationAssessSeeds: readonly ActivitySeed[] = [
  {
    sourceId: 'masked-seeded',
    title: 'Seeded masked ventilation challenge',
    description:
      'Complete one locally seeded, masked case using the preserved ventilation engine, scoring rubric, and critical-error mastery rule.',
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
  },
]

const mcsLessonSeeds: readonly ActivitySeed[] = [
  ['mcs-foundations-signals', 'Validate the signal before the device'],
  ['mcs-foundations-mechanisms', 'Unloading, augmentation, and total flow'],
  ['iabp-timing-triggering', 'IABP timing and triggering'],
  ['iabp-efficacy-limits', 'IABP efficacy, limits, and escalation'],
  ['impella-unloading-placement', 'Impella unloading and placement signals'],
  ['impella-suction-purge-rv', 'Impella suction, purge, hemolysis, and RV delivery'],
  ['lvad-parameters-assessment', 'Durable LVAD parameters and ICU assessment'],
  ['lvad-alarms-emergencies', 'Durable LVAD low flow, high power, and power emergencies'],
].map(([sourceId, title]) => ({
  sourceId,
  title,
  competencyIds: ['mcs-device-management', 'mcs-patient-assessment', 'mcs-safety'],
  pathwayIds: ['cardiogenic-and-rv-shock', 'shock-and-perfusion'],
  evidenceIds: ['mcs-device-source-registry'],
}))

const mcsPracticeSeeds: readonly ActivitySeed[] = [
  ['IABP-01', 'The balloon that stays inflated too long'],
  ['IABP-02', 'Irregular rhythm, unreliable trigger'],
  ['IABP-03', 'Correct timing, inadequate circulation'],
  ['IMP-01', 'High support, underfilled LV'],
  ['IMP-02', 'Malposition with blood-trauma risk'],
  ['IMP-03', 'Low flow across high afterload'],
  ['LVAD-01', 'Low flow with severe hypertension'],
  ['LVAD-02', 'Low flow with a failing right ventricle'],
  ['LVAD-03', 'Controller alarm after power interruption'],
].map(([sourceId, title]) => ({
  sourceId,
  title,
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
].map(([sourceId, title]) => ({
  sourceId,
  title,
  competencyIds: ['mcs-device-management', 'mcs-patient-assessment', 'mcs-safety'],
  pathwayIds: ['cardiogenic-and-rv-shock', 'shock-and-perfusion'],
  prerequisiteActivityIds: mcsCapstonePrerequisites[sourceId] ?? [],
  evidenceIds: ['mcs-device-source-registry', 'mcs-educational-model-v1'],
}))

const ecmoLessonSeeds: readonly ActivitySeed[] = [
  ['startup-sensor-orientation', 'Console, circuit, and external-control orientation', 'vv'],
  ['preload-drainage-collapse', 'Preload-limited flow and drainage collapse', 'vv'],
  ['afterload-return-obstruction', 'Return-side obstruction', 'vv'],
  ['afterload-oxygenator-resistance', 'Oxygenator resistance or dysfunction pattern', 'vv'],
  ['vv-recirculation', 'VV recirculation despite high displayed flow', 'vv'],
  ['acute-hypercapnia', 'Acute hypercapnic acidemia', 'vv'],
  ['compensated-hypercapnia', 'Compensated hypercapnia during maintenance', 'vv'],
  ['gas-source-interruption', 'Gas-source interruption with preserved blood flow', 'vv'],
  ['arterial-bubble-stop', 'Arterial bubble intervention and cause-before-reset', 'vv'],
  ['transport-power-loss', 'Transport power loss and backup readiness', 'vv'],
  [
    'va-startup-sensor-orientation',
    'VA console, femoral circuit, and independent-monitor orientation',
    'va',
  ],
  [
    'va-preload-drainage-collapse',
    'VA preload-limited drainage and falling systemic support',
    'va',
  ],
  ['va-afterload-arterial-return-obstruction', 'VA arterial-return resistance', 'va'],
  ['va-afterload-oxygenator-resistance', 'VA oxygenator resistance pattern', 'va'],
  ['va-differential-hypoxemia', 'Peripheral VA differential upper-body oxygenation', 'va'],
  ['va-lv-loading', 'VA LV-loading recognition', 'va'],
  ['va-acute-hypercapnia', 'VA phase-aware sweep adjustment', 'va'],
  ['va-gas-source-interruption', 'VA gas-source interruption with continued arterial flow', 'va'],
  ['va-arterial-bubble-stop', 'VA arterial-return bubble and cause-before-reset', 'va'],
  ['va-transport-power-loss', 'VA transport power loss and circulatory backup', 'va'],
].map(([sourceId, title, track]) => ({
  sourceId,
  title,
  track: track as EcmoTrack,
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
].map(([sourceId, title, track]) => ({
  sourceId,
  title,
  track: track as EcmoTrack,
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
    competencyIds: ['ecmo-circuit-assessment', 'ecmo-device-management', 'ecmo-safety'],
    pathwayIds: ['acute-respiratory-failure', 'multiorgan-critical-illness'],
    prerequisiteActivityIds: ecmoLearnActivityIdsByTrack.vv,
    evidenceIds: ['cardiohelp-i-us-2025'],
  },
  {
    sourceId: 'va-mixed-circulation-capstone',
    title: 'Unseen capstone: VA mixed-circulation mismatch',
    track: 'va',
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

const crrtLessonSeeds: readonly ActivitySeed[] = [
  ['crrt-indications-modality', 'CRRT indications and modality selection', ['crrt-prescription']],
  ['crrt-solute-transport', 'Solute and water transport', ['crrt-prescription']],
  ['crrt-prescription-dosing', 'Prescription and delivered dose', ['crrt-prescription']],
  [
    'crrt-circuit-pressures',
    'Circuit anatomy and pressure localization',
    ['crrt-pressure-localization'],
  ],
  ['crrt-anticoagulation', 'Anticoagulation and citrate safety', ['crrt-safety']],
  [
    'crrt-alarms-troubleshooting',
    'Alarms and cause-first troubleshooting',
    ['crrt-device-management', 'crrt-safety'],
  ],
  ['crrt-fluid-liberation', 'Fluid management and liberation', ['crrt-fluid-management']],
].map(([sourceId, title, competencyIds]) => ({
  sourceId: sourceId as string,
  title: title as string,
  competencyIds: [...(competencyIds as readonly string[]), 'critical-care-safety'],
  pathwayIds: ['renal-support-and-fluid-management', 'multiorgan-critical-illness'],
  evidenceIds: ['REVIEW-CKRT-CORE-2025', 'DEV-PM-009'],
}))

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
  ['CRRT-13', 'Localize and correct a worsening access-pressure pattern', 5],
  ['CRRT-15', 'Localize rising filter and effluent pressure trends', 5],
  ['CRRT-14', 'High return pressure versus return disconnection', 5],
  ['CRRT-17', 'Recognize and escalate a citrate-calcium safety concern', 6],
  ['CRRT-18', 'Renal recovery, discontinuation, and transition', 6],
].map(([sourceId, title, station]) => {
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
    title: 'Unseen PrisMax capstone',
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

const icuScenarioSeeds = [
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
  },
  {
    sourceId: 'lv-cardiogenic',
    title: 'LV cardiogenic shock with pulmonary edema',
    pathwayIds: ['shock-and-perfusion', 'cardiogenic-and-rv-shock', 'multiorgan-critical-illness'],
    evidenceIds: ['ICU-ACC-CARDIOGENIC', 'ICU-MCS-ENGINE', 'ICU-SCENARIO-MODEL'],
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
  },
  {
    sourceId: 'hemorrhagic',
    title: 'Active hemorrhagic hypovolemic shock',
    pathwayIds: ['shock-and-perfusion', 'multiorgan-critical-illness'],
    evidenceIds: ['ICU-TRAUMA-HEMORRHAGE', 'ICU-ESICM-SHOCK', 'ICU-SCENARIO-MODEL'],
  },
  {
    sourceId: 'tamponade',
    title: 'Evolving cardiac tamponade',
    pathwayIds: ['shock-and-perfusion', 'cardiogenic-and-rv-shock', 'multiorgan-critical-illness'],
    evidenceIds: ['ICU-ESC-PERICARDIAL', 'ICU-ESICM-SHOCK', 'ICU-SCENARIO-MODEL'],
  },
  {
    sourceId: 'mixed-cardiogenic-vasodilatory',
    title: 'Mixed cardiogenic–vasodilatory shock capstone',
    pathwayIds: ['shock-and-perfusion', 'cardiogenic-and-rv-shock', 'multiorgan-critical-illness'],
    evidenceIds: ['ICU-SSC-2026', 'ICU-ECMO-ENGINE', 'ICU-SCENARIO-MODEL'],
  },
] as const

const icuSeeds: readonly ActivitySeed[] = icuScenarioSeeds.map((scenario) => ({
  ...scenario,
  competencyIds: [
    'multiorgan-prioritization',
    'cross-system-reassessment',
    'integrated-device-management',
    'critical-care-safety',
  ],
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
  ...defineActivities('icu-simulation', 'practice', icuSeeds),
  ...defineActivities('icu-simulation', 'assess', icuSeeds),
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
    if (activity.reviewStatus === 'released' && activity.evidenceIds.length === 0) {
      errors.push(`${activity.id}: released activity requires evidence`)
    }
    if (activity.kind === 'assessment' && !activity.masteryRuleId) {
      errors.push(`${activity.id}: assessment requires a mastery rule`)
    }
  }
  return errors
}

export function validateCriticalCareCatalogs(): readonly string[] {
  const errors = [...validateCriticalCareActivityCatalog()]
  const moduleIds = new Set<string>(criticalCareModuleCatalog.map((module) => module.id))
  const competencyIds = new Set<string>(criticalCareCompetencies.map((competency) => competency.id))
  const activityIds = new Set(criticalCareActivities.map((activity) => activity.id))

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
  }

  return errors
}

const catalogErrors = validateCriticalCareCatalogs()
if (catalogErrors.length > 0) {
  throw new Error(`Invalid critical-care catalogs: ${catalogErrors.join('; ')}`)
}
