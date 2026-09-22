/**
 * One acquisition projection, read by every surface that shows a plateau or a pressure split.
 *
 * `plateauValidity.ts` already answers *is this number interpretable as mechanics* — is the
 * patient pulling. It does not answer the separate question the walkthrough caught us getting
 * wrong on every console: *did anyone actually occlude anything*. `measurements.plateauPressureCmH2O`
 * is published on every breath, estimated off the end-inspiratory sample
 * (`observedPlateauPressureCmH2O`), whether or not a hold has ever been performed — so
 * "measured Pplateau 14" was printed on a case that had just opened, the Section 14 integration
 * panel showed "PLATEAU 14.3 · PEAK − PLATEAU 17.4" on the step that says *measure before
 * deciding*, and the discriminator treated `plateauPressureCmH2O > 0` as proof of a measurement.
 *
 * The two questions are orthogonal and this file keeps them that way. An occlusion that happened
 * while the patient was pulling is `acquired-invalid`: it is a hold, it is kept as a hold, and it
 * still cannot carry the elastic/resistive split. An estimate on a perfectly passive patient is
 * `reference-estimate`: interpretable as far as effort goes, and still not a measurement.
 *
 * Sources of truth, all of them existing:
 *   - `state.holdRecords`          — occlusions the engine actually performed (see types.ts)
 *   - `state.ventilator.pendingHold` / `holdType` — requested and running
 *   - `plateauReadingValidity`     — whether the patient was quiet across the occlusion
 *   - `measurementConditionsFingerprint` — the settings/mechanics a hold was taken under
 *
 * No threshold is introduced here and no value is invented. Nothing in this file changes what the
 * model computes; it changes what the number is called.
 */
import { measurementConditionsFingerprint } from '../engine/measurementConditions'
import type { PerformedHoldRecord, VentilationSimulationState } from '../engine/types'

export type PlateauAcquisitionStatus =
  /** No occlusion has been performed; the number on screen is derived from the trace. */
  | 'reference-estimate'
  /** An occlusion is required here and has not happened. The value is withheld. */
  | 'not-acquired'
  /** Requested and queued, or running: the maneuver has started and has not finished. */
  | 'pending'
  /** It happened, and the patient was pulling through it. */
  | 'acquired-invalid'
  /** It happened on a quiet patient under the conditions still in force. */
  | 'acquired-valid'
  /** It happened, but the settings or the simulated patient have changed since. */
  | 'stale'

export interface PlateauAcquisition {
  readonly hold: 'inspiratory' | 'expiratory'
  readonly status: PlateauAcquisitionStatus
  /**
   * **The number the surface must print**, whatever identity it is claiming — or null when this
   * surface withholds an unacquired value.
   *
   * Identity and value travel together here because they came apart everywhere they did not. The
   * consoles labelled the plateau "measured during the inspiratory hold at 12.4 s" and then printed
   * `measurements.plateauPressureCmH2O`, which is the live estimate off the current trace: on an
   * active patient that showed roughly 26 beside an acquisition record of roughly 24.5. A surface
   * that says "acquired" must show what was acquired, and a surface that says "estimate" must show
   * the estimate. Reading `state.measurements.plateauPressureCmH2O` directly beside an acquisition
   * label is the defect, not a shortcut.
   */
  readonly valueCmH2O: number | null
  /** What the trace estimates right now, for a surface that is deliberately showing the estimate. */
  readonly estimateCmH2O: number
  /** What the occlusion recorded, if one happened. Null when nothing has been acquired. */
  readonly acquiredValueCmH2O: number | null
  /**
   * True only for `acquired-valid`.
   *
   * The single gate for any claim that needs a valid current plateau: the elastic/resistive split,
   * peak-minus-plateau read as resistance, static compliance attributed to a hold. Consumers must
   * not rebuild it from a non-null value (which is also true of stale and invalid records) or from
   * current passivity (which says nothing about whether anything was occluded).
   */
  readonly supportsMechanicsClaim: boolean
  /** True when a real occlusion produced this number, valid or not. */
  readonly acquired: boolean
  readonly acquiredAtSeconds: number | null
  /** Four or five words, for a readout that has no room for a sentence. */
  readonly label: string
  /** The whole statement, for text equivalents and panels. */
  readonly detail: string
}

const STATUS_LABELS: Readonly<Record<PlateauAcquisitionStatus, string>> = {
  'reference-estimate': 'estimate from the trace',
  'not-acquired': 'not acquired',
  pending: 'acquisition in progress',
  'acquired-invalid': 'acquired; not interpretable',
  'acquired-valid': 'acquired hold',
  stale: 'acquired before the change',
}

function lastCompleted(
  records: readonly PerformedHoldRecord[],
  hold: PerformedHoldRecord['hold'],
): PerformedHoldRecord | undefined {
  return records
    .filter((record) => record.hold === hold && record.completedAtSeconds !== null)
    .at(-1)
}

function openRecord(
  records: readonly PerformedHoldRecord[],
  hold: PerformedHoldRecord['hold'],
): PerformedHoldRecord | undefined {
  return records.find((record) => record.hold === hold && record.completedAtSeconds === null)
}

/**
 * @param requireAcquisition when this surface may not print a current-patient value that no
 *   occlusion produced. The value is withheld; the explanation stays available either way.
 */
export function plateauAcquisition(
  state: VentilationSimulationState,
  options: {
    readonly hold?: 'inspiratory' | 'expiratory'
    readonly requireAcquisition?: boolean
  } = {},
): PlateauAcquisition {
  const hold = options.hold ?? 'inspiratory'
  const requireAcquisition = options.requireAcquisition ?? false
  const estimate =
    hold === 'inspiratory'
      ? state.measurements.plateauPressureCmH2O
      : state.ventilator.settings.peepCmH2O + state.measurements.intrinsicPeepCmH2O
  const quantity = hold === 'inspiratory' ? 'plateau' : 'total end-expiratory pressure'

  const build = (
    status: PlateauAcquisitionStatus,
    valueCmH2O: number | null,
    detail: string,
    record?: PerformedHoldRecord,
  ): PlateauAcquisition => ({
    hold,
    status,
    valueCmH2O,
    estimateCmH2O: estimate,
    acquiredValueCmH2O: record ? record.valueCmH2O : null,
    supportsMechanicsClaim: status === 'acquired-valid',
    acquired: status === 'acquired-valid' || status === 'acquired-invalid' || status === 'stale',
    acquiredAtSeconds: record?.completedAtSeconds ?? null,
    label: STATUS_LABELS[status],
    detail,
  })

  if (state.ventilator.pendingHold === hold)
    return build(
      'pending',
      requireAcquisition ? null : estimate,
      `A ${hold} hold has been requested and the valves close at the next breath boundary. No ${quantity} has been acquired yet.`,
    )

  const running = openRecord(state.holdRecords, hold)
  if (running || state.ventilator.holdType === hold)
    return build(
      'pending',
      requireAcquisition ? null : estimate,
      `The ${hold} occlusion is running. The reading is not complete until the valves reopen.`,
    )

  const record = lastCompleted(state.holdRecords, hold)
  /* A record with no occluded samples measured nothing, whatever else it says. */
  if (!record || record.sampleCount === 0)
    return build(
      requireAcquisition ? 'not-acquired' : 'reference-estimate',
      requireAcquisition ? null : estimate,
      requireAcquisition
        ? `No ${hold} hold has been performed on this patient, so there is no measured ${quantity} to read.`
        : `No ${hold} hold has been performed. This number is estimated from the end-inspiratory sample on the trace, not measured during an occlusion.`,
    )

  const at = record.completedAtSeconds
  if (record.conditions !== measurementConditionsFingerprint(state))
    return build(
      'stale',
      record.valueCmH2O,
      `This ${quantity} was acquired at ${(at ?? 0).toFixed(1)} s, before the settings or the simulated patient changed. It cannot be read as this patient's current mechanics; repeat the hold.`,
      record,
    )

  if (record.conditionsChangedDuringHold)
    return build(
      'acquired-invalid',
      record.valueCmH2O,
      `The settings or the simulated patient changed while the valves were shut at ${(at ?? 0).toFixed(1)} s, so this was not a controlled maneuver. Changing them back afterwards does not make it one. The number is kept as what the occlusion showed; repeat the hold under settled conditions.`,
      record,
    )

  if (!record.interpretable)
    return build(
      'acquired-invalid',
      record.valueCmH2O,
      `The patient was pulling during this occlusion, so it reports alveolar pressure minus their effort rather than the elastic pressure of the respiratory system. The hold happened and the number is kept, but it cannot carry a mechanics claim.`,
      record,
    )

  return build(
    'acquired-valid',
    record.valueCmH2O,
    `Acquired during the ${hold} occlusion at ${(at ?? 0).toFixed(1)} s, with the patient quiet across it and the conditions unchanged.`,
    record,
  )
}

/** The short clause a readout or text equivalent puts beside the number. */
export function plateauAcquisitionNote(acquisition: PlateauAcquisition): string {
  return acquisition.status === 'acquired-valid'
    ? `measured during the ${acquisition.hold} hold at ${(acquisition.acquiredAtSeconds ?? 0).toFixed(1)} s`
    : acquisition.label
}
