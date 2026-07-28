export interface ExactIdentifierOptions {
  removeSlashes?: boolean
}

export function displayIdentifier(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const display = String(value).trim()
  return display.length > 0 ? display : null
}

export function exactIdentifierComparison(
  value: unknown,
  { removeSlashes = true }: ExactIdentifierOptions = {},
): string | null {
  const display = displayIdentifier(value)
  if (!display) return null
  const punctuation = removeSlashes ? /[\s\-./]+/g : /[\s\-.]+/g
  const normalized = display.normalize('NFKC').toLocaleUpperCase('en-US').replace(punctuation, '')
  return normalized.length > 0 ? normalized : null
}

export function looseSearchValue(value: unknown): string | null {
  const display = displayIdentifier(value)
  if (!display) return null
  const normalized = display
    .normalize('NFKC')
    .toLocaleLowerCase('en-US')
    .replace(/[®™℠©]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
  return normalized.length > 0 ? normalized : null
}

const LEGAL_SUFFIX =
  /\s+(?:incorporated|inc|limited|ltd|llc|l l c|corporation|corp|company|co|gmbh|ag|se|kg|plc|lp|llp|b v|bv|s a|sa|sas|sarl|pty)\.?$/i

export function normalizeManufacturerName(value: unknown): string | null {
  let normalized = looseSearchValue(value)
  if (!normalized) return null
  let previous: string
  do {
    previous = normalized
    normalized = normalized.replace(LEGAL_SUFFIX, '').trim()
  } while (normalized !== previous)
  return normalized || null
}

export function splitAlternateIdentifiers(value: unknown): string[] {
  const display = displayIdentifier(value)
  if (!display) return []
  return stableUnique(
    display
      .split(/[;,|\r\n]+/)
      .map((part) => displayIdentifier(part))
      .filter((part): part is string => Boolean(part)),
    (part) => exactIdentifierComparison(part) ?? part,
  )
}

export function escapeOpenFdaQuotedValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

export function exactOpenFdaSearch(field: string, value: string): string {
  return `${field}:"${escapeOpenFdaQuotedValue(value)}"`
}

export function stableUnique<T>(values: T[], key: (value: T) => string): T[] {
  const seen = new Set<string>()
  const result: T[] = []
  for (const value of values) {
    const identity = key(value)
    if (seen.has(identity)) continue
    seen.add(identity)
    result.push(value)
  }
  return result
}

export function normalizeSearchExpression(search: string): string {
  return search
    .trim()
    .replace(/\s+AND\s+/gi, ' AND ')
    .replace(/\s+/g, ' ')
}

export function redactApiKey(value: string): string {
  try {
    const url = new URL(value)
    if (url.searchParams.has('api_key')) url.searchParams.set('api_key', '[REDACTED]')
    return url.toString()
  } catch {
    return value.replace(/([?&]api_key=)[^&\s]+/gi, '$1[REDACTED]')
  }
}
