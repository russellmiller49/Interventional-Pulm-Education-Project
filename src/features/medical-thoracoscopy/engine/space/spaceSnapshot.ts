import type { SpaceSnapshotId } from '../../components/space/types'
import { anatomyManifest } from '../../content/data/generated/anatomy'
import { deviceKitManifest } from '../../content/data/generated/deviceKit'
import { AUTHORED_INSTRUMENT_VALUES } from './instrument'

/**
 * What a state was computed for (fidelity contract, "Snapshot identity"): the anatomy, the device
 * definitions, the optics the engine authors, the port, the scenario, the lung's step and the
 * geometry the proxies are, each named by the hash of the file it comes from, with a teaching target
 * named by where it is and its size. A result for another snapshot changes nothing.
 */
const short = (hash: string) => hash.slice(0, 12)

function fileHash(id: string): string {
  const file = anatomyManifest.files.find((entry) => entry.id === id)
  if (!file) throw new Error(`The anatomy manifest has no ${id}`)
  return short(file.sha256)
}

export function spaceSnapshot(
  scenario: string,
  lungStep: number,
  /** A teaching target in the space, by name (the contact spike, slice 13). */
  target?: string,
): SpaceSnapshotId {
  const optics = Object.entries(AUTHORED_INSTRUMENT_VALUES)
    .map(([key, value]) => `${key}=${value}`)
    .join(';')
  return {
    anatomy: short(anatomyManifest.records['surfaces.json']),
    device: short(deviceKitManifest.definitionsSha256),
    optics,
    port: short(anatomyManifest.records['port-record.json']),
    scenario,
    lungAndFluid: `lung step ${lungStep}`,
    geometry: `${fileHash('proxy-pleural-space')}+${fileHash('proxy-lung')}${target ? `+${target}` : ''}`,
  }
}
