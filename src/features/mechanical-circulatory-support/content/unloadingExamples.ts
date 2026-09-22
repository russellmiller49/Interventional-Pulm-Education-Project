import { defaultMcsPatient } from './scenarios'

/** Existing reference patient and the low-preload condition from dump-mcs-signals.ts. */
export const mcsUnloadingExamples = [
  { id: 'filled', label: 'Filled reference', preloadPercent: defaultMcsPatient.preloadPercent },
  { id: 'underfilled', label: 'Underfilled example', preloadPercent: 58 },
] as const

export const MCS_UNLOADING_BASE_LEVEL = 5
export const MCS_UNLOADING_COMPARISON_LEVELS = [6, 8] as const
export type McsUnloadingLevel = (typeof MCS_UNLOADING_COMPARISON_LEVELS)[number]

export const mcsUnloadingSignals = [
  ['nativeFlowLMin', 'Concurrent native flow', 'L/min', 2],
  ['leftDeviceFlowLMin', 'Left pump flow estimate', 'L/min', 2],
  ['effectiveSystemicFlowLMin', 'Effective systemic flow', 'L/min', 2],
  ['recirculatingFlowLMin', 'Regurgitant return', 'L/min', 2],
  ['lvedvMl', 'LV end-diastolic volume', 'mL', 0],
  ['pcwpMmHg', 'Wedge pressure', 'mm Hg', 0],
] as const

/**
 * What the comparison says about the size of each matched-time difference.
 *
 * At P5 against P6 the table read a wedge pressure of 18 and 18 and an end-diastolic volume four
 * millilitres apart, and a fellow came away with "Impella hardly unloads the left ventricle"
 * (F24). Printing more decimal places would not have helped and would have been a lie about the
 * model's resolution: the wedge pressure is derived to the nearest millimetre, and this engine's
 * own measured idle drift for it is about a millimetre with nothing done at all. What was missing
 * was the comparison against that drift. Each row now carries its matched-time difference and
 * whether that difference clears the display deadband the module already measured for that
 * quantity, so "too small for this model to resolve" is a readable answer instead of an invisible
 * one — and the response itself is unchanged, unamplified, and still the model's own.
 */
export const MCS_UNLOADING_DELTA_CAPTION =
  'The last column is the P5 control subtracted from the changed setting at the same simulated instant. “Below this model’s resolution” means the difference is smaller than the idle drift this engine shows for that quantity with nothing done to it, so it cannot be read as a response — not that the response is zero.'
