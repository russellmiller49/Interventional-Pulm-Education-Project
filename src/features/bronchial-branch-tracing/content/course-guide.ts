import type { CtNoduleTarget } from './ct-types'

/**
 * The short reference every lesson can open: the four fork patterns, the naming key and how this
 * CT numbers its slices.
 *
 * Pattern names and definitions follow Kurimoto & Morita, Bronchial Branch Tracing (Springer
 * 2020), chapter 1, as recorded in docs/bronchial-branch-tracing/clinical-review.md. Subsegment
 * letters follow the same book (pp. 27, 46–47).
 */
export interface PatternReference {
  /** The lesson that works this pattern. */
  lessonId: string
  name: string
  definition: string[]
}

export const PATTERNS: PatternReference[] = [
  {
    lessonId: 'look-up-rul',
    name: 'Vertical',
    definition: [
      'A vertical airway crosses successive axial planes as a compact lumen.',
      'When a bronchus runs close to perpendicular to the axial plane, its lumen appears on successive CT levels.',
    ],
  },
  {
    lessonId: 'middle-lobe-flat',
    name: 'Horizontal–horizontal',
    definition: [
      'A horizontal airway can travel a considerable distance while remaining within a narrow range of axial levels.',
      'For a horizontal–horizontal division, reconstruct the relationship as seen along the parent airway.',
    ],
  },
  {
    lessonId: 'rb5-up-or-down',
    name: 'Horizontal–vertical',
    definition: [
      'The daughter’s change in level resolves a horizontal–vertical relationship.',
      'Viewed along a horizontal parent, cranial and caudal daughters can form an up–down relationship.',
    ],
  },
  {
    lessonId: 'oblique',
    name: 'Horizontal–oblique',
    definition: [
      'An oblique branch moves across the image and through the stack.',
      'An oblique daughter leaves a horizontal parent with both in-plane and craniocaudal motion.',
    ],
  },
]

/** A related idea taught in its own lesson; the course does not call it a fifth pattern. */
export const DIRECTION_CHANGE = {
  lessonId: 'turn-back',
  name: 'A change in tracing direction',
  definition: [
    'The slice direction can reverse without changing the airway connection.',
    'A route can descend and then turn cranially. Do not force every distal step to move toward a lower slice number. Follow the lumen from the last certain connection.',
  ],
}

export const patternFor = (lessonId: string) => PATTERNS.find((p) => p.lessonId === lessonId)

export const NAMING_KEY =
  'R or L gives the side. B denotes a bronchus and S its pulmonary segment. Numbers identify segmental bronchi; a, b and c identify subsegments.'
export const NAMING_USE =
  'Lesions are named by the segment they sit in (S); routes are traced through bronchi (B).'
export const SUBSEGMENT_NOTE =
  'Subsegment letters follow Kurimoto and Morita: RB1a posterior and RB1b anterior; RB5a horizontal and RB5b caudal.'

/**
 * This CT's slice numbering, stated for the dataset only. native-v1 maps index k to patient
 * z = origin + 0.5·k in LPS, where +z is superior, so a higher index is more cranial.
 */
export const SLICE_DIRECTION_NOTE =
  'In this teaching CT, slices are 0.5 mm apart and their numbers rise toward the head. That numbering belongs to this CT’s export: read direction from the Feet and Head buttons beside the slider, not from the number alone.'

/** Distinguishes a lesion's segment (S code) from the bronchi a route follows (B codes). */
export function targetNaming(target: CtNoduleTarget) {
  const { code, name, bronchusCode } = target.segment
  return {
    segment: `${code} · ${name}`,
    sentence: `The lesion is in ${code} (${name.toLowerCase()}), a segment; its segmental bronchus is ${bronchusCode}${
      target.approachCode !== bronchusCode
        ? `, and the route to this lesion ends in ${target.approachCode}`
        : ''
    }.`,
  }
}
