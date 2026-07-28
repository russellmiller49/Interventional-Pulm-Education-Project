export interface ParsedCliArguments {
  flags: Set<string>
  values: Map<string, string[]>
}

export function parseCliArguments(argv: string[]): ParsedCliArguments {
  const flags = new Set<string>()
  const values = new Map<string, string[]>()

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (!argument.startsWith('--')) {
      throw new Error(`Unexpected positional argument: ${argument}`)
    }

    const equalsIndex = argument.indexOf('=')
    if (equalsIndex > 2) {
      const key = argument.slice(2, equalsIndex)
      const value = argument.slice(equalsIndex + 1)
      values.set(key, [...(values.get(key) ?? []), value])
      continue
    }

    const key = argument.slice(2)
    const next = argv[index + 1]
    if (next && !next.startsWith('--')) {
      values.set(key, [...(values.get(key) ?? []), next])
      index += 1
    } else {
      flags.add(key)
    }
  }

  return { flags, values }
}

export function stringArgument(
  arguments_: ParsedCliArguments,
  key: string,
  fallback: string,
): string
export function stringArgument(arguments_: ParsedCliArguments, key: string): string | undefined
export function stringArgument(arguments_: ParsedCliArguments, key: string, fallback?: string) {
  if (arguments_.flags.has(key)) {
    throw new Error(`--${key} requires a value.`)
  }
  return arguments_.values.get(key)?.at(-1) ?? fallback
}

export function numberArgument(arguments_: ParsedCliArguments, key: string, fallback?: number) {
  const raw = stringArgument(arguments_, key)
  if (raw === undefined) {
    return fallback
  }

  if (!/^\d+$/u.test(raw)) {
    throw new Error(`--${key} must be a positive integer.`)
  }
  const value = Number(raw)
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`--${key} must be a positive integer.`)
  }
  return value
}

export function nonNegativeIntegerArgument(
  arguments_: ParsedCliArguments,
  key: string,
  fallback?: number,
) {
  const raw = stringArgument(arguments_, key)
  if (raw === undefined) return fallback
  if (!/^\d+$/u.test(raw)) {
    throw new Error(`--${key} must be a non-negative integer.`)
  }
  const value = Number(raw)
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`--${key} must be a non-negative integer.`)
  }
  return value
}

export function hasFlag(arguments_: ParsedCliArguments, key: string) {
  return arguments_.flags.has(key)
}

export function assertKnownArguments(arguments_: ParsedCliArguments, known: readonly string[]) {
  const allowed = new Set(known)
  const supplied = [...arguments_.flags, ...arguments_.values.keys()]
  const unknown = supplied.filter((key) => !allowed.has(key))
  if (unknown.length > 0) {
    throw new Error(`Unknown option(s): ${unknown.map((key) => `--${key}`).join(', ')}`)
  }
}
