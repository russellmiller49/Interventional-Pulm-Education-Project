import type { McsDeviceKind } from '../engine/types'
import { mcsLearnerCopyErrors, mcsSourceIdsRegistered } from './learnerCopy'

/**
 * Named increments: every step up in complexity says how big it is.
 *
 * Each device pair opens with one sentence that counts the new ideas out loud, so a learner who
 * has the common model knows exactly how much of what follows is new and how much is already
 * theirs. The integration section counts zero: it adds no mechanism, only the choice among them.
 * The count is in the sentence and in the list, and the validator holds them to each other, so a
 * third idea cannot arrive unannounced.
 */

export type McsIncrementTrack = McsDeviceKind | 'integration'

export interface McsDeviceIncrement {
  readonly track: McsIncrementTrack
  /** The section that opens the track and carries the sentence. */
  readonly carrierSectionId: string
  readonly sentence: string
  readonly ideas: readonly { readonly id: string; readonly idea: string }[]
  readonly sourceIds: readonly string[]
}

const COUNT_WORDS: readonly string[] = ['no', 'one', 'exactly two', 'exactly three']

export const MCS_DEVICE_INCREMENTS: readonly McsDeviceIncrement[] = Object.freeze([
  {
    track: 'iabp',
    carrierSectionId: 'iabp-timing-triggering',
    sentence:
      'Counterpulsation is the common model plus one new idea: a device that changes pressure and timing without moving a stream of its own.',
    ideas: [
      {
        id: 'pressure-not-flow',
        idea: 'The balloon changes when and against what the ventricle ejects. There is no second stream, so there is nothing to add to the native output.',
      },
    ],
    sourceIds: ['mcs-bedside-reference-supplied', 'getinge-iabp-current'],
  },
  {
    track: 'impella',
    carrierSectionId: 'impella-unloading-placement',
    sentence:
      'The transvalvular pump is counterpulsation plus exactly two new ideas: a real second stream, whose number is an estimate; and a relieved chamber whose filling the right ventricle still has to deliver.',
    ideas: [
      {
        id: 'second-stream',
        idea: 'A stream of blood now moves through the device from the ventricle to the aorta, and the number the console shows for it is an estimate of movement along the pathway, not a measurement of arrival.',
      },
      {
        id: 'inherited-right-ventricle',
        idea: 'The left ventricle is relieved directly, but the pump can only move what crossed the lung, so the right ventricle inherits the whole requirement.',
      },
    ],
    sourceIds: ['mcs-bedside-reference-supplied', 'fda-impella-cp-labeling'],
  },
  {
    track: 'lvad',
    carrierSectionId: 'lvad-parameters-assessment',
    sentence:
      'The durable pump is the transvalvular pump plus one new idea: the flow number on its controller is a different kind of number, and the decision to use the pump is a different kind of decision.',
    ideas: [
      {
        id: 'computed-flow',
        idea: 'Displayed flow is derived from pump power and speed against assumed loading, so it is least trustworthy in exactly the states that disturb that relationship — and candidacy, implantation and an exit strategy are settled before support begins.',
      },
    ],
    sourceIds: ['mcs-bedside-reference-supplied', 'ishlt-durable-mcs-2023', 'fda-heartmate3-ifu'],
  },
  {
    track: 'integration',
    carrierSectionId: 'mcs-device-selection-integration',
    sentence:
      'Choosing among them adds no new mechanism. The limiting problem, named from the filling pressures before any device is named, is what selects.',
    ideas: [],
    sourceIds: ['mcs-bedside-reference-supplied', 'ishlt-hfsa-acute-mcs-2023'],
  },
])

export function mcsDeviceIncrement(track: McsIncrementTrack): McsDeviceIncrement | undefined {
  return MCS_DEVICE_INCREMENTS.find((increment) => increment.track === track)
}

export function mcsIncrementForSection(sectionId: string): McsDeviceIncrement | undefined {
  return MCS_DEVICE_INCREMENTS.find((increment) => increment.carrierSectionId === sectionId)
}

export function validateMcsDeviceIncrements(
  increments: readonly McsDeviceIncrement[] = MCS_DEVICE_INCREMENTS,
): string[] {
  const errors: string[] = []
  const tracks = increments.map((increment) => increment.track)
  if (new Set(tracks).size !== tracks.length) errors.push('two increments share a track')
  for (const track of ['iabp', 'impella', 'lvad', 'integration'] as const) {
    if (!tracks.includes(track)) errors.push(`track ${track} has no increment`)
  }
  for (const increment of increments) {
    const countWord = COUNT_WORDS[increment.ideas.length]
    if (countWord === undefined) {
      errors.push(
        `${increment.track}: ${increment.ideas.length} ideas is more than a sentence can count`,
      )
    } else if (
      !new RegExp(`\\b${countWord} new (idea|ideas|mechanism)\\b`, 'i').test(increment.sentence)
    ) {
      errors.push(`${increment.track}: the sentence must say "${countWord} new idea(s)" out loud`)
    }
    const ideaIds = increment.ideas.map((idea) => idea.id)
    if (new Set(ideaIds).size !== ideaIds.length)
      errors.push(`${increment.track}: duplicate idea id`)
    errors.push(...mcsLearnerCopyErrors(`${increment.track}.sentence`, increment.sentence))
    for (const idea of increment.ideas) {
      errors.push(...mcsLearnerCopyErrors(`${increment.track}.${idea.id}`, idea.idea))
    }
    if (increment.sourceIds.length === 0) errors.push(`${increment.track}: no sources`)
    if (!mcsSourceIdsRegistered(increment.sourceIds)) {
      errors.push(`${increment.track}: names a source that is not registered`)
    }
  }
  return errors
}

const incrementErrors = validateMcsDeviceIncrements()
if (incrementErrors.length > 0) {
  throw new Error(`Invalid MCS device increments:\n- ${incrementErrors.join('\n- ')}`)
}
