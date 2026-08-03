import path from 'node:path'

import { format, resolveConfig } from 'prettier'

/**
 * Format generated JSON the way the repository formats every other file.
 *
 * The config is resolved rather than defaulted. `format(text, { parser: 'json' })` alone ignores
 * `.prettierrc` — there is no filepath for prettier to resolve options from — so generated
 * artifacts came out at prettier's built-in 80-column default while `prettier --check` judged them
 * at the repository's 100. Almost every artifact happened to look identical either way, which is
 * exactly how a mismatch like that survives: it only surfaces the day a generated file contains an
 * array that fits in 100 columns and not in 80, and then the format check fails on a file nobody
 * edited.
 */

let cachedOptions: Awaited<ReturnType<typeof resolveConfig>> | undefined

async function jsonOptions() {
  if (cachedOptions === undefined) {
    // Resolved from a notional file at the repository root, which is where `.prettierrc` lives and
    // where every generated artifact's own directory would resolve to anyway.
    cachedOptions = await resolveConfig(path.join(process.cwd(), 'generated.json'))
  }
  return cachedOptions ?? {}
}

export async function formatJson(value: unknown): Promise<string> {
  return format(JSON.stringify(value, null, 2), { ...(await jsonOptions()), parser: 'json' })
}
