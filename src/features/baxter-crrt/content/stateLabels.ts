import type { CrrtAnticoagulationMethod, CrrtDeviceState, CrrtModality } from '../engine/types'

/**
 * Engine state words as a learner reads them (CRRT-FELLOW-04, F-24).
 *
 * Learn and Practice printed raw state values — “Applied method: cvvhd”, a delivery state of
 * “idle”, an anticoagulation of “systemic-concept”. These say the same things in words, and
 * nothing more: no state is renamed into a claim the engine does not make.
 */
export const crrtDeliveryStateWords: Readonly<Record<CrrtDeviceState['deliveryState'], string>> =
  Object.freeze({
    idle: 'not started',
    running: 'running',
    paused: 'paused',
    ended: 'ended',
  })

export function crrtModalityLabel(modality: CrrtModality | null | undefined): string {
  return modality ? modality.toUpperCase() : 'not applied'
}

export const crrtAnticoagulationWords: Readonly<Record<CrrtAnticoagulationMethod, string>> =
  Object.freeze({
    none: 'none',
    'systemic-concept': 'systemic, as a concept only (no dose or protocol is modeled)',
  })
