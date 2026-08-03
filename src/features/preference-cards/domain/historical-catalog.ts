import { stableSnapshotHash } from './stable-hash'

/**
 * Retained catalog content, addressed by hash.
 *
 * `catalogImportId` on a release bundle already hashes the artifacts the resolver reads, so it
 * *detects* a catalog move. Detecting a move is not the same as being able to reconstruct what
 * was there before it. A card pinned to release R names catalog release C; if the only copy of C
 * is "whatever `catalog-products.json` said at the time", then C is a receipt for content nobody
 * kept, and a product deleted from the current catalog takes the identity of every saved pick
 * that named it.
 *
 * So the id is made to address retrievable content. Two artifacts, in the shape the design
 * called for:
 *
 * ```text
 *   catalog row content → canonical row hash → content-addressed immutable row store
 *   catalog release      → manifest of exact row hashes → manifest hash
 * ```
 *
 * The row store is content-addressed, so two releases that share a product store it once; the
 * manifest is thin, so a release is a list of hashes rather than a second copy of the catalog.
 * Neither is ever rewritten: a row whose content no longer hashes to its own key has been edited
 * in place, and a manifest that no longer hashes to what it recorded has been edited in place,
 * and both are build failures rather than silent corrections.
 *
 * ## What is retained, and what is deliberately not
 *
 * Retained: the normalized content needed to reconstruct a *saved selection* — product identity,
 * the manufacturer behind it, the role mappings that made it selectable, the dimensions the
 * compatibility rules read, and the governance values that change what the resolver does with it.
 *
 * Not retained: hospital-local operational state — local approval, current inventory, storage
 * location, preference rank, local item number, room capability, formulary status. Those are
 * *supposed* to be current: a physician reopening a card should see the requirements they
 * reviewed and the equipment the room has today. Freezing them would pin a card to a shelf that
 * has since been emptied. None of them appear in the three catalog release inputs at all, which
 * is what makes the boundary checkable rather than merely stated — see
 * `HISTORICAL_CATALOG_EXCLUDED_HOSPITAL_LOCAL_FIELDS`.
 *
 * ## The closure rule
 *
 * A retained row may only carry values that come from the three files `catalogReleaseId` is
 * computed over — `catalog-products.json`, `product-roles.json`, `roles.json`. That is not a
 * convenience; it is what makes the id a content address. Anything derived from a fourth input
 * could change while the id sat still, and one id would then legitimately address two different
 * manifests. Three things are excluded for exactly this reason and are pinned or retained
 * elsewhere:
 *
 * - **Role aliases.** Pinned by the release bundle's `roleTaxonomyPin`.
 * - **Reviewed governance** — `slottingScope`, lifecycle context, regulatory status. Authored in
 *   `reviewed/external-review-corrections.json` and applied by `decorateProduct`. It answers a
 *   *current* question ("may this be attached to a requirement today"), which is the right
 *   question to keep asking from current data: an item withdrawn to `not_applicable` should stop
 *   being selectable, not keep being selectable because it once was.
 * - **Reviewed product-family membership.** A family version records its own `catalogReleaseId`
 *   and its own frozen member list; see `product-family.ts`. Membership is a reviewed statement
 *   *about* a catalog release, not a property of a catalog row, and a row that carried it would
 *   change whenever a family was reviewed.
 *
 * - **Product lineage.** Retained only where a source explicitly authored it. No column in the
 *   current catalog does, so nothing is retained rather than something inferred: a replacement
 *   relationship guessed from names, catalog numbers, or dimensions is a clinical claim.
 */

/** Bumped when the *meaning* of a row or manifest hash changes. Carried inside every hash. */
export const HISTORICAL_CATALOG_HASH_VERSION = 'ip-cards-catalog-retention/1'

export const HISTORICAL_CATALOG_FORMAT_VERSION = '1.0'

/**
 * The hospital-local fields that must never enter a retained catalog row, written down as data
 * so the boundary is reviewable and so `historical-catalog.test.ts` can assert it rather than
 * trusting the prose above.
 */
export const HISTORICAL_CATALOG_EXCLUDED_HOSPITAL_LOCAL_FIELDS: Readonly<Record<string, string>> = {
  verificationState:
    'Local approval. A site approves an item for its own shelves; that decision is current by definition and a card must not be pinned to last year’s approval.',
  active:
    'Current inventory. Whether the site still stocks the item is a fact about today’s store room.',
  storageLocation: 'Where the item currently lives in this hospital.',
  preferenceRank:
    'Local formulary ranking. Explicit selections already stop ranking from rewriting a saved card; retaining a rank would additionally freeze a preference the site is entitled to change.',
  localItemNumber: 'The site’s own item number, which no other site shares.',
  localDescription: 'The site’s own wording for the item.',
  locationCapabilities:
    'What the room can do today. Pinning it would keep asserting a capability the site may since have lost.',
  formularyStatus: 'Whether the item is on the local formulary right now.',
}

export type HistoricalCatalogRow =
  | HistoricalProductRow
  | HistoricalRoleRow
  | HistoricalProductRoleRow

/**
 * One product, normalized to what a saved selection needs to be reconstructed.
 *
 * Field names are the domain's, not the workbook's: the generated JSON uses snake_case column
 * names inherited from the import, and a retained artifact that mirrored them would make the
 * retention format hostage to a column rename upstream.
 */
export interface HistoricalProductRow {
  kind: 'product'
  productId: string
  /**
   * The manufacturer exactly as the catalog release recorded it, not the canonical display group.
   *
   * Alias grouping lives in `manufacturer-aliases.ts` — code, deliberately, so a presentation
   * decision can change without a re-import — which puts it outside the three files
   * `catalogReleaseId` is computed from. Retaining the *grouped* identity would therefore let one
   * catalog release id address two different manifests, the one property a content address must
   * not have. The grouping is applied by current code on the way out, and that file is byte-
   * protected by `protected-artifacts.test.ts`, so it cannot drift unnoticed either.
   */
  manufacturerId: string | null
  manufacturerName: string | null
  productName: string
  catalogNumber: string | null
  gtin: string | null
  sizeDisplay: string | null
  /** Retained because the discovery grouping is derived from these two and the explorer shows them. */
  brandFamily: string | null
  subcategory: string | null
  productKind: string | null
  /**
   * Raw governance columns rather than the derived tier: `catalogVerificationTier` and
   * `isUsStatusPending` are resolver code, and retaining their *output* would freeze one build's
   * interpretation of the data into the data itself. Both columns change what the resolver does —
   * they decide whether a rebuilt pick lands as `prototype_visible` or `unverified`, which is the
   * difference between a card that prints a confirm-before-use flag and one that does not.
   */
  verificationGrade: string | null
  visibilityState: string | null
  /** The dimensions the typed compatibility rules read. */
  diameterMm: number | null
  lengthMm: number | null
  frenchSize: number | null
  gauge: number | null
  workingLengthCm: number | null
  minWorkingChannelMm: number | null
  deliverySystemOdMm: number | null
  /** Provenance a rebuilt pick carries onto the card. */
  primarySourceId: string | null
  primarySourceLocation: string | null
}

export interface HistoricalRoleRow {
  kind: 'role'
  roleCode: string
  roleName: string
  category: string | null
  requiresCurrentIfu: boolean | null
}

export interface HistoricalProductRoleRow {
  kind: 'product-role'
  productId: string
  roleCode: string
  roleFit: string | null
}

/** The content-addressed store. Keys are row hashes; values are the rows they address. */
export interface HistoricalCatalogRowStore {
  formatVersion: string
  hashVersion: string
  rows: Record<string, HistoricalCatalogRow>
}

/**
 * A catalog release, as a manifest of exact row hashes.
 *
 * `catalogReleaseId` is computed exactly as it always was — see `catalog-release-id.ts` — so a
 * bundle published before this artifact existed still names a release this manifest describes.
 * `manifestHash` is new and addresses the retained content itself, which is the thing that could
 * not previously be checked.
 */
export interface HistoricalCatalogReleaseManifest {
  catalogReleaseId: string
  workbookSha256: string
  /** Per-file digests, carried so the manifest still explains which inputs produced it. */
  inputs: Record<string, string>
  productRowHashes: string[]
  roleRowHashes: string[]
  productRoleRowHashes: string[]
  manifestHash: string
}

export interface HistoricalCatalogReleaseFile {
  formatVersion: string
  hashVersion: string
  releases: HistoricalCatalogReleaseManifest[]
}

function hash(kind: string, payload: unknown): string {
  return stableSnapshotHash({ v: HISTORICAL_CATALOG_HASH_VERSION, kind, payload })
}

/** The canonical hash of one retained row. Identical content always yields the same key. */
export function catalogRowHash(row: HistoricalCatalogRow): string {
  return hash(`row:${row.kind}`, row)
}

/**
 * The manifest's own hash: the release id plus the exact row hashes it names, in order.
 *
 * The row hash lists are sorted by the builder before they get here, so this is a hash of a
 * canonical sequence rather than of whatever order a Map happened to iterate in.
 */
export function catalogReleaseManifestHash(
  manifest: Omit<HistoricalCatalogReleaseManifest, 'manifestHash'>,
): string {
  return hash('release-manifest', {
    catalogReleaseId: manifest.catalogReleaseId,
    workbookSha256: manifest.workbookSha256,
    inputs: manifest.inputs,
    productRowHashes: manifest.productRowHashes,
    roleRowHashes: manifest.roleRowHashes,
    productRoleRowHashes: manifest.productRoleRowHashes,
  })
}

export function emptyHistoricalCatalogRowStore(): HistoricalCatalogRowStore {
  return {
    formatVersion: HISTORICAL_CATALOG_FORMAT_VERSION,
    hashVersion: HISTORICAL_CATALOG_HASH_VERSION,
    rows: {},
  }
}

export function emptyHistoricalCatalogReleaseFile(): HistoricalCatalogReleaseFile {
  return {
    formatVersion: HISTORICAL_CATALOG_FORMAT_VERSION,
    hashVersion: HISTORICAL_CATALOG_HASH_VERSION,
    releases: [],
  }
}

/**
 * Fold new rows into the store without disturbing what is already there.
 *
 * Append-only by construction, like the module ledger: a key the store already holds is left
 * exactly as it is, so this function can never be the thing that rewrites retained content.
 * Because the key *is* the hash of the content, "already holds this key" and "already holds this
 * content" are the same statement — a changed row simply arrives under a new key, and the old
 * one stays addressable by every manifest that named it.
 */
export function withRetainedCatalogRows(
  store: HistoricalCatalogRowStore,
  rows: HistoricalCatalogRow[],
): HistoricalCatalogRowStore {
  const merged: Record<string, HistoricalCatalogRow> = { ...store.rows }
  for (const row of rows) {
    const key = catalogRowHash(row)
    if (merged[key]) continue
    merged[key] = row
  }
  return {
    formatVersion: store.formatVersion,
    hashVersion: store.hashVersion,
    rows: Object.fromEntries(
      Object.entries(merged).sort(([left], [right]) => left.localeCompare(right)),
    ),
  }
}

/**
 * Record a release manifest, once.
 *
 * An id the file already carries is returned untouched even when re-derivation now produces
 * something different; that divergence is reported by `validateHistoricalCatalog` rather than
 * absorbed here. Silently replacing it would mean the same catalog release id addressed
 * different content before and after a build, which is the failure the whole artifact exists to
 * make impossible.
 */
export function withRetainedCatalogRelease(
  file: HistoricalCatalogReleaseFile,
  manifest: HistoricalCatalogReleaseManifest,
): HistoricalCatalogReleaseFile {
  if (file.releases.some((release) => release.catalogReleaseId === manifest.catalogReleaseId)) {
    return file
  }
  return {
    formatVersion: file.formatVersion,
    hashVersion: file.hashVersion,
    releases: [...file.releases, manifest].sort((left, right) =>
      left.catalogReleaseId.localeCompare(right.catalogReleaseId),
    ),
  }
}

export type HistoricalCatalogValidationCode =
  | 'catalog_row_mutated'
  | 'catalog_row_missing'
  | 'catalog_release_duplicate'
  | 'catalog_release_manifest_mutated'
  | 'catalog_release_manifest_diverged'
  | 'catalog_release_missing'
  | 'catalog_row_orphaned'

export interface HistoricalCatalogValidationMessage {
  code: HistoricalCatalogValidationCode
  severity: 'blocking' | 'info'
  catalogReleaseId: string | null
  message: string
  rowHashes?: string[]
}

export interface HistoricalCatalogValidationInput {
  store: HistoricalCatalogRowStore
  releases: HistoricalCatalogReleaseFile
  /**
   * The manifest re-derived from the current catalog in this run, keyed by release id. A release
   * absent here is one the current catalog no longer produces, which is normal for a historical
   * release and is not an error; a release present here that disagrees with what is retained is
   * a rewritten manifest and is.
   */
  rederived?: Map<string, HistoricalCatalogReleaseManifest>
  /** Catalog releases published bundles pin. Every one of these must stay retrievable. */
  pinnedCatalogReleaseIds?: ReadonlySet<string>
}

/**
 * Every way the retained catalog can be wrong, checked in one pass.
 *
 * Checked against three things, for the same reason the module ledger is checked against two.
 * Against itself — a row whose content no longer hashes to its key, or a manifest whose recorded
 * hash no longer matches its own row lists, has been edited in place. Against re-derivation — the
 * same catalog release id producing different content now than when it was recorded means the
 * derivation changed under a frozen id. And against the releases that pin it — a catalog release
 * a published bundle names must still be there, or the bundle's card cannot be reconstructed.
 */
export function validateHistoricalCatalog(
  input: HistoricalCatalogValidationInput,
): HistoricalCatalogValidationMessage[] {
  const messages: HistoricalCatalogValidationMessage[] = []

  for (const [key, row] of Object.entries(input.store.rows)) {
    const recomputed = catalogRowHash(row)
    if (recomputed === key) continue
    messages.push({
      code: 'catalog_row_mutated',
      severity: 'blocking',
      catalogReleaseId: null,
      rowHashes: [key],
      message: `Retained catalog row ${key} no longer hashes to its own content (${key} → ${recomputed}). A retained row is immutable: a changed product is a new row under a new hash, named by a new catalog release.`,
    })
  }

  const seen = new Set<string>()
  const referenced = new Set<string>()
  for (const release of input.releases.releases) {
    if (seen.has(release.catalogReleaseId)) {
      messages.push({
        code: 'catalog_release_duplicate',
        severity: 'blocking',
        catalogReleaseId: release.catalogReleaseId,
        message: `Catalog release ${release.catalogReleaseId} is recorded more than once. A catalog release id must address exactly one manifest.`,
      })
      continue
    }
    seen.add(release.catalogReleaseId)

    const recomputed = catalogReleaseManifestHash(release)
    if (recomputed !== release.manifestHash) {
      messages.push({
        code: 'catalog_release_manifest_mutated',
        severity: 'blocking',
        catalogReleaseId: release.catalogReleaseId,
        message: `Catalog release ${release.catalogReleaseId} no longer hashes to the manifest it recorded (${release.manifestHash} → ${recomputed}).`,
      })
    }

    const missing: string[] = []
    for (const rowHash of [
      ...release.productRowHashes,
      ...release.roleRowHashes,
      ...release.productRoleRowHashes,
    ]) {
      referenced.add(rowHash)
      if (!input.store.rows[rowHash]) missing.push(rowHash)
    }
    if (missing.length > 0) {
      messages.push({
        code: 'catalog_row_missing',
        severity: 'blocking',
        catalogReleaseId: release.catalogReleaseId,
        rowHashes: missing.slice(0, 20),
        message: `Catalog release ${release.catalogReleaseId} names ${missing.length} retained row(s) the store no longer holds. A retained release must stay reconstructable.`,
      })
    }

    const rederived = input.rederived?.get(release.catalogReleaseId)
    if (rederived && rederived.manifestHash !== release.manifestHash) {
      messages.push({
        code: 'catalog_release_manifest_diverged',
        severity: 'blocking',
        catalogReleaseId: release.catalogReleaseId,
        message: `Catalog release ${release.catalogReleaseId} was retained with one manifest and the current catalog re-derives another (${release.manifestHash} → ${rederived.manifestHash}). One catalog release id cannot address two different catalogs: if the catalog changed, its id changes with it.`,
      })
    }
  }

  for (const catalogReleaseId of input.pinnedCatalogReleaseIds ?? []) {
    if (seen.has(catalogReleaseId)) continue
    messages.push({
      code: 'catalog_release_missing',
      severity: 'blocking',
      catalogReleaseId,
      message: `Catalog release ${catalogReleaseId} is pinned by a published release bundle but is not retained. The cards pinned to it cannot reconstruct product or role identity.`,
    })
  }

  // Informational rather than blocking: an unreferenced row is dead weight, not corruption, and
  // pruning it is a decision with its own risk (a manifest may be added later in the same
  // milestone). Reported so the growth of the store stays visible.
  const orphaned = Object.keys(input.store.rows).filter((key) => !referenced.has(key))
  if (orphaned.length > 0) {
    messages.push({
      code: 'catalog_row_orphaned',
      severity: 'info',
      catalogReleaseId: null,
      rowHashes: orphaned.slice(0, 20),
      message: `${orphaned.length} retained catalog row(s) are named by no release manifest.`,
    })
  }

  return messages
}

export type HistoricalCatalogErrorCode =
  | 'catalog_release_unavailable'
  | 'catalog_row_unavailable'
  | 'catalog_row_hash_mismatch'
  | 'catalog_manifest_hash_mismatch'

export interface HistoricalCatalogFailure {
  ok: false
  code: HistoricalCatalogErrorCode
  message: string
  catalogReleaseId: string
}

/**
 * A resolved historical catalog: exactly the content one release retained, indexed for lookup.
 *
 * Deliberately not merged with the current catalog. A caller holding one of these is
 * reconstructing a card as its author saw it, and quietly filling a gap from today's catalog is
 * the substitution every pin in this module exists to prevent — a product that has been
 * reformulated under the same id would arrive with its new dimensions and the card would resolve
 * against specs nobody reviewed.
 */
export interface HistoricalCatalog {
  ok: true
  catalogReleaseId: string
  productById: ReadonlyMap<string, HistoricalProductRow>
  roleByCode: ReadonlyMap<string, HistoricalRoleRow>
  /** product id → the roles that product was mapped to in this release. */
  rolesByProductId: ReadonlyMap<string, HistoricalProductRoleRow[]>
}

export type HistoricalCatalogResult = HistoricalCatalog | HistoricalCatalogFailure

/**
 * Rebuild one catalog release from the retained artifacts, verifying every hash on the way.
 *
 * Every failure is typed and none of them fall back. A missing manifest, a missing row, a row
 * whose content no longer matches the hash the manifest named — each is reported as itself, and
 * the caller turns it into a view-only card rather than a card resolved against a substitute.
 */
export function resolveHistoricalCatalog(
  catalogReleaseId: string,
  store: HistoricalCatalogRowStore,
  releases: HistoricalCatalogReleaseFile,
): HistoricalCatalogResult {
  const manifest = releases.releases.find(
    (release) => release.catalogReleaseId === catalogReleaseId,
  )
  if (!manifest) {
    return {
      ok: false,
      code: 'catalog_release_unavailable',
      catalogReleaseId,
      message: `Catalog release ${catalogReleaseId} is not retained, so the products and roles this card was saved against cannot be reconstructed.`,
    }
  }
  if (catalogReleaseManifestHash(manifest) !== manifest.manifestHash) {
    return {
      ok: false,
      code: 'catalog_manifest_hash_mismatch',
      catalogReleaseId,
      message: `Catalog release ${catalogReleaseId} no longer hashes to the manifest it recorded.`,
    }
  }

  const productById = new Map<string, HistoricalProductRow>()
  const roleByCode = new Map<string, HistoricalRoleRow>()
  const rolesByProductId = new Map<string, HistoricalProductRoleRow[]>()

  const take = (rowHash: string): HistoricalCatalogRow | HistoricalCatalogFailure => {
    const row = store.rows[rowHash]
    if (!row) {
      return {
        ok: false,
        code: 'catalog_row_unavailable',
        catalogReleaseId,
        message: `Catalog release ${catalogReleaseId} names retained row ${rowHash}, which is no longer stored.`,
      }
    }
    if (catalogRowHash(row) !== rowHash) {
      return {
        ok: false,
        code: 'catalog_row_hash_mismatch',
        catalogReleaseId,
        message: `Retained catalog row ${rowHash} no longer hashes to its own content.`,
      }
    }
    return row
  }

  for (const rowHash of manifest.productRowHashes) {
    const row = take(rowHash)
    if ('ok' in row) return row
    if (row.kind !== 'product') continue
    productById.set(row.productId, row)
  }
  for (const rowHash of manifest.roleRowHashes) {
    const row = take(rowHash)
    if ('ok' in row) return row
    if (row.kind !== 'role') continue
    roleByCode.set(row.roleCode, row)
  }
  for (const rowHash of manifest.productRoleRowHashes) {
    const row = take(rowHash)
    if ('ok' in row) return row
    if (row.kind !== 'product-role') continue
    const existing = rolesByProductId.get(row.productId)
    if (existing) existing.push(row)
    else rolesByProductId.set(row.productId, [row])
  }

  return { ok: true, catalogReleaseId, productById, roleByCode, rolesByProductId }
}
