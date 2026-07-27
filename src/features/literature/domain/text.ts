import { createHash } from 'node:crypto'

export function normalizeWhitespace(value: string) {
  return value.replace(/\s+/gu, ' ').trim()
}

export function normalizeSearchableText(value: string) {
  return normalizeWhitespace(
    value
      .normalize('NFKD')
      .replace(/\p{M}/gu, '')
      .toLocaleLowerCase('en-US')
      .replace(/[^\p{L}\p{N}]+/gu, ' '),
  )
}

export function normalizeTitle(value: string) {
  return normalizeSearchableText(value)
}

export function stableUnique(values: Iterable<string>) {
  const seen = new Set<string>()
  const result: string[] = []

  for (const value of values) {
    const normalized = normalizeWhitespace(value)
    if (!normalized || seen.has(normalized)) {
      continue
    }
    seen.add(normalized)
    result.push(normalized)
  }

  return result
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJsonValue)
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, sortJsonValue(child)]),
    )
  }

  return value
}

export function stableJson(value: unknown) {
  return JSON.stringify(sortJsonValue(value))
}

export function sha256(value: string | Buffer) {
  return createHash('sha256').update(value).digest('hex')
}

export function truncatePlainText(value: string, maximumLength: number) {
  if (value.length <= maximumLength) {
    return value
  }

  return `${value.slice(0, Math.max(0, maximumLength - 1)).trimEnd()}…`
}
