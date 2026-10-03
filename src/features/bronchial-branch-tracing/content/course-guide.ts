import type { CtLesson, CtNoduleTarget } from './ct-types'
import { BASE_PATH, LESSONS } from './lessons'
import { ASSESS_TRACES, PRACTICE_TRACES, SEGMENT_PRACTICE_TRACES } from './practice'
import { targetForTrace, traceById } from '../geometry/native-ct'

/**
 * Learner-facing course guide (BBT-PRE-REVIEW-04): one route overview, the four-pattern reference,
 * a short list of terms and the B/S naming key.
 *
 * Nothing here is a new anatomical claim. Counts and targets are read from the lesson and route
 * registries. Pattern definitions are sentences already taught in the pattern lessons (a test holds
 * each one against its lesson), and the pattern names are the ones the repository's clinical review
 * record lists as read from the supplied textbook (docs/bronchial-branch-tracing/clinical-review.md).
 * Every term reuses wording the module already shows elsewhere; the copy/source comparison in
 * docs/gap-remediation/fellow-feedback/bbt/BBT-PRE-REVIEW-04-copy-source-comparison.md names each
 * source.
 */

const lesson = (id: string) => {
  const found = LESSONS.find((l) => l.id === id)
  if (!found) throw new Error(`Unknown lesson ${id}`)
  return found
}
export const lessonNumber = (id: string) => LESSONS.findIndex((l) => l.id === id) + 1
export const lessonHref = (id: string) => `${BASE_PATH}/learn?lesson=${id}`

export interface PatternReference {
  lessonId: string
  /** The name the clinical review record lists for this Chapter 1 concept. */
  name: string
  /** Where the lesson's own text names this pattern, so the mapping is not read from a URL. */
  evidence: string
  /** Sentences already taught in that lesson, reused verbatim. */
  definition: string[]
}

export const PATTERNS: PatternReference[] = [
  {
    lessonId: 'vertical',
    name: 'Vertical',
    evidence: 'vertical pattern',
    definition: [
      'A vertical airway crosses successive axial planes as a compact lumen.',
      'When a bronchus runs close to perpendicular to the axial plane, its lumen appears on successive CT levels.',
    ],
  },
  {
    lessonId: 'horizontal-horizontal',
    name: 'Horizontal–horizontal',
    evidence: 'horizontal–horizontal division',
    definition: [
      'A horizontal airway can travel a considerable distance while remaining within a narrow range of axial levels.',
      'For a horizontal–horizontal division, reconstruct the relationship as seen along the parent airway.',
    ],
  },
  {
    lessonId: 'horizontal-vertical',
    name: 'Horizontal–vertical',
    evidence: 'horizontal–vertical relationship',
    definition: [
      'The daughter’s change in level resolves a horizontal–vertical relationship.',
      'Viewed along a horizontal parent, cranial and caudal daughters can form an up–down relationship.',
    ],
  },
  {
    lessonId: 'horizontal-oblique',
    name: 'Horizontal–oblique',
    evidence: 'oblique daughter leaves a horizontal parent',
    definition: [
      'An oblique branch moves across the image and through the stack.',
      'An oblique daughter leaves a horizontal parent with both in-plane and craniocaudal motion.',
    ],
  },
]

/** A related idea taught in its own lesson; the course does not call it a fifth pattern. */
export const DIRECTION_CHANGE = {
  lessonId: 'orientation-changes',
  name: 'A change in tracing direction',
  definition: [
    'The slice direction can reverse without changing the airway connection.',
    'A route can descend and then turn cranially. Do not force every distal step to move toward a lower slice number. Follow the lumen from the last certain connection.',
  ],
}

export const patternFor = (lessonId: string) => PATTERNS.find((p) => p.lessonId === lessonId)
export const patternSource = (p: { lessonId: string }) => lesson(p.lessonId).sourcePages

/** The lesson text a pattern definition must come from (used by the provenance test). */
export const lessonText = (l: CtLesson) => [l.concept, l.objective, ...l.teaching].join(' ')

export interface Term {
  term: string
  text: string
}

/**
 * Terms at first use. Each reuses the module's existing wording (source named in the copy/source
 * comparison). Kept small and local on purpose: this is not a site glossary.
 */
export const TERMS: Term[] = [
  {
    term: 'Parent airway view',
    text: 'The model camera beside the CT. It looks along the parent airway toward its division, follows the model reference route and records nothing. It is a CT-derived model surface, not recorded bronchoscopy, and turning or reflecting the CT never moves it.',
  },
  {
    term: 'Parent viewpoint',
    text: 'Looking from the parent airway toward its daughter branches, as the bronchoscope does. “Parent observer” and “parent-airway viewpoint” mean the same thing here.',
  },
  {
    term: 'Camera roll',
    text: 'The patient direction held at the top of the parent airway view, declared per region. The caption beside the view names it, for example “anterior at the top of the view”. It is separate from how you turn the CT display.',
  },
  {
    term: 'Display convention (tracing view)',
    text: 'The book’s rotation or reflection of standard axial CT for a region: a left–right reflection for caudal tracing in the middle lobe, lingula and lower lobes; 90° counterclockwise for the right upper lobe; 90° clockwise for the left upper division. These change the display, not the patient anatomy. Standard axial remains a valid tracing display.',
  },
  {
    term: 'Model reference',
    text: 'Gold crosshairs and the reference route come from the existing airway model of this CT. They are location aids for comparison: not reviewed wall contours, not an answer key, and not yet faculty reviewed.',
  },
  {
    term: 'Response slice',
    text: 'The CT plane that locates a supplied parent or daughter point, where a response is placed. You can still browse every neighbouring plane; a mark is a selection, not a wall trace.',
  },
  {
    term: 'Worked example, Try tracing, Compare with reference',
    text: 'A worked example plays the interval with the model reference shown. Try tracing opens a clean view of the same example; Show reference brings the reference back at any time and records nothing. After you check, Compare with reference shows your own marks beside it. Marking an example you have just watched is guided practice on that example, not an independent test.',
  },
  {
    term: 'Save for later and Mark reviewed',
    text: 'Save for later bookmarks a lesson on this device so you can find it again. Mark reviewed is your own note that you reached the end of a lesson. Neither is a result, and neither changes what is open.',
  },
]

/** B/S naming, reusing the sentence the Airway names panel already shows on every route. */
export const NAMING_KEY =
  'R or L gives the side. B denotes a bronchus and S its pulmonary segment. Numbers identify segmental bronchi; a, b and c identify subsegments.'
export const NAMING_USE =
  'Targets are named by the segment they sit in (S); routes are traced through bronchi (B).'
export const SUBSEGMENT_NOTE =
  'Subsegment letters (a, b) follow this source’s labelling and are pending nomenclature review.'

/** Distinguishes a target segment (S code) from the bronchi a route follows (B codes). */
export function targetNaming(target: CtNoduleTarget) {
  const { code, name, bronchusCode } = target.segment
  return {
    segment: `${code} · ${name}`,
    sentence: `The target ${code} (${name.toLowerCase()}) is a segment; its segmental bronchus is ${bronchusCode}${
      target.approachCode !== bronchusCode
        ? `, and the route to this target ends in ${target.approachCode}${
            /\d[a-c]$/.test(target.approachCode)
              ? ' (a subsegment letter pending nomenclature review)'
              : ''
          }`
        : ''
    }.`,
  }
}

/**
 * This CT's slice numbering, stated for the dataset only. native-v1 maps index k to patient
 * z = origin + 0.5·k in LPS, where +z is superior, so a higher index is more cranial.
 */
export const SLICE_DIRECTION_NOTE =
  'In this teaching CT, slice numbers rise toward the head, so stepping from a higher to a lower number moves caudally. That numbering belongs to this CT’s export: read direction from the Caudal and Cranial labels beside the slider, not from the number alone.'

export interface RouteSetEntry {
  traceId: string
  target: CtNoduleTarget
  /** Where else the same route or target already appears in this course. */
  alsoIn: string[]
}

const lessonTraces = (l: CtLesson) => [
  { id: l.example, role: 'worked example' },
  { id: l.prediction, role: 'your trace' },
  { id: l.transfer, role: 'transfer route' },
]

/** The More routes set, with each route's overlap with Lesson 9 and Practice read from the registries. */
export function moreRoutesSet(): RouteSetEntry[] {
  const routeLessons = LESSONS.filter((l) => !l.exercises)
  return ASSESS_TRACES.map((traceId) => {
    const target = targetForTrace(traceById(traceId))
    const alsoIn: string[] = []
    for (const l of routeLessons)
      for (const t of lessonTraces(l))
        if (t.id === traceId) alsoIn.push(`Lesson ${lessonNumber(l.id)} ${t.role}`)
    const practiceTargets = SEGMENT_PRACTICE_TRACES.map((id) => traceById(id).targetId)
    if (practiceTargets.includes(target.id)) alsoIn.push('a Practice target')
    return { traceId, target, alsoIn }
  })
}

export interface CourseMap {
  lessons: number
  estimatedMinutes: number
  practiceTargets: number
  mixedSet: number
  moreRoutes: number
  moreRoutesAlsoInLearn: number
  /** The route lessons those overlapping targets belong to. */
  moreRoutesLearnLessons: number[]
  moreRoutesAlsoInPractice: number
}

export function courseMap(): CourseMap {
  const set = moreRoutesSet()
  return {
    lessons: LESSONS.length,
    estimatedMinutes: LESSONS.reduce((n, l) => n + l.minutes, 0),
    practiceTargets: SEGMENT_PRACTICE_TRACES.length,
    mixedSet: PRACTICE_TRACES.length,
    moreRoutes: ASSESS_TRACES.length,
    moreRoutesAlsoInLearn: set.filter((e) => e.alsoIn.some((a) => a.startsWith('Lesson'))).length,
    moreRoutesLearnLessons: [
      ...new Set(
        set.flatMap((e) =>
          e.alsoIn.filter((a) => a.startsWith('Lesson')).map((a) => Number(a.split(' ')[1])),
        ),
      ),
    ],
    moreRoutesAlsoInPractice: set.filter((e) => e.alsoIn.includes('a Practice target')).length,
  }
}

/** Lesson groups for the overview, by lesson id; titles and numbers come from the registry. */
export const LESSON_GROUPS: { label: string; ids: string[] }[] = [
  {
    label: 'Foundations: one lumen, the parent airway view, a first bifurcation',
    ids: ['follow-one-airway', 'orientation', 'continuity'],
  },
  {
    label: 'The four tracing patterns',
    ids: PATTERNS.map((p) => p.lessonId),
  },
  { label: 'A short route map through three divisions', ids: ['orientation-changes'] },
  { label: 'A complete route to a simulated nodule', ids: ['variants-limits'] },
]

export interface RegionalNote {
  region: string
  heading: string
  text: string
  /** The lesson that traces that region. */
  seeLesson: string
}

/**
 * Conventions for another region, kept reachable in a lesson's optional reference rather than in
 * its main teaching (BBTF-45). The text is the lesson's former sentence, verbatim.
 */
export const REGIONAL_NOTES: Record<string, RegionalNote> = {
  'orientation-changes': {
    region: 'left-upper-division',
    heading: 'Left upper division convention (not this lesson’s LB6 route)',
    text: 'For the left upper division, the book rotates axial images clockwise by 90°. Its term “left superior segment” in this discussion refers to the upper division, not the lower-lobe superior segment.',
    seeLesson: 'horizontal-oblique',
  },
}
