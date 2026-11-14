import { question } from './authoring'
import { EBUS_NUMBERS } from './teachingNumbers'
import type { Question } from './types'
import {
  NODE_FEATURE_ANNOTATIONS,
  type AnnotatedNodeImage,
  type NodeAnnotationLabel,
} from './node-feature-annotations.generated'

/**
 * Lesson 16, node characterization: real EBUS stills chosen by the owner to show one sonographic
 * feature each, with his CVAT outlines (node, distinct and indistinct margin, long and short axes,
 * central hilar structure, coagulation necrosis areas). Definitions follow ICS/IAB 2023 Table 5
 * and Fujiwara 2010. Pathology for these nodes is not part of the course, so no image is offered
 * as a benign or malignant example: each shows a feature.
 */
export const NODE_FEATURE_IMAGE_BASE = '/ebus-guided/node-features/'
const RATIO = EBUS_NUMBERS.value('node-round-ratio')

export interface NodeFeatureImage {
  slug: string
  station: '2R' | '4L' | '4R' | '7'
  /** The crop shown, in image pixels: x, y, width, height. Every outline lies inside it. */
  view: [number, number, number, number]
}

export const NODE_FEATURE_IMAGES: Record<string, NodeFeatureImage> = {
  'station-2r-round-distinct': {
    slug: 'station-2r-round-distinct',
    station: '2R',
    view: [300, 0, 480, 360],
  },
  'station-4l-heterogeneous': {
    slug: 'station-4l-heterogeneous',
    station: '4L',
    view: [330, 0, 520, 390],
  },
  'station-4r-oval-chs': { slug: 'station-4r-oval-chs', station: '4R', view: [380, 0, 480, 360] },
  'station-7-necrosis': { slug: 'station-7-necrosis', station: '7', view: [340, 0, 480, 360] },
  'station-7-indistinct': { slug: 'station-7-indistinct', station: '7', view: [320, 0, 480, 360] },
  'station-7-round-distinct': {
    slug: 'station-7-round-distinct',
    station: '7',
    view: [350, 0, 520, 390],
  },
  'station-7-oval': { slug: 'station-7-oval', station: '7', view: [340, 0, 520, 390] },
  'station-7-homogeneous': { slug: 'station-7-homogeneous', station: '7', view: [0, 0, 628, 520] },
}

export function annotationsFor(slug: string): AnnotatedNodeImage {
  const found = NODE_FEATURE_ANNOTATIONS[slug]
  if (!found) throw new Error('No annotations for EBUS node image ' + slug)
  return found
}

const length = ([a, b]: [number, number][]) => Math.hypot(b[0] - a[0], b[1] - a[1])

/**
 * Long axis ÷ short axis from the drawn axes, to one decimal. Shape needs no calibration: it is a
 * ratio of two lengths on the same image. Absolute size would need the processor's calipers.
 */
export function axisRatio(slug: string): string {
  const shapes = annotationsFor(slug).shapes
  const long = shapes.find((s) => s.label === 'long-axis')
  const short = shapes.find((s) => s.label === 'short-axis')
  if (!long || !short) throw new Error('No axes drawn on ' + slug)
  const [a, b] = [length(long.points), length(short.points)]
  return (Math.max(a, b) / Math.min(a, b)).toFixed(1)
}

/** What each outline is, in the words the legend uses. */
export const OUTLINE_NAMES: Record<NodeAnnotationLabel, string> = {
  node: 'Node outline',
  'distinct-margin': 'Distinct margin',
  'indistinct-margin': 'Indistinct margin',
  chs: 'Central hilar structure',
  cns: 'Hypoechoic area (possible necrosis)',
  'long-axis': 'Long axis',
  'short-axis': 'Short axis',
}

export interface FeatureExample {
  slug: string
  layers: NodeAnnotationLabel[]
  caption: string
}
export interface FeatureTab {
  id: 'size-shape' | 'margin' | 'echogenicity' | 'chs' | 'cns'
  title: string
  definition: string
  /** What the feature does to suspicion, from the same sources. */
  meaning: string
  examples: FeatureExample[]
}

export const FEATURE_TABS: FeatureTab[] = [
  {
    id: 'size-shape',
    title: 'Size and shape',
    definition: `Size is the short axis, measured with calipers at right angles to the long axis. Shape compares the two: round when the long axis is less than ${RATIO} times the short axis, oval when it is more.`,
    meaning: `A short axis ${EBUS_NUMBERS.value('node-short-axis')} and a round shape both favor malignancy. In Fujiwara’s series, round shape predicted metastasis independently; size did not once the other features were counted.`,
    examples: [
      {
        slug: 'station-7-oval',
        layers: ['node', 'long-axis', 'short-axis'],
        caption: `Station 7. Long axis ÷ short axis = ${axisRatio('station-7-oval')}: oval.`,
      },
      {
        slug: 'station-7-round-distinct',
        layers: ['node', 'long-axis', 'short-axis'],
        caption: `Station 7. Long axis ÷ short axis = ${axisRatio('station-7-round-distinct')}: round, and large.`,
      },
    ],
  },
  {
    id: 'margin',
    title: 'Margin',
    definition: `Distinct when ${EBUS_NUMBERS.value('node-distinct-margin')} of the border is sharply seen; indistinct when most of it fades into the surrounding tissue.`,
    meaning:
      'Fujiwara found a distinct margin predicted metastasis, but studies disagree: one large series found distinct margins favored benign nodes. Weigh it with the other features.',
    examples: [
      {
        slug: 'station-2r-round-distinct',
        layers: ['distinct-margin'],
        caption:
          'Station 2R. A small node next to the transducer, with a sharp border all the way round: distinct.',
      },
      {
        slug: 'station-7-indistinct',
        layers: ['node', 'indistinct-margin'],
        caption:
          'Station 7. Two adjacent nodes. The marked segments of their borders fade into the surrounding tissue: indistinct.',
      },
    ],
  },
  {
    id: 'echogenicity',
    title: 'Echogenicity',
    definition:
      'Homogeneous: fine, evenly distributed internal echoes. Heterogeneous: mixed brighter and darker areas within the node.',
    meaning:
      'Heterogeneous echogenicity independently predicted metastasis and is the second most specific single feature.',
    examples: [
      {
        slug: 'station-7-homogeneous',
        layers: ['node'],
        caption:
          'Station 7. Even internal echoes throughout: homogeneous. The node runs past both edges of the sector, so this frame cannot give its size.',
      },
      {
        slug: 'station-4l-heterogeneous',
        layers: ['node'],
        caption:
          'Station 4L. Two adjacent nodes with patchy brighter and darker areas inside them: heterogeneous.',
      },
    ],
  },
  {
    id: 'chs',
    title: 'Central hilar structure',
    definition: 'A linear, flat, hyperechoic band in the center of the node.',
    meaning:
      'Its presence favors a benign node; malignant nodes tend to lose it. An absent CHS is the most sensitive single feature of malignancy.',
    examples: [
      {
        slug: 'station-4r-oval-chs',
        layers: ['node', 'chs', 'long-axis', 'short-axis'],
        caption: `Station 4R. An oval node (long ÷ short = ${axisRatio('station-4r-oval-chs')}) with a bright, flat band along its center: a central hilar structure.`,
      },
    ],
  },
  {
    id: 'cns',
    title: 'Coagulation necrosis sign',
    definition:
      'A hypoechoic area inside the node with no flow on Doppler. On grayscale alone it is only suspected; Doppler confirms it.',
    meaning:
      'The most specific single feature of malignancy. Tuberculosis can show it too, so it does not replace tissue.',
    examples: [
      {
        slug: 'station-7-necrosis',
        layers: ['node', 'cns'],
        caption:
          'Station 7. Several well-defined dark areas inside the node. On this grayscale frame they are a suspected necrosis sign until Doppler shows no flow in them.',
      },
    ],
  },
]

export interface ReadingItem {
  slug: string
  /** The outlines that appear once the learner has answered. */
  layers: NodeAnnotationLabel[]
  question: Question
}

type Option = [text: string, rationale: string]
const read = (id: string, prompt: string, correct: Option, wrong: Option, other: Option) =>
  question('node-reading-' + id, prompt, correct, wrong, other)

/**
 * Lesson 16's image-reading task: one question per image, about the feature that image was
 * chosen to show. The outlines stay hidden until the learner checks an answer or opens the
 * explanation. Nothing is recorded.
 */
export const READING_ITEMS: ReadingItem[] = [
  {
    slug: 'station-7-oval',
    layers: ['node', 'long-axis', 'short-axis'],
    question: read(
      'oval',
      'Station 7. What is the shape of this node?',
      [
        'Oval',
        `The long axis is ${axisRatio('station-7-oval')} times the short axis, well above the ${RATIO} that separates oval from round.`,
      ],
      [
        'Round',
        `Round needs a long axis under ${RATIO} times the short axis. This node is ${axisRatio('station-7-oval')} times as long as it is wide.`,
      ],
      [
        'Cannot be called without calibrated calipers',
        'Shape is a ratio of two lengths on the same image, so it needs no calibration. Size is the feature that needs calipers.',
      ],
    ),
  },
  {
    slug: 'station-2r-round-distinct',
    layers: ['node', 'distinct-margin', 'long-axis', 'short-axis'],
    question: read(
      'round-distinct-small',
      'Station 2R, the small node next to the transducer. Which description fits its shape and margin?',
      [
        'Round, with a distinct margin',
        `The two axes are nearly equal (ratio ${axisRatio('station-2r-round-distinct')}) and the border is sharp all the way round.`,
      ],
      [
        'Oval, with a distinct margin',
        `Oval needs a long axis over ${RATIO} times the short axis; here the ratio is ${axisRatio('station-2r-round-distinct')}.`,
      ],
      [
        'Round, with an indistinct margin',
        'The hypoechoic node is outlined by a sharp border around its whole circumference, which is more than half: distinct.',
      ],
    ),
  },
  {
    slug: 'station-7-round-distinct',
    layers: ['node', 'distinct-margin', 'long-axis', 'short-axis'],
    question: read(
      'round-distinct-large',
      'Station 7. Which two of Fujiwara’s malignant-pattern features does this node show?',
      [
        'Round shape and distinct margin',
        `Long ÷ short is ${axisRatio('station-7-round-distinct')}, so it is round, and the border is sharp along more than half of its circumference.`,
      ],
      [
        'Oval shape and distinct margin',
        `The axes are almost equal (ratio ${axisRatio('station-7-round-distinct')}); oval needs more than ${RATIO}.`,
      ],
      [
        'Round shape and indistinct margin',
        'Most of the border, including the whole lower margin, is sharply seen. That makes it distinct.',
      ],
    ),
  },
  {
    slug: 'station-4r-oval-chs',
    layers: ['node', 'chs', 'long-axis', 'short-axis'],
    question: read(
      'oval-chs',
      'Station 4R. Which two features does this node show?',
      [
        'Oval shape with a central hilar structure',
        `Long ÷ short is ${axisRatio('station-4r-oval-chs')}, and a flat, bright band runs along the center of the node: a CHS.`,
      ],
      [
        'Oval shape with a coagulation necrosis sign',
        'A necrosis sign is darker than the node. The central band here is brighter than the node around it.',
      ],
      [
        'Round shape with a central hilar structure',
        `Round needs a ratio under ${RATIO}; this node is ${axisRatio('station-4r-oval-chs')} times as long as it is wide.`,
      ],
    ),
  },
  {
    slug: 'station-7-homogeneous',
    layers: ['node'],
    question: read(
      'homogeneous',
      'Station 7. How would you describe the internal echoes of this node?',
      [
        'Homogeneous',
        'Fine echoes are spread evenly through the node, with no focal brighter or darker areas.',
      ],
      [
        'Heterogeneous',
        'Heterogeneous means patches of different brightness inside the node. The texture here is even from the near field to the far margin.',
      ],
      [
        'Homogeneous, with a coagulation necrosis sign',
        'There is no focal hypoechoic area inside the node, so there is nothing to check with Doppler.',
      ],
    ),
  },
  {
    slug: 'station-4l-heterogeneous',
    layers: ['node'],
    question: read(
      'heterogeneous',
      'Station 4L, two adjacent nodes. How would you describe their internal echoes?',
      [
        'Heterogeneous',
        'Brighter and darker patches sit side by side inside the nodes rather than an even, fine texture.',
      ],
      [
        'Homogeneous; the darker patches are from low gain',
        'Gain changes the brightness of the whole image at a given depth. Patches of different brightness within one node at the same depth belong to the node.',
      ],
      [
        'Homogeneous, with a central hilar structure',
        'A CHS is one flat, bright band along the center of the node. These nodes show scattered bright and dark areas instead.',
      ],
    ),
  },
  {
    slug: 'station-7-indistinct',
    layers: ['node', 'indistinct-margin'],
    question: read(
      'indistinct',
      'Station 7, two adjacent nodes. How would you describe their margins?',
      [
        'Indistinct',
        'Long stretches of each border fade into the surrounding tissue, so less than half of it is sharply seen.',
      ],
      [
        'Distinct, because the border is sharp where the node meets the airway wall',
        'One sharp segment is not enough. Distinct means more than half of the border is clearly seen.',
      ],
      [
        'Not assessable, because the two nodes touch',
        'Each node’s margin is judged along its own border; touching does not prevent that. Loss of the tissue plane between two nodes is called conglomeration and is recorded separately.',
      ],
    ),
  },
  {
    slug: 'station-7-necrosis',
    layers: ['node', 'cns'],
    question: read(
      'necrosis',
      'Station 7. Several well-defined dark areas sit inside this node. What do you need before calling them a coagulation necrosis sign?',
      [
        'Doppler showing no flow in them',
        'A coagulation necrosis sign is a hypoechoic area without flow. On grayscale alone it is only suspected; Doppler separates it from an intranodal vessel.',
      ],
      [
        'More gain, to see whether they fill in',
        'Gain brightens the whole image. The question is whether blood is flowing in the dark areas, and gain cannot answer it.',
      ],
      [
        'A diameter over 5 mm for each area',
        'The sign has no size threshold. It is defined by low echoes and absent flow.',
      ],
    ),
  },
]
