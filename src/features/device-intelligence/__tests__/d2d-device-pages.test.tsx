import type { AnchorHTMLAttributes, ReactNode } from 'react'

import { render, within } from '@testing-library/react'
import { axe } from 'jest-axe'

import DeviceDetailPage, { generateMetadata } from '@/app/[locale]/devices/[productId]/page'
import { RegulatoryEvidencePanel } from '@/features/device-intelligence/components/D2dEvidencePanels'
import type { ReviewedProductRegulatoryEvidence } from '@/features/device-intelligence/server/d2d-evidence.server'
import { getReviewedProductRegulatoryEvidence } from '@/features/device-intelligence/server/d2d-evidence.server'
import { getD2dEvidenceLabels } from '@/features/device-intelligence/server/d2d-labels.server'
import { getAtlasProductDetail } from '@/features/device-intelligence/server/atlas.server'

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

jest.setTimeout(120_000)

async function renderProduct(productId: string, locale = 'en') {
  return render(await DeviceDetailPage({ params: Promise.resolve({ locale, productId }) }))
}

const PILOT_MATRIX = [
  ['PRD-003C4641E6', 'exact_product', 'exact_udi_catalog_match'],
  ['PRD-05670F1B5F', 'exact_product', 'exact_model_manufacturer_match'],
  ['PRD-1ED27ADA45', 'exact_product', 'strong_exact_identity_match'],
  ['PRD-2632FFBF07', 'exact_product', 'exact_udi_catalog_match'],
  ['PRD-3E1556EBE5', 'exact_product', 'ambiguous'],
  ['PRD-6F15A8C9B5', 'exact_product', 'exact_udi_catalog_match'],
  ['PRD-A0655BF464', 'exact_product', 'exact_model_manufacturer_match'],
  ['PRD-AED3720BF6', 'configuration_variant', 'family_level_match'],
  ['PRD-B76AF3D731', 'configuration_variant', 'ambiguous'],
  ['PRD-F4AE2A74E6', 'configuration_variant', 'ambiguous'],
] as const

describe('D2D-B Atlas detail integration', () => {
  it.each(PILOT_MATRIX)(
    'renders reviewed profile and regulatory sections for %s',
    async (productId, profileScope, regulatoryMatch) => {
      const detail = getAtlasProductDetail(productId)!
      expect(detail.profile?.description_scope).toBe(profileScope)
      expect(detail.regulatoryEvidence?.match_level).toBe(regulatoryMatch)
      // D2D remains beside the canonical record rather than being merged into it.
      expect(detail.product).not.toHaveProperty('profile')
      expect(detail.product).not.toHaveProperty('regulatoryEvidence')

      const { container, unmount } = await renderProduct(productId)
      expect(container.querySelector('[data-d2d-profile-scope]')).toHaveAttribute(
        'data-d2d-profile-scope',
        profileScope,
      )
      expect(container.querySelector('[data-d2d-regulatory-match]')).toHaveAttribute(
        'data-d2d-regulatory-match',
        regulatoryMatch,
      )
      unmount()
    },
  )

  it('renders the exact KARL STORZ profile verbatim with numbered, safe source citations', async () => {
    const { container, getByRole, getByText } = await renderProduct('PRD-A0655BF464')
    const profile = getByRole('region', { name: 'Reviewed product profile' })
    within(profile).getByText(/KARL STORZ 10350F is a reusable optical forceps/)
    within(profile).getByText('PDF pages 49-50, item 10350F product card')
    expect(
      within(profile).getAllByText(/Exact product/, {
        selector: '[data-evidence-scope="exact"]',
      }).length,
    ).toBeGreaterThan(0)
    getByText(
      'Commercial-distribution evidence is not proof of current local availability, current orderability, formulary status, or procurement status.',
    )

    const officialLinks = within(profile).getAllByRole('link', {
      name: /Open official source/,
    })
    expect(officialLinks.length).toBeGreaterThan(0)
    for (const link of officialLinks) {
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
      expect(link.getAttribute('href')).toMatch(/^https:\/\//)
    }

    // Review IDs, content hashes, and artifact envelopes never reach rendered output.
    expect(container.innerHTML).not.toMatch(
      /D2D-PROFILE-REVIEW|D2D-REG-REVIEW|content_sha256|source_artifacts|method_version|D2D-Q-|request skip|record keys|search=/i,
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  it('discloses configuration and family scope for Narwhal without an exact-product clearance badge', async () => {
    const { container, getByRole, getByText, queryByText } = await renderProduct('PRD-AED3720BF6')
    getByText(/Configuration-level evidence/)
    getByText('Family-level regulatory evidence. Exact catalog-SKU linkage remains unresolved.')
    getByText('K261068')
    expect(container.querySelector('[data-regulatory-conclusion="cleared_510k"]')).toBeNull()
    expect(queryByText('510(k) cleared')).toBeNull()
    expect(getByRole('region', { name: 'Regulatory evidence' })).toHaveAttribute(
      'data-d2d-regulatory-match',
      'family_level_match',
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  it('renders unresolved identity honestly without turning ambiguity into a negative finding', async () => {
    const { container, getByRole } = await renderProduct('PRD-3E1556EBE5')
    const panel = getByRole('region', { name: 'Regulatory evidence' })
    within(panel).getByText('Exact regulatory identity unresolved')
    expect(panel.textContent).not.toMatch(/unlisted|uncleared|unapproved|unauthorized|unsafe/i)
    expect(panel).toHaveAttribute('data-d2d-regulatory-match', 'ambiguous')
    expect(await axe(container)).toHaveNoViolations()
  })

  it('keeps ERBE D2D evidence independent from the active lot-specific D2B safety gate', async () => {
    const { container, getByRole, getByText } = await renderProduct('PRD-05670F1B5F')
    getByRole('heading', { level: 2, name: 'Regulatory evidence' })
    getByText(/^Z-1568-2026$/)
    expect(container.querySelector('[data-status-gate]')).toHaveAttribute(
      'data-status-gate',
      'blocked_active_safety_action',
    )
    const safetyNotice = container.querySelector('.border-rose-600\\/50')
    expect(safetyNotice).not.toBeNull()
    within(safetyNotice as HTMLElement).getByText('Active FDA safety action')
  })

  it('renders one compact fallback for a real verified-source nonpilot product', async () => {
    const nonpilotId = 'PRD-2E043ED827'
    const detail = getAtlasProductDetail(nonpilotId)!
    expect(detail.profile).toBeNull()
    expect(detail.regulatoryEvidence).toBeNull()

    const { container, getByRole, getByText } = await renderProduct(nonpilotId)
    getByRole('heading', { name: 'Extended evidence status' })
    getByText('Reviewed extended product profile not yet available.')
    getByText('Exact regulatory profile not yet researched.')
    expect(container.querySelectorAll('[data-d2d-enrichment-fallback]')).toHaveLength(1)
    expect(container.querySelector('[data-d2d-profile-scope]')).toBeNull()
    expect(container.querySelector('[data-d2d-regulatory-match]')).toBeNull()
    expect(await axe(container)).toHaveNoViolations()
  })

  it('shows the localized English-content notice on a non-English pilot route', async () => {
    const { container, getByText } = await renderProduct('PRD-A0655BF464', 'es')
    getByText('The reviewed, source-derived profile content is currently available in English.')
    expect(container.querySelector('[data-d2d-profile-scope] [lang="en"]')).not.toBeNull()
  })

  it('keeps D2D text out of product metadata', async () => {
    const productId = 'PRD-A0655BF464'
    const detail = getAtlasProductDetail(productId)!
    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: 'en', productId }),
    })
    expect(metadata.description).toBe(detail.product.description)
    expect(metadata.description).not.toBe(detail.profile?.summary_claims[0].text)
  })
})

describe('D2D-B controlled regulatory wording', () => {
  it('distinguishes 510(k) clearance from PMA approval', async () => {
    const family = getReviewedProductRegulatoryEvidence('PRD-AED3720BF6')!
    const sourceRefs = family.pathways[0].source_refs
    const evidence = {
      ...family,
      match_level: 'exact_premarket_submission_match',
      confidence: 'high',
      classifications: [],
      pathways: [
        {
          pathway: '510k',
          submission_number: 'K261068',
          decision: 'substantially_equivalent',
          decision_date: '2026-06-30',
          evidence_scope: 'exact',
          source_refs: sourceRefs,
        },
        {
          pathway: 'pma',
          submission_number: 'P123456',
          decision: 'approved',
          decision_date: '2026-07-01',
          evidence_scope: 'exact',
          source_refs: sourceRefs,
        },
      ],
      conclusion_codes: ['cleared_510k', 'approved_pma'],
    } as ReviewedProductRegulatoryEvidence
    const labels = await getD2dEvidenceLabels('en')
    const { container, getByText } = render(
      <RegulatoryEvidencePanel evidence={evidence} labels={labels} />,
    )
    getByText('510(k) cleared')
    getByText('PMA approved')
    expect(
      container.querySelector('[data-regulatory-conclusion="cleared_510k"]'),
    ).toHaveTextContent('510(k) cleared')
    expect(
      container.querySelector('[data-regulatory-conclusion="approved_pma"]'),
    ).toHaveTextContent('PMA approved')
  })

  it('renders GUDID/listing as identity and listing evidence, never as approval', async () => {
    const exact = getReviewedProductRegulatoryEvidence('PRD-A0655BF464')!
    const sourceRefs = exact.udi_identities[0].source_refs
    const evidence = {
      ...exact,
      registration_listing_evidence: [
        {
          establishment_registration_number: '3012345678',
          listing_number: 'D123456',
          proprietary_name: 'Controlled test identity',
          product_code: 'GEH',
          status: 'listed',
          as_of_date: '2026-08-24',
          evidence_scope: 'exact',
          source_refs: sourceRefs,
        },
      ],
      conclusion_codes: ['fda_listed_device'],
    } as ReviewedProductRegulatoryEvidence
    const labels = await getD2dEvidenceLabels('en')
    const { container, getByText, queryByText } = render(
      <RegulatoryEvidencePanel evidence={evidence} labels={labels} />,
    )
    getByText('FDA-listed device')
    getByText('Listing record found')
    expect(queryByText('510(k) cleared')).toBeNull()
    expect(queryByText('PMA approved')).toBeNull()
    expect(container.textContent).not.toMatch(/FDA approved/i)
  })
})
