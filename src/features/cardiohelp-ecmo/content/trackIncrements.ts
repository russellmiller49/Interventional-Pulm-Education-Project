import type { SupportMode } from '../engine/types'
import { ecmoLearnerCopyErrors } from './controlPanel'
import { validateEvidenceIds } from './evidence'

/**
 * Named increments: how much is new when a learner steps up a track.
 *
 * Unquantified difficulty is what makes a module feel as if it escalates suddenly. A counted
 * increment tells the learner exactly how much attention the new track asks for and reassures
 * them that the rest is already theirs. The sentence is authored once, here; the section that
 * opens the track imports it, and the track chooser may repeat it, but neither restates it.
 *
 * VV is the base track and has no increment — there is nothing for it to be "plus". Ideas carry
 * their own sources because each is a claim in its own right: the first is the pump's afterload
 * sensitivity meeting an arterial return, the second is the dual-circulation physiology of
 * venoarterial support.
 */

export interface EcmoTrackIncrementIdea {
  readonly id: string
  readonly label: string
  readonly sentence: string
  readonly sourceIds: readonly string[]
}

export interface EcmoTrackIncrement {
  /** The sentence that opens the track. Counts the ideas out loud. */
  readonly sentence: string
  readonly ideas: readonly [EcmoTrackIncrementIdea, EcmoTrackIncrementIdea]
  readonly sourceIds: readonly string[]
}

export type EcmoTrackIncrements = Readonly<Partial<Record<SupportMode, EcmoTrackIncrement>>>

export const ECMO_TRACK_INCREMENTS = {
  va: {
    sentence:
      'VA is VV plus exactly two ideas: the artery pushes back on the return limb, and there are now two circulations sharing one aorta.',
    ideas: [
      {
        id: 'artery-pushes-back',
        label: 'The artery pushes back',
        sentence:
          'The return limb now empties into an artery, so the pump delivers against the patient’s own arterial pressure, and the circuit’s return pressure is read beside that pressure rather than as it.',
        sourceIds: ['ecmo-book-ch9', 'elso-adult-va-2021'],
      },
      {
        id: 'two-circulations',
        label: 'Two circulations share one aorta',
        sentence:
          'The heart still ejects into the same aorta the circuit returns to, so two streams meet at a place that moves with native ejection, and which of them reaches the upper body is a question the console cannot answer.',
        sourceIds: ['elso-dual-circulation-2024', 'elso-adult-va-2021'],
      },
    ],
    sourceIds: ['elso-adult-va-2021', 'elso-dual-circulation-2024'],
  },
} as const satisfies EcmoTrackIncrements

export function ecmoTrackIncrement(track: SupportMode): EcmoTrackIncrement | null {
  return (ECMO_TRACK_INCREMENTS as EcmoTrackIncrements)[track] ?? null
}

export function validateEcmoTrackIncrements(
  increments: EcmoTrackIncrements = ECMO_TRACK_INCREMENTS,
): readonly string[] {
  const errors: string[] = []

  if (increments.vv !== undefined) {
    errors.push('vv: the base track has no increment — there is nothing for it to be plus')
  }
  if (increments.va === undefined) errors.push('va: the track that adds ideas must count them')

  for (const [track, increment] of Object.entries(increments)) {
    if (!increment) continue
    const where = `${track}.sentence`
    errors.push(...ecmoLearnerCopyErrors(where, increment.sentence))

    if (increment.ideas.length !== 2) {
      errors.push(`${track}: exactly two ideas, found ${increment.ideas.length}`)
    }
    // The count is said out loud in the sentence, so a third idea cannot arrive unannounced.
    if (!/\bexactly two\b/i.test(increment.sentence)) {
      errors.push(`${track}: the sentence must count the ideas out loud`)
    }
    const ids = increment.ideas.map((idea) => idea.id)
    if (new Set(ids).size !== ids.length) errors.push(`${track}: two ideas share an id`)

    for (const idea of increment.ideas) {
      errors.push(...ecmoLearnerCopyErrors(`${track}.${idea.id}.label`, idea.label))
      errors.push(...ecmoLearnerCopyErrors(`${track}.${idea.id}.sentence`, idea.sentence))
      if (idea.sourceIds.length === 0) errors.push(`${track}.${idea.id}: no sources`)
      if (!validateEvidenceIds(idea.sourceIds)) {
        errors.push(`${track}.${idea.id}: names a source that is not registered`)
      }
    }

    if (increment.sourceIds.length === 0) errors.push(`${track}: no sources`)
    if (!validateEvidenceIds(increment.sourceIds)) {
      errors.push(`${track}: names a source that is not registered`)
    }
  }

  return errors
}

const trackIncrementErrors = validateEcmoTrackIncrements()
if (trackIncrementErrors.length > 0) {
  throw new Error(`Invalid ECMO track increments:\n- ${trackIncrementErrors.join('\n- ')}`)
}
