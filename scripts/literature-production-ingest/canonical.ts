import { createHash } from 'node:crypto'

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJsonValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, child]) => child !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, sortJsonValue(child)]),
    )
  }
  return value
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortJsonValue(value))
}

export function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex')
}

export function jsonBody(value: unknown): { body: string; bytes: number; checksum: string } {
  const body = JSON.stringify(value)
  return {
    body,
    bytes: Buffer.byteLength(body),
    checksum: sha256(body),
  }
}

export function checksumBody<T extends object>(body: T, checksumKey: keyof T): string {
  const copy = { ...body }
  delete copy[checksumKey]
  return sha256(canonicalJson(copy))
}

const CREDENTIAL_SHAPES = [
  /sb_secret_[A-Za-z0-9._-]+/gu,
  /sb_publishable_[A-Za-z0-9._-]+/gu,
  /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/gu,
]

export function redact(value: unknown, secrets: readonly string[] = []): string {
  let output = value instanceof Error ? value.message : String(value)
  for (const secret of secrets) {
    if (secret) output = output.replaceAll(secret, '[redacted]')
  }
  for (const pattern of CREDENTIAL_SHAPES) output = output.replace(pattern, '[redacted]')
  return output
}

export function assertSha256(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/u.test(value)) {
    throw new Error(`${label} must be a lowercase SHA-256 digest.`)
  }
}
