/**
 * The CRRT numeric truth surface.
 *
 * This module holds the *checks*; the dump script under `scripts/baxter-crrt/`
 * is only a printer over them. Keeping the logic here means every flag class is
 * covered by jest rather than by a script nobody runs in CI.
 *
 * Nothing here re-derives physiology. Each check recomputes a published device
 * expression from state the engine already carries and asserts the two agree —
 * so a flag always means the surface and the simulation disagree, never that
 * this file has an opinion about the therapy.
 */

import {
  calculateCrrtMachineFluidLedger,
  calculateCrrtWholePatientLedger,
  checkCrrtFluidConservation,
} from './circuitFluidLedger'
import { crrtPressureSignalDetails } from './content/circuitModel'
import { calculatePrismaxEffluentPumpTargetMlPerHour } from './engine/clinicalMath'
import { getCrrtDeviceCalculationAdapter } from './engine/deviceAdapters/calculations'
import { calculateWholePatientNetBalanceMl } from './engine/fluidModel'
import {
  CRRT_MODEL_EQUIVALENCE_TOLERANCE,
  CRRT_VOLUME_EQUIVALENCE_TOLERANCE_ML,
} from './engine/simulation'
import type { CrrtSimulationState, DowntimeReason } from './engine/types'

export const crrtNumericFlagKinds = [
  'impossible-conservation',
  'nonfinite-value',
  'delivered-exceeds-possible',
  'measured-calculated-mismatch',
  'stale-prescription',
  'unexplained-makeup',
] as const

export type CrrtNumericFlagKind = (typeof crrtNumericFlagKinds)[number]

export interface CrrtNumericFlag {
  readonly kind: CrrtNumericFlagKind
  readonly scenarioId: string
  readonly atSeconds: number
  readonly metric: string
  readonly reason: string
}

/**
 * Downtime buckets the engine declares but never writes. Reporting these as a
 * measured zero would be a lie: the simulation has no path that increments
 * them, so a zero says nothing about the therapy.
 */
export const crrtUnreachableDowntimeReasons: readonly DowntimeReason[] = Object.freeze(['alarm'])

export interface CrrtNumericRow {
  readonly metric: string
  readonly value: number | null
  /**
   * `modelled` — read from a simulated site. `calculated` — device arithmetic
   * over modelled values. `authored` — an input constant the simulation copies
   * through and never computes. `cumulative` — an integral the engine keeps.
   */
  readonly kind: 'modelled' | 'calculated' | 'authored' | 'cumulative'
  readonly unit: string
  readonly note: string | null
}

function near(a: number, b: number, tolerance: number): boolean {
  return Math.abs(a - b) <= tolerance
}

function flag(
  kind: CrrtNumericFlagKind,
  state: CrrtSimulationState,
  metric: string,
  reason: string,
): CrrtNumericFlag {
  return {
    kind,
    scenarioId: state.scenario.fixtureId ?? 'unloaded',
    atSeconds: state.simulationTimeSeconds,
    metric,
    reason,
  }
}

/**
 * Every number the dump prints, with the provenance of each. The kind column is
 * the point: a reader must be able to tell at a glance which numbers came off a
 * simulated transducer, which are arithmetic, and which are authored constants
 * that will not move no matter what the flows do.
 */
export function collectCrrtNumericRows(state: CrrtSimulationState): readonly CrrtNumericRow[] {
  const pressures = state.circuit.pressures
  const therapy = state.deliveredTherapy
  const flows = state.circuit.flows
  const ledger = calculateCrrtMachineFluidLedger(flows)
  // The whole-patient ledger consumes the machine removal term. When that term is
  // withheld the patient balance cannot be stated either, and is reported as
  // withheld rather than computed from a substituted zero.
  const patientLedger =
    ledger.machinePatientFluidRemovalMlHour === null
      ? null
      : calculateCrrtWholePatientLedger(
          state.scenario.externalFluidRates,
          ledger.machinePatientFluidRemovalMlHour,
          state.scenario.unintendedDeviceNetGainRateMlHour,
        )

  const rows: CrrtNumericRow[] = [
    {
      metric: 'access-pressure',
      value: pressures.accessPressureMmHg,
      kind: 'modelled',
      unit: 'mmHg',
      note: null,
    },
    {
      metric: 'filter-pressure',
      value: pressures.filterPressureMmHg,
      kind: 'modelled',
      unit: 'mmHg',
      note: null,
    },
    {
      metric: 'return-pressure',
      value: pressures.returnPressureMmHg,
      kind: 'modelled',
      unit: 'mmHg',
      note: null,
    },
    {
      metric: 'effluent-pressure',
      value: pressures.effluentPressureMmHg,
      kind: 'modelled',
      unit: 'mmHg',
      note: null,
    },
    {
      metric: 'transmembrane-pressure',
      value: pressures.prismaxTransmembranePressureMmHg,
      kind: 'calculated',
      unit: 'mmHg',
      note: 'MATH-PM-002 over filter, return, and effluent. No transducer of its own.',
    },
    {
      metric: 'filter-pressure-drop',
      value: pressures.prismaxFilterPressureDropMmHg,
      kind: 'calculated',
      unit: 'mmHg',
      note: 'DEV-PM-010 over filter and return. Displayed value; the offset is already applied.',
    },
    {
      metric: 'filtration-fraction',
      value: therapy.filtrationFraction,
      kind: 'authored',
      unit: 'fraction',
      note: 'Authored input copied through by the simulation. It does not respond to the flows.',
    },
    {
      metric: 'prescribed-effluent-rate',
      value: therapy.prescribedEffluentRateMlHour,
      kind: 'calculated',
      unit: 'mL/h',
      note: 'MATH-PM-001 over the prescription flows.',
    },
    {
      metric: 'prescribed-effluent-dose',
      value: therapy.prescribedEffluentDoseMlKgHour,
      kind: 'calculated',
      unit: 'mL/kg/h',
      note: null,
    },
    {
      metric: 'delivered-dose',
      value: therapy.deliveredDoseMlKgHour,
      kind: 'cumulative',
      unit: 'mL/kg/h',
      note: 'Measured off the actual effluent over the charting window, not off the prescription.',
    },
    {
      metric: 'cumulative-actual-effluent',
      value: therapy.cumulativeActualEffluentMl,
      kind: 'cumulative',
      unit: 'mL',
      note: null,
    },
    {
      metric: 'cumulative-downtime',
      value: therapy.cumulativeDowntimeSeconds,
      kind: 'cumulative',
      unit: 's',
      note: null,
    },
    {
      metric: 'treatment-time',
      value: therapy.treatmentTimeSeconds,
      kind: 'cumulative',
      unit: 's',
      note: null,
    },
    {
      metric: 'set-time',
      value: therapy.setTimeSeconds,
      kind: 'cumulative',
      unit: 's',
      note: null,
    },
    {
      metric: 'ledger.entering-blood-path',
      value: ledger.enteringBloodPathMlHour,
      kind: 'calculated',
      unit: 'mL/h',
      note: null,
    },
    {
      metric: 'ledger.never-enters-patient',
      value: ledger.neverEnteringPatientMlHour,
      kind: 'calculated',
      unit: 'mL/h',
      note: 'Dialysate.',
    },
    {
      metric: 'ledger.crossing-membrane',
      value: ledger.crossingMembraneMlHour,
      kind: 'calculated',
      unit: 'mL/h',
      note: 'Total effluent less dialysate. Regrouping of MATH-PM-001, not a separate engine quantity.',
    },
    {
      metric: 'ledger.total-effluent',
      value: ledger.totalEffluentMlHour,
      kind: 'calculated',
      unit: 'mL/h',
      note: null,
    },
    {
      metric: 'ledger.machine-patient-fluid-removal',
      value: ledger.machinePatientFluidRemovalMlHour,
      kind: 'calculated',
      unit: 'mL/h',
      note: 'FLUID-PM-002.',
    },
    {
      metric: 'ledger.net-to-patient',
      value: ledger.netFluidToPatientMlHour,
      kind: 'calculated',
      unit: 'mL/h',
      note: null,
    },
    {
      metric: 'patient-ledger.external-input',
      value: patientLedger?.externalInputMlHour ?? null,
      kind: 'authored',
      unit: 'mL/h',
      note: null,
    },
    {
      metric: 'patient-ledger.external-output',
      value: patientLedger?.externalOutputMlHour ?? null,
      kind: 'authored',
      unit: 'mL/h',
      note: null,
    },
    {
      metric: 'patient-ledger.net-balance',
      value: patientLedger?.netBalanceMlHour ?? null,
      kind: 'calculated',
      unit: 'mL/h',
      note: 'A different quantity from total effluent, and from machine removal.',
    },
    {
      metric: 'cumulative-machine-patient-fluid-removal',
      value: therapy.cumulativeMachinePatientFluidRemovalMl,
      kind: 'cumulative',
      unit: 'mL',
      note: null,
    },
    {
      metric: 'cumulative-whole-patient-balance',
      value: therapy.cumulativeWholePatientBalanceMl,
      kind: 'cumulative',
      unit: 'mL',
      note: null,
    },
  ]

  for (const [reason, seconds] of Object.entries(therapy.downtimeSecondsByReason)) {
    const unreachable = crrtUnreachableDowntimeReasons.includes(reason as DowntimeReason)
    rows.push({
      metric: `downtime.${reason}`,
      value: seconds,
      kind: 'cumulative',
      unit: 's',
      note: unreachable
        ? 'Declared but never incremented by the simulation. A zero here means "no path writes this", not "this did not happen".'
        : null,
    })
  }

  return Object.freeze(rows)
}

/** Every metric name the dump is expected to carry, so a field cannot silently disappear. */
export function crrtNumericMetricNames(state: CrrtSimulationState): readonly string[] {
  return collectCrrtNumericRows(state)
    .map((row) => row.metric)
    .sort()
}

export function auditCrrtSimulationFrame(state: CrrtSimulationState): readonly CrrtNumericFlag[] {
  const flags: CrrtNumericFlag[] = []
  const pressures = state.circuit.pressures
  const therapy = state.deliveredTherapy
  const flows = state.circuit.flows

  // 1. Nonfinite. A null is an honest "no signal"; NaN or Infinity is a defect.
  for (const row of collectCrrtNumericRows(state)) {
    if (row.value !== null && !Number.isFinite(row.value)) {
      flags.push(
        flag('nonfinite-value', state, row.metric, `${row.metric} is ${String(row.value)}.`),
      )
    }
  }

  // 2. Conservation. The ledger regroups MATH-PM-001; if a regrouping does not
  //    balance, either the flows or the regrouping is wrong.
  const ledger = calculateCrrtMachineFluidLedger(flows)
  for (const check of checkCrrtFluidConservation(ledger)) {
    if (check.status === 'balanced') continue
    if (check.status === 'unresolved') {
      flags.push(
        flag(
          'unexplained-makeup',
          state,
          check.id,
          `${check.label} could not be checked. ${ledger.unresolvedReason ?? check.explanation}`,
        ),
      )
      continue
    }
    flags.push(
      flag(
        'impossible-conservation',
        state,
        check.id,
        `${check.label} is off by ${String(check.residualMlHour)} mL/h.`,
      ),
    )
  }

  const recomputedWholeBalance = calculateWholePatientNetBalanceMl(therapy.fluidLedger)
  if (
    !near(
      recomputedWholeBalance,
      therapy.cumulativeWholePatientBalanceMl,
      CRRT_VOLUME_EQUIVALENCE_TOLERANCE_ML,
    )
  ) {
    flags.push(
      flag(
        'impossible-conservation',
        state,
        'cumulative-whole-patient-balance',
        `Stored whole-patient balance ${therapy.cumulativeWholePatientBalanceMl} mL disagrees with the ledger it is made of (${recomputedWholeBalance} mL).`,
      ),
    )
  }

  // 3. Delivered cannot exceed what the modelled delivery permits. The delivery
  //    fraction is at most one by construction, so any excess is a defect.
  if (therapy.prescribedEffluentRateMlHour !== null && therapy.chartingWindowSeconds > 0) {
    const ceilingMl = therapy.prescribedEffluentRateMlHour * (therapy.chartingWindowSeconds / 3600)
    if (therapy.cumulativeActualEffluentMl > ceilingMl + CRRT_VOLUME_EQUIVALENCE_TOLERANCE_ML) {
      flags.push(
        flag(
          'delivered-exceeds-possible',
          state,
          'cumulative-actual-effluent',
          `Actual effluent ${therapy.cumulativeActualEffluentMl} mL exceeds the ${ceilingMl} mL the prescription could have produced over this charting window.`,
        ),
      )
    }
  }
  if (therapy.treatmentTimeSeconds > therapy.setTimeSeconds + CRRT_MODEL_EQUIVALENCE_TOLERANCE) {
    flags.push(
      flag(
        'delivered-exceeds-possible',
        state,
        'treatment-time',
        `Treatment time ${therapy.treatmentTimeSeconds} s exceeds set time ${therapy.setTimeSeconds} s.`,
      ),
    )
  }
  if (
    therapy.cumulativeDowntimeSeconds >
    therapy.setTimeSeconds + CRRT_MODEL_EQUIVALENCE_TOLERANCE
  ) {
    flags.push(
      flag(
        'delivered-exceeds-possible',
        state,
        'cumulative-downtime',
        `Cumulative downtime ${therapy.cumulativeDowntimeSeconds} s exceeds set time ${therapy.setTimeSeconds} s.`,
      ),
    )
  }

  // 4. Measured versus calculated. Recompute both device expressions from the
  //    four modelled sites and demand the stored values agree — this is what
  //    makes the circuit's labelling a claim the dump can falsify.
  const { filterPressureMmHg, returnPressureMmHg, effluentPressureMmHg } = pressures
  if (filterPressureMmHg !== null && returnPressureMmHg !== null && effluentPressureMmHg !== null) {
    const adapter = getCrrtDeviceCalculationAdapter(state.deviceId)
    const recomputed = adapter.calculateDisplayedPressures({
      rawFilterPressureMmHg: filterPressureMmHg,
      rawReturnPressureMmHg: returnPressureMmHg,
      rawEffluentPressureMmHg: effluentPressureMmHg,
    })

    if (
      pressures.prismaxTransmembranePressureMmHg !== null &&
      !near(
        recomputed.transmembranePressureMmHg,
        pressures.prismaxTransmembranePressureMmHg,
        CRRT_MODEL_EQUIVALENCE_TOLERANCE,
      )
    ) {
      flags.push(
        flag(
          'measured-calculated-mismatch',
          state,
          'transmembrane-pressure',
          `Stored TMP ${pressures.prismaxTransmembranePressureMmHg} mmHg is not what the three modelled sites produce (${recomputed.transmembranePressureMmHg} mmHg). It is presented as calculated, so it must be recomputable.`,
        ),
      )
    }

    if (
      pressures.prismaxFilterPressureDropMmHg !== null &&
      !near(
        recomputed.displayedFilterPressureDropMmHg,
        pressures.prismaxFilterPressureDropMmHg,
        CRRT_MODEL_EQUIVALENCE_TOLERANCE,
      )
    ) {
      const doubleOffset = near(
        recomputed.displayedFilterPressureDropMmHg -
          (recomputed.rawFilterPressureDropMmHg - recomputed.displayedFilterPressureDropMmHg),
        pressures.prismaxFilterPressureDropMmHg,
        CRRT_MODEL_EQUIVALENCE_TOLERANCE,
      )
      flags.push(
        flag(
          'measured-calculated-mismatch',
          state,
          'filter-pressure-drop',
          doubleOffset
            ? 'The stored filter pressure drop looks like the display offset applied twice.'
            : `Stored filter pressure drop ${pressures.prismaxFilterPressureDropMmHg} mmHg is not what the two modelled sites produce (${recomputed.displayedFilterPressureDropMmHg} mmHg).`,
        ),
      )
    }
  }

  // The circuit's own labelling must not drift out of step with this audit.
  const calculatedSignalIds = crrtPressureSignalDetails
    .filter((detail) => detail.kind === 'calculated-relationship')
    .map((detail) => detail.id)
  if (
    calculatedSignalIds.length !== 2 ||
    !calculatedSignalIds.includes('tmp') ||
    !calculatedSignalIds.includes('filter-drop')
  ) {
    flags.push(
      flag(
        'measured-calculated-mismatch',
        state,
        'pressure-labelling',
        `The circuit marks ${calculatedSignalIds.join(', ') || 'nothing'} as calculated, but the device recomputes exactly TMP and filter pressure drop.`,
      ),
    )
  }

  // 5. Stale prescription. `advanceContinuous` recomputes the effluent target
  //    each step but never writes it back, so a stored rate that no longer
  //    matches the flows means the surface is showing an old prescription.
  if (state.prescription.status === 'configured' && therapy.prescribedEffluentRateMlHour !== null) {
    const expected = calculatePrismaxEffluentPumpTargetMlPerHour({
      patientFluidRemovalMlPerHour: state.prescription.flows.patientFluidRemovalMlHour,
      preBloodPumpMlPerHour: state.prescription.flows.pbpFlowMlHour,
      totalReplacementMlPerHour:
        state.prescription.flows.preReplacementFlowMlHour +
        state.prescription.flows.postReplacementFlowMlHour,
      dialysateMlPerHour: state.prescription.flows.dialysateFlowMlHour,
      syringeMlPerHour: state.prescription.flows.syringeFlowMlHour,
      makeupMlPerHour: state.prescription.flows.makeupFlowMlHour,
    })
    if (
      !near(expected, therapy.prescribedEffluentRateMlHour, CRRT_VOLUME_EQUIVALENCE_TOLERANCE_ML)
    ) {
      flags.push(
        flag(
          'stale-prescription',
          state,
          'prescribed-effluent-rate',
          `Stored prescribed effluent rate ${therapy.prescribedEffluentRateMlHour} mL/h does not match the current flows (${expected} mL/h).`,
        ),
      )
    }
  }

  return Object.freeze(flags)
}

export function auditCrrtFrames(
  frames: readonly CrrtSimulationState[],
): readonly CrrtNumericFlag[] {
  return Object.freeze(frames.flatMap((frame) => auditCrrtSimulationFrame(frame)))
}
