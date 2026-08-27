import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const REPO_ROOT = join(__dirname, '../../..')
const read = (relativePath: string): string => readFileSync(join(REPO_ROOT, relativePath), 'utf8')
const json = <T>(relativePath: string): T => JSON.parse(read(relativePath)) as T
const hash = (relativePath: string): string =>
  createHash('sha256')
    .update(readFileSync(join(REPO_ROOT, relativePath)))
    .digest('hex')

function sourceFiles(directory: string): string[] {
  const absolute = join(REPO_ROOT, directory)
  const files: string[] = []
  for (const entry of readdirSync(absolute)) {
    const path = join(absolute, entry)
    if (statSync(path).isDirectory()) files.push(...sourceFiles(relative(REPO_ROOT, path)))
    else if (/\.(?:ts|tsx|js|jsx)$/.test(entry)) files.push(path)
  }
  return files
}

describe('D2D-A governance and invariance boundaries', () => {
  it('freezes exactly the approved ten-product pilot', () => {
    const cohort = json<{ products: Array<{ product_id: string }> }>(
      'data/ip-device-intelligence/reviewed/d2d-pilot-cohort.json',
    )
    expect(cohort.products.map((product) => product.product_id)).toEqual([
      'PRD-003C4641E6',
      'PRD-05670F1B5F',
      'PRD-1ED27ADA45',
      'PRD-2632FFBF07',
      'PRD-3E1556EBE5',
      'PRD-6F15A8C9B5',
      'PRD-A0655BF464',
      'PRD-AED3720BF6',
      'PRD-B76AF3D731',
      'PRD-F4AE2A74E6',
    ])
  })

  it('preserves every governed baseline count', () => {
    const products = json<Array<{ verification_grade?: string | null }>>(
      'data/ip-preference-cards/generated/catalog-products.json',
    )
    const manufacturers = json<unknown[]>('data/ip-preference-cards/generated/manufacturers.json')
    const sources = json<unknown[]>('data/ip-preference-cards/generated/sources.json')
    const productSources = json<unknown[]>(
      'data/ip-preference-cards/generated/product-sources.json',
    )
    const productRoles = json<unknown[]>('data/ip-preference-cards/generated/product-roles.json')
    const taxonomy = json<{
      rows: unknown[]
      counts: { needs_review: number }
    }>('data/ip-device-intelligence/generated/product-taxonomy-overlay.json')
    const slotOptions = json<unknown[]>(
      'data/ip-preference-cards/generated/slot-product-options.json',
    )
    const proposals = json<{ proposals: unknown[] }>(
      'data/ip-preference-cards/generated/slot-product-option-proposals.json',
    )
    const governedCountContract = json<{
      count_contract: { published_products_after: number }
    }>('data/ip-preference-cards/reviewed/source-completeness-additions-2026-08-20.json')

    expect({
      canonicalProducts: products.length,
      verifiedSourceProducts: products.filter(
        (product) => product.verification_grade === 'verified_source',
      ).length,
      manufacturers: manufacturers.length,
      sources: sources.length,
      productSources: productSources.length,
      productRoles: productRoles.length,
      taxonomyRows: taxonomy.rows.length,
      taxonomyNeedsReview: taxonomy.counts.needs_review,
      slotOptions: slotOptions.length,
      slotProposals: proposals.proposals.length,
      publishedBaseline: governedCountContract.count_contract.published_products_after,
    }).toEqual({
      canonicalProducts: 2158,
      verifiedSourceProducts: 1957,
      manufacturers: 55,
      sources: 107,
      productSources: 2570,
      productRoles: 2223,
      taxonomyRows: 1957,
      taxonomyNeedsReview: 22,
      slotOptions: 2035,
      slotProposals: 1794,
      publishedBaseline: 101,
    })
  })

  it('leaves the D2B overlay bytes and ERBE sentinel behavior unchanged', () => {
    const path = 'data/ip-device-intelligence/generated/product-status-overlay.json'
    expect(hash(path)).toBe('87656505e4ef7d25316f660f7d766b201f110e9e599614bdf181f7ffb3c92736')
    const overlay = json<{
      rows: Array<{
        product_id: string
        market_status: string
        safety_display: string
        safety_action_scope: string
        safety_reference_codes: string[]
        status_recommendation_gate: string
      }>
    }>(path)
    expect(overlay.rows.find((row) => row.product_id === 'PRD-05670F1B5F')).toEqual(
      expect.objectContaining({
        market_status: 'confirmed_current_us',
        safety_display: 'active_safety_notice',
        safety_action_scope: 'lot_specific',
        safety_reference_codes: ['Z-1568-2026'],
        status_recommendation_gate: 'blocked_active_safety_action',
      }),
    )
  })

  it('leaves both reviewed D2D-A runtime overlays byte-identical', () => {
    expect(hash('data/ip-device-intelligence/generated/product-profile-overlay.json')).toBe(
      '6dff82598371e9a701cd1f9dceabe5200dc73cac860ada9873b064afae323454',
    )
    expect(hash('data/ip-device-intelligence/generated/product-regulatory-overlay.json')).toBe(
      'eddbb29d3e3e7dcfeb619767793e9262a2c5faa563a0729cb7379491605a68a9',
    )
  })

  it('keeps research, reviewed inputs, raw cache, and AI drafts outside runtime imports', () => {
    const offenders: string[] = []
    for (const absolutePath of sourceFiles('src')) {
      if (absolutePath.includes(`${join('device-intelligence', '__tests__')}/`)) continue
      const source = readFileSync(absolutePath, 'utf8')
      if (
        /data\/ip-device-intelligence\/research\/d2d\//.test(source) ||
        /data\/ip-device-intelligence\/reviewed\/(?:d2d-|product-description-reviews|product-profile-evidence|product-regulatory-matches)/.test(
          source,
        ) ||
        /local-data\/ip-device-intelligence\/d2d/.test(source) ||
        /product-profile-drafts\.json|evidence-proposals\.json/.test(source)
      ) {
        offenders.push(relative(REPO_ROOT, absolutePath))
      }
    }
    expect(offenders).toEqual([])
  })

  it('admits the compact D2D overlays through exactly one server-only runtime reader', () => {
    const sources = sourceFiles('src').map((absolutePath) => ({
      path: relative(REPO_ROOT, absolutePath),
      text: readFileSync(absolutePath, 'utf8'),
    }))
    const importers = sources.filter((source) =>
      /product-(?:profile|regulatory)-overlay\.json/.test(source.text),
    )
    expect(importers.map((source) => source.path)).toEqual([
      'src/features/device-intelligence/server/d2d-evidence.server.ts',
    ])
    expect(importers[0].text).toContain("import 'server-only'")
    expect(importers[0].text).not.toMatch(/^['"]use client['"]/m)

    const clientImporters = sources.filter(
      (source) =>
        /^['"]use client['"]/m.test(source.text) &&
        /d2d-evidence\.server|product-(?:profile|regulatory)-overlay\.json/.test(source.text),
    )
    expect(clientImporters.map((source) => source.path)).toEqual([])
  })

  it('does not introduce equivalence, compatibility, formulary, or procurement semantics', () => {
    const cohort = read('data/ip-device-intelligence/reviewed/d2d-pilot-cohort.json')
    const profileDomain = read('src/features/device-intelligence/domain/product-profile.ts')
    for (const prohibited of [
      'equivalent_product',
      'substitute_product',
      'compatibility_result',
      'formulary_status',
      'procurement_status',
      'recommended_product',
    ]) {
      expect(`${cohort}\n${profileDomain}`).not.toContain(prohibited)
    }
  })
})
