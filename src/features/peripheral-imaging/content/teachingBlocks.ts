import type { StageBlockKind } from '@/features/learning-module/stage/StageTeachingScope'

import type { Lesson, TeachingBlock } from '../types'

/**
 * Which phase of a section may show each teaching block.
 *
 * The draft showed every block before its check. On the stage the teaching pane is scoped to the
 * step: the framing and the signals stay visible before the prediction, the mechanism waits for
 * the commitment, and the boundary opens at Explain. An authored `kind` on a block wins; otherwise
 * the first block frames the question, a block with a labelled list is signals, and the last block
 * — where the draft put the mechanism — waits for the commitment. The rendered pre-commit leak scan
 * is what forces a block to `after-commitment` when it names the answer.
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

/** The blocks a learner may read before committing: everything not held for the commitment. */
export function precommitBlocks(lesson: Lesson): readonly TeachingBlock[] {
  return blocksOfKind(lesson, 'question', 'signals', 'pattern', 'discriminators')
}
