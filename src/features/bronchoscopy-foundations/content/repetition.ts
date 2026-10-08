import { COURSE_FLOWS, type CourseChunk, type CourseNote } from './courseFlow'
import type { BronchSectionId } from './sectionIds'

/**
 * Where a question or activity repeats the worked example before it (fellow walkthrough A6).
 *
 * The walkthrough's Appendix B lists the pairs in which the worked example and the check that
 * follows share one scene and one answer. Each is inventoried here and said honestly on the screen
 * that repeats: it is rehearsal of reasoning the learner has just read, or retrieval of it later in
 * the section — never a new or changed case. Nothing is hidden to make the repeat harder: the
 * worked teaching stays in front of the question, and "Review the teaching" still opens it.
 *
 * Three of the repeats are produced by the course's own worked visuals (`worked-decision` prints
 * the check's situation, `sort-example` prints the set's first row with its match, `sequence`
 * prints the steps in the worked order). Those are literal redisplays and are named as such.
 *
 * This file changes no item, key, option, id or order. Meaningfully different application cases
 * are proposals for the clinical-review packet (batch 05), not runtime replacements.
 */
export type RepetitionClass =
  /** The repeat follows the worked example directly; the learner rebuilds reasoning just read. */
  | 'guided-rehearsal'
  /** The same situation, returned to after other teaching in the section. */
  | 'later-retrieval'
  /** The screen reprints worked content word for word (a worked visual drawn from the item). */
  | 'literal-redisplay'

export interface RepeatedPair {
  readonly sectionId: BronchSectionId
  /** The chunk whose question or activity repeats the worked example. */
  readonly chunkId: string
  /** The teaching chunk that holds the worked example. */
  readonly workedChunkId: string
  /** The worked block, when the example is an authored block rather than a worked visual. */
  readonly workedBlockId?: string
  readonly repetition: RepetitionClass
  /** What exactly is shared, in a clause that completes the note. */
  readonly shared: string
}

export const REPEATED_PAIRS: readonly RepeatedPair[] = [
  {
    sectionId: 'shared-airway',
    chunkId: 'check',
    workedChunkId: 'worked-safety',
    workedBlockId: 'five-questions-worked',
    repetition: 'guided-rehearsal',
    shared: 'the same situation',
  },
  {
    sectionId: 'clinical-question',
    chunkId: 'application',
    workedChunkId: 'worked-plan',
    repetition: 'literal-redisplay',
    shared: 'its first statement, which is the worked match shown there',
  },
  {
    sectionId: 'clinical-question',
    chunkId: 'check',
    workedChunkId: 'worked-plan',
    workedBlockId: 'four-box-worked',
    repetition: 'later-retrieval',
    shared: 'the same patient and request',
  },
  {
    sectionId: 'pre-use-check',
    chunkId: 'check',
    workedChunkId: 'readiness',
    workedBlockId: 'scene-worked',
    repetition: 'literal-redisplay',
    shared: 'the same situation, restated word for word',
  },
  {
    sectionId: 'sedation-and-monitoring',
    chunkId: 'application',
    workedChunkId: 'medication-record',
    workedBlockId: 'arithmetic-worked',
    repetition: 'guided-rehearsal',
    shared: 'the same record',
  },
  {
    sectionId: 'sedation-and-monitoring',
    chunkId: 'check',
    workedChunkId: 'medication-record',
    workedBlockId: 'arithmetic-worked',
    repetition: 'guided-rehearsal',
    shared: 'the same record',
  },
  {
    sectionId: 'view-loss',
    chunkId: 'check',
    workedChunkId: 'recovery',
    workedBlockId: 'recovery-routine',
    repetition: 'later-retrieval',
    shared: 'the same situation',
  },
  {
    sectionId: 'systematic-survey',
    chunkId: 'check',
    workedChunkId: 'worked-record',
    workedBlockId: 'lower-lobe-worked',
    repetition: 'guided-rehearsal',
    shared: 'the same situation in a different segment',
  },
  {
    sectionId: 'describe-findings',
    chunkId: 'application',
    workedChunkId: 'written-finding',
    workedBlockId: 'finding-described',
    repetition: 'guided-rehearsal',
    shared: 'the same written finding',
  },
  {
    sectionId: 'describe-findings',
    chunkId: 'check',
    workedChunkId: 'written-finding',
    workedBlockId: 'finding-described',
    repetition: 'guided-rehearsal',
    shared: 'the same written finding',
  },
  {
    sectionId: 'washing-and-lavage',
    chunkId: 'application',
    workedChunkId: 'worked-sequence',
    repetition: 'literal-redisplay',
    shared: 'the same steps, which that part lists in the worked order',
  },
  {
    sectionId: 'poor-return',
    chunkId: 'check',
    workedChunkId: 'baseline',
    repetition: 'later-retrieval',
    shared: 'the same segment and scene',
  },
  {
    sectionId: 'specimen-pathway',
    chunkId: 'application',
    workedChunkId: 'identity',
    repetition: 'literal-redisplay',
    shared: 'its first statement, which is the worked match shown there',
  },
  {
    sectionId: 'icu-physiology',
    chunkId: 'application',
    workedChunkId: 'procedure-purpose',
    repetition: 'literal-redisplay',
    shared: 'its first statement, which is the worked match shown there',
  },
]

const LEAD: Readonly<Record<RepetitionClass, string>> = {
  'guided-rehearsal': 'Guided rehearsal, not a new case.',
  'later-retrieval': 'Retrieval practice, not a new case.',
  'literal-redisplay': 'Guided rehearsal, not a new case.',
}

function chunkOf(sectionId: BronchSectionId, chunkId: string): CourseChunk | undefined {
  return COURSE_FLOWS[sectionId]?.find((chunk) => chunk.id === chunkId)
}

/** The line the repeating screen carries: what it shares with the worked example, and where. */
export function repetitionNote(sectionId: BronchSectionId, chunkId: string): CourseNote | null {
  const pair = REPEATED_PAIRS.find(
    (entry) => entry.sectionId === sectionId && entry.chunkId === chunkId,
  )
  if (!pair) return null
  const worked = chunkOf(sectionId, pair.workedChunkId)
  if (!worked) return null
  return {
    kind: 'rehearsal',
    text: `${LEAD[pair.repetition]} This uses ${pair.shared}, worked in “${worked.title}”. It is optional practice at rebuilding that reasoning; the worked teaching stays available.`,
  }
}

/** Words that would claim a repeat is something new. Refused in a repeating chunk's title. */
export const NOVELTY_WORDS = /\b(changed|another|different|new|unseen|fresh)\b/i

export function validateRepeatedPairs(): readonly string[] {
  const errors: string[] = []
  const seen = new Set<string>()
  for (const pair of REPEATED_PAIRS) {
    const where = `Repeated pair ${pair.sectionId}/${pair.chunkId}`
    const key = `${pair.sectionId}/${pair.chunkId}`
    if (seen.has(key)) errors.push(`${where} is listed twice.`)
    seen.add(key)
    const chunk = chunkOf(pair.sectionId, pair.chunkId)
    const worked = chunkOf(pair.sectionId, pair.workedChunkId)
    if (!chunk) errors.push(`${where} names no chunk in the course flow.`)
    if (!worked) errors.push(`${where} names no worked chunk ${pair.workedChunkId}.`)
    if (worked && worked.kind !== 'teach')
      errors.push(`${where}: the worked example must be a teaching part.`)
    if (chunk && worked) {
      const flow = COURSE_FLOWS[pair.sectionId]!
      if (flow.indexOf(worked) >= flow.indexOf(chunk))
        errors.push(`${where}: the worked example must come before its repeat.`)
    }
    if (pair.workedBlockId && worked && !worked.blocks.includes(pair.workedBlockId))
      errors.push(`${where}: block ${pair.workedBlockId} is not in ${pair.workedChunkId}.`)
    if (chunk && NOVELTY_WORDS.test(chunk.title))
      errors.push(`${where}: the title “${chunk.title}” calls a repeat something new.`)
  }
  return errors
}
