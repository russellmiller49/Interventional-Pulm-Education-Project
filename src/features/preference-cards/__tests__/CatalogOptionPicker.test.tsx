import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  CatalogOptionPicker,
  type CatalogPickerFamily,
  type CatalogPickerOption,
} from '../components/CatalogOptionPicker'

const STENT_ROLE = 'AIRWAY_STENT_SILICONE_STRAIGHT'
const TUBE_ROLE = 'CHEST_TUBE_SURGICAL'

function option(overrides: Partial<CatalogPickerOption> & { productId: string }) {
  return {
    manufacturerDisplay: 'Novatech',
    productName: 'DUMON TD 14 x 40',
    catalogNumber: 'TD-14-40',
    gtin: null,
    sizeDisplay: '14 mm x 40 mm',
    subcategory: null,
    verificationTier: 'verified' as const,
    usStatusPending: false,
    distributionStatus: null,
    catalogLifecycleContext: 'unknown' as const,
    slottingScope: 'catalog_only' as const,
    preferredNewPurchase: null,
    lifecycleNote: null,
    regulatoryStatus: 'unknown' as const,
    regulatoryNote: null,
    roleFit: null,
    minWorkingChannelMm: null,
    deliverySystemOdMm: null,
    sourceId: null,
    sourceLocation: null,
    ...overrides,
  }
}

function family(overrides: Partial<CatalogPickerFamily> = {}): CatalogPickerFamily {
  return {
    discoveryKey: 'MFR-NOVA|dumon td|implant',
    // Approved by default, because the interesting default is the one that can be persisted; the
    // draft and discovery-only cases are exercised explicitly below.
    reviewedFamilyGovernanceState: 'approved',
    reviewedFamilyVersionId: 'family-novatech-dumon-td-v1-0',
    reviewedFamilyCode: 'NOVATECH_DUMON_TD',
    reviewedFamilyCatalogReleaseId: 'a'.repeat(64),
    reviewedFamilyDefinitionHash: 'b'.repeat(64),
    familyName: 'DUMON TD',
    manufacturerDisplay: 'Novatech',
    manufacturerGroupId: 'MFR-NOVA',
    variantCount: 2,
    verifiedCount: 2,
    verificationTier: 'verified',
    usStatusPending: false,
    distributionStatus: null,
    catalogLifecycleContext: null,
    regulatoryStatus: null,
    specRanges: [{ key: 'diameter_mm', min: 11, max: 18 }],
    placementMethods: ['Rigid bronchoscopy'],
    sourceId: null,
    sourceLocation: null,
    variants: [
      option({ productId: 'PRD-TD1440' }),
      option({
        productId: 'PRD-TD1660',
        productName: 'DUMON TD 16 x 60',
        catalogNumber: 'TD-16-60',
      }),
    ],
    ...overrides,
  }
}

/** Serves whichever shape the picker asked for, and records the requests it made. */
function mockCatalogSearch(payload: {
  options?: CatalogPickerOption[]
  families?: CatalogPickerFamily[]
}) {
  const urls: string[] = []
  const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    urls.push(url)
    const grouped = url.includes('group=family')
    return {
      ok: true,
      json: async () =>
        grouped ? { families: payload.families ?? [] } : { options: payload.options ?? [] },
    } as Response
  })
  global.fetch = fetchMock as unknown as typeof fetch
  return { urls }
}

afterEach(() => {
  jest.restoreAllMocks()
})

describe('CatalogOptionPicker', () => {
  it('opens on the product-line view for a role sized during the procedure', async () => {
    const user = userEvent.setup()
    const { urls } = mockCatalogSearch({ families: [family()] })

    render(
      <CatalogOptionPicker
        roleCode={STENT_ROLE}
        roleLabel="Silicone stent"
        existingProductIds={new Set()}
        onAdd={jest.fn()}
        onAddFamily={jest.fn()}
      />,
    )
    await user.click(screen.getByRole('button', { name: /search full catalog/i }))

    await waitFor(() => expect(screen.getByText('DUMON TD')).toBeInTheDocument())
    expect(urls.some((url) => url.includes('group=family'))).toBe(true)
    // The individual sizes stay collapsed until asked for.
    expect(screen.queryByText('DUMON TD 14 x 40')).not.toBeInTheDocument()
  })

  it('opens on the flat product list for a role that needs a committed size', async () => {
    const user = userEvent.setup()
    const { urls } = mockCatalogSearch({ options: [option({ productId: 'PRD-CT1' })] })

    render(
      <CatalogOptionPicker
        roleCode={TUBE_ROLE}
        roleLabel="Chest tube"
        existingProductIds={new Set()}
        onAdd={jest.fn()}
        onAddFamily={jest.fn()}
      />,
    )
    await user.click(screen.getByRole('button', { name: /search full catalog/i }))

    await waitFor(() => expect(screen.getByText('DUMON TD 14 x 40')).toBeInTheDocument())
    expect(urls.every((url) => !url.includes('group=family'))).toBe(true)
  })

  it('expands a line to its individual sizes and adds one as a product', async () => {
    const user = userEvent.setup()
    mockCatalogSearch({ families: [family()] })
    const onAdd = jest.fn()

    render(
      <CatalogOptionPicker
        roleCode={STENT_ROLE}
        roleLabel="Silicone stent"
        existingProductIds={new Set()}
        onAdd={onAdd}
        onAddFamily={jest.fn()}
      />,
    )
    await user.click(screen.getByRole('button', { name: /search full catalog/i }))
    await waitFor(() => expect(screen.getByText('DUMON TD')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /show sizes/i }))

    expect(screen.getByText('DUMON TD 16 x 60')).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: /add to eligible local/i })[0])
    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ productId: 'PRD-TD1440', roleCode: STENT_ROLE }),
    )
  })

  it('adds a whole line, carrying the size range rather than a catalog number', async () => {
    const user = userEvent.setup()
    mockCatalogSearch({ families: [family()] })
    const onAddFamily = jest.fn()

    render(
      <CatalogOptionPicker
        roleCode={STENT_ROLE}
        roleLabel="Silicone stent"
        existingProductIds={new Set()}
        onAdd={jest.fn()}
        onAddFamily={onAddFamily}
      />,
    )
    await user.click(screen.getByRole('button', { name: /search full catalog/i }))
    await waitFor(() => expect(screen.getByText('DUMON TD')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /add line/i }))

    expect(onAddFamily).toHaveBeenCalledWith(
      expect.objectContaining({
        productFamilyVersionId: 'family-novatech-dumon-td-v1-0',
        definitionHash: 'b'.repeat(64),
        familyName: 'DUMON TD',
        roleCode: STENT_ROLE,
        variantCount: 2,
        specRanges: [{ key: 'diameter_mm', min: 11, max: 18 }],
      }),
    )
  })

  it('hides the whole-line button where a family cannot be carried', async () => {
    const user = userEvent.setup()
    mockCatalogSearch({ options: [option({ productId: 'PRD-TD1440' })] })

    // The equipment-set manager builds sets of specific products, so it passes no onAddFamily.
    render(
      <CatalogOptionPicker
        roleCode={STENT_ROLE}
        roleLabel="Silicone stent"
        existingProductIds={new Set()}
        onAdd={jest.fn()}
        addLabel="Add to set"
      />,
    )
    await user.click(screen.getByRole('button', { name: /search full catalog/i }))

    await waitFor(() => expect(screen.getByText('DUMON TD 14 x 40')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /add line/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add to set/i })).toBeInTheDocument()
  })

  it('marks an already-added line rather than offering it twice', async () => {
    const user = userEvent.setup()
    mockCatalogSearch({ families: [family()] })

    render(
      <CatalogOptionPicker
        roleCode={STENT_ROLE}
        roleLabel="Silicone stent"
        existingProductIds={new Set()}
        onAdd={jest.fn()}
        existingFamilyVersionIds={new Set(['family-novatech-dumon-td-v1-0'])}
        onAddFamily={jest.fn()}
      />,
    )
    await user.click(screen.getByRole('button', { name: /search full catalog/i }))

    await waitFor(() => expect(screen.getByText('DUMON TD')).toBeInTheDocument())
    const added = screen.getByRole('button', { name: /line added/i })
    expect(added).toBeDisabled()
  })

  it('withholds the whole-line action when the grouping is not a reviewed family', async () => {
    const user = userEvent.setup()
    mockCatalogSearch({
      families: [
        family({
          reviewedFamilyGovernanceState: null,
          reviewedFamilyVersionId: null,
          reviewedFamilyCode: null,
          reviewedFamilyCatalogReleaseId: null,
          reviewedFamilyDefinitionHash: null,
        }),
      ],
    })

    render(
      <CatalogOptionPicker
        roleCode={STENT_ROLE}
        roleLabel="Silicone stent"
        existingProductIds={new Set()}
        onAdd={jest.fn()}
        onAddFamily={jest.fn()}
      />,
    )
    await user.click(screen.getByRole('button', { name: /search full catalog/i }))
    await waitFor(() => expect(screen.getByText('DUMON TD')).toBeInTheDocument())

    // Browsable, expandable, and individually selectable — just not persistable as a line.
    expect(screen.queryByRole('button', { name: /add line/i })).not.toBeInTheDocument()
    expect(screen.getByText(/not an approved product family/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /show sizes/i })).toBeInTheDocument()
  })

  it('withholds the whole-line action for a draft family and says why it differs', async () => {
    // A draft family is identified and its membership frozen; only clinical sign-off is missing.
    // The server withholds the pin fields so no pick can be built, and the wording distinguishes
    // this from a grouping nobody has reviewed at all.
    const user = userEvent.setup()
    mockCatalogSearch({
      families: [
        family({
          reviewedFamilyGovernanceState: 'draft',
          reviewedFamilyVersionId: null,
          reviewedFamilyCode: null,
          reviewedFamilyCatalogReleaseId: null,
          reviewedFamilyDefinitionHash: null,
        }),
      ],
    })

    render(
      <CatalogOptionPicker
        roleCode={STENT_ROLE}
        roleLabel="Silicone stent"
        existingProductIds={new Set()}
        onAdd={jest.fn()}
        onAddFamily={jest.fn()}
      />,
    )
    await user.click(screen.getByRole('button', { name: /search full catalog/i }))
    await waitFor(() => expect(screen.getByText('DUMON TD')).toBeInTheDocument())

    expect(screen.queryByRole('button', { name: /add line/i })).not.toBeInTheDocument()
    expect(screen.getByText(/clinical review is still pending/i)).toBeInTheDocument()
    expect(screen.queryByText(/not an approved product family/i)).not.toBeInTheDocument()
    // Exact product selection is unaffected: the sizes are still there and still addable.
    await user.click(screen.getByRole('button', { name: /show sizes/i }))
    expect(screen.getByText('DUMON TD 14 x 40')).toBeInTheDocument()
  })
})
