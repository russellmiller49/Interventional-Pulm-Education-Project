import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

/**
 * Provenance for the resolver build a release was published by.
 *
 * This is deliberately **not** the support boundary. The boundary is the semantic contract —
 * `PREFERENCE_CARD_RESOLVER_CONTRACT_VERSION`, asserted behaviourally by
 * `resolver-contract.test.ts` — because that is what decides whether a historical card still
 * reconstructs correctly. A source digest cannot decide that: extracting a helper, renaming a
 * local, or reformatting a file all move it while every card resolves identically. Treating
 * that as "the contract moved" would mark every historical card unsupported for a refactor,
 * and a signal that fires on refactors is a signal everyone learns to ignore.
 *
 * So the digest answers a narrower and genuinely useful question — *which build produced this
 * card* — and drift in it is reported as information rather than as a problem.
 */

/**
 * The modules whose source constitutes "the resolver".
 *
 * Kept explicit rather than globbing `domain/`: `types.ts` is type-only, `release-bundle.ts`
 * governs releases rather than resolution, and a glob would fold every future neighbour into
 * the digest whether or not it participates.
 */
export const RESOLVER_SOURCE_FILES = [
  'src/features/preference-cards/domain/resolve-card.ts',
  'src/features/preference-cards/domain/expand-recipe-composition.ts',
  'src/features/preference-cards/domain/evaluate-compatibility.ts',
  'src/features/preference-cards/domain/kit-suppression.ts',
  'src/features/preference-cards/domain/quantity-expression.ts',
  'src/features/preference-cards/domain/size-at-procedure.ts',
  'src/features/preference-cards/domain/verification.ts',
  'src/features/preference-cards/domain/stable-hash.ts',
] as const

export interface ResolverRelease {
  resolverContractVersion: string
  resolverImplementationHash: string
  sources: Record<string, string>
}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex')
}

export async function computeResolverRelease(
  resolverContractVersion: string,
): Promise<ResolverRelease> {
  const sources: Record<string, string> = {}
  for (const filename of RESOLVER_SOURCE_FILES) {
    sources[filename] = sha256(await readFile(filename))
  }
  const manifest = RESOLVER_SOURCE_FILES.map(
    (filename) => `${sources[filename]}  ${filename}\n`,
  ).join('')

  return {
    resolverContractVersion,
    resolverImplementationHash: sha256(manifest),
    sources,
  }
}
