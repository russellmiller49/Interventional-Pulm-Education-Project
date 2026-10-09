/** What the simulator is, stated once: on the hub and on the closing screen. */

/** The module's one boundary statement. Shown on the hub, the module frame and the closing screen. */
export const MCS_TEACHING_SIMULATOR_STATEMENT =
  'This is a teaching simulator. Its numbers come from a model of the circulation, not from a patient or a real console. At the bedside, work from the patient, the device in front of you and its instructions for use.'

export const MCS_MODEL_LIMITS_HEADING = 'About this simulator'

export const MCS_MODEL_LIMITS: readonly { readonly id: string; readonly statement: string }[] =
  Object.freeze([{ id: 'teaching-simulator', statement: MCS_TEACHING_SIMULATOR_STATEMENT }])
