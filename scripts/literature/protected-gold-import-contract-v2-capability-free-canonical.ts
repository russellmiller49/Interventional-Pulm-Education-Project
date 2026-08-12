import { createHash } from 'node:crypto'

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

export function protectedV2CapabilityFreeCanonicalValue(value: unknown): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Canonical JSON rejects non-finite numbers.')
    return value
  }
  if (Array.isArray(value)) return value.map(protectedV2CapabilityFreeCanonicalValue)
  if (!isRecord(value)) throw new Error(`Canonical JSON rejects ${typeof value}.`)
  return Object.fromEntries(
    Object.keys(value)
      .sort(compareCodeUnits)
      .map((key) => {
        if (value[key] === undefined) throw new Error(`Canonical JSON rejects undefined at ${key}.`)
        return [key, protectedV2CapabilityFreeCanonicalValue(value[key])]
      }),
  )
}

export function protectedV2CapabilityFreeCanonicalJson(value: unknown): string {
  return `${JSON.stringify(protectedV2CapabilityFreeCanonicalValue(value), null, 2)}\n`
}

export function protectedV2CapabilityFreeIdentitySha256(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(protectedV2CapabilityFreeCanonicalValue(value)))
    .digest('hex')
}
