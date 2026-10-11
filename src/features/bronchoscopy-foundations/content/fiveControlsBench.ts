import type { ScopeGoal, ScopeGoalTest, ScopeViewSpec } from '../components/scope/types'

/**
 * The bench tasks of "Driving the scope": the view and the goals of each. The section file names
 * them as its activities and the lesson units (`fiveControlsLearn.ts`) run them, so a task is
 * written once.
 */
export const FIVE_CONTROLS_VIEW_LINE = 'The tip rests on a bench, outside any airway.'

export const BENCH: ScopeViewSpec = {
  sectionId: 'five-controls',
  mode: 'controls-isolated',
  profile: 'adult-teaching-combined-left-basal-v1',
  start: { kind: 'bench' },
  controls: [],
  assists: {},
  readouts: ['depthMm', 'rotationDeg', 'deflectionDeg'],
  boundary: FIVE_CONTROLS_VIEW_LINE,
  physicalControlLabels: true,
}

// These targets use the engine's bench coordinates, not patient anatomy.
export const GUIDED_BENCH_TARGET: NonNullable<ScopeViewSpec['benchTarget']> = {
  point: [-22, 22, 60],
  radiusMm: 4,
}
export const TRANSFER_BENCH_TARGET: NonNullable<ScopeViewSpec['benchTarget']> = {
  point: [0, -22, 60],
  radiusMm: 4,
}

const depthView = { ...BENCH, controls: ['advance', 'withdraw', 'reset'] } as const
const bendView = { ...BENCH, controls: ['deflect', 'reset'] } as const
const rotateView = { ...BENCH, controls: ['rotate', 'deflect', 'reset'] } as const
const combineView = {
  ...BENCH,
  controls: ['rotate', 'deflect', 'advance', 'withdraw', 'reset'],
  benchTarget: GUIDED_BENCH_TARGET,
} as const
const transferView = { ...combineView, benchTarget: TRANSFER_BENCH_TARGET } as const
const suctionView = {
  ...BENCH,
  controls: ['suction', 'reset'],
  readouts: ['depthMm', 'suction'],
} as const

const goal = (id: string, label: string, test: ScopeGoalTest): ScopeGoal => ({ id, label, test })

const depthGoal = goal(
  'advance-then-withdraw',
  'Move forward, then return to the starting depth.',
  {
    type: 'all',
    tests: [
      { type: 'event-sequence', events: ['advanced', 'withdrawn'] },
      { type: 'metric', metric: 'depthMm', op: '>=', value: 0 },
      { type: 'metric', metric: 'depthMm', op: '<=', value: 0 },
    ],
  },
)
const bendGoal = goal('bend-and-release', 'Bend the tip, then return it to straight.', {
  type: 'all',
  tests: [
    { type: 'event-sequence', events: ['control-used:deflection', 'control-used:deflection'] },
    { type: 'metric', metric: 'deflectionDeg', op: '>=', value: 0 },
    { type: 'metric', metric: 'deflectionDeg', op: '<=', value: 0 },
  ],
})
function targetGoal(view: ScopeViewSpec): ScopeGoal {
  return goal(
    'center-and-approach',
    'Keep the target centered as you advance into the depth band.',
    {
      type: 'all',
      tests: [
        { type: 'bench-target', point: view.benchTarget!.point, toleranceDeg: 5 },
        { type: 'metric', metric: 'depthMm', op: '>=', value: 12 },
        { type: 'metric', metric: 'depthMm', op: '<=', value: 16 },
        { type: 'event', event: 'advanced' },
        { type: 'without', event: 'bench-advanced-off-target' },
      ],
    },
  )
}

export interface FiveControlsTask {
  readonly view: ScopeViewSpec
  readonly goals: readonly ScopeGoal[]
}

export const FIVE_CONTROLS_TASK_IDS = [
  'depth',
  'depth-repeat',
  'bend',
  'bend-repeat',
  'rotation',
  'rotation-repeat',
  'combine',
  'suction',
  'suction-repeat',
  'transfer',
] as const
export type FiveControlsTaskId = (typeof FIVE_CONTROLS_TASK_IDS)[number]

export const FIVE_CONTROLS_TASKS: Readonly<Record<FiveControlsTaskId, FiveControlsTask>> = {
  depth: { view: depthView, goals: [depthGoal] },
  'depth-repeat': { view: depthView, goals: [depthGoal] },
  bend: { view: bendView, goals: [bendGoal] },
  'bend-repeat': { view: bendView, goals: [bendGoal] },
  rotation: {
    view: rotateView,
    goals: [
      goal(
        'rotate-bend-rotate',
        'Turn the straight scope, bend the tip, then turn it while it stays bent.',
        {
          type: 'all',
          tests: [
            {
              type: 'event-sequence',
              events: ['control-used:rotation', 'control-used:deflection', 'control-used:rotation'],
            },
            { type: 'metric', metric: 'deflectionDeg', op: 'abs>=', value: 1 },
          ],
        },
      ),
    ],
  },
  'rotation-repeat': {
    view: { ...rotateView, controls: ['rotate', 'reset'], defaults: { deflectionDeg: 25 } },
    goals: [
      goal('turn-bent-tip', 'Turn the bent tip without changing its bend or its depth.', {
        type: 'event',
        event: 'control-used:rotation',
      }),
    ],
  },
  combine: { view: combineView, goals: [targetGoal(combineView)] },
  suction: {
    view: suctionView,
    goals: [
      goal('suction-on-off', 'Apply suction, then release it.', {
        type: 'event-sequence',
        events: ['suction-applied', 'suction-released'],
      }),
    ],
  },
  'suction-repeat': {
    view: suctionView,
    goals: [
      goal('suction-repeat', 'Apply suction, then release it.', {
        type: 'event-sequence',
        events: ['suction-applied', 'suction-released'],
      }),
    ],
  },
  transfer: { view: transferView, goals: [targetGoal(transferView)] },
}
