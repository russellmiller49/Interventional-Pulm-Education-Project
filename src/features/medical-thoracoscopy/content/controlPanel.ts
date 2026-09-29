import { assertThoracoscopyCopy } from './learnerCopy'
import type { ThoracoscopySectionId } from './sectionIds'
import type { ThoracoscopySpinePhase } from './spine'

/**
 * The control panel: the four things the learner changes in the simulation, from the original
 * plan. They are controls of the model and are labelled that way. Everything else is watched or
 * managed by the team, and whether to go on, sample, treat, stop or call for help is a clinical
 * decision, not a control.
 *
 * The imported statement stays unchanged in the implementation manifest. The learner name of the
 * second control, "Where the scope looks", is a default the owner has not decided (owner
 * decisions, T8): the imported wording trips the learner-copy gate.
 */
export const CONTROL_IDS = ['port', 'scope', 'tool', 'space'] as const

export type ControlId = (typeof CONTROL_IDS)[number]

export interface ControlPart {
  readonly id: string
  readonly name: string
  readonly changes: string
}

export interface ModelControl {
  readonly id: ControlId
  /** The name printed on the control. */
  readonly name: string
  /** What it changes, in one sentence. */
  readonly changes: string
  readonly parts: readonly ControlPart[]
  /** The section that teaches it in full. */
  readonly taughtIn: ThoracoscopySectionId
  /** Where on the procedure line it is first used. */
  readonly firstUsed: ThoracoscopySpinePhase
}

export const CONTROL_PANEL_LABEL = 'Controls of the model'

export const MODEL_CONTROLS: readonly ModelControl[] = [
  {
    id: 'port',
    name: 'Where the port goes',
    changes:
      'Where the sleeve crosses the chest wall. It is chosen before entry, and once the sleeve is in it does not move. In this model it is fixed.',
    parts: [],
    taughtIn: 'choosing-the-port',
    firstUsed: 'Enter',
  },
  {
    id: 'scope',
    name: 'Where the scope looks',
    changes: 'The direction and depth of the telescope, and how it is turned.',
    parts: [
      {
        id: 'pivot',
        name: 'Pivot',
        changes: 'Tilts the telescope about the port. The tip swings the opposite way to the hand.',
      },
      {
        id: 'depth',
        name: 'Depth',
        changes: 'Moves the telescope in or out along the line it already lies on.',
      },
      {
        id: 'roll',
        name: 'Roll',
        changes:
          'Turns the telescope about its own length. The line of sight stays where it was, because the telescope looks straight ahead; the picture turns with it, because the camera is fixed to the eyepiece in this model.',
      },
    ],
    taughtIn: 'four-controls',
    firstUsed: 'Survey',
  },
  {
    id: 'tool',
    name: 'Which tool is in the channel',
    changes: 'What passes down the working channel of the telescope, if anything.',
    parts: [],
    taughtIn: 'taking-biopsies',
    firstUsed: 'Sample',
  },
  {
    id: 'space',
    name: 'What is in the space',
    changes: 'Whether fluid is still in the pleural space, and whether air has come in.',
    parts: [
      { id: 'fluid-out', name: 'Fluid out', changes: 'Draws the fluid out of the space.' },
      {
        id: 'air-in',
        name: 'Air in',
        changes: 'Lets air in through the open port as the fluid leaves.',
      },
    ],
    taughtIn: 'making-room',
    firstUsed: 'Make room',
  },
]

/** Watched or managed by the team, never a control of the model. */
export const WATCHED_BY_THE_TEAM: readonly string[] = [
  'The lung',
  'The heart',
  'The diaphragm',
  'Breathing',
  'Sedation',
]

export function modelControl(id: ControlId): ModelControl {
  const control = MODEL_CONTROLS.find((entry) => entry.id === id)
  if (!control) throw new Error(`Unknown control: ${id}`)
  return control
}

function validate(): void {
  if (MODEL_CONTROLS.map((control) => control.id).join() !== CONTROL_IDS.join()) {
    throw new Error('Medical Thoracoscopy control panel: the four controls, in order')
  }
  assertThoracoscopyCopy([
    { where: 'control panel label', text: CONTROL_PANEL_LABEL, options: { allowDigits: false } },
    ...MODEL_CONTROLS.flatMap((control) => [
      { where: `control ${control.id} name`, text: control.name, options: { allowDigits: false } },
      { where: `control ${control.id}`, text: control.changes },
      ...control.parts.flatMap((part) => [
        {
          where: `control ${control.id}.${part.id} name`,
          text: part.name,
          options: { allowDigits: false },
        },
        { where: `control ${control.id}.${part.id}`, text: part.changes },
      ]),
    ]),
    ...WATCHED_BY_THE_TEAM.map((text, index) => ({ where: `watched ${index + 1}`, text })),
  ])
}

validate()
