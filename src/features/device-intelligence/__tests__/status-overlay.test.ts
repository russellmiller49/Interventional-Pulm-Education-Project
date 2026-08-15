import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import {
  MARKET_STATUSES,
  RESEARCH_SAFETY_ACTION_STATES,
  RESEARCH_SAFETY_SEARCH_STATUSES,
  RESEARCH_STATES,
  SAFETY_DISPLAYS,
  STATUS_RECOMMENDATION_GATES,
  UNRESEARCHED_PRODUCT_STATUS,
  safetyDisplayCarriesReferenceCodes,
  safetyDisplayIsMaterialOnCards,
  safetyDisplayMatchedAnAction,
  toMarketStatus,
  toSafetyActionScope,
  toSafetyDisplay,
  toStatusRecommendationGate,
} from '@/features/device-intelligence/domain/product-status'
import {
  RECALL_NUMBER_PATTERN,
  statusOverlayArtifactSchema,
} from '@/features/device-intelligence/domain/status-overlay-schema'
import {
  getProductStatus,
  getStatusOverlayProvenance,
} from '@/features/device-intelligence/server/product-status.server'
import { getAtlasCatalogStore } from '@/features/device-intelligence/server/atlas-store.server'
import {
  OVERLAY_RELATIVE_PATH,
  generateStatusOverlayFile,
} from '../../../../scripts/ip-device-intelligence/build-status-overlay'

const REPO_ROOT = join(__dirname, '../../../..')
const SOURCE_RELATIVE_PATH =
  'data/ip-preference-cards/research/us-status/2026-08-13/us-status-evidence-proposals.json'

const committed = readFileSync(join(REPO_ROOT, OVERLAY_RELATIVE_PATH), 'utf8')
const artifact = statusOverlayArtifactSchema.parse(JSON.parse(committed))

describe('D2B status overlay — generation', () => {
  it('is deterministic: regenerating produces byte-identical output', () => {
    expect(generateStatusOverlayFile(REPO_ROOT)).toBe(committed)
    expect(generateStatusOverlayFile(REPO_ROOT)).toBe(generateStatusOverlayFile(REPO_ROOT))
  })

  it('pins the source proposal artifact by sha-256 and research date', () => {
    const bytes = readFileSync(join(REPO_ROOT, SOURCE_RELATIVE_PATH))
    expect(artifact.source_artifact.path).toBe(SOURCE_RELATIVE_PATH)
    expect(artifact.source_artifact.sha256).toBe(createHash('sha256').update(bytes).digest('hex'))
    expect(artifact.research_as_of_date).toBe('2026-08-13')
    for (const row of artifact.rows) {
      expect(row.research_snapshot_date).toBe('2026-08-13')
    }
  })

  it('validates every row against the closed schema and rejects unknown fields', () => {
    const single = (row: unknown) => ({
      ...artifact,
      counts: { ...artifact.counts, rows: 1 },
      rows: [row],
    })
    for (const row of artifact.rows) {
      expect(statusOverlayArtifactSchema.safeParse(single(row)).success).toBe(true)
    }
    expect(
      statusOverlayArtifactSchema.safeParse(
        single({ ...artifact.rows[0], rationale: 'because the manufacturer page said so' }),
      ).success,
    ).toBe(false)
    expect(
      statusOverlayArtifactSchema.safeParse(
        single({ ...artifact.rows[0], market_status: 'currently_orderable' }),
      ).success,
    ).toBe(false)
    expect(
      statusOverlayArtifactSchema.safeParse(
        single({ ...artifact.rows[0], safety_reference_codes: ['see the FDA notice'] }),
      ).success,
    ).toBe(false)
    // Row-level invariants the schema owns: unsorted rows and mismatched counts both fail.
    expect(
      statusOverlayArtifactSchema.safeParse({
        ...artifact,
        rows: [...artifact.rows].reverse(),
      }).success,
    ).toBe(false)
  })

  it('carries no prose, URL, API query, or raw source reference of any kind', () => {
    // Every scalar in the artifact must be a controlled value, an ISO date, a product id, a
    // recall number, a sha-256, or the declared paths/kinds. Nothing free-text.
    const allowedTopLevelStrings = new Set([
      artifact.artifact_kind,
      artifact.method_version,
      artifact.research_as_of_date,
      artifact.row_scope,
      artifact.source_artifact.path,
      artifact.source_artifact.sha256,
    ])
    const controlled = new Set<string>([
      ...MARKET_STATUSES,
      ...SAFETY_DISPLAYS,
      ...STATUS_RECOMMENDATION_GATES,
      'high',
      'moderate',
      'low',
      'lot_specific',
      'product_wide',
      'family_level',
      'unknown',
      '2026-08-13',
    ])
    const offenders: string[] = []
    const walk = (value: unknown, path: string) => {
      if (typeof value === 'string') {
        if (allowedTopLevelStrings.has(value)) return
        if (controlled.has(value)) return
        if (/^PRD-[A-Z0-9]{6,20}$/.test(value)) return
        if (RECALL_NUMBER_PATTERN.test(value)) return
        offenders.push(`${path}: ${value}`)
        return
      }
      if (Array.isArray(value)) {
        value.forEach((entry, index) => walk(entry, `${path}[${index}]`))
        return
      }
      if (value && typeof value === 'object') {
        for (const [key, entry] of Object.entries(value)) walk(entry, `${path}.${key}`)
      }
    }
    walk(artifact, '$')
    expect(offenders).toEqual([])
    expect(committed).not.toMatch(/https?:\/\//)
    expect(committed).not.toMatch(/search=|exact_query|response-[0-9a-f]{8}/)
  })

  it('is dramatically smaller than the research artifact it projects', () => {
    const researchBytes = readFileSync(join(REPO_ROOT, SOURCE_RELATIVE_PATH)).byteLength
    const overlayBytes = Buffer.byteLength(committed)
    expect(overlayBytes).toBeLessThan(researchBytes / 50)
    expect(artifact.rows.length).toBe(578)
    expect(artifact.counts.research_products_considered).toBe(779)
  })

  it('covers exactly the verified-source products the research package researched', () => {
    const atlas = getAtlasCatalogStore()
    for (const row of artifact.rows) {
      expect({
        productId: row.product_id,
        inCohort: atlas.productById.has(row.product_id),
      }).toEqual({ productId: row.product_id, inCohort: true })
    }
    // Candidate/unknown-grade researched products contribute no runtime row at all.
    expect(artifact.counts.research_products_considered - artifact.rows.length).toBe(201)
  })
})

describe('D2B status overlay — controlled mapping', () => {
  it('maps every research state conservatively without hiding a product', () => {
    expect(toMarketStatus('current_us_distribution_supported', 'high')).toBe('confirmed_current_us')
    expect(toMarketStatus('current_us_distribution_supported', 'moderate')).toBe(
      'likely_current_us',
    )
    // Low confidence is not an affirmative current-distribution claim.
    expect(toMarketStatus('current_us_distribution_supported', 'low')).toBe(
      'current_status_unverified',
    )
    expect(toMarketStatus('current_status_conflicted', 'moderate')).toBe(
      'current_status_conflicted',
    )
    expect(toMarketStatus('not_currently_distributed_supported', 'high')).toBe(
      'historical_or_discontinued',
    )
    expect(toMarketStatus('not_applicable_noncommercial_or_local', 'high')).toBe(
      'not_applicable_noncommercial_or_local',
    )
    // Every unresolved / insufficient / identity-unresolved state, plus anything a future
    // method version invents, lands on "not recently verified" — never on exclusion.
    for (const state of [
      'historically_authorized_current_status_unresolved',
      'identity_unresolved',
      'insufficient_evidence',
      'a_state_this_method_version_does_not_know',
    ]) {
      expect(toMarketStatus(state, 'low')).toBe('current_status_unverified')
    }
    // Exhaustive over the declared research vocabulary: every state maps to a controlled value.
    for (const state of RESEARCH_STATES) {
      for (const confidence of ['high', 'moderate', 'low']) {
        expect(MARKET_STATUSES).toContain(toMarketStatus(state, confidence))
      }
    }
  })

  it('never lets identity_unresolved read as an exclusion or a negative finding', () => {
    // The research package's identity_unresolved means current-status identity matching was
    // insufficient for that method — not that the catalog product lacks sourced identity.
    expect(toMarketStatus('identity_unresolved', 'low')).toBe('current_status_unverified')
    expect(toMarketStatus('identity_unresolved', 'low')).not.toBe('historical_or_discontinued')
    // 168 of the 578 rows are identity_unresolved and every one of them is in the atlas.
    const atlas = getAtlasCatalogStore()
    const unverified = artifact.rows.filter(
      (row) => row.market_status === 'current_status_unverified',
    )
    expect(unverified.length).toBeGreaterThan(400)
    for (const row of unverified) expect(atlas.productById.has(row.product_id)).toBe(true)
  })

  it('maps every safety state, preserving the PR #105 distinctions', () => {
    expect(toSafetyDisplay('searched', 'active_exact_product_action')).toBe('active_safety_notice')
    expect(toSafetyDisplay('searched', 'historical_exact_product_action')).toBe(
      'historical_safety_notice',
    )
    expect(toSafetyDisplay('searched', 'family_or_ambiguous_action')).toBe(
      'safety_identity_review_required',
    )
    expect(toSafetyDisplay('searched', 'no_exact_action_found')).toBe(
      'no_exact_action_found_as_of_snapshot',
    )
    expect(toSafetyDisplay('searched', 'unknown')).toBe('safety_status_unverified')
    expect(toSafetyDisplay('not_searched', 'unknown')).toBe('safety_status_unverified')
    expect(toSafetyDisplay('query_error', 'no_exact_action_found')).toBe('safety_status_unverified')
    // Exhaustive over the declared vocabulary.
    for (const searchStatus of RESEARCH_SAFETY_SEARCH_STATUSES) {
      for (const actionState of RESEARCH_SAFETY_ACTION_STATES) {
        expect(SAFETY_DISPLAYS).toContain(toSafetyDisplay(searchStatus, actionState))
      }
    }
    expect(toSafetyActionScope('lot_specific')).toBe('lot_specific')
    expect(toSafetyActionScope(null)).toBe('unknown')
    expect(toSafetyActionScope('something_else')).toBe('unknown')
  })

  it('derives the recommendation gate from market and safety status only', () => {
    expect(toStatusRecommendationGate('confirmed_current_us', 'active_safety_notice')).toBe(
      'blocked_active_safety_action',
    )
    expect(
      toStatusRecommendationGate('confirmed_current_us', 'safety_identity_review_required'),
    ).toBe('review_required')
    expect(toStatusRecommendationGate('confirmed_current_us', 'safety_status_unverified')).toBe(
      'review_required',
    )
    expect(
      toStatusRecommendationGate(
        'current_status_conflicted',
        'no_exact_action_found_as_of_snapshot',
      ),
    ).toBe('review_required')
    expect(
      toStatusRecommendationGate('confirmed_current_us', 'no_exact_action_found_as_of_snapshot'),
    ).toBe('clear')
    // A historical (terminated) action is not an active one.
    expect(toStatusRecommendationGate('confirmed_current_us', 'historical_safety_notice')).toBe(
      'clear',
    )
    // Availability uncertainty alone is not a review trigger; safety-verification gaps are.
    expect(
      toStatusRecommendationGate(
        'current_status_unverified',
        'no_exact_action_found_as_of_snapshot',
      ),
    ).toBe('clear')
    for (const market of MARKET_STATUSES) {
      for (const safety of SAFETY_DISPLAYS) {
        expect(STATUS_RECOMMENDATION_GATES).toContain(toStatusRecommendationGate(market, safety))
      }
    }
  })

  it('recomputes every committed row from the pure mapping functions', () => {
    for (const row of artifact.rows) {
      expect({
        productId: row.product_id,
        gate: row.status_recommendation_gate,
      }).toEqual({
        productId: row.product_id,
        gate: toStatusRecommendationGate(row.market_status, row.safety_display),
      })
      // Reference codes only for exact-product actions, scope only when an action matched.
      if (!safetyDisplayCarriesReferenceCodes(row.safety_display)) {
        expect(row.safety_reference_codes).toEqual([])
      }
      expect({
        productId: row.product_id,
        hasScope: row.safety_action_scope !== null,
      }).toEqual({
        productId: row.product_id,
        hasScope: safetyDisplayMatchedAnAction(row.safety_display),
      })
      // Sorted and deduplicated, so generation is byte-stable.
      expect(row.safety_reference_codes).toEqual([...new Set(row.safety_reference_codes)].sort())
    }
  })
})

describe('D2B status overlay — runtime reader', () => {
  it('defaults honestly for a product with no row', () => {
    const status = getProductStatus('PRD-NOTAREALPRODUCT')
    expect(status).toEqual(UNRESEARCHED_PRODUCT_STATUS)
    expect(status.researched).toBe(false)
    expect(status.researchSnapshotDate).toBeNull()
    expect(status.marketStatus).toBe('current_status_unverified')
    // Never "safe", never "recall-free".
    expect(status.safetyDisplay).toBe('safety_status_unverified')
    expect(status.safetyReferenceCodes).toEqual([])
    expect(status.statusRecommendationGate).toBe('review_required')
  })

  it('resolves a status for every product in the atlas, researched or not', () => {
    const atlas = getAtlasCatalogStore()
    let researched = 0
    for (const product of atlas.products) {
      const status = getProductStatus(product.product_id)
      expect(MARKET_STATUSES).toContain(status.marketStatus)
      expect(SAFETY_DISPLAYS).toContain(status.safetyDisplay)
      expect(STATUS_RECOMMENDATION_GATES).toContain(status.statusRecommendationGate)
      if (status.researched) researched += 1
      else expect(status).toEqual(UNRESEARCHED_PRODUCT_STATUS)
    }
    // The 578 newly included products are researched; the 753 previously visible ones are
    // not, and are labeled "not recently verified" rather than presented as current.
    expect(researched).toBe(578)
    expect(atlas.products.length - researched).toBe(753)
  })

  it('exposes the pinned provenance to the UI', () => {
    expect(getStatusOverlayProvenance()).toEqual({
      researchAsOfDate: '2026-08-13',
      sourceSha256: artifact.source_artifact.sha256,
      rowCount: 578,
    })
  })

  it('is imported by exactly one runtime module, and never by a client component', () => {
    const roots = [join(REPO_ROOT, 'src')]
    const sources: { path: string; text: string }[] = []
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry)
        if (statSync(full).isDirectory()) walk(full)
        else if (/\.tsx?$/.test(entry))
          sources.push({ path: full.slice(REPO_ROOT.length + 1), text: readFileSync(full, 'utf8') })
      }
    }
    roots.forEach(walk)
    const importers = sources.filter((source) =>
      /^import .* from '[^']*product-status-overlay\.json'$/m.test(source.text),
    )
    expect(importers.map((source) => source.path)).toEqual([
      'src/features/device-intelligence/server/product-status.server.ts',
    ])
    // That module is server-only, so the compact artifact cannot be pulled into a client
    // bundle through it either.
    expect(importers[0].text).toContain("import 'server-only'")
    // No client component anywhere reaches the overlay, directly or by re-export path.
    const clientComponents = sources.filter((source) => /^['"]use client['"]/m.test(source.text))
    expect(clientComponents.length).toBeGreaterThan(0)
    for (const source of clientComponents) {
      expect({
        path: source.path,
        importsOverlay: source.text.includes('product-status-overlay'),
      }).toEqual({ path: source.path, importsOverlay: false })
    }
  })

  it('keeps the card-badge rule narrow: only matched actions are badged', () => {
    expect(safetyDisplayIsMaterialOnCards('active_safety_notice')).toBe(true)
    expect(safetyDisplayIsMaterialOnCards('historical_safety_notice')).toBe(true)
    expect(safetyDisplayIsMaterialOnCards('safety_identity_review_required')).toBe(true)
    expect(safetyDisplayIsMaterialOnCards('safety_status_unverified')).toBe(false)
    expect(safetyDisplayIsMaterialOnCards('no_exact_action_found_as_of_snapshot')).toBe(false)
  })
})
