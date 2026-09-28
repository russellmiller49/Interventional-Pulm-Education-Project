import { assertThoracoscopyCopy } from './learnerCopy'
import type { ThoracoscopySectionId } from './sectionIds'

/**
 * Teaching examples: authored states a lesson can load, each labelled as an example.
 *
 * Loading one is not a procedure event. It starts the scene in a state the learner did not bring
 * about, and the lesson says so every time: a loaded example is never the learner's own entry,
 * drainage or observation, and never counts toward anything.
 */
export const TEACHING_EXAMPLE_IDS = ['space-made'] as const

export type TeachingExampleId = (typeof TEACHING_EXAMPLE_IDS)[number]

export interface TeachingExample {
  readonly id: TeachingExampleId
  /** Printed with the example wherever it is shown. */
  readonly label: 'Teaching example'
  readonly title: string
  /** What is already done when it loads, in the learner's words. */
  readonly loaded: string
  /** Said every time it loads: the learner did not do these steps, and where they are taught. */
  readonly notPerformed: string
  /**
   * Where the steps that lead to this state are taught. The lesson lists them by their printed
   * titles, with their current state, so the note stays true when one of them opens.
   */
  readonly stepsTaughtIn: readonly ThoracoscopySectionId[]
  /** The state it loads. Words for now; the space engine gives them their values. */
  readonly state: {
    readonly port: 'prototype-port'
    readonly fluid: 'drained'
    readonly air: 'entered'
    readonly lung: 'fallen-away'
    readonly telescope: 'tip-just-inside'
  }
  readonly claimIds: readonly `MT-C-${string}`[]
}

export const TEACHING_EXAMPLES: readonly TeachingExample[] = [
  {
    id: 'space-made',
    label: 'Teaching example',
    title: 'The space, ready to look',
    loaded:
      'The port is in the right seventh intercostal space on the mid-axillary line, a site chosen for this model and not a recommended one. The fluid has been drained, air has come in through the port, and the lung has fallen away from the chest wall. The telescope tip is just inside the pleural space.',
    notPerformed:
      'You did not do these steps here. Each is taught in its own section, listed with this example.',
    stepsTaughtIn: ['choosing-the-port', 'entry', 'making-room'],
    state: {
      port: 'prototype-port',
      fluid: 'drained',
      air: 'entered',
      lung: 'fallen-away',
      telescope: 'tip-just-inside',
    },
    claimIds: ['MT-C-0001', 'MT-C-0002', 'MT-C-0003'],
  },
]

export function teachingExample(id: TeachingExampleId): TeachingExample {
  const example = TEACHING_EXAMPLES.find((entry) => entry.id === id)
  if (!example) throw new Error(`Unknown teaching example: ${id}`)
  return example
}

assertThoracoscopyCopy(
  TEACHING_EXAMPLES.flatMap((example) => [
    { where: `example ${example.id} title`, text: example.title, options: { allowDigits: false } },
    { where: `example ${example.id} loaded`, text: example.loaded },
    { where: `example ${example.id} not performed`, text: example.notPerformed },
  ]),
)
