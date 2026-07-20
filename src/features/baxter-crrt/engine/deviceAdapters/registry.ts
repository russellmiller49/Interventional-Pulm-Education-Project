import { BAXTER_CRRT_DEVICE_IDS, type BaxterCrrtDeviceId } from '../../content/deviceProfiles'
import { prismaxDeviceAdapter } from './prismax'
import type { CrrtDeviceAdapter } from './types'

export const baxterCrrtDeviceAdapterRegistry: Readonly<
  Record<BaxterCrrtDeviceId, CrrtDeviceAdapter>
> = Object.freeze({
  'prismax-aw8035-2xx': prismaxDeviceAdapter,
})

if (Object.keys(baxterCrrtDeviceAdapterRegistry).length !== BAXTER_CRRT_DEVICE_IDS.length) {
  throw new Error('Every Baxter CRRT device profile must have one operational adapter.')
}

export function getBaxterCrrtDeviceAdapter(deviceId: BaxterCrrtDeviceId): CrrtDeviceAdapter {
  return baxterCrrtDeviceAdapterRegistry[deviceId]
}
