import { render, within } from '@testing-library/react'
import { axe } from 'jest-axe'
import artifactJson from '../../../../data/ip-device-intelligence/generated/product-safety-evidence.json'
import { safetyEvidenceArtifactSchema, safetyNoticeSchema } from '../domain/safety-notice-schema'
import { safetyEvidenceFreshness } from '../domain/evidence-freshness'
import { getSafetyEvidence } from '../server/safety-evidence.server'
import { MarketSafetyPanel } from '../components/ProductStatus'
import { getProductStatus } from '../server/product-status.server'
import { getProductStatusLabels } from '../server/status-labels.server'
import { searchAtlas } from '../server/atlas.server'
import { catalogSearchSchema } from '@/features/preference-cards/schemas/catalog-search'

const ERBE = 'PRD-05670F1B5F'
const evidence = getSafetyEvidence(ERBE)!
const clone = () => JSON.parse(JSON.stringify(evidence)) as typeof evidence

describe('dated safety evidence', () => {
  it('labels historical and active notices independently on a product with both', async () => {
    const productId = 'PRD-48C48C68BA'
    const mixed = getSafetyEvidence(productId)!
    expect(new Set(mixed.notices.map((notice) => notice.recorded_state))).toEqual(
      new Set(['active', 'historical']),
    )
    const labels = await getProductStatusLabels('en')
    const { container } = render(
      <MarketSafetyPanel
        status={getProductStatus(productId)}
        labels={labels}
        evidence={mixed}
        freshness="refresh_due"
      />,
    )
    for (const notice of mixed.notices) {
      const rendered = within(
        container.querySelector(`[data-safety-notice="${notice.recall_number}"]`) as HTMLElement,
      )
      rendered.getByText(labels.evidence.recordedState[notice.recorded_state])
    }
  })
  it('preserves known notices with specific FDA links and complete source-reported reasons', () => {
    expect(safetyEvidenceArtifactSchema.safeParse(artifactJson).success).toBe(true)
    expect(evidence.notices).toHaveLength(1)
    expect(evidence.notices[0]).toMatchObject({
      recall_number: 'Z-1568-2026',
      match_scope: 'exact_product',
      scope: 'lot_specific',
      reason_for_recall: 'Probes may rupture/burst during activation',
      official_record_url:
        'https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfres/res.cfm?id=218710',
    })
    expect(evidence.notices[0].matched_identifiers).toContain('20402-411')
    expect(
      evidence.notices[0].reports.find((report) => report.system === 'device_enforcement')
        ?.classification,
    ).toBe('Class I')
    expect(Object.isFrozen(evidence.notices[0])).toBe(true)
    expect(JSON.stringify(evidence)).not.toMatch(
      /source_ids|raw_cache|exact_query|code_info|sha256|rationale|search=/,
    )
    expect(
      safetyNoticeSchema.safeParse({ ...evidence.notices[0], code_info_excerpt: 'partial lots' })
        .success,
    ).toBe(false)
    expect(
      safetyNoticeSchema.safeParse({
        ...evidence.notices[0],
        official_record_url: 'https://example.com/recall',
      }).success,
    ).toBe(false)
    expect(
      safetyNoticeSchema.safeParse({
        ...evidence.notices[0],
        match_scope: 'family_or_proprietary_name',
      }).success,
    ).toBe(false)
  })

  it('uses source dates, never citation-retrieval or page-build time, for the review interval', () => {
    const current = clone()
    current.source_checks.forEach((source) => {
      source.dataset_as_of = '2026-09-01'
      source.has_undated_responses = false
      source.retrieved_on = '2026-09-11'
    })
    expect(safetyEvidenceFreshness(current, '2026-09-14')).toBe('within_review_interval')
    expect(safetyEvidenceFreshness(current, '2026-09-15')).toBe('refresh_due')
    current.source_checks[0].dataset_as_of = '2026-08-01'
    expect(safetyEvidenceFreshness(current, '2026-09-11')).toBe('refresh_due')
    current.source_checks[0].dataset_as_of = '2026-09-12'
    expect(safetyEvidenceFreshness(current, '2026-09-11')).toBe('incomplete')
    expect(safetyEvidenceFreshness(evidence, 'invalid')).toBe('incomplete')
  })

  it('keeps absent, failed and partially covered searches unverified', () => {
    expect(safetyEvidenceFreshness(null, '2026-09-11')).toBe('not_checked')
    const partial = clone()
    partial.source_checks.pop()
    expect(safetyEvidenceFreshness(partial, '2026-09-11')).toBe('incomplete')
    partial.search_status = 'not_searched'
    expect(safetyEvidenceFreshness(partial, '2026-09-11')).toBe('not_checked')
    partial.search_status = 'query_error'
    expect(safetyEvidenceFreshness(partial, '2026-09-11')).toBe('incomplete')
    expect(partial.notices).toEqual(evidence.notices)
  })

  it('shows a dated actionable notice and never turns aging evidence into a cleared status', async () => {
    const labels = await getProductStatusLabels('en')
    const status = getProductStatus(ERBE)
    const view = render(
      <MarketSafetyPanel
        status={status}
        labels={labels}
        evidence={evidence}
        freshness="refresh_due"
      />,
    )
    view.getByText('Safety evidence needs a refresh')
    const notice = within(view.container.querySelector('[data-safety-notice]') as HTMLElement)
    expect(notice.getByRole('link', { name: /Open FDA action instructions/ })).toHaveAttribute(
      'href',
      evidence.notices[0].official_record_url,
    )
    notice.getByText('Class I')
    expect(view.container.querySelector('[data-status-gate]')).toHaveAttribute(
      'data-status-gate',
      'blocked_active_safety_action',
    )
    expect(await axe(view.container)).toHaveNoViolations()
  })

  it('does not show an absence finding when source coverage is incomplete', async () => {
    const labels = await getProductStatusLabels('en')
    const view = render(
      <MarketSafetyPanel
        status={getProductStatus('PRD-2E043ED827')}
        labels={labels}
        evidence={null}
        freshness="incomplete"
      />,
    )
    view.getByText(/FDA safety actions have not been verified for this product/)
    expect(view.container.textContent).not.toContain('No FDA safety action matched')
  })
})

describe('exact identifier search labels', () => {
  it('marks identifier equality separately from prefixes and fuzzy names', () => {
    const exact = searchAtlas(catalogSearchSchema.parse({ q: '20402-411' }))
    expect(exact.exactIdentifierMatchIds).toEqual([ERBE])
    expect(exact.items.length).toBeGreaterThan(1)
    expect(
      searchAtlas(catalogSearchSchema.parse({ q: '20402' })).exactIdentifierMatchIds,
    ).not.toContain(ERBE)
    expect(
      searchAtlas(catalogSearchSchema.parse({ q: 'Flexible Cryoprobe' })).exactIdentifierMatchIds,
    ).toEqual([])
    expect(
      searchAtlas(catalogSearchSchema.parse({ q: '20402411' })).exactIdentifierMatchIds,
    ).toEqual([ERBE])
    expect(searchAtlas(catalogSearchSchema.parse({ q: '' })).exactIdentifierMatchIds).toEqual([])
  })
})
