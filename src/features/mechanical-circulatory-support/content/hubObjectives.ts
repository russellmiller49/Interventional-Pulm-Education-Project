import { mcsLessons } from './lessons'

/**
 * What the hub says first (F02): who this is for, what a learner will be able to do, and where the
 * optional refresher is.
 *
 * Every objective names the sections that actually teach it, and the validator refuses one that
 * points at a section the module does not have — so the hub cannot promise something no activity
 * delivers. The wording follows each section's own authored objective; nothing here adds a topic.
 * The audience line and these five sentences are new learner-facing copy and are listed for owner
 * review in the MCS-PRE-REVIEW-04 owner packet (OD-07).
 */

export const MCS_HUB_AUDIENCE = Object.freeze({
  who: 'For adult-ICU clinicians and trainees who are starting to look after patients on an intra-aortic balloon pump (IABP), an Impella, or a durable left ventricular assist device (LVAD).',
  assumes:
    'It assumes you can read an arterial line and right-heart pressures, and that cardiac output, wedge pressure and mixed venous saturation are familiar words. Each is defined again where it is first used.',
})

export const MCS_HUB_REFRESHER = Object.freeze({
  label: 'Optional refresher',
  sentence:
    'If pressures, wedge and cardiac output feel rusty, the ICU Hemodynamics Lab covers them. It is not required: every section here opens without it.',
  linkLabel: 'Open the ICU Hemodynamics Lab',
  href: '/icu-hemodynamics',
})

/** Said beside the stated minutes so an estimate is not read as a measured duration (F39). */
export const MCS_HUB_TIME_NOTE =
  'Minutes are authored estimates for the main path, not measured learner time. Optional references and explanations add reading.'

export interface McsHubObjective {
  readonly id: string
  /** Completes the sentence "After this module you will be able to…". */
  readonly statement: string
  /** The sections that teach it, in pathway order. */
  readonly sectionIds: readonly string[]
}

export const MCS_HUB_OBJECTIVES: readonly McsHubObjective[] = Object.freeze([
  {
    id: 'pressure-versus-flow',
    statement:
      'Tell pressure evidence from flow evidence: say which question a mean arterial pressure answers on its own, and keep native, device and effective systemic flow as three separate lines.',
    sectionIds: ['mcs-foundations-signals', 'mcs-foundations-mechanisms'],
  },
  {
    id: 'iabp-timing',
    statement:
      'Recognize IABP timing relationships — inflation against valve closure, deflation against the next ejection — and say what this model’s trace does and does not reproduce.',
    sectionIds: ['iabp-timing-triggering', 'iabp-efficacy-limits'],
  },
  {
    id: 'impella-unloading-suction',
    statement:
      'Reason through a modeled Impella placement, unloading or suction state: whether a falling flow or a suction alarm is asking for more support or for more filling at the inlet.',
    sectionIds: ['impella-unloading-placement', 'impella-suction-purge-rv'],
  },
  {
    id: 'durable-pump-parameters',
    statement:
      'Read a generic durable pump’s speed, flow, power and pulsatility beside the patient’s pressures and filling, and say what the displayed flow is made from.',
    sectionIds: ['lvad-parameters-assessment', 'lvad-alarms-emergencies'],
  },
  {
    id: 'transfer-versus-delivery',
    statement:
      'Tell what a device transfers from what the circulation effectively receives, and name the limiting side from the filling pressures before naming a device.',
    sectionIds: ['mcs-device-selection-integration'],
  },
])

function validateHubObjectives(): readonly string[] {
  const errors: string[] = []
  const known = new Set(mcsLessons.map((lesson) => lesson.id))
  if (MCS_HUB_OBJECTIVES.length < 3 || MCS_HUB_OBJECTIVES.length > 5)
    errors.push('the hub states three to five objectives')
  const covered = new Set<string>()
  for (const objective of MCS_HUB_OBJECTIVES) {
    if (objective.sectionIds.length === 0)
      errors.push(`${objective.id}: an objective must name the section that teaches it`)
    for (const sectionId of objective.sectionIds) {
      if (!known.has(sectionId)) errors.push(`${objective.id}: unknown section ${sectionId}`)
      if (covered.has(sectionId)) errors.push(`${sectionId} is claimed by two objectives`)
      covered.add(sectionId)
    }
  }
  for (const id of known) if (!covered.has(id)) errors.push(`${id}: no hub objective covers it`)
  return errors
}

const hubObjectiveErrors = validateHubObjectives()
if (hubObjectiveErrors.length > 0) {
  throw new Error(`Invalid MCS hub objectives:\n- ${hubObjectiveErrors.join('\n- ')}`)
}
