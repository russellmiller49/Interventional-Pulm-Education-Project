import type { ThoracoscopySectionSpec } from './types'

/**
 * The parts of a section's lesson, in the default order its question sets (`content/types.ts`,
 * `ThoracoscopySectionSpec`). The orientation (objective, clinical question, what the learner sees
 * and where it comes from, and that the section is not clinically reviewed) and the teaching example
 * come first, the transfer last.
 *
 * - A prediction: the blocks placed before the question; the question; then the new idea and its
 *   anchor, the blocks placed after it, the worked example, the activity, the misconceptions, the
 *   harmful reflex and what the model leaves out.
 * - A retrieval: the new idea and its anchor, the blocks, the worked example, the activity, the
 *   misconceptions, the harmful reflex and what the model leaves out; then the question.
 *
 * The learner may open any part at any time; the order is where Continue leads.
 */
export type LessonPartId =
  | 'orientation'
  | 'teaching-example'
  | `block:${string}`
  | 'question'
  | 'concept'
  | 'worked-example'
  | 'activity'
  | 'misconceptions'
  | 'harmful-reflex'
  | 'model-leaves-out'
  | 'transfer'

export function lessonParts(spec: ThoracoscopySectionSpec): readonly LessonPartId[] {
  const block = (id: string): LessonPartId => `block:${id}`
  const before = spec.blocks
    .filter((entry) => entry.when === 'before-question')
    .map((entry) => block(entry.id))
  const after = spec.blocks
    .filter((entry) => entry.when === 'after-question')
    .map((entry) => block(entry.id))
  const head: LessonPartId[] = [
    'orientation',
    ...(spec.teachingExample ? (['teaching-example'] as const) : []),
  ]
  const rest: LessonPartId[] = [
    'worked-example',
    'activity',
    ...(spec.misconceptions.length > 0 ? (['misconceptions'] as const) : []),
    'harmful-reflex',
    'model-leaves-out',
  ]
  return spec.question.kind === 'prediction'
    ? [...head, ...before, 'question', 'concept', ...after, ...rest, 'transfer']
    : [
        ...head,
        'concept',
        ...spec.blocks.map((entry) => block(entry.id)),
        ...rest,
        'question',
        'transfer',
      ]
}
