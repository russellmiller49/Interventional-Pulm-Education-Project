import type { StageBlockKind } from '@/features/learning-module/stage/StageTeachingScope'

import type { Lesson, TeachingBlock } from '../types'

/**
 * Legacy block kinds organize the teaching column and source registry. The Learn renderer
 * explicitly exposes explanations before independent application; pending questions use their
 * own disclosure boundary rather than inferring it from these kinds.
 */
export interface ClassifiedBlock {
  readonly block: TeachingBlock
  readonly kind: StageBlockKind
}

export function classifyTeachingBlocks(lesson: Lesson): readonly ClassifiedBlock[] {
  const last = lesson.blocks.length - 1
  return lesson.blocks.map((block, index) => {
    if (block.kind) return { block, kind: block.kind }
    if (index === last && lesson.blocks.length > 1) return { block, kind: 'after-commitment' }
    if (index === 0) return { block, kind: 'question' }
    if (block.points && block.points.length > 0) return { block, kind: 'signals' }
    return { block, kind: 'pattern' }
  })
}

export function blocksOfKind(
  lesson: Lesson,
  ...kinds: readonly StageBlockKind[]
): readonly TeachingBlock[] {
  return classifyTeachingBlocks(lesson)
    .filter((entry) => kinds.includes(entry.kind))
    .map((entry) => entry.block)
}

/** Historical classification helper; independent Learn disclosure is owned by ImagingTeachingColumn. */
export function precommitBlocks(lesson: Lesson): readonly TeachingBlock[] {
  return blocksOfKind(lesson, 'question', 'signals', 'pattern', 'discriminators')
}
