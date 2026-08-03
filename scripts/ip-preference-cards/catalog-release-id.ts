import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

/**
 * A content digest for the catalog release a preference-card release was published against.
 *
 * The obvious candidate — `import-report.json`'s `workbook_sha256` — identifies the wrong
 * object. It is the digest of the *source workbook*, and the generated catalog is not the
 * workbook: `apply-catalog-additions`, `apply-product-overrides`, `apply-role-taxonomy`, and
 * the external-review remediation overlay all rewrite product identity, role mappings, and
 * slotting governance downstream of it. Every one of those edits changes what a card resolves
 * to — whether a stored pick still maps to its role, whether a product is selectable at all —
 * while `workbook_sha256` sits perfectly still. An identifier that cannot move when the thing
 * it identifies moves is not an identifier.
 *
 * So this hashes the artifacts the resolver actually reads. It stays *outside* the release
 * bundle's `definitionHash` for the reason recorded in `RELEASE_BUNDLE_HASH_EXCLUSIONS`: the
 * catalog is independently versioned and re-imported on its own cadence, and forcing every
 * procedure to republish on each import would make republication routine and therefore
 * meaningless. Recorded and reported, not blocking.
 */

/**
 * The generated catalog artifacts that can change a resolved card.
 *
 * Deliberately not the whole `generated/` directory. `verification-backlog.json`,
 * `slot-product-option-proposals.json`, `coverage-report.json`, and the OpenFDA artifacts are
 * review queues and dashboards — none of them reaches `resolveCard`, and including them would
 * make the digest churn on every review pass while saying nothing about clinical output.
 */
export const CATALOG_RELEASE_INPUTS = [
  'catalog-products.json',
  'product-roles.json',
  'roles.json',
] as const

export interface CatalogRelease {
  /** The digest a release bundle records. */
  catalogReleaseId: string
  /** The source workbook, kept alongside so provenance is still legible. */
  workbookSha256: string
  inputs: Record<string, string>
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export async function computeCatalogRelease(
  generatedDirectory: string,
  workbookSha256: string,
): Promise<CatalogRelease> {
  const inputs: Record<string, string> = {}
  for (const filename of CATALOG_RELEASE_INPUTS) {
    const contents = await readFile(path.join(generatedDirectory, filename), 'utf8')
    // Hashed as parsed-and-restringified rather than raw bytes, so a reformat of a generated
    // file is not reported as a catalog change.
    inputs[filename] = sha256(JSON.stringify(JSON.parse(contents)))
  }

  const manifest = [
    `workbook:${workbookSha256}`,
    ...CATALOG_RELEASE_INPUTS.map((filename) => `${filename}:${inputs[filename]}`),
  ].join('\n')

  return { catalogReleaseId: sha256(manifest), workbookSha256, inputs }
}
