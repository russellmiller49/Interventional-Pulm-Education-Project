import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import {
  safetyDisplayCarriesReferenceCodes,
  safetyDisplayMatchedAnAction,
  toMarketStatus,
  toSafetyActionScope,
  toSafetyDisplay,
  toStatusRecommendationGate,
  type MarketConfidence,
} from '../../src/features/device-intelligence/domain/product-status'
import {
  RECALL_NUMBER_PATTERN,
  statusOverlayArtifactSchema,
  type StatusOverlayArtifact,
  type StatusOverlayRow,
} from '../../src/features/device-intelligence/domain/status-overlay-schema'
import { ATLAS_INCLUDED_VERIFICATION_GRADE } from '../../src/features/device-intelligence/domain/atlas-cohort'

/**
 * Build the compact Device Intelligence market-status and safety overlay from the merged
 * PR #105 research package.
 *
 *   npm run ip-intel:status-overlay          # write
 *   npm run ip-intel:status-overlay -- --check   # fail if the committed file is stale
 *
 * The research proposal artifact is ~14 MB of evidence: rationale prose, unresolved-question
 * prose, manufacturer and FDA response text, source URLs, raw cache references, API query
 * strings, and free-text conflict descriptions. NONE of that may reach application runtime
 * code or a client bundle. This generator projects it down to controlled, enumerated fields
 * only — the ones the D2B UI actually renders — and pins the source artifact's sha-256 so a
 * reader can prove which evidence snapshot produced the labels.
 *
 * Row scope: products the research package covers whose CANONICAL verification grade is
 * `verified_source`. Those are exactly the products the D2B atlas can admit; a candidate- or
 * unknown-grade product is unreachable in Device Intelligence, so shipping its status into a
 * runtime artifact would be data the UI can never use.
 *
 * Determinism: rows sorted by product id, reference codes sorted and deduplicated, counts
 * derived from the rows, no clock or environment input anywhere. Running it twice produces
 * byte-identical output.
 */

const REPO_ROOT = path.resolve(__dirname, '../..')
const SOURCE_RELATIVE_PATH =
  'data/ip-preference-cards/research/us-status/2026-08-13/us-status-evidence-proposals.json'
const CATALOG_RELATIVE_PATH = 'data/ip-preference-cards/generated/catalog-products.json'
export const OVERLAY_RELATIVE_PATH =
  'data/ip-device-intelligence/generated/product-status-overlay.json'

interface ResearchSafetyRecord {
  recall_number?: unknown
  match_scope?: unknown
}

interface ResearchRow {
  canonical_identity: { product_id: string }
  research_state: string
  confidence: string
  layer_results: {
    safety_action: {
      search_status: string
      action_state: string
      action_scope: string
      records?: ResearchSafetyRecord[]
    }
  }
}

interface ResearchArtifact {
  artifact_kind: string
  method_version: string
  research_as_of_date: string
  products: ResearchRow[]
}

interface CatalogRow {
  product_id: string
  verification_grade?: string | null
}

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function countBy<T extends string>(values: T[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const value of values.slice().sort()) counts[value] = (counts[value] ?? 0) + 1
  return counts
}

export function buildStatusOverlay(options: {
  research: ResearchArtifact
  researchBytes: Buffer
  catalog: CatalogRow[]
}): StatusOverlayArtifact {
  const { research, researchBytes, catalog } = options
  if (research.artifact_kind !== 'current_us_status_evidence_proposals') {
    throw new Error(`Unexpected research artifact_kind "${research.artifact_kind}".`)
  }
  if (research.method_version !== 'current-us-status-evidence-v1') {
    throw new Error(`Unexpected research method_version "${research.method_version}".`)
  }

  const gradeByProductId = new Map(
    catalog.map((product) => [product.product_id, product.verification_grade ?? null]),
  )

  const rows: StatusOverlayRow[] = []
  for (const product of research.products) {
    const productId = product.canonical_identity.product_id
    if (!gradeByProductId.has(productId)) {
      throw new Error(
        `Research row ${productId} is absent from ${CATALOG_RELATIVE_PATH}; the pinned catalog input has drifted.`,
      )
    }
    // Canonical grade, not the research package's snapshot copy: the catalog is the
    // authority on sourced identity, and D2B admits exactly `verified_source`.
    if (gradeByProductId.get(productId) !== ATLAS_INCLUDED_VERIFICATION_GRADE) continue

    const safety = product.layer_results.safety_action
    const marketStatus = toMarketStatus(product.research_state, product.confidence)
    const safetyDisplay = toSafetyDisplay(safety.search_status, safety.action_state)
    // Scope describes a matched action, so it exists only when one was matched. Emitting
    // "unknown" for the 533 products with no matched action would read as an undetermined
    // recall scope rather than as no recall at all.
    const scope = safetyDisplayMatchedAnAction(safetyDisplay)
      ? toSafetyActionScope(safety.action_scope)
      : null

    // Recall numbers ride along only for EXACT product matches, and only from records the
    // research package itself scoped as exact. Nothing else about a record is copied — no
    // firm name, no reason text, no product description, no dates beyond the snapshot.
    const referenceCodes = safetyDisplayCarriesReferenceCodes(safetyDisplay)
      ? [
          ...new Set(
            (safety.records ?? [])
              .filter((record) => record.match_scope === 'exact_product')
              .map((record) => record.recall_number)
              .filter(
                (value): value is string =>
                  typeof value === 'string' && RECALL_NUMBER_PATTERN.test(value),
              ),
          ),
        ].sort()
      : []

    rows.push({
      product_id: productId,
      research_snapshot_date: research.research_as_of_date,
      market_status: marketStatus,
      market_confidence: (['high', 'moderate', 'low'] as const).includes(
        product.confidence as MarketConfidence,
      )
        ? (product.confidence as MarketConfidence)
        : null,
      safety_display: safetyDisplay,
      safety_action_scope: scope,
      safety_reference_codes: referenceCodes,
      status_recommendation_gate: toStatusRecommendationGate(marketStatus, safetyDisplay),
    })
  }

  rows.sort((left, right) => left.product_id.localeCompare(right.product_id))

  const artifact = {
    format_version: 1 as const,
    artifact_kind: 'device_intelligence_product_status_overlay' as const,
    method_version: 'd2b-status-overlay-v1' as const,
    research_as_of_date: research.research_as_of_date,
    source_artifact: {
      path: SOURCE_RELATIVE_PATH,
      sha256: sha256(researchBytes),
    },
    row_scope: 'research_cohort_verification_grade_verified_source' as const,
    counts: {
      rows: rows.length,
      research_products_considered: research.products.length,
      market_status: countBy(rows.map((row) => row.market_status)),
      safety_display: countBy(rows.map((row) => row.safety_display)),
      status_recommendation_gate: countBy(rows.map((row) => row.status_recommendation_gate)),
    },
    rows,
  }

  // Validate BEFORE writing: a schema failure must never produce a committed artifact.
  return statusOverlayArtifactSchema.parse(artifact)
}

export function serializeStatusOverlay(artifact: StatusOverlayArtifact): string {
  return `${JSON.stringify(artifact, null, 2)}\n`
}

export function generateStatusOverlayFile(repoRoot = REPO_ROOT): string {
  const researchBytes = readFileSync(path.join(repoRoot, SOURCE_RELATIVE_PATH))
  const research = JSON.parse(researchBytes.toString('utf8')) as ResearchArtifact
  const catalog = JSON.parse(
    readFileSync(path.join(repoRoot, CATALOG_RELATIVE_PATH), 'utf8'),
  ) as CatalogRow[]
  return serializeStatusOverlay(buildStatusOverlay({ research, researchBytes, catalog }))
}

function main(argv: string[]): void {
  const check = argv.includes('--check')
  const target = path.join(REPO_ROOT, OVERLAY_RELATIVE_PATH)
  const next = generateStatusOverlayFile()
  if (check) {
    const current = readFileSync(target, 'utf8')
    if (current !== next) {
      throw new Error(
        `${OVERLAY_RELATIVE_PATH} is stale. Run "npm run ip-intel:status-overlay" and commit the result.`,
      )
    }
    process.stdout.write(`${OVERLAY_RELATIVE_PATH} is up to date.\n`)
    return
  }
  writeFileSync(target, next)
  const parsed = JSON.parse(next) as StatusOverlayArtifact
  process.stdout.write(
    `Wrote ${OVERLAY_RELATIVE_PATH}: ${parsed.rows.length} rows, ${Buffer.byteLength(next)} bytes.\n`,
  )
}

if (require.main === module) {
  try {
    main(process.argv.slice(2))
  } catch (error) {
    process.stderr.write(`${(error as Error).message}\n`)
    process.exitCode = 1
  }
}
