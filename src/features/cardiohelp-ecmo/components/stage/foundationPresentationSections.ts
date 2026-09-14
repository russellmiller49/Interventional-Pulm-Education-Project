import type { StagePhase } from './stageModel'

export const baselineGroups = {
  vv: ['drainage-and-load', 'membrane-and-return', 'gas-side', 'patient', 'all'],
  va: [
    'drainage-and-load',
    'membrane-and-return',
    'gas-side',
    'patient',
    'parallel-circulation',
    'all',
  ],
} as const
export const baselineGroupLabels: Readonly<Record<string, string>> = {
  'drainage-and-load': 'Drainage and load',
  'membrane-and-return': 'Membrane and return',
  'gas-side': 'Gas side',
  patient: 'Patient',
  'parallel-circulation': 'Parallel circulation',
  all: 'The combined stable run',
}

/** Each original section appears in its assigned task; detailed guides remain at Explain. */
export const foundationPresentationSections: Readonly<
  Record<string, Readonly<Record<StagePhase, readonly string[]>>>
> = {
  'vv-normal-state': {
    recognize: ['vv-topology-heading', 'baseline-heading'],
    predict: [],
    act: ['baseline-heading'],
    observe: ['baseline-heading', 'trend-window-heading', 'derived-values'],
    explain: ['drift-heading', 'beyond-circuit-heading'],
    transfer: ['baseline-heading'],
  },
  'va-normal-state': {
    recognize: ['va-topology-heading', 'va-baseline-heading'],
    predict: [],
    act: ['va-baseline-heading'],
    observe: ['va-baseline-heading', 'va-trend-window-heading', 'derived-values'],
    explain: ['va-parallel-heading', 'va-drift-heading', 'va-beyond-circuit-heading'],
    transfer: ['va-baseline-heading'],
  },
  'vv-series-physiology': {
    recognize: ['series-path-heading'],
    predict: [],
    act: ['two-flows-heading', 'comparison-heading'],
    observe: ['comparison-heading'],
    explain: ['mixture-heading', 'derived-values'],
    transfer: ['comparison-heading'],
  },
  'va-parallel-physiology': {
    recognize: ['parallel-path-heading'],
    predict: [],
    act: ['va-signals-heading', 'va-comparison-heading'],
    observe: ['va-comparison-heading'],
    explain: ['va-mechanisms-heading', 'configuration-strategy', 'derived-values'],
    transfer: ['va-comparison-heading'],
  },
}
