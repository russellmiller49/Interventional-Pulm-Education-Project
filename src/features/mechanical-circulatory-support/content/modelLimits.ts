/** What the simulator is: stated by the frame on every page, and in full on a closing screen. */

/**
 * The module's boundary statement, in full, for a section's closing screen. The module frame carries
 * the same statement, in short, as its closed "Teaching simulator" disclosure.
 */
export const MCS_TEACHING_SIMULATOR_STATEMENT =
  'This is a teaching simulator. Its numbers come from a model of the circulation, not from a patient or a real console. At the bedside, work from the patient, the device in front of you and its instructions for use.'

export const MCS_MODEL_LIMITS_HEADING = 'About this simulator'

export const MCS_MODEL_LIMITS: readonly { readonly id: string; readonly statement: string }[] =
  Object.freeze([{ id: 'teaching-simulator', statement: MCS_TEACHING_SIMULATOR_STATEMENT }])
