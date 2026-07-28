import { render, screen, within } from '@testing-library/react'

import { RoleComparisonTable } from '../components/RoleComparisonTable'
import { VerificationBadge } from '../components/VerificationBadge'
import type { CatalogListItem, UseDetailManufacturerGroup } from '../server/catalog'

const verificationLabels = {
  verified: 'Verified',
  candidate: 'Unverified',
  unknown: 'Unknown',
  usPending: 'US status unconfirmed',
  notDistributed: 'Not currently distributed',
}

function listItem(overrides: Partial<CatalogListItem> & { productId: string }): CatalogListItem {
  return {
    productName: 'Test product',
    manufacturerDisplay: 'Acme Airway',
    manufacturerGroupId: 'MFR-A',
    brandFamily: null,
    catalogNumber: null,
    gtin: null,
    primaryCategory: null,
    subcategory: null,
    sizeDisplay: null,
    diameterMm: null,
    lengthMm: null,
    frenchSize: null,
    gauge: null,
    workingLengthCm: null,
    minWorkingChannelMm: null,
    deliverySystemOdMm: null,
    material: null,
    coverage: null,
    verificationTier: 'verified',
    usStatusPending: false,
    distributionStatus: null,
    ...overrides,
  }
}

describe('VerificationBadge', () => {
  it('labels a verified product', () => {
    render(<VerificationBadge tier="verified" labels={verificationLabels} />)
    expect(screen.getByText('Verified')).toBeInTheDocument()
    expect(screen.queryByText('US status unconfirmed')).not.toBeInTheDocument()
  })

  it('labels a candidate product as unverified rather than hiding it', () => {
    render(<VerificationBadge tier="candidate" labels={verificationLabels} />)
    expect(screen.getByText('Unverified')).toBeInTheDocument()
  })

  it('flags a device the FDA no longer lists in commercial distribution', () => {
    render(
      <VerificationBadge
        tier="verified"
        distributionStatus="not_in_distribution"
        labels={verificationLabels}
      />,
    )
    expect(screen.getByText('Not currently distributed')).toBeInTheDocument()
  })

  it('does not flag a device that is still in commercial distribution', () => {
    render(
      <VerificationBadge
        tier="verified"
        distributionStatus="in_distribution"
        labels={verificationLabels}
      />,
    )
    expect(screen.queryByText('Not currently distributed')).not.toBeInTheDocument()
  })

  it('prefers the discontinued flag over the pending-status badge', () => {
    render(
      <VerificationBadge
        tier="verified"
        usStatusPending
        distributionStatus="not_in_distribution"
        labels={verificationLabels}
      />,
    )
    expect(screen.getByText('Not currently distributed')).toBeInTheDocument()
    expect(screen.queryByText('US status unconfirmed')).not.toBeInTheDocument()
  })

  it('adds the pending-status badge alongside the verified tier', () => {
    render(<VerificationBadge tier="verified" usStatusPending labels={verificationLabels} />)
    expect(screen.getByText('Verified')).toBeInTheDocument()
    expect(screen.getByText('US status unconfirmed')).toBeInTheDocument()
  })
})

describe('RoleComparisonTable', () => {
  const groups: UseDetailManufacturerGroup[] = [
    {
      manufacturerGroupId: 'MFR-A',
      manufacturerDisplay: 'Acme Airway',
      verifiedCount: 1,
      items: [
        listItem({
          productId: 'PRD-AAA',
          productName: 'Alpha Stent',
          catalogNumber: 'ALP-100',
          sizeDisplay: 'OD 12 mm',
          diameterMm: 12,
          roleFit: 'Primary',
        }),
      ],
    },
    {
      manufacturerGroupId: 'MFR-B',
      manufacturerDisplay: 'Bravo Medical',
      verifiedCount: 0,
      items: [
        listItem({
          productId: 'PRD-BBB',
          productName: 'Beta Stent',
          catalogNumber: 'BET-200',
          verificationTier: 'candidate',
          roleFit: 'Exact',
        }),
      ],
    },
  ]

  const labels = {
    ...verificationLabels,
    product: 'Product',
    catalogNumber: 'Catalog #',
    size: 'Size',
    fit: 'Fit',
    verification: 'Verification',
    missingValue: '—',
  }

  const groupSummaries = {
    'MFR-A': '1 products · 1 verified',
    'MFR-B': '1 products · 0 verified',
  }

  function renderTable() {
    return render(
      <RoleComparisonTable
        groups={groups}
        specColumns={['diameter_mm']}
        specLabels={{
          diameter_mm: 'Diameter (mm)',
          length_mm: 'Length (mm)',
          french_size: 'French',
          gauge: 'Gauge',
          working_length_cm: 'Working length (cm)',
          min_working_channel_mm: 'Min channel (mm)',
          delivery_system_od_mm: 'Delivery OD (mm)',
          material: 'Material',
          coverage: 'Coverage',
        }}
        labels={labels}
        groupSummaries={groupSummaries}
        locale="en"
      />,
    )
  }

  it('groups products under each manufacturer', () => {
    renderTable()
    expect(screen.getByText('Acme Airway')).toBeInTheDocument()
    expect(screen.getByText('Bravo Medical')).toBeInTheDocument()
    expect(screen.getByText('1 products · 1 verified')).toBeInTheDocument()
    expect(screen.getByText('1 products · 0 verified')).toBeInTheDocument()
  })

  it('renders only the spec columns it was given', () => {
    renderTable()
    expect(screen.getByRole('columnheader', { name: 'Diameter (mm)' })).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Material' })).not.toBeInTheDocument()
  })

  it('links each product to its detail page', () => {
    renderTable()
    expect(screen.getByRole('link', { name: 'Alpha Stent' })).toHaveAttribute(
      'href',
      '/en/preference-cards/catalog/product/PRD-AAA',
    )
  })

  it('shows an em dash where a spec is not recorded', () => {
    renderTable()
    const betaRow = screen.getByRole('link', { name: 'Beta Stent' }).closest('tr')
    expect(betaRow).not.toBeNull()
    expect(within(betaRow!).getAllByText('—').length).toBeGreaterThan(0)
  })

  it('badges unverified products in place rather than omitting them', () => {
    renderTable()
    const betaRow = screen.getByRole('link', { name: 'Beta Stent' }).closest('tr')
    expect(within(betaRow!).getByText('Unverified')).toBeInTheDocument()
  })
})
