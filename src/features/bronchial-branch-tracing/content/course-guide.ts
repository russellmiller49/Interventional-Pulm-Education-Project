import type { CtNoduleTarget } from './ct-types'

/**
 * The short reference every lesson can open: the method's steps, its tips, the naming key and how
 * this CT numbers its slices.
 *
 * The method is the simplified bronchial branch tracing of Mortimer and Saghaie, J Clin Med
 * 2025;14:8009 (paraphrased, not quoted). Subsegment letters follow Kurimoto & Morita, Bronchial
 * Branch Tracing (Springer 2020), pp. 27, 46–47.
 */
export interface MethodStep {
  /** The lesson that teaches this step. */
  lessonId: string
  name: string
  what: string
}
export const METHOD_STEPS: readonly MethodStep[] = [
  {
    lessonId: 'start-at-the-lesion',
    name: 'Start at the lesion',
    what: 'Find the airway that runs into the lesion, or the one that gives the best approach, and follow it back through the slices to the ostium of its segmental bronchus.',
  },
  {
    lessonId: 'views-that-help',
    name: 'Set up the views',
    what: 'Turn or flip the axial CT if it helps you picture the scope’s view, and add a coronal or sagittal reconstruction where the segment runs across the axial plane. Neither is required.',
  },
  {
    lessonId: 'stand-at-the-ostium',
    name: 'Stand at the ostium',
    what: 'Imagine the scope at the ostium, looking in. Draw a circle for that view and write the four directions that lie across it round its edge.',
  },
  {
    lessonId: 'nested-arcs',
    name: 'Draw each division',
    what: 'Scroll to the next division, see which way each branch leaves compared with the others, and draw each as an arc on that side, inside the arc of the branch before. Repeat to the lesion and star the branch that reaches it.',
  },
  {
    lessonId: 'drive-with-the-map',
    name: 'Drive with the map',
    what: 'Past the segmental ostium, take the opening on the side of the arc that holds the star. When the view stops matching the map, back out to the last division you are sure of.',
  },
]

/** Practical points from the method, said once in the reference. */
export const METHOD_TIPS: readonly string[] = [
  'Plan on thin slices: the airways near a peripheral lesion are a millimetre or two across.',
  'A break in a bronchial wall is often where a small branch leaves.',
  'Small pulmonary arteries run with the airways; when an airway is hard to see, follow its artery.',
  'Number the divisions in the order the scope will meet them.',
  'Drawing a generation inside the branches that do not lead to the lesion helps you recognise a turn into a branch that leads away.',
  'The scope rolls as it enters each branch: turn the map, or the scope, to match before choosing.',
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
