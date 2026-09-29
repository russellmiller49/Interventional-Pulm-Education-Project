import { assertThoracoscopyCopy } from './learnerCopy'
import { THORACOSCOPY_SECTION_IDS, type ThoracoscopySectionId } from './sectionIds'
import { THORACOSCOPY_SPINE } from './spine'

/**
 * The one ordering authority for the course: chapters, sections, practice scenarios and cases,
 * imported from the implementation manifest and pinned to it by test. The outline, Continue and
 * every link read from here, so the course has one order.
 *
 * A section is `in-preparation` until it is written, `written` once its content exists and waits for
 * the lesson that shows it, and `available` once a learner can open it. Only an available section is
 * a link, can be resumed, or is ever recorded as opened or reviewed.
 */
export type SectionState = 'in-preparation' | 'written' | 'available'

export type ChapterId =
  | 'decide'
  | 'equipment-and-anatomy'
  | 'access-and-orientation'
  | 'survey-and-intervention'
  | 'finish-and-complications'

export interface CurriculumSection {
  readonly id: ThoracoscopySectionId
  readonly number: number
  /** What the learner reads. It differs from the imported title only where `TITLE_REWORDINGS` says. */
  readonly title: string
  readonly importedTitle: string
  /** The activity the plan names for the section. Planning language, not shown to learners. */
  readonly plannedActivity: string
  /** An authored estimate, never a measurement. */
  readonly minutes: number
  readonly chapter: ChapterId
  readonly state: SectionState
}

export interface CurriculumChapter {
  readonly id: ChapterId
  readonly title: string
  readonly description: string
  readonly sectionIds: readonly ThoracoscopySectionId[]
}

export interface PracticeScenario {
  readonly id: `P${number}`
  readonly title: string
  readonly pairsWith: readonly ThoracoscopySectionId[]
  readonly state: SectionState
}

export interface IntegratedCase {
  readonly id: `C${number}`
  readonly title: string
  readonly state: SectionState
}

/**
 * Where a learner title differs from the imported inventory. Each is a default the owner has not
 * decided (owner decisions, T10); the imported title stays in the manifest unchanged.
 */
export const TITLE_REWORDINGS: Readonly<
  Partial<Record<ThoracoscopySectionId, { readonly learner: string; readonly reason: string }>>
> = {
  complications: {
    learner: 'When a complication happens',
    reason: 'The imported title uses "wrong", a correctness word the learner-copy gate refuses.',
  },
}

type SectionRow = readonly [ThoracoscopySectionId, string, string, number, ChapterId]

// [id, imported title, planned activity, minutes, chapter]
const SECTION_ROWS: readonly SectionRow[] = [
  ['why-thoracoscopy', 'What looking inside adds', 'Sort the clinical questions', 6, 'decide'],
  ['patient-selection', 'Who is a candidate', 'Sort micro-cases', 7, 'decide'],
  [
    'the-instrument',
    'The Mini-Thoracoscopy Set',
    'Device explorer: exploded, assemble, cutaway',
    9,
    'equipment-and-anatomy',
  ],
  [
    'room-and-tower',
    'Room, tower and team',
    'Diorama: positioning, sight line to the monitor, cable/port matching, return pad',
    8,
    'equipment-and-anatomy',
  ],
  [
    'the-chest-wall',
    'The wall you cross',
    'Layer peel, costal groove, safe-triangle overlay',
    8,
    'equipment-and-anatomy',
  ],
  [
    'normal-pleural-space',
    'A normal hemithorax from inside',
    'Guided endoscopic tour of the zones (right side)',
    9,
    'equipment-and-anatomy',
  ],
  ['four-controls', 'Four things you control', 'Fulcrum sandbox', 7, 'access-and-orientation'],
  [
    'choosing-the-port',
    'Choosing the port site',
    'Ultrasound station plus reachability map',
    9,
    'access-and-orientation',
  ],
  [
    'entry',
    'Entering the pleural space',
    'Anesthesia down to the pleura (principle), incision, blunt dissection, trocar and sleeve. Little or no fluid is taught as a field in motion: guideline advice to induce a pneumothorax vs the 2025 RCT finding direct entry noninferior',
    8,
    'access-and-orientation',
  ],
  [
    'making-room',
    'Fluid out, air in',
    'Paired scenarios: sealed port vs open port; lung collapse morph',
    8,
    'access-and-orientation',
  ],
  [
    'systematic-survey',
    'Look everywhere, in order',
    'Zone ledger (not seen / partly seen / seen) lit on the Chest view',
    9,
    'survey-and-intervention',
  ],
  [
    'reading-the-pleura',
    'What you see and where',
    'Grammar built from side-by-side pathology variants',
    10,
    'survey-and-intervention',
  ],
  [
    'taking-biopsies',
    'Parietal biopsies',
    'Forceps drill; site classified over the rib vs costal groove vs visceral vs mediastinal',
    9,
    'survey-and-intervention',
  ],
  [
    'energy-and-bleeding',
    'Energy, bleeding and hemostasis',
    'Hook and button electrodes (principles; settings per IFU)',
    8,
    'survey-and-intervention',
  ],
  [
    'adhesions',
    "When the lung won't fall away",
    'Filmy vs fibrous vs vascular bands; trapped lung',
    8,
    'survey-and-intervention',
  ],
  [
    'talc-poudrage',
    'Talc poudrage',
    'Particle spray and zone deposition; talc vs IPC vs both',
    9,
    'survey-and-intervention',
  ],
  [
    'finishing',
    'Drain, re-expansion, recovery',
    'Drain through the port, re-expansion morph',
    8,
    'finish-and-complications',
  ],
  [
    'complications',
    'When something goes wrong',
    'Recognition, first moves, escalation',
    9,
    'finish-and-complications',
  ],
  [
    'what-completion-means',
    "What this course does and doesn't show",
    'Supervised training and credentialing (sourced)',
    5,
    'finish-and-complications',
  ],
]

/**
 * Sections past "in preparation". The first three are written (`content/sections/`) and open to
 * learners only once the lesson that shows them exists; none is available yet.
 */
const SECTION_STATES: Readonly<Partial<Record<ThoracoscopySectionId, SectionState>>> = {
  'normal-pleural-space': 'written',
  'four-controls': 'written',
  'systematic-survey': 'written',
}

export const curriculumSections: readonly CurriculumSection[] = SECTION_ROWS.map(
  ([id, importedTitle, plannedActivity, minutes, chapter], index) => ({
    id,
    number: index + 1,
    title: TITLE_REWORDINGS[id]?.learner ?? importedTitle,
    importedTitle,
    plannedActivity,
    minutes,
    chapter,
    state: SECTION_STATES[id] ?? 'in-preparation',
  }),
)

/**
 * The five chapters. Their names come from the first revision of the plan; which sections belong
 * to which is a proposal the owner has not decided (owner decisions, T1).
 */
export const curriculumChapters: readonly CurriculumChapter[] = [
  {
    id: 'decide',
    title: 'Decide',
    description: 'Whether looking inside will change the plan, and for whom.',
    sectionIds: ['why-thoracoscopy', 'patient-selection'],
  },
  {
    id: 'equipment-and-anatomy',
    title: 'Equipment and anatomy',
    description:
      'The instrument, the room and the chest wall, and a normal pleural space seen from inside.',
    sectionIds: ['the-instrument', 'room-and-tower', 'the-chest-wall', 'normal-pleural-space'],
  },
  {
    id: 'access-and-orientation',
    title: 'Access and orientation',
    description:
      'What you control, where the port goes, how you enter, and how you make room to look.',
    sectionIds: ['four-controls', 'choosing-the-port', 'entry', 'making-room'],
  },
  {
    id: 'survey-and-intervention',
    title: 'Survey and intervention',
    description:
      'A survey in a fixed order, reading what you see, biopsy, energy, adhesions and talc.',
    sectionIds: [
      'systematic-survey',
      'reading-the-pleura',
      'taking-biopsies',
      'energy-and-bleeding',
      'adhesions',
      'talc-poudrage',
    ],
  },
  {
    id: 'finish-and-complications',
    title: 'Finish and complications',
    description:
      'Drain and re-expansion, what to do when a complication happens, and what the course does not cover.',
    sectionIds: ['finishing', 'complications', 'what-completion-means'],
  },
]

const sectionById = new Map(curriculumSections.map((section) => [section.id, section]))

function sectionsNumbered(...numbers: number[]): ThoracoscopySectionId[] {
  return numbers.map((number) => THORACOSCOPY_SECTION_IDS[number - 1])
}

export const practiceScenarios: readonly PracticeScenario[] = [
  {
    id: 'P1',
    title: 'High hemidiaphragm',
    pairsWith: sectionsNumbered(8),
    state: 'in-preparation',
  },
  {
    id: 'P2',
    title: "Lung won't fall away",
    pairsWith: sectionsNumbered(10, 15),
    state: 'in-preparation',
  },
  {
    id: 'P3',
    title: 'Scattered parietal nodules',
    pairsWith: sectionsNumbered(11, 12),
    state: 'in-preparation',
  },
  {
    id: 'P4',
    title: 'Over the rib vs in the groove',
    pairsWith: sectionsNumbered(13),
    state: 'in-preparation',
  },
  {
    id: 'P5',
    title: 'Non-expandable lung at the end',
    pairsWith: sectionsNumbered(16),
    state: 'in-preparation',
  },
  {
    id: 'P6',
    title: 'Bleeding after a biopsy',
    pairsWith: sectionsNumbered(14),
    state: 'in-preparation',
  },
  {
    id: 'P7',
    title: 'Air leak or subcutaneous emphysema',
    pairsWith: sectionsNumbered(17, 18),
    state: 'in-preparation',
  },
]

export const integratedCases: readonly IntegratedCase[] = [
  { id: 'C1', title: 'Undiagnosed lymphocytic exudate', state: 'in-preparation' },
  {
    id: 'C2',
    title: 'Recurrent malignant effusion with an expandable lung',
    state: 'in-preparation',
  },
  { id: 'C3', title: 'Asbestos exposure with plaques and nodularity', state: 'in-preparation' },
  { id: 'C4', title: 'Malignant effusion with a non-expandable lung', state: 'in-preparation' },
]

/** Who the course is for, and what it assumes. From the original plan, in the learner's words. */
export const COURSE_AUDIENCE = {
  primary: 'Interventional and pulmonary fellows and attendings starting thoracoscopy.',
  prerequisites:
    'It assumes you know pleural ultrasound, thoracentesis and drains, pleural fluid analysis and the basics of malignant effusion.',
} as const

/**
 * What the simulation does not show, for the learner. One statement for each boundary in the
 * manifest, in the same order; the wording spells out abbreviations and says "course".
 */
export const MODEL_BOUNDARIES: readonly string[] = [
  'No haptics, tissue forces or bleeding physiology.',
  'Pressure is shown as qualitative authored states.',
  'Pathology and the talc spray are illustrative.',
  'Anatomy the scan does not contain (the pleura, the intercostal muscles, the neurovascular bundles) is authored teaching geometry.',
  'Sedation, energy settings and reprocessing follow the device instructions for use and local protocol.',
  'Completing the course is not competence.',
]

export function curriculumSection(id: ThoracoscopySectionId): CurriculumSection {
  const section = sectionById.get(id)
  if (!section) throw new Error(`Unknown section: ${id}`)
  return section
}

export function curriculumChapter(id: ChapterId): CurriculumChapter {
  const chapter = curriculumChapters.find((candidate) => candidate.id === id)
  if (!chapter) throw new Error(`Unknown chapter: ${id}`)
  return chapter
}

export const COURSE_MINUTES_ESTIMATE = curriculumSections.reduce(
  (total, section) => total + section.minutes,
  0,
)

/** "19 sections in 5 chapters · about 154 min". Every number counted from the registry. */
export function compositionLine(): string {
  return `${curriculumSections.length} sections in ${curriculumChapters.length} chapters · about ${COURSE_MINUTES_ESTIMATE} min`
}

function validate(): void {
  const problems: string[] = []
  const ids = curriculumSections.map((section) => section.id)
  if (ids.join() !== THORACOSCOPY_SECTION_IDS.join())
    problems.push('sections follow the section-id order')
  // The chapters tile the canonical order exactly once, each a contiguous run.
  const tiled = curriculumChapters.flatMap((chapter) => chapter.sectionIds)
  if (tiled.join() !== ids.join()) problems.push('chapters tile the canonical order exactly once')
  for (const chapter of curriculumChapters) {
    for (const id of chapter.sectionIds) {
      if (sectionById.get(id)?.chapter !== chapter.id)
        problems.push(`${id} is in chapter ${chapter.id}`)
    }
  }
  if (THORACOSCOPY_SPINE.length !== 8) problems.push('the spine has eight phases')
  if (problems.length > 0)
    throw new Error(`Medical Thoracoscopy curriculum:\n${problems.join('\n')}`)

  assertThoracoscopyCopy([
    ...curriculumSections.map((section) => ({
      where: `section ${section.id} title`,
      text: section.title,
    })),
    ...curriculumChapters.flatMap((chapter) => [
      {
        where: `chapter ${chapter.id} title`,
        text: chapter.title,
        options: { allowDigits: false },
      },
      { where: `chapter ${chapter.id} description`, text: chapter.description },
    ]),
    ...practiceScenarios.map((scenario) => ({
      where: `scenario ${scenario.id}`,
      text: scenario.title,
    })),
    ...integratedCases.map((item) => ({ where: `case ${item.id}`, text: item.title })),
    { where: 'audience', text: COURSE_AUDIENCE.primary },
    { where: 'prerequisites', text: COURSE_AUDIENCE.prerequisites },
    ...MODEL_BOUNDARIES.map((text, index) => ({ where: `model boundary ${index + 1}`, text })),
  ])
}

validate()
