import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { ClinicalUseReviewImportWorkbench } from '../components/ClinicalUseReviewImportWorkbench'
import { ClinicalUseReviewWorkbookControls } from '../components/ClinicalUseReviewWorkbookControls'
import type { ClinicalUseReviewImportPreview } from '../excel/clinical-use-review-contract'

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

const originalFetch = global.fetch
const originalCreateObjectUrl = Object.getOwnPropertyDescriptor(URL, 'createObjectURL')
const originalRevokeObjectUrl = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL')
const originalRequestAnimationFrame = Object.getOwnPropertyDescriptor(
  window,
  'requestAnimationFrame',
)
const originalInnerWidth = Object.getOwnPropertyDescriptor(window, 'innerWidth')

let fetchMock: jest.Mock
let anchorClickMock: jest.SpyInstance
let animationFrameCallbacks: FrameRequestCallback[]

function restoreProperty(
  target: object,
  property: PropertyKey,
  descriptor: PropertyDescriptor | undefined,
) {
  if (descriptor) Object.defineProperty(target, property, descriptor)
  else Reflect.deleteProperty(target, property)
}

function importPreview(staleArtifact = true): ClinicalUseReviewImportPreview {
  const decision = {
    recordType: 'product_role' as const,
    reviewKey: 'product_role:PRD-TEST01:ENDOBRONCHIAL_VALVE',
    productId: 'PRD-TEST01',
    roleCode: 'ENDOBRONCHIAL_VALVE',
    decision: 'replace_with_different_role' as const,
    suggestedRoleCode: 'AIRWAY_STENT',
    rationale: 'The current broad clinical-use classification appears incorrect.',
    evidenceNeeded: null,
    reviewerName: 'Clinician Reviewer',
    reviewerConfidence: 'high' as const,
    reviewDate: '2026-07-29',
    followUpNotes: null,
    readyForSecondReview: true,
    secondReviewer: null,
    secondReviewComments: null,
  }
  return {
    formatVersion: 1,
    importedAt: '2026-07-29T20:00:00.000Z',
    workbookFileName: 'completed clinical use review.xlsx',
    workbookSha256: 'workbook-sha256',
    workbookMetadata: {
      format_version: '1',
      exported_at: '2026-07-29T19:00:00.000Z',
      clinical_use_manifest_sha256: 'workbook-manifest-sha256',
      catalog_products_sha256: 'catalog-products-sha256',
      product_roles_sha256: 'product-roles-sha256',
      roles_sha256: 'roles-sha256',
      procedures_sha256: 'procedures-sha256',
      procedure_slots_sha256: 'procedure-slots-sha256',
      slot_product_options_sha256: 'slot-product-options-sha256',
      catalog_product_count: '1474',
      product_role_count: '1566',
      current_slot_count: '2080',
      application_base_url: 'https://interventionalpulm.com',
      source_branch: 'codex/preference-cards/catalog-verification-workflow',
      source_commit: 'abcdef123456',
      locale: 'en',
    },
    currentClinicalUseManifestSha256: 'current-manifest-sha256',
    staleArtifact,
    staleWarning: staleArtifact
      ? 'The workbook clinical-use manifest differs from the current catalog mapping manifest.'
      : null,
    canExportNormalized: true,
    exportBlockers: [],
    summary: {
      validCompletedDecisions: 1,
      productRoleDecisions: 1,
      currentSlotDecisions: 0,
      incompleteDecisions: 0,
      rowsWithoutDecision: 3645,
      invalidDecisionValues: 0,
      missingRationales: 0,
      missingSuggestedRoles: 0,
      missingSuggestedSlots: 0,
      unknownReviewKeys: 0,
      staleReviewKeys: staleArtifact ? 1 : 0,
      protectedFieldDifferences: 0,
      duplicateRows: 0,
      unchangedProtectedRows: 3646,
      changedProtectedRows: 0,
      missingCurrentRows: 0,
      matchedReviewKeys: 3646,
    },
    missingCurrentReviewKeys: [],
    unknownWorkbookReviewKeys: [],
    duplicateReviewKeys: [],
    changedReviewKeys: [],
    reviewedReviewKeys: [decision.reviewKey],
    decisions: [decision],
    rows: [
      {
        sheetName: 'Product Role Review',
        rowNumber: 2,
        recordType: 'product_role',
        reviewKey: decision.reviewKey,
        status: 'valid_completed',
        protectedFieldDifferences: [],
        issues: [],
        decision,
      },
    ],
  }
}

beforeEach(() => {
  fetchMock = jest.fn()
  animationFrameCallbacks = []
  global.fetch = fetchMock as unknown as typeof fetch
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: jest.fn(() => 'blob:clinical-use-review-test'),
  })
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: jest.fn(),
  })
  Object.defineProperty(window, 'requestAnimationFrame', {
    configurable: true,
    value: (callback: FrameRequestCallback) => {
      animationFrameCallbacks.push(callback)
      return animationFrameCallbacks.length
    },
  })
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: 390,
  })
  anchorClickMock = jest
    .spyOn(window.HTMLAnchorElement.prototype, 'click')
    .mockImplementation(() => undefined)
  window.history.replaceState(null, '', '/en/admin/preference-cards/catalog-qa/clinical-use/import')
})

afterEach(() => {
  global.fetch = originalFetch
  anchorClickMock.mockRestore()
  restoreProperty(URL, 'createObjectURL', originalCreateObjectUrl)
  restoreProperty(URL, 'revokeObjectURL', originalRevokeObjectUrl)
  restoreProperty(window, 'requestAnimationFrame', originalRequestAnimationFrame)
  restoreProperty(window, 'innerWidth', originalInnerWidth)
  window.history.replaceState(null, '', '/')
})

describe('ClinicalUseReviewWorkbookControls', () => {
  it('exports every current mapping with accessible, narrow-screen controls and no apply action', async () => {
    const user = userEvent.setup()
    fetchMock.mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) =>
          ({
            'content-disposition':
              'attachment; filename="IP_Full_Catalog_Clinical_Use_Review_2026-07-29.xlsx"',
            'x-catalog-product-count': '1474',
            'x-current-slot-count': '2080',
            'x-product-role-count': '1566',
          })[name.toLocaleLowerCase()] ?? null,
      },
      blob: async () => new Blob(['workbook']),
    } as Response)

    render(
      <ClinicalUseReviewWorkbookControls
        locale="en"
        productCount={1474}
        productRoleCount={1566}
        currentSlotCount={2080}
      />,
    )

    const region = screen.getByRole('region', { name: 'Excel clinical-use review' })
    expect(region).toHaveTextContent('1,474')
    expect(region).toHaveTextContent('1,566')
    expect(region).toHaveTextContent('2,080')
    expect(region).toHaveTextContent(/do not enter patient/i)
    expect(
      within(region).getByRole('link', { name: 'Import completed clinical-use workbook' }),
    ).toHaveAttribute('href', '/en/admin/preference-cards/catalog-qa/clinical-use/import')
    const exportButton = within(region).getByRole('button', {
      name: 'Export full-catalog clinical-use review workbook',
    })
    expect(exportButton).toHaveClass('w-full')
    expect(exportButton.parentElement).toHaveClass('grid', 'sm:grid-cols-2', 'lg:grid-cols-1')
    expect(within(region).queryByRole('button', { name: /apply|approve/i })).not.toBeInTheDocument()

    await user.click(exportButton)

    await waitFor(() =>
      expect(
        within(region).getByText(
          'Workbook downloaded with 1,474 products, 1,566 role mappings, and 2,080 authored slot options.',
        ),
      ).toBeInTheDocument(),
    )
    expect(fetchMock).toHaveBeenCalledWith('/api/preference-cards/clinical-use-review/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: 'en' }),
    })
    expect(anchorClickMock).toHaveBeenCalledTimes(1)
  })
})

describe('ClinicalUseReviewImportWorkbench', () => {
  it('focuses the stale preview and gates normalized downloads on explicit acknowledgment', async () => {
    const user = userEvent.setup()
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => importPreview(true),
    } as Response)

    render(<ClinicalUseReviewImportWorkbench locale="en" />)

    const region = screen.getByRole('region', { name: 'Import and validate' })
    const input = within(region).getByLabelText('Completed full-catalog clinical-use workbook')
    expect(input).toHaveAttribute('accept', `.xlsx,${XLSX_MIME}`)
    expect(input).toHaveAccessibleDescription(/do not include patient information/i)
    expect(
      within(region).getByRole('button', { name: 'Import and validate workbook' }),
    ).toHaveClass('w-full', 'sm:w-auto')

    await user.upload(
      input,
      new File(['completed workbook'], 'completed clinical use review.xlsx', {
        type: XLSX_MIME,
      }),
    )
    await user.click(within(region).getByRole('button', { name: 'Import and validate workbook' }))

    const previewHeading = await screen.findByRole('heading', {
      name: 'Clinical-use import preview',
    })
    expect(animationFrameCallbacks).toHaveLength(1)
    animationFrameCallbacks[0](0)
    expect(previewHeading).toHaveFocus()
    expect(window.location.hash).toBe('#preview')
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/preference-cards/clinical-use-review/import?filename=completed%20clinical%20use%20review.xlsx&locale=en',
      {
        method: 'POST',
        headers: { 'Content-Type': XLSX_MIME },
        body: expect.any(File),
      },
    )

    const staleAlert = screen.getByRole('alert')
    const acknowledge = within(staleAlert).getByRole('checkbox', {
      name: /current catalog identities and protected mapping values remain authoritative/i,
    })
    const jsonDownload = screen.getByRole('button', { name: 'Download normalized JSON' })
    const csvDownload = screen.getByRole('button', { name: 'Download normalized CSV' })
    expect(jsonDownload).toBeDisabled()
    expect(csvDownload).toBeDisabled()
    expect(screen.queryByRole('button', { name: /apply|approve/i })).not.toBeInTheDocument()

    await user.click(acknowledge)
    expect(jsonDownload).toBeEnabled()
    expect(csvDownload).toBeEnabled()
    await user.click(jsonDownload)

    await waitFor(() =>
      expect(
        screen.getByText('Normalized JSON clinical-use artifact downloaded.'),
      ).toBeInTheDocument(),
    )
    expect(anchorClickMock).toHaveBeenCalledTimes(1)
  })
})
