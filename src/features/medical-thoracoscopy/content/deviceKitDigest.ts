import { createHash } from 'node:crypto'

import type { DeviceDefinitions } from './deviceDefinitions'

/**
 * A digest of exactly what the model generator reads from the device definitions: every value,
 * unit and kind of claim of each modelled part, and each of its forms. The device kit's manifest
 * carries the digest it was built from. A changed dimension changes the digest, so the kit must be
 * built again; a reviewer's recorded decision or a reworded note does not.
 *
 * Node only: used by the packaging script and by tests, never by a course page.
 */
export function deviceGeometryDigest(definitions: DeviceDefinitions): string {
  const modelled = definitions.devices
    .filter((device) => device.modelled)
    .map((device) => ({
      id: device.id,
      standard: device.standard,
      facts: device.facts
        .filter((entry) => entry.value !== null)
        .map((entry) => [entry.key, entry.value, entry.unit, entry.category]),
      forms: device.forms.map((entry) => [
        entry.key,
        entry.kind,
        entry.points ?? null,
        entry.parameters ?? null,
        entry.category,
      ]),
    }))
  return createHash('sha256')
    .update(JSON.stringify({ label: definitions.labelUntilCad, modelled }))
    .digest('hex')
}
