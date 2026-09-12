import { isWellFormedProductId } from './product-id'

export const SAVED_DEVICES_KEY = 'device-intelligence.saved-devices.v1'
export const MAX_SAVED_DEVICES = 100
export const MAX_COMPARISON_DEVICES = 4

/** Browser storage contains identifiers only. Product facts always come from the server. */
export function parseSavedDevices(raw: string | null): string[] {
  if (raw === null) return []
  if (raw.length > 8_000) throw new Error('Invalid saved device list')
  const value: unknown = JSON.parse(raw)
  if (
    !value ||
    typeof value !== 'object' ||
    !('version' in value) ||
    value.version !== 1 ||
    !('productIds' in value) ||
    !Array.isArray(value.productIds) ||
    value.productIds.length > MAX_SAVED_DEVICES ||
    value.productIds.some((id) => typeof id !== 'string' || !isWellFormedProductId(id))
  )
    throw new Error('Invalid saved device list')
  return [...new Set(value.productIds as string[])]
}

export function serializeSavedDevices(productIds: string[]): string {
  const raw = JSON.stringify({ version: 1, productIds })
  parseSavedDevices(raw)
  return raw
}

/** Reject the whole request when malformed or over the bound; never silently truncate it. */
export function parseDeviceIds(raw: string | undefined | null, limit: number): string[] | null {
  if (!raw) return []
  if (raw.length > limit * 25) return null
  const ids = raw.split(',')
  if (ids.length > limit || ids.some((id) => !isWellFormedProductId(id))) return null
  return [...new Set(ids)]
}

export function comparisonHref(locale: string, productIds: string[]): string {
  return `/${locale}/devices/compare?ids=${encodeURIComponent(productIds.join(','))}`
}
