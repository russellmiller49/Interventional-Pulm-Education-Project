import type { DeviceProfile } from '../engine/types'

export const cardiohelpDeviceProfile: DeviceProfile = Object.freeze({
  id: 'cardiohelp-i-us-2025',
  displayName: 'CARDIOHELP-i',
  manufacturer: 'Getinge',
  jurisdiction: 'US',
  ifuRevision: '2.3',
  ifuDate: 'January 2025',
  minimumSoftwareVersion: '03.04.10.00',
  thApp: 'Cardiopulmonary Support',
  supportedContentModes: ['vv', 'va'] as const,
  educationalUseOnly: true,
})

export type CardiohelpEcmoPublicationStatus = 'draft' | 'published'
export const cardiohelpEcmoPublicationStatus: CardiohelpEcmoPublicationStatus = 'draft'
