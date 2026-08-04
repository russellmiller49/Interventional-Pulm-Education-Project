/**
 * The MCS flow chain as a table of numbers.
 *
 * Every claim the M0/M1 common model makes about flow is a claim about arithmetic the engine
 * performs, and none of it is visible in a screenshot. This harness drives the reducer over
 * representative states, prints the flow account and the derived values side by side, and fails
 * closed when a relationship the pathway cards assert stops holding.
 *
 * Run it directly — there is no package.json script, deliberately, because package.json is a
 * shared file during this parallel round:
 *
 *     npx tsx scripts/critical-care/dump-mcs-signals.ts
 *     MCS_DEVICE=impella npx tsx scripts/critical-care/dump-mcs-signals.ts
 *
 * The `.ts` extension is load-bearing. tsx resolves a `.ts` entrypoint here; an `.mts` entrypoint
 * fails to load the project's ESM/CJS mix, which is why the sibling ECMO and ventilation harnesses
 * go through an esbuild bundle instead. This one does not need to, because it renders no React and
 * therefore never has to load a CSS module.
 *
 * The exit contract follows audit-guides.mts, not dump-ecmo-signals.mts: a flag exits 1. A dump
 * that reports failures and exits 0 cannot gate anything.
 */

import {
  mcsSupportPathwayCards,
  type McsSupportPathwayCard,
} from '../../src/features/mechanical-circulatory-support/content/supportPathways'
import { createInitialMcsState } from '../../src/features/mechanical-circulatory-support/engine/model'
import { mcsReducer } from '../../src/features/mechanical-circulatory-support/engine/reducer'
import type {
  McsAction,
  McsDerivedMetrics,
  McsDeviceKind,
  McsSimulationState,
} from '../../src/features/mechanical-circulatory-support/engine/types'

const ONLY_DEVICE = process.env.MCS_DEVICE as McsDeviceKind | undefined

interface Flag {
  readonly stateId: string
  readonly reason: string
}

interface Observation {
  readonly stateId: string
  readonly note: string
}

const flags: Flag[] = []
const observations: Observation[] = []

function flag(stateId: string, reason: string): void {
  flags.push({ stateId, reason })
}

function observe(stateId: string, note: string): void {
  observations.push({ stateId, note })
}

/** Let the fixed-step solver settle so a row is not a transient. */
function settle(state: McsSimulationState, seconds = 6): McsSimulationState {
  let next = state
  for (let index = 0; index < seconds * 5; index += 1) {
    next = mcsReducer(next, { type: 'TICK', seconds: 0.2 })
  }
  return next
}

function build(device: McsDeviceKind, actions: readonly McsAction[]): McsSimulationState {
  let state = createInitialMcsState('learn', device, null, 417)
  for (const action of actions) state = mcsReducer(state, action)
  return settle(state)
}

interface Row {
  readonly id: string
  readonly device: McsDeviceKind
  readonly label: string
  readonly state: McsSimulationState
}

function n(value: number | null, digits = 2): string {
  if (value === null) return '—'
  return Number.isFinite(value) ? value.toFixed(digits) : 'NONFINITE'
}

const NUMERIC_METRIC_KEYS = [
  'nativeFlowLMin',
  'leftDeviceFlowLMin',
  'rightDeviceFlowLMin',
  'pumpBalanceLMin',
  'deviceFlowLMin',
  'effectiveSystemicFlowLMin',
  'recirculatingFlowLMin',
  'mapMmHg',
  'pulsePressureMmHg',
  'rapMmHg',
  'pcwpMmHg',
  'lvedpMmHg',
  'lvedvMl',
  'papSystolicMmHg',
  'papDiastolicMmHg',
  'papi',
  'cardiacPowerOutputW',
  'svo2Percent',
] as const satisfies readonly (keyof McsDerivedMetrics)[]

const OPTIONAL_NUMERIC_METRIC_KEYS = [
  'timingQualityPercent',
  'pumpPowerW',
  'pulsatilityIndex',
] as const satisfies readonly (keyof McsDerivedMetrics)[]

/**
 * The states the table covers.
 *
 * Chosen to exercise each pathway topology at least twice — once at a baseline and once where the
 * flow account has something to say: a right pump running beside a left pump (serial), aortic
 * insufficiency (a stream that returns to where it came from), a preload-limited pump, and a
 * loading change that moves flow without any setting change.
 */
function buildRows(): readonly Row[] {
  const rows: Row[] = []

  const iabp: readonly (readonly [string, string, readonly McsAction[]])[] = [
    ['iabp-baseline', 'Counterpulsation, timing aligned, 1:1', []],
    [
      'iabp-late-deflation',
      'Late deflation, 1:1',
      [{ type: 'SET_IABP_CONTROL', control: 'deflationOffsetMs', value: 150 }],
    ],
    [
      'iabp-weaned-1-3',
      'Assist ratio 1:3',
      [{ type: 'SET_IABP_CONTROL', control: 'assistRatio', value: 3 }],
    ],
    [
      'iabp-rv-limited',
      'Timing aligned, right ventricle limiting',
      [{ type: 'SET_PATIENT_CONTROL', control: 'rightVentricularContractility', value: 0.34 }],
    ],
  ]

  const impella: readonly (readonly [string, string, readonly McsAction[]])[] = [
    ['impella-cp-p5', 'Left CP at P-5, correct position', []],
    [
      'impella-cp-p8',
      'Left CP at P-8, correct position',
      [{ type: 'SET_IMPELLA_CONTROL', side: 'left', control: 'performanceLevel', value: 8 }],
    ],
    [
      'impella-55-p8',
      'Left 5.5 at P-8',
      [
        { type: 'SET_IMPELLA_CONFIGURATION', control: 'leftVariant', value: '55' },
        { type: 'SET_IMPELLA_CONTROL', side: 'left', control: 'performanceLevel', value: 8 },
      ],
    ],
    [
      'impella-bipella',
      'BiPella — left CP plus right RP, both running',
      [
        { type: 'SET_IMPELLA_CONFIGURATION', control: 'rightEnabled', value: true },
        { type: 'SET_IMPELLA_CONTROL', side: 'right', control: 'performanceLevel', value: 7 },
        { type: 'SET_PATIENT_CONTROL', control: 'rightVentricularContractility', value: 0.36 },
      ],
    ],
    [
      'impella-aortic-insufficiency',
      'Left CP at P-8 with aortic insufficiency',
      [
        { type: 'SET_IMPELLA_CONTROL', side: 'left', control: 'performanceLevel', value: 8 },
        { type: 'SET_PATIENT_CONTROL', control: 'aorticInsufficiencySeverity', value: 0.6 },
      ],
    ],
    [
      'impella-preload-limited',
      'Left CP at P-8, preload limited',
      [
        { type: 'SET_IMPELLA_CONTROL', side: 'left', control: 'performanceLevel', value: 8 },
        { type: 'SET_PATIENT_CONTROL', control: 'preloadPercent', value: 58 },
      ],
    ],
    [
      'impella-high-afterload',
      'Left CP at P-8, high systemic resistance',
      [
        { type: 'SET_IMPELLA_CONTROL', side: 'left', control: 'performanceLevel', value: 8 },
        {
          type: 'SET_PATIENT_CONTROL',
          control: 'systemicVascularResistanceDynSecCm5',
          value: 2000,
        },
      ],
    ],
    [
      'impella-malposition',
      'Left CP at P-8, inlet too deep',
      [
        { type: 'SET_IMPELLA_CONTROL', side: 'left', control: 'performanceLevel', value: 8 },
        { type: 'SET_IMPELLA_CONTROL', side: 'left', control: 'position', value: 'too-deep' },
      ],
    ],
  ]

  const lvad: readonly (readonly [string, string, readonly McsAction[]])[] = [
    ['lvad-baseline', 'Durable pump at 5200 rpm', []],
    [
      'lvad-high-afterload',
      'Durable pump, high systemic resistance',
      [
        {
          type: 'SET_PATIENT_CONTROL',
          control: 'systemicVascularResistanceDynSecCm5',
          value: 2000,
        },
      ],
    ],
    [
      'lvad-rv-limited',
      'Durable pump, right ventricle limiting',
      [{ type: 'SET_PATIENT_CONTROL', control: 'rightVentricularContractility', value: 0.32 }],
    ],
    [
      'lvad-power-lost',
      'Durable pump, external power path lost',
      [{ type: 'SET_LVAD_CONTROL', control: 'powerConnected', value: false }],
    ],
    [
      'lvad-thrombosis-pattern',
      'Durable pump, high-power pattern',
      [{ type: 'SET_LVAD_CONTROL', control: 'suspectedPumpThrombosis', value: true }],
    ],
  ]

  const byDevice: Record<
    McsDeviceKind,
    readonly (readonly [string, string, readonly McsAction[]])[]
  > = { iabp, impella, lvad }

  for (const device of ['iabp', 'impella', 'lvad'] as const) {
    if (ONLY_DEVICE && ONLY_DEVICE !== device) continue
    for (const [id, label, actions] of byDevice[device]) {
      rows.push({ id, device, label, state: build(device, actions) })
    }
  }

  return rows
}

// ── Invariants ────────────────────────────────────────────────────────────────

/** Tolerance for a relationship the engine computes in floating point and rounds for display. */
const EPSILON = 0.02

function checkFiniteness(row: Row): void {
  const metrics = row.state.metrics
  for (const key of NUMERIC_METRIC_KEYS) {
    const value = metrics[key] as number
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      flag(row.id, `${key} is not a finite number (${String(value)})`)
    }
  }
  for (const key of OPTIONAL_NUMERIC_METRIC_KEYS) {
    const value = metrics[key] as number | null
    if (value !== null && (typeof value !== 'number' || !Number.isFinite(value))) {
      flag(row.id, `${key} is neither null nor a finite number (${String(value)})`)
    }
  }
  if (typeof metrics.aorticValveOpening !== 'boolean') {
    flag(row.id, 'aorticValveOpening is not a boolean')
  }
}

/**
 * Effective systemic flow must be reachable from the pathway topology.
 *
 * Counterpulsation moves no blood, so effective flow is native flow and nothing else. A left-sided
 * pump adds a parallel stream and loses whatever regurgitates. A right-sided pump is serial with a
 * left-sided one and must never appear in the systemic total.
 */
function checkTopology(row: Row): void {
  const m = row.state.metrics

  if (row.device === 'iabp') {
    if (Math.abs(m.deviceFlowLMin) > EPSILON) {
      flag(
        row.id,
        `counterpulsation reported a device flow of ${n(m.deviceFlowLMin)} L/min — this pathway moves no blood of its own`,
      )
    }
    if (Math.abs(m.effectiveSystemicFlowLMin - m.nativeFlowLMin) > EPSILON) {
      flag(
        row.id,
        `effective flow ${n(m.effectiveSystemicFlowLMin)} differs from native flow ${n(m.nativeFlowLMin)} with no device stream to explain it`,
      )
    }
    return
  }

  const expected = m.nativeFlowLMin + m.leftDeviceFlowLMin - m.recirculatingFlowLMin
  if (Math.abs(m.effectiveSystemicFlowLMin - expected) > EPSILON) {
    flag(
      row.id,
      `effective flow ${n(m.effectiveSystemicFlowLMin)} is not native ${n(m.nativeFlowLMin)} + left-sided ${n(m.leftDeviceFlowLMin)} − returning ${n(m.recirculatingFlowLMin)} = ${n(expected)}`,
    )
  }

  // The serial-flow trap: a right-sided pump's output must not appear in the systemic total.
  if (m.rightDeviceFlowLMin > EPSILON) {
    const summedSerially =
      m.nativeFlowLMin + m.leftDeviceFlowLMin + m.rightDeviceFlowLMin - m.recirculatingFlowLMin
    if (m.effectiveSystemicFlowLMin > summedSerially - m.rightDeviceFlowLMin + EPSILON) {
      flag(
        row.id,
        `effective flow ${n(m.effectiveSystemicFlowLMin)} appears to include the ${n(m.rightDeviceFlowLMin)} L/min right-sided delivery — those pumps are serial`,
      )
    }
    if (Math.abs(m.deviceFlowLMin - m.leftDeviceFlowLMin) > EPSILON) {
      flag(
        row.id,
        `the systemic device-flow signal ${n(m.deviceFlowLMin)} is not the left-sided flow ${n(m.leftDeviceFlowLMin)} — it must never carry the right-sided pump`,
      )
    }
  }

  if (m.recirculatingFlowLMin < -EPSILON) {
    flag(row.id, `returning flow is negative (${n(m.recirculatingFlowLMin)})`)
  }
  if (m.recirculatingFlowLMin > m.leftDeviceFlowLMin + EPSILON) {
    flag(
      row.id,
      `returning flow ${n(m.recirculatingFlowLMin)} exceeds the left-sided pump flow ${n(m.leftDeviceFlowLMin)} that produced it`,
    )
  }

  const ceiling =
    m.nativeFlowLMin + m.leftDeviceFlowLMin + m.rightDeviceFlowLMin - m.recirculatingFlowLMin
  if (m.effectiveSystemicFlowLMin > ceiling + EPSILON) {
    flag(
      row.id,
      `effective flow ${n(m.effectiveSystemicFlowLMin)} exceeds every stream the pathway carries (${n(ceiling)})`,
    )
  }
}

/**
 * Device flow rising while the patient does worse.
 *
 * A real and teachable state — it is the module's spine — but only when something in the model
 * accounts for it. Blood returning to the chamber it came from accounts for it. An active alarm
 * accounts for it. A silent divergence does not, and is the signature of an over-counted stream.
 */
function checkFlowVersusOrganResponse(before: Row, after: Row, changeDescription: string): void {
  const a = before.state.metrics
  const b = after.state.metrics
  const deviceRose = b.deviceFlowLMin - a.deviceFlowLMin > 0.1
  if (!deviceRose) return

  const effectiveFell = b.effectiveSystemicFlowLMin - a.effectiveSystemicFlowLMin < -0.1
  const powerFell = b.cardiacPowerOutputW - a.cardiacPowerOutputW < -0.02
  if (!effectiveFell && !powerFell) return

  const recirculationAccountsForIt = b.recirculatingFlowLMin > a.recirculatingFlowLMin + 0.05
  const alarmAccountsForIt = after.state.alarms.some((alarm) => alarm.active)
  if (recirculationAccountsForIt || alarmAccountsForIt) {
    observe(
      after.id,
      `${changeDescription}: displayed flow rose while ${
        effectiveFell ? 'effective flow' : 'cardiac power'
      } fell — accounted for by ${recirculationAccountsForIt ? 'blood returning to its source chamber' : 'an active modeled alarm'}`,
    )
    return
  }

  flag(
    after.id,
    `${changeDescription}: displayed device flow rose from ${n(a.deviceFlowLMin)} to ${n(b.deviceFlowLMin)} while ${
      effectiveFell ? 'effective flow' : 'cardiac power'
    } fell, with no returning flow and no active alarm to account for it`,
  )
}

/**
 * A card must not describe an estimate as a measurement.
 *
 * Nothing in this simulation puts a flow probe in the bloodstream: every device flow the engine
 * reports is computed from pump behaviour and assumed loading. A simulated pathway whose card
 * claims a measured flow is telling the learner the opposite of what the number is.
 */
function checkFlowProvenanceLabels(): void {
  const enginePathwaysReportingFlow: Record<string, boolean> = {
    'iabp-counterpulsation': false,
    'impella-left-transvalvular': true,
    'impella-right-caval-to-pa': true,
    'durable-continuous-flow-lvad': true,
  }

  for (const card of mcsSupportPathwayCards) {
    const simulated = card.availability === 'simulated-in-this-module'
    if (!simulated) continue
    const reportsFlow = enginePathwaysReportingFlow[card.id]
    if (reportsFlow === undefined) {
      flag(card.id, 'a simulated pathway card has no known engine flow behaviour to check against')
      continue
    }
    if (reportsFlow && card.displayedFlow.valueType !== 'estimated') {
      flag(
        card.id,
        `card labels its displayed flow "${card.displayedFlow.valueType}" but this module computes it from pump behaviour — it is an estimate`,
      )
    }
    if (!reportsFlow && card.displayedFlow.valueType !== 'no-device-flow-reported') {
      flag(
        card.id,
        `card labels a displayed flow "${card.displayedFlow.valueType}" for a pathway that reports none`,
      )
    }
    if (
      card.displayedFlow.valueType === 'no-device-flow-reported' &&
      card.productReferences.length > 0
    ) {
      flag(
        card.id,
        'card publishes a product flow figure for a pathway that reports no device flow',
      )
    }
  }

  for (const card of mcsSupportPathwayCards) {
    for (const reference of card.productReferences) {
      if (!reference.measurand.trim()) {
        flag(card.id, `product figure ${reference.valueText} names no measurand`)
      }
    }
  }
}

/**
 * Cardiac power moving opposite to effective flow.
 *
 * Not a defect — cardiac power is a pressure–flow product, so a large enough pressure rise carries
 * it upward while forward flow falls. That is exactly the "pressure improvement is not perfusion
 * improvement" claim the common model makes, so the harness surfaces every instance rather than
 * leaving the module to assert it without a worked case.
 */
function reportPressureFlowDivergence(rows: readonly Row[]): void {
  const baselineByDevice = new Map<McsDeviceKind, Row>()
  for (const row of rows) {
    if (!baselineByDevice.has(row.device)) baselineByDevice.set(row.device, row)
  }
  for (const row of rows) {
    const baseline = baselineByDevice.get(row.device)
    if (!baseline || baseline.id === row.id) continue
    const flowDelta =
      row.state.metrics.effectiveSystemicFlowLMin - baseline.state.metrics.effectiveSystemicFlowLMin
    const powerDelta =
      row.state.metrics.cardiacPowerOutputW - baseline.state.metrics.cardiacPowerOutputW
    if (flowDelta < -0.1 && powerDelta > 0.02) {
      observe(
        row.id,
        `effective flow fell ${n(Math.abs(flowDelta))} L/min against ${baseline.id} while cardiac power rose ${n(powerDelta)} W — MAP ${n(baseline.state.metrics.mapMmHg, 0)} → ${n(row.state.metrics.mapMmHg, 0)} mm Hg carries the product upward`,
      )
    }
  }
}

/**
 * A power signature that moves while flow does not.
 *
 * The durable-pump card says the displayed flow is computed from power and speed and is least
 * trustworthy in exactly the states that disturb that relationship. This reports whether the
 * simulated high-power pattern actually separates the two.
 */
function reportPowerWithoutFlowChange(rows: readonly Row[]): void {
  const baseline = rows.find((row) => row.id === 'lvad-baseline')
  const thrombosis = rows.find((row) => row.id === 'lvad-thrombosis-pattern')
  if (!baseline || !thrombosis) return
  const powerDelta =
    (thrombosis.state.metrics.pumpPowerW ?? 0) - (baseline.state.metrics.pumpPowerW ?? 0)
  const flowDelta =
    thrombosis.state.metrics.effectiveSystemicFlowLMin -
    baseline.state.metrics.effectiveSystemicFlowLMin
  observe(
    'lvad-thrombosis-pattern',
    `the high-power pattern moves pump power ${n(powerDelta)} W while effective flow moves ${n(flowDelta)} L/min — the display and the delivered support come apart, which is the state the card warns about`,
  )
}

/**
 * PAPi's sensitivity, reported rather than flagged.
 *
 * PAPi is one of the two derived values the module carries a guide for, and it is used in the
 * workbench to name an RV-limited phenotype. Whether it actually responds to right-sided support in
 * this model is a fact the owner should see, not something this package may change.
 */
function reportPapiSensitivity(): void {
  if (ONLY_DEVICE && ONLY_DEVICE !== 'impella') return
  const rvLimited: readonly McsAction[] = [
    { type: 'SET_PATIENT_CONTROL', control: 'rightVentricularContractility', value: 0.36 },
  ]
  const withoutRp = build('impella', rvLimited)
  const withRp = build('impella', [
    ...rvLimited,
    { type: 'SET_IMPELLA_CONFIGURATION', control: 'rightEnabled', value: true },
    { type: 'SET_IMPELLA_CONTROL', side: 'right', control: 'performanceLevel', value: 8 },
  ])
  const delta = withRp.metrics.papi - withoutRp.metrics.papi
  observe(
    'papi-sensitivity',
    `PAPi ${n(withoutRp.metrics.papi)} without a right-sided pump vs ${n(withRp.metrics.papi)} with one at P-8 (change ${n(delta)}); RAP ${n(withoutRp.metrics.rapMmHg, 1)} → ${n(withRp.metrics.rapMmHg, 1)}, right-sided flow ${n(withRp.metrics.rightDeviceFlowLMin)} L/min`,
  )
}

// ── Output ────────────────────────────────────────────────────────────────────

function pad(value: string, width: number): string {
  return value.length >= width ? value.slice(0, width) : value + ' '.repeat(width - value.length)
}

const COLUMNS: readonly (readonly [string, number, (row: Row) => string])[] = [
  ['state', 26, (row) => row.id],
  ['native', 7, (row) => n(row.state.metrics.nativeFlowLMin)],
  ['dev-L', 7, (row) => n(row.state.metrics.leftDeviceFlowLMin)],
  ['dev-R', 7, (row) => n(row.state.metrics.rightDeviceFlowLMin)],
  ['dev-sys', 8, (row) => n(row.state.metrics.deviceFlowLMin)],
  ['recirc', 7, (row) => n(row.state.metrics.recirculatingFlowLMin)],
  ['effective', 10, (row) => n(row.state.metrics.effectiveSystemicFlowLMin)],
  ['MAP', 6, (row) => n(row.state.metrics.mapMmHg, 0)],
  ['RAP', 6, (row) => n(row.state.metrics.rapMmHg, 0)],
  ['PCWP', 6, (row) => n(row.state.metrics.pcwpMmHg, 0)],
  ['PAPi', 6, (row) => n(row.state.metrics.papi)],
  ['CPO', 6, (row) => n(row.state.metrics.cardiacPowerOutputW)],
  ['SvO2', 6, (row) => n(row.state.metrics.svo2Percent, 0)],
  ['timing', 7, (row) => n(row.state.metrics.timingQualityPercent, 0)],
  ['power', 7, (row) => n(row.state.metrics.pumpPowerW)],
  ['PI', 6, (row) => n(row.state.metrics.pulsatilityIndex)],
  ['AV', 4, (row) => (row.state.metrics.aorticValveOpening ? 'open' : 'shut')],
]

function printTable(rows: readonly Row[]): void {
  console.log(COLUMNS.map(([label, width]) => pad(label, width)).join(' '))
  console.log(COLUMNS.map(([, width]) => '─'.repeat(width)).join(' '))
  let currentDevice: McsDeviceKind | null = null
  for (const row of rows) {
    if (row.device !== currentDevice) {
      currentDevice = row.device
      console.log(`\n${row.device.toUpperCase()}`)
    }
    console.log(COLUMNS.map(([, width, read]) => pad(read(row), width)).join(' '))
  }
  console.log('\nLegend: flows in L/min · dev-sys is the systemic device-flow signal, which for a')
  console.log('biventricular configuration is the LEFT pump only · recirc is flow returning to the')
  console.log('chamber it came from · timing in %, power in W, PI unitless · AV = aortic valve.\n')
}

function printLabels(rows: readonly Row[]): void {
  console.log('States\n──────')
  for (const row of rows) console.log(`  ${pad(row.id, 26)} ${row.label}`)
  console.log('')
}

function main(): void {
  const rows = buildRows()

  printLabels(rows)
  printTable(rows)

  for (const row of rows) {
    checkFiniteness(row)
    checkTopology(row)
  }
  checkFlowProvenanceLabels()

  // Escalation sweeps: does raising support ever buy a worse patient with no explanation?
  if (!ONLY_DEVICE || ONLY_DEVICE === 'impella') {
    const preloadLimitedBase = build('impella', [
      { type: 'SET_PATIENT_CONTROL', control: 'preloadPercent', value: 58 },
      { type: 'SET_IMPELLA_CONTROL', side: 'left', control: 'performanceLevel', value: 4 },
    ])
    const preloadLimitedEscalated = build('impella', [
      { type: 'SET_PATIENT_CONTROL', control: 'preloadPercent', value: 58 },
      { type: 'SET_IMPELLA_CONTROL', side: 'left', control: 'performanceLevel', value: 9 },
    ])
    checkFlowVersusOrganResponse(
      { id: 'impella-preload-sweep', device: 'impella', label: 'P-4', state: preloadLimitedBase },
      {
        id: 'impella-preload-sweep',
        device: 'impella',
        label: 'P-9',
        state: preloadLimitedEscalated,
      },
      'raising the left-sided performance level from P-4 to P-9 in a preload-limited patient',
    )

    const aiBase = build('impella', [
      { type: 'SET_PATIENT_CONTROL', control: 'aorticInsufficiencySeverity', value: 0.6 },
      { type: 'SET_IMPELLA_CONTROL', side: 'left', control: 'performanceLevel', value: 4 },
    ])
    const aiEscalated = build('impella', [
      { type: 'SET_PATIENT_CONTROL', control: 'aorticInsufficiencySeverity', value: 0.6 },
      { type: 'SET_IMPELLA_CONTROL', side: 'left', control: 'performanceLevel', value: 9 },
    ])
    checkFlowVersusOrganResponse(
      { id: 'impella-ai-sweep', device: 'impella', label: 'P-4', state: aiBase },
      { id: 'impella-ai-sweep', device: 'impella', label: 'P-9', state: aiEscalated },
      'raising the left-sided performance level from P-4 to P-9 with aortic insufficiency',
    )
  }

  reportPressureFlowDivergence(rows)
  reportPowerWithoutFlowChange(rows)
  reportPapiSensitivity()

  if (observations.length > 0) {
    console.log(`${observations.length} observation(s) — reported, not failures`)
    for (const item of observations) console.log(`  ${item.stateId}: ${item.note}`)
    console.log('')
  }

  console.log(`${flags.length} flag(s)`)
  for (const item of flags) console.log(`  ${item.stateId}: ${item.reason}`)

  if (flags.length > 0) process.exit(1)
}

main()

export type { McsSupportPathwayCard }
