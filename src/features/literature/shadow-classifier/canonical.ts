import { createHash } from 'node:crypto'

function canonicalValue(value: unknown, path = '$'): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`Canonical JSON does not support a non-finite number at ${path}.`)
    }
    return Object.is(value, -0) ? 0 : value
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => canonicalValue(item, `${path}[${index}]`))
  }
  if (!value || typeof value !== 'object') {
    throw new Error(`Canonical JSON does not support ${typeof value} at ${path}.`)
  }

  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error(`Canonical JSON requires a plain object at ${path}.`)
  }

  const record = value as Record<string, unknown>
  return Object.fromEntries(
    Object.keys(record)
      .sort()
      .map((key) => {
        if (record[key] === undefined) {
          throw new Error(`Canonical JSON does not support undefined at ${path}.${key}.`)
        }
        return [key, canonicalValue(record[key], `${path}.${key}`)]
      }),
  )
}

export function canonicalShadowJson(value: unknown): string {
  return JSON.stringify(canonicalValue(value))
}

export function sha256ShadowValue(value: unknown): string {
  return createHash('sha256').update(canonicalShadowJson(value)).digest('hex')
}

export function sha256ShadowText(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function immutableShadowValue<T>(value: T): Readonly<T> {
  const clone = JSON.parse(canonicalShadowJson(value)) as T

  const freeze = (candidate: unknown): void => {
    if (!candidate || typeof candidate !== 'object' || Object.isFrozen(candidate)) return
    for (const child of Object.values(candidate as Record<string, unknown>)) freeze(child)
    Object.freeze(candidate)
  }

  freeze(clone)
  return clone
}
