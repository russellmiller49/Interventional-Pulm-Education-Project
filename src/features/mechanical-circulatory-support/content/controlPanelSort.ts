import { mcsLearnerCopyErrors } from './learnerCopy'

/**
 * The control-panel moment as something to do.
 *
 * Reading "you can change only a few things" is one thing; sorting the screen into what you can
 * set, what the console reports, and what the patient's loading decides is the act that makes it
 * stick. Seven things a learner meets on these consoles, attributed as a set and committed once,
 * so the whole panel is reasoned about before any row is marked.
 */

export type McsControlPanelBin = 'setting' | 'monitoring' | 'loading'

export interface McsControlPanelSortCandidate {
  readonly id: string
  readonly label: string
  readonly bin: McsControlPanelBin
  /** Shown after the commitment, whichever bin the learner chose. */
  readonly rationale: string
}

export interface McsControlPanelSort {
  readonly prompt: string
  readonly bins: readonly {
    readonly id: McsControlPanelBin
    readonly label: string
    readonly definition: string
  }[]
  readonly candidates: readonly McsControlPanelSortCandidate[]
}

export const MCS_CONTROL_PANEL_SORT: McsControlPanelSort = {
  prompt:
    'Sort each of these into what you can set, what the console reports, and what the patient’s loading decides. Commit them as a set.',
  bins: [
    {
      id: 'setting',
      label: 'You can set it',
      definition:
        'A request to the device. It says what the device is asked for, not what it delivers.',
    },
    {
      id: 'monitoring',
      label: 'The console reports it',
      definition:
        'A reading. It describes what is happening; changing it directly is not on offer.',
    },
    {
      id: 'loading',
      label: 'The patient’s loading decides it',
      definition:
        'A condition of the circulation — volume, resistance, rhythm, the right ventricle — that decides what any setting can deliver.',
    },
  ],
  candidates: [
    {
      id: 'performance-level',
      label: 'The performance level on a transvalvular pump',
      bin: 'setting',
      rationale:
        'A request. It sets what the pump is asked for; the display beside it says what it got.',
    },
    {
      id: 'displayed-flow',
      label: 'The displayed pump flow',
      bin: 'monitoring',
      rationale:
        'A reading, and an estimated one. It is the largest number on the screen and the one most often mistaken for a setting.',
    },
    {
      id: 'assist-ratio',
      label: 'The assist ratio on a balloon',
      bin: 'setting',
      rationale: 'A request: how many beats the balloon assists. It moves no stream of its own.',
    },
    {
      id: 'timing-synchrony',
      label: 'The timing synchrony figure',
      bin: 'monitoring',
      rationale:
        'A reading of how well the timing settings fit the beat. The settings are the offsets; this figure reports them.',
    },
    {
      id: 'pump-power',
      label: 'Pump power on a durable pump',
      bin: 'monitoring',
      rationale:
        'A reading. Speed is set; power is what the pump draws to hold that speed against whatever it faces.',
    },
    {
      id: 'right-atrial-pressure',
      label: 'The right atrial pressure',
      bin: 'loading',
      rationale:
        'The patient’s loading, read at the beginning of the loop. No device setting sets it, and it decides what every pump downstream can draw on.',
    },
    {
      id: 'systemic-resistance',
      label: 'The systemic vascular resistance',
      bin: 'loading',
      rationale:
        'The patient’s loading, at the end of the loop. It decides what every pump ejects against, and no console setting moves it.',
    },
  ],
}

export function validateMcsControlPanelSort(
  sort: McsControlPanelSort = MCS_CONTROL_PANEL_SORT,
): string[] {
  const errors: string[] = []
  const ids = sort.candidates.map((candidate) => candidate.id)
  if (new Set(ids).size !== ids.length) errors.push('two candidates share an id')
  const bins = new Set(sort.bins.map((bin) => bin.id))
  for (const candidate of sort.candidates) {
    if (!bins.has(candidate.bin)) errors.push(`${candidate.id}: unknown bin ${candidate.bin}`)
    errors.push(...mcsLearnerCopyErrors(`${candidate.id}.label`, candidate.label))
    errors.push(...mcsLearnerCopyErrors(`${candidate.id}.rationale`, candidate.rationale))
  }
  for (const bin of sort.bins) {
    if (!sort.candidates.some((candidate) => candidate.bin === bin.id)) {
      errors.push(`bin ${bin.id} has no candidate`)
    }
    errors.push(...mcsLearnerCopyErrors(`bin.${bin.id}.label`, bin.label))
    errors.push(...mcsLearnerCopyErrors(`bin.${bin.id}.definition`, bin.definition))
  }
  errors.push(...mcsLearnerCopyErrors('prompt', sort.prompt))
  return errors
}

const sortErrors = validateMcsControlPanelSort()
if (sortErrors.length > 0) {
  throw new Error(`Invalid MCS control panel sort:\n- ${sortErrors.join('\n- ')}`)
}
