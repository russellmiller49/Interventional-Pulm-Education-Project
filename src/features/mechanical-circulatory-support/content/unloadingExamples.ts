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

/** Matched-time arithmetic on display metrics, without asserting hidden precision. */
export const MCS_UNLOADING_DELTA_CAPTION =
  'The last column subtracts the rounded P5 control from the rounded changed setting at the same simulated instant. “No resolvable displayed change” means those displayed values are equal. This table does not quantify a smaller underlying change. Idle drift across different times is not a resolution threshold for this matched-time comparison.'
