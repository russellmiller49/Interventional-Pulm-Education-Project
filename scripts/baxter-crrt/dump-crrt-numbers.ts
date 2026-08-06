/**
 * The CRRT numeric truth surface.
 *
 * Every engine defect worth finding in this module is invisible in a screenshot
 * and obvious in a table of samples. This prints that table for representative
 * CRRT states and exits non-zero if any invariant is broken.
 *
 * Nothing is added to package.json. Run it directly from the repo root:
 *
 *   npx tsx scripts/baxter-crrt/dump-crrt-numbers.ts
 *   CRRT_CASE=CRRT-04 npx tsx scripts/baxter-crrt/dump-crrt-numbers.ts
 *   CRRT_STEPS=24 CRRT_STEP_SECONDS=1800 npx tsx scripts/baxter-crrt/dump-crrt-numbers.ts
 *
 * The flag list should stay empty. A flag means the printed surface and the
 * simulation disagree, not that the therapy is wrong.
 */
import { calculateCrrtMachineFluidLedger } from '../../src/features/baxter-crrt/circuitFluidLedger'
import { baxterCrrtPilotFixtures } from '../../src/features/baxter-crrt/content/pilotCases'
import { createInitialCrrtSimulationState } from '../../src/features/baxter-crrt/engine/initialState'
import { crrtSimulationReducer } from '../../src/features/baxter-crrt/engine/reducer'
import { createSyntheticFixture } from '../../src/features/baxter-crrt/engine/testSupport/syntheticFixture'
import type {
  CrrtEngineFixture,
  CrrtSimulationState,
} from '../../src/features/baxter-crrt/engine/types'
import {
  createInitialPrismaxPilotInterfaceState,
  selectPrismaxPilotCaseOperationsDisplay,
} from '../../src/features/baxter-crrt/engine/deviceAdapters/prismax'
import {
  crrtLivePressureModelBoundaries,
  crrtLivePressureReviewStates,
} from '../../src/features/baxter-crrt/engine/testSupport/livePressureStates'
import {
  auditCrrtFrames,
  collectCrrtNumericRows,
  type CrrtNumericFlag,
  type CrrtNumericRow,
} from '../../src/features/baxter-crrt/numericAudit'

const ONLY_CASE = process.env.CRRT_CASE ?? null
const STEPS = Number(process.env.CRRT_STEPS ?? 12)
const STEP_SECONDS = Number(process.env.CRRT_STEP_SECONDS ?? 3_600)

function pad(value: string, width: number): string {
  return value.length >= width ? value : `${value}${' '.repeat(width - value.length)}`
}

function padStart(value: string, width: number): string {
  return value.length >= width ? value : `${' '.repeat(width - value.length)}${value}`
}

function num(value: number | null, places = 2): string {
  if (value === null) return '--'
  if (!Number.isFinite(value)) return String(value)
  return value.toFixed(places)
}

function runFixture(fixture: CrrtEngineFixture): readonly CrrtSimulationState[] {
  let state = crrtSimulationReducer(createInitialCrrtSimulationState({ fixture }), {
    type: 'SET_DELIVERY_STATE',
    deliveryState: 'running',
  })
  const frames: CrrtSimulationState[] = [state]
  for (let index = 0; index < STEPS; index += 1) {
    state = crrtSimulationReducer(state, { type: 'ADVANCE_TIME', seconds: STEP_SECONDS })
    frames.push(state)
  }
  return frames
}

const KIND_TAG: Readonly<Record<CrrtNumericRow['kind'], string>> = {
  modelled: 'modelled  ',
  calculated: 'calculated',
  authored: 'AUTHORED  ',
  cumulative: 'cumulative',
}

function printRowTable(state: CrrtSimulationState): void {
  const rows = collectCrrtNumericRows(state)
  const metricWidth = Math.max(...rows.map((row) => row.metric.length)) + 2

  console.log(
    `  ${pad('metric', metricWidth)}${padStart('value', 12)}  ${pad('unit', 9)}kind        note`,
  )
  console.log(`  ${'-'.repeat(metricWidth + 12 + 2 + 9 + 12 + 4)}`)
  for (const row of rows) {
    console.log(
      `  ${pad(row.metric, metricWidth)}${padStart(num(row.value), 12)}  ${pad(row.unit, 9)}${KIND_TAG[row.kind]}  ${row.note ?? ''}`.trimEnd(),
    )
  }
}

function printTrajectory(frames: readonly CrrtSimulationState[]): void {
  console.log(
    `  ${pad('t (h)', 8)}${padStart('access', 9)}${padStart('filter', 9)}${padStart('return', 9)}${padStart('effluent', 10)}${padStart('TMP*', 9)}${padStart('drop*', 9)}${padStart('presc', 9)}${padStart('deliv', 9)}${padStart('downtime', 10)}`,
  )
  console.log(`  ${'-'.repeat(91)}`)
  for (const frame of frames) {
    const pressures = frame.circuit.pressures
    const therapy = frame.deliveredTherapy
    console.log(
      `  ${pad((frame.simulationTimeSeconds / 3600).toFixed(1), 8)}` +
        `${padStart(num(pressures.accessPressureMmHg, 1), 9)}` +
        `${padStart(num(pressures.filterPressureMmHg, 1), 9)}` +
        `${padStart(num(pressures.returnPressureMmHg, 1), 9)}` +
        `${padStart(num(pressures.effluentPressureMmHg, 1), 10)}` +
        `${padStart(num(pressures.prismaxTransmembranePressureMmHg, 1), 9)}` +
        `${padStart(num(pressures.prismaxFilterPressureDropMmHg, 1), 9)}` +
        `${padStart(num(therapy.prescribedEffluentDoseMlKgHour, 1), 9)}` +
        `${padStart(num(therapy.deliveredDoseMlKgHour, 1), 9)}` +
        `${padStart(num(therapy.cumulativeDowntimeSeconds, 0), 10)}`,
    )
  }
  console.log(
    '  * TMP and drop are calculated from the four modelled sites; they have no site of their own.',
  )
}

function printLedger(state: CrrtSimulationState): void {
  const ledger = calculateCrrtMachineFluidLedger(state.circuit.flows)
  const ratio =
    ledger.effluentPerMillilitreRemoved === null
      ? 'undefined (nothing is being removed)'
      : `${ledger.effluentPerMillilitreRemoved.toFixed(1)} mL of effluent per mL the patient loses`

  console.log(
    `  enters the blood path       ${padStart(num(ledger.enteringBloodPathMlHour), 10)} mL/h`,
  )
  console.log(
    `  never enters the patient    ${padStart(num(ledger.neverEnteringPatientMlHour), 10)} mL/h  (dialysate)`,
  )
  console.log(
    `  crosses the membrane        ${padStart(num(ledger.crossingMembraneMlHour), 10)} mL/h`,
  )
  console.log(
    `  net returned to the patient ${padStart(num(ledger.netFluidToPatientMlHour), 10)} mL/h`,
  )
  console.log(`  TOTAL EFFLUENT              ${padStart(num(ledger.totalEffluentMlHour), 10)} mL/h`)
  console.log(
    `  MACHINE PATIENT REMOVAL     ${padStart(num(ledger.machinePatientFluidRemovalMlHour), 10)} mL/h`,
  )
  console.log(`  ratio                       ${ratio}`)
}

/* ------------------------------------------------------------------ *
 * Engine versus adapter
 *
 * The live pressure profile may only show what the engine already computed.
 * This table puts the two side by side for every state the surface can reach,
 * so a divergence is a printed mismatch rather than a plausible-looking number
 * on a screen nobody is checking.
 * ------------------------------------------------------------------ */

function pressureCell(value: number | null): string {
  return value === null ? 'unavail' : value.toFixed(1)
}

function printLivePressureComparison(): readonly string[] {
  const problems: string[] = []
  const ui = createInitialPrismaxPilotInterfaceState()

  console.log(`\n${'='.repeat(100)}`)
  console.log('LIVE PRESSURE PROFILE  ·  engine versus adapter')
  console.log('='.repeat(100))
  console.log(
    `\n${pad('state', 26)}${pad('delivery', 9)}${pad('Qacts', 7)}${pad('mode', 7)}${padStart('Q', 5)}  ` +
      ['access', 'filter', 'return', 'effl', 'TMP', 'dP']
        .map((name) => `${padStart(`${name} eng`, 11)}${padStart('adp', 9)}`)
        .join('') +
      `  ${pad('kinds', 8)}${pad('avail', 8)}hist`,
  )

  for (const review of crrtLivePressureReviewStates()) {
    const display = selectPrismaxPilotCaseOperationsDisplay(ui, review.state)
    const engine = review.state.circuit.pressures
    const context = display.treatmentContext
    const pairs: readonly (readonly [string, number | null, number | null])[] = [
      ['access', engine.accessPressureMmHg, display.pressures.accessPressureMmHg],
      ['filter', engine.filterPressureMmHg, display.pressures.filterPressureMmHg],
      ['return', engine.returnPressureMmHg, display.pressures.returnPressureMmHg],
      ['effluent', engine.effluentPressureMmHg, display.pressures.effluentPressureMmHg],
      ['tmp', engine.prismaxTransmembranePressureMmHg, display.pressures.transmembranePressureMmHg],
      [
        'filter-drop',
        engine.prismaxFilterPressureDropMmHg,
        display.pressures.filterPressureDropMmHg,
      ],
    ]
    const bySignalId = new Map(display.pressureSignals.map((signal) => [signal.id, signal]))

    for (const [id, engineValue, adapterValue] of pairs) {
      const described = bySignalId.get(id as never)
      if (engineValue !== adapterValue) {
        problems.push(
          `${review.id}/${id}: engine ${String(engineValue)} != adapter ${String(adapterValue)}`,
        )
      }
      if (described && described.valueMmHg !== engineValue) {
        problems.push(
          `${review.id}/${id}: described ${String(described.valueMmHg)} != engine ${String(engineValue)}`,
        )
      }
      if (engineValue !== null && !Number.isFinite(engineValue)) {
        problems.push(`${review.id}/${id}: nonfinite`)
      }
    }

    for (const signal of display.pressureSignals) {
      const detail = signal.kind === 'directly-modelled-site'
      if (detail !== (signal.nodeId !== null)) {
        problems.push(`${review.id}/${signal.id}: direct/calculated label does not match its node`)
      }
      if (signal.valueMmHg === null && signal.unavailableReason === null) {
        problems.push(`${review.id}/${signal.id}: unavailable with no stated reason`)
      }
      if (signal.valueMmHg === null && signal.availability === 'live-model-value') {
        problems.push(`${review.id}/${signal.id}: no value but reported as live`)
      }
      if (signal.historyAvailability === 'not-recorded' && signal.history.length > 0) {
        problems.push(`${review.id}/${signal.id}: unrecorded channel carries a series`)
      }
    }

    // The withheld quantities are the *calculated* conservation results, not the
    // entered patient-fluid-removal setting, which is legitimate context.
    const serialised =
      JSON.stringify(display.pressureSignals) + JSON.stringify(display.treatmentContext)
    for (const forbidden of [
      'cumulativeMachinePatientFluidRemovalMl',
      'cumulativeWholePatientBalanceMl',
      'fluidLedger',
      'crossingMembrane',
      'netFluidToPatient',
    ]) {
      if (serialised.includes(forbidden)) {
        problems.push(`${review.id}: ${forbidden} reached the pressure surface`)
      }
    }

    const sites = display.pressureSignals.filter((s) => s.kind === 'directly-modelled-site').length
    const relationships = display.pressureSignals.length - sites
    const unavailable = display.pressureSignals.filter((s) => s.valueMmHg === null).length

    console.log(
      `${pad(review.id, 26)}${pad(context.deliveryState, 9)}` +
        `${pad(context.bloodFlowContributesToPressures ? 'yes' : 'no', 7)}` +
        `${pad(context.modality ? context.modality.toUpperCase() : '-', 7)}` +
        `${padStart(String(context.bloodFlowMlMin ?? '-'), 5)}  ` +
        pairs
          .map(([, e, a]) => `${padStart(pressureCell(e), 11)}${padStart(pressureCell(a), 9)}`)
          .join('') +
        `  ${pad(`${sites}s/${relationships}r`, 8)}${pad(`${unavailable} n/a`, 8)}` +
        display.pressureSignals.map((s) => (s.history.length > 0 ? '1' : '0')).join(''),
    )
  }

  console.log(
    '\nhist is one digit per channel in the order access, filter, return, effluent, TMP, filter drop.',
  )
  console.log('States this engine cannot produce, and which are therefore not shown:')
  for (const line of crrtLivePressureModelBoundaries) {
    console.log(`  - ${line}`)
  }
  return problems
}

function main(): void {
  const fixtures: readonly CrrtEngineFixture[] = ONLY_CASE
    ? baxterCrrtPilotFixtures.filter((fixture) => fixture.id === ONLY_CASE)
    : [createSyntheticFixture(), ...baxterCrrtPilotFixtures]

  if (fixtures.length === 0) {
    console.error(
      `No fixture matched CRRT_CASE=${ONLY_CASE}. Available: ${baxterCrrtPilotFixtures
        .map((fixture) => fixture.id)
        .join(', ')}`,
    )
    process.exitCode = 1
    return
  }

  const allFlags: CrrtNumericFlag[] = []

  for (const fixture of fixtures) {
    const frames = runFixture(fixture)
    const last = frames[frames.length - 1]

    console.log(`\n${'='.repeat(100)}`)
    console.log(
      `FIXTURE ${fixture.id}  ·  modality ${fixture.prescription.modality}  ·  ${STEPS} x ${STEP_SECONDS}s`,
    )
    console.log('='.repeat(100))

    console.log('\n-- trajectory --')
    printTrajectory(frames)

    console.log('\n-- fluid conservation (machine ledger, from the prescription flows) --')
    printLedger(last)

    console.log('\n-- every number, with its provenance --')
    printRowTable(last)

    allFlags.push(...auditCrrtFrames(frames))
  }

  const pressureProblems = printLivePressureComparison()

  console.log(`\n${'='.repeat(100)}`)
  console.log(`${allFlags.length} flag(s)`)
  for (const item of allFlags) {
    console.log(`  [${item.kind}] ${item.scenarioId} @ ${item.atSeconds}s · ${item.metric}`)
    console.log(`      ${item.reason}`)
  }
  console.log(`${pressureProblems.length} engine/adapter pressure problem(s)`)
  for (const problem of pressureProblems) console.log(`  ${problem}`)
  if (allFlags.length > 0 || pressureProblems.length > 0) process.exitCode = 1
}

main()
