/**
 * Course glossary (EBUS-PRE-REVIEW-04, NAV-3 / L1-4 / L15-4).
 *
 * Every definition below is made of sentences the course already teaches, quoted or trimmed from
 * the place named in `sources`; nothing is written from general knowledge. A term the course
 * uses without defining it (for example "central hilar structure", or abbreviations such as TNM,
 * IASLC, NSCLC and IFU) is deliberately absent and listed for source review instead, because a
 * definition added here would read as authoritative teaching.
 *
 * `firstUse` names the lessons that use a term without teaching it there — lesson 1 uses "N
 * category" sixteen lessons before lesson 17 teaches it — and show it beside their teaching. The
 * lesson that teaches a term does not repeat its own paragraph as a glossary entry. It is a list of
 * places the term is used, not a course order: `curriculum.ts` remains the only order.
 */
export interface GlossaryEntry {
  id: string
  term: string
  definition: string
  /** Where each sentence of the definition comes from, in the course's own words. */
  sources: string[]
  /** The lesson that teaches the term in full, linked from the entry. */
  lessonId?: string
  firstUse: string[]
}

export const GLOSSARY: GlossaryEntry[] = [
  {
    id: 'ebus-tbna',
    term: 'EBUS-TBNA',
    definition:
      'Endobronchial ultrasound-guided transbronchial needle aspiration. Linear EBUS places an ultrasound transducer beside the airway and displays a needle in its imaging plane. EBUS-TBNA can obtain material for diagnosis and nodal staging. Radial EBUS, used to localize peripheral lesions, serves a different procedural role.',
    sources: [
      'Course overview (the expansion of EBUS-TBNA)',
      'Lesson 1, Define the clinical question: first teaching paragraph',
    ],
    lessonId: 'clinical-question',
    firstUse: ['clinical-question'],
  },
  {
    id: 'examination-record',
    term: 'Examination record',
    definition:
      'An examination record connects the clinical request, planned coverage, specimens and unanswered questions. In the course’s record tasks, plans and form entries are learner declarations; specimen and result entries are supplied history.',
    sources: [
      'Lesson 1, Define the clinical question: the note on the first task',
      'Record tasks: “Record identity and source limits”',
    ],
    lessonId: 'clinical-question',
    firstUse: ['clinical-question'],
  },
  {
    id: 'station',
    term: 'Nodal station',
    definition:
      'The IASLC map names compartments. A node’s station is determined by where it lies, not by its size, PET uptake, or sonographic appearance. Record the station before collecting and labeling a specimen.',
    sources: ['Lesson 11, Translate the CT into a nodal map: second teaching paragraph'],
    lessonId: 'ct-map',
    firstUse: ['clinical-question'],
  },
  {
    id: 'n-category',
    term: 'N category (N1, N2, N3)',
    definition:
      'N classification describes regional tumor involvement in the relevant cancer context, not all adenopathy: a non-lung-cancer adenopathy case does not automatically receive an N category. The categories are defined relative to the primary side. The course’s examples: ipsilateral hilar and intrapulmonary nodes, including interlobar nodes, are N1; subcarinal involvement (station 7) is N2 for either primary side; contralateral mediastinal involvement is N3. For a right lung primary, 4L is N3, 7 is N2, and 11R is N1. These are the examples the course teaches, not the complete ninth-edition definitions.',
    sources: [
      'Lesson 1, Define the clinical question: the note on the first task and the rationale of the transfer check',
      'Lesson 17, Systematic staging and TNM ninth edition: second teaching paragraph, worked example and first check',
      'Lesson 15, Hilar and interlobar stations: rationale of the transfer check',
    ],
    lessonId: 'systematic-staging',
    firstUse: ['clinical-question', 'station-seven', 'hilar-interlobar'],
  },
  {
    id: 'n2a-n2b',
    term: 'N2a and N2b',
    definition:
      'In TNM ninth edition, N2a means involvement of a single ipsilateral mediastinal or subcarinal station; N2b means multiple such stations. Count involved stations, not individual nodes or needle passes. This distinction does not itself prescribe treatment.',
    sources: ['Lesson 17, Systematic staging and TNM ninth edition: third teaching paragraph'],
    lessonId: 'systematic-staging',
    firstUse: [],
  },
  {
    id: 'systematic-staging',
    term: 'Systematic staging',
    definition:
      'A planned survey of accessible relevant stations, including the core mediastinal stations 4R, 4L, and 7, reconciled with CT/PET findings and any inaccessible target, rather than a targeted examination.',
    sources: ['Lesson 17, Systematic staging and TNM ninth edition: first teaching paragraph'],
    lessonId: 'systematic-staging',
    firstUse: ['results-reporting'],
  },
  {
    id: 'acoustic-contact',
    term: 'Acoustic contact (coupling)',
    definition:
      'Air between the transducer and the airway wall reflects most of the incident ultrasound. A usable window requires contact between the transducer or fluid-filled balloon and the wall. Gain amplifies received echoes; it cannot replace missing contact.',
    sources: ['Lesson 4, Acoustic contact and coupling: first teaching paragraph'],
    lessonId: 'acoustic-contact',
    firstUse: [],
  },
  {
    id: 'eus-b',
    term: 'EUS-B',
    definition:
      'EUS-B uses the EBUS endoscope from the esophagus. Changing the approach does not change a lymph node’s anatomical station. It can complement airway EBUS, particularly for 4L, 7, and lower mediastinal stations 8 and 9, depending on anatomy and operator expertise. The esophageal route does not replace the airway examination of hilar or interlobar nodes.',
    sources: [
      'Lesson 19, Compare airway and esophageal windows: recall',
      'Lesson 18, Where EUS-B complements EBUS: first and second teaching paragraphs',
    ],
    lessonId: 'eus-b',
    firstUse: ['left-paratracheal', 'eus-b-route-model'],
  },
  {
    id: 'rose',
    term: 'ROSE',
    definition:
      'Rapid on-site evaluation (ROSE) provides immediate feedback about the submitted material and may guide further acquisition or allocation. It does not replace final pathology and does not automatically establish adequacy for all molecular or ancillary tests.',
    sources: ['Lesson 22, Adequacy, passes, and ROSE: first teaching paragraph'],
    lessonId: 'adequacy-rose',
    firstUse: ['specimen-triage'],
  },
  {
    id: 'nonrepresentative',
    term: 'Nonrepresentative sample',
    definition:
      'Blood-only or otherwise nonrepresentative material is not equivalent to a representative negative node. An unexamined station has no tissue result.',
    sources: ['Lesson 26, Interpret the result and close the loop: first teaching paragraph'],
    lessonId: 'results-reporting',
    firstUse: ['adequacy-rose'],
  },
]

export function glossaryForLesson(lessonId: string) {
  return GLOSSARY.filter((entry) => entry.firstUse.includes(lessonId))
}
