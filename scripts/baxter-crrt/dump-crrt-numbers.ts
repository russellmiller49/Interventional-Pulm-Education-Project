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

  console.log(`\n${'='.repeat(100)}`)
  console.log(`${allFlags.length} flag(s)`)
  for (const item of allFlags) {
    console.log(`  [${item.kind}] ${item.scenarioId} @ ${item.atSeconds}s · ${item.metric}`)
    console.log(`      ${item.reason}`)
  }
  if (allFlags.length > 0) process.exitCode = 1
}

main()
