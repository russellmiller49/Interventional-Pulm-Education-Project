/**
 * The names the stage's surfaces carry, so an instruction and a caption use one name for one thing
 * (medical-education-modules P13, "Say where").
 *
 * A step's `lookIn.landmark` must be one of these strings for its pane — or, in the Teaching panel,
 * the heading of one of the section's own teaching blocks. The host renders every one of these as
 * visible text on the surface it names, so "look at the airway map" always points at something
 * called that on screen.
 */
export const STEPS_LANDMARKS = {
  choices: 'the answer choices on this card',
  verdict: 'the verdict on this card',
  sortRows: 'the statements to place on this card',
  identifyRows: 'the views to name on this card',
  sequence: 'the steps to put in order on this card',
  ledger: 'the accounting table on this card',
  report: 'the report fields on this card',
  decision: 'the decision on this card',
  goals: 'the goals on this card',
} as const

export const SIMULATOR_LANDMARKS = {
  scopeView: 'the bronchoscope view',
  controls: 'the scope controls under the view',
  map: 'the airway map',
  record: 'the inspection record',
  readouts: 'the readouts under the controls',
  image: 'the image in this panel',
  photograph: 'the bronchoscope photograph',
  monitor: 'the monitor',
} as const

export const TEACHING_LANDMARKS = {
  purpose: 'What this section is for',
  adds: 'What this section adds',
  anchor: 'The idea in one picture',
  strip: 'The five controls',
  grammar: 'Reading the view',
  boundary: 'What this model leaves out',
} as const

export type StepsLandmark = (typeof STEPS_LANDMARKS)[keyof typeof STEPS_LANDMARKS]
export type SimulatorLandmark = (typeof SIMULATOR_LANDMARKS)[keyof typeof SIMULATOR_LANDMARKS]
export type TeachingLandmark = (typeof TEACHING_LANDMARKS)[keyof typeof TEACHING_LANDMARKS]
