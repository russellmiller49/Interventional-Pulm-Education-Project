import type { ClinicalDecisionDomain } from '../engine/learningLabTypes'

export const stentPlanModel = [
  'Indication',
  'Mechanical job',
  'Anatomic fit',
  'Time horizon',
  'Tissue interface',
  'Surveillance and exit strategy',
] as const

export interface ClinicalFrameworkItem {
  id: string
  label: string
  prompt: string
  domains: readonly ClinicalDecisionDomain[]
  evidenceRefs: readonly string[]
}

export const mechanicalJobs: readonly ClinicalFrameworkItem[] = [
  {
    id: 'oppose-extrinsic-load',
    label: 'Oppose persistent external compression',
    prompt: 'What external load remains after treatable intraluminal disease is addressed?',
    domains: ['mechanical-job', 'indication'],
    evidenceRefs: ['wabip-malignant-stenting-2024'],
  },
  {
    id: 'stabilize-treated-airway',
    label: 'Stabilize a residual structural problem',
    prompt: 'Does the wall remain mechanically inadequate after the primary intervention?',
    domains: ['mechanical-job', 'indication'],
    evidenceRefs: ['chest-cao-guideline-2024', 'wabip-malignant-stenting-2024'],
  },
  {
    id: 'temporary-dynamic-trial',
    label: 'Maintain a dynamic segment during a defined trial',
    prompt: 'What question will the trial answer, and when will the device be removed?',
    domains: ['mechanical-job', 'surveillance'],
    evidenceRefs: ['wabip-benign-stenting-2025'],
  },
  {
    id: 'seal-fistula',
    label: 'Provide a continuous sealing surface',
    prompt: 'Which defect must be covered without sacrificing required branch patency?',
    domains: ['mechanical-job', 'fit'],
    evidenceRefs: ['chest-cao-guideline-2024'],
  },
  {
    id: 'anchor-bifurcation',
    label: 'Share load across a bifurcation',
    prompt: 'Which limbs, branch angles, and distal pathways must remain patent?',
    domains: ['mechanical-job', 'fit', 'architecture'],
    evidenceRefs: ['wabip-malignant-stenting-2024'],
  },
  {
    id: 'temporize',
    label: 'Temporize while another therapy takes effect',
    prompt: 'How will changing disease or anatomy alter fit and the exit plan?',
    domains: ['mechanical-job', 'surveillance'],
    evidenceRefs: ['wabip-malignant-stenting-2024'],
  },
]

export const fitPlanningItems: readonly ClinicalFrameworkItem[] = [
  {
    id: 'landing-zones',
    label: 'Proximal and distal landing zones',
    prompt: 'Are both landing zones stable enough to support the intended job?',
    domains: ['fit'],
    evidenceRefs: ['wabip-malignant-stenting-2024', 'wabip-benign-stenting-2025'],
  },
  {
    id: 'disease-coverage',
    label: 'Disease length and intended coverage',
    prompt: 'What must be spanned, and what healthy or branch-bearing airway must be spared?',
    domains: ['fit', 'mechanical-job'],
    evidenceRefs: ['wabip-malignant-stenting-2024'],
  },
  {
    id: 'taper-curvature',
    label: 'Taper and curvature',
    prompt: 'Where could mismatch create gapping, straightening, or repeated end contact?',
    domains: ['fit', 'complication'],
    evidenceRefs: ['ratnovsky-airway-mechanics-2015', 'gupta-granulation-review-2025'],
  },
  {
    id: 'branches',
    label: 'Branch angles and orifices',
    prompt: 'Which distal pathways must remain patent after the entire architecture is deployed?',
    domains: ['fit', 'architecture'],
    evidenceRefs: ['wabip-malignant-stenting-2024'],
  },
  {
    id: 'dynamic-change',
    label: 'Breathing, cough, and dynamic change',
    prompt: 'Where might the device and mucosa move relative to one another?',
    domains: ['fit', 'complication'],
    evidenceRefs: ['gupta-granulation-review-2025', 'chung-airway-fracture-2008'],
  },
  {
    id: 'future-anatomy',
    label: 'Expected disease response or remodeling',
    prompt: 'How could treatment response, remodeling, or progression change contact and fixation?',
    domains: ['fit', 'surveillance'],
    evidenceRefs: ['wabip-malignant-stenting-2024', 'wabip-benign-stenting-2025'],
  },
  {
    id: 'fistula-adjacent-device',
    label: 'Fistula and adjacent-device relationship',
    prompt: 'Could the airway device interact with the defect or an adjacent esophageal device?',
    domains: ['fit', 'complication'],
    evidenceRefs: ['chest-cao-guideline-2024'],
  },
]

export const architectureDecisionAxes = [
  {
    id: 'removability',
    label: 'Removability',
    question: 'Is planned removal likely, and how might the interface change with time?',
  },
  {
    id: 'coverage',
    label: 'Coverage',
    question: 'Is sealing or protection from ingrowth needed, and what secretion burden follows?',
  },
  {
    id: 'deployment',
    label: 'Deployment',
    question: 'Are rigid deployment, repositioning, or customization important constraints?',
  },
  {
    id: 'geometry',
    label: 'Geometry',
    question: 'Is the target straight, curved, tapered, bifurcated, or highly dynamic?',
  },
  {
    id: 'functional-lumen',
    label: 'Functional lumen',
    question: 'How much of the available lumen is occupied by the architecture?',
  },
  {
    id: 'anchoring',
    label: 'Anchoring',
    question: 'Where does fixation come from, and where does that place contact?',
  },
  {
    id: 'branch-preservation',
    label: 'Branch preservation',
    question: 'Could the architecture compromise an adjacent or distal orifice?',
  },
  {
    id: 'time-horizon',
    label: 'Time horizon',
    question: 'What is expected to change over the intended dwell period?',
  },
] as const

export const surveillancePlanColumns = [
  'Expected failure mode',
  'Recognition trigger',
  'Response category',
  'Correct the underlying driver',
] as const

export const clinicalModelBoundary = {
  physicsCanHelpWith: [
    'Identify the load the architecture is being asked to oppose.',
    'Inspect deformation in a curve, bifurcation, eccentric narrowing, breathing cycle, or cough.',
    'Locate plausible contact, relative motion, secretion pockets, and architecture transitions.',
    'Ask how changing anatomy or dwell time could alter fit and removal.',
  ],
  physicsCannotDetermine: [
    'A universally preferred device or architecture.',
    'A patient-specific tissue pressure or granulation probability.',
    'A universal force threshold or oversizing rule.',
    'Clinical superiority from a schematic deformation.',
  ],
} as const
