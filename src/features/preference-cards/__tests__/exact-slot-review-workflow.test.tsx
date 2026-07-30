import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { ExactSlotReviewImportWorkbench } from '../components/ExactSlotReviewImportWorkbench'
import { ExactSlotReviewWorkbookControls } from '../components/ExactSlotReviewWorkbookControls'
import type { ExactSlotReviewImportPreview } from '../excel/exact-slot-review-contract'

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const MAX_WORKBOOK_BYTES = 20 * 1024 * 1024

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
  if (descriptor) {
    Object.defineProperty(target, property, descriptor)
  } else {
    Reflect.deleteProperty(target, property)
  }
}

function importPreview(staleArtifact = true): ExactSlotReviewImportPreview {
  const decision = {
    proposalKey: 'SLOT-EBV-VALVE:PRD-TEST01',
    slotId: 'SLOT-EBV-VALVE',
    procedureCode: 'EBV',
    productId: 'PRD-TEST01',
    roleCode: 'ENDOBRONCHIAL_VALVE',
    decision: 'candidate_for_canonical_option' as const,
    rationale: 'Manufacturer evidence supports review for this exact slot.',
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
    workbookFileName: 'completed review.xlsx',
    workbookSha256: 'workbook-sha256',
    workbookMetadata: {
      format_version: '1',
      exported_at: '2026-07-29T19:00:00.000Z',
      proposal_artifact_sha256: 'workbook-artifact-sha256',
      proposal_count: '1',
      application_base_url: 'https://interventionalpulm.com',
      source_branch: 'codex/preference-cards/catalog-verification-workflow',
      source_commit: 'abcdef123456',
      locale: 'en',
    },
    currentProposalArtifactSha256: 'current-artifact-sha256',
    staleArtifact,
    staleWarning: staleArtifact
      ? 'The workbook proposal artifact differs from the current proposal artifact.'
      : null,
    canExportNormalized: true,
    exportBlockers: [],
    summary: {
      validCompletedDecisions: 1,
      incompleteDecisions: 0,
      rowsWithoutDecision: 0,
      invalidDecisionValues: 0,
      missingRationales: 0,
      unknownProposalKeys: 0,
      staleProposalKeys: staleArtifact ? 1 : 0,
      protectedFieldDifferences: 0,
      duplicateRows: 0,
      unchangedProtectedRows: 1,
      changedProtectedRows: 0,
      missingCurrentProposals: 0,
      matchedProposalKeys: 1,
    },
    missingCurrentProposalKeys: [],
    unknownWorkbookProposalKeys: [],
    duplicateProposalKeys: [],
    changedProposalKeys: [],
    reviewedProposalKeys: [decision.proposalKey],
    decisions: [decision],
    rows: [
      {
        rowNumber: 5,
        proposalKey: decision.proposalKey,
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
    value: jest.fn(() => 'blob:exact-slot-review-test'),
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
  window.history.replaceState(null, '', '/en/admin/preference-cards/catalog-qa/slot-options/import')
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

describe('ExactSlotReviewWorkbookControls', () => {
  it('provides screen-reader labels, safe export behavior, and narrow-screen action layout', async () => {
    const user = userEvent.setup()
    fetchMock.mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) =>
          ({
            'content-disposition': 'attachment; filename="exact-slot-review.xlsx"',
            'x-proposal-count': '7',
          })[name.toLocaleLowerCase()] ?? null,
      },
      blob: async () => new Blob(['workbook']),
    } as Response)

    render(
      <ExactSlotReviewWorkbookControls
        locale="en"
        totalCount={447}
        filteredCount={7}
        requiredCount={313}
        filters={{ procedure: 'EBV', requiredness: 'required' }}
      />,
    )

    const region = screen.getByRole('region', { name: 'Excel clinician review' })
    const scope = within(region).getByLabelText('Workbook scope')
    expect(scope).toHaveValue('filtered')
    expect(
      within(region).getByRole('option', { name: 'Only unreviewed after import' }),
    ).toBeDisabled()
    expect(
      within(region).getByRole('link', { name: 'Import completed review workbook' }),
    ).toHaveAttribute('href', '/en/admin/preference-cards/catalog-qa/slot-options/import')
    expect(region).toHaveTextContent(/recommendations only/i)
    expect(region).toHaveTextContent(/does not modify the canonical catalog/i)

    const exportButton = within(region).getByRole('button', {
      name: 'Export clinician review workbook',
    })
    expect(exportButton).toHaveClass('w-full')
    expect(exportButton.parentElement).toHaveClass('grid', 'gap-2', 'sm:grid-cols-2')
    expect(region.firstElementChild).toHaveClass('flex-col', 'lg:flex-row')
    expect(within(region).queryByRole('button', { name: /apply|approve/i })).not.toBeInTheDocument()
    expect(within(region).queryByRole('link', { name: /apply|approve/i })).not.toBeInTheDocument()

    await user.click(exportButton)

    await waitFor(() =>
      expect(within(region).getByText('Workbook downloaded with 7 proposals.')).toBeInTheDocument(),
    )
    expect(fetchMock).toHaveBeenCalledWith('/api/preference-cards/exact-slot-review/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scope: 'filtered',
        locale: 'en',
        filters: { procedure: 'EBV', requiredness: 'required' },
      }),
    })
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect(anchorClickMock).toHaveBeenCalledTimes(1)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:exact-slot-review-test')
  })

  it('announces a product with no proposals and disables its product-scoped export', () => {
    render(
      <ExactSlotReviewWorkbookControls
        locale="en"
        totalCount={447}
        filteredCount={0}
        requiredCount={313}
        productId="PRD-NONE01"
        productName="Example valve"
        productProposalCount={0}
      />,
    )

    const region = screen.getByRole('region', { name: 'Excel clinician review' })
    const exportButton = within(region).getByRole('button', {
      name: 'Export exact-slot proposals for Example valve',
    })
    expect(exportButton).toBeDisabled()
    expect(exportButton).toHaveClass('w-full')
    expect(region).toHaveTextContent('This product has no exact-slot proposals to export.')
    expect(within(region).getByRole('link', { name: 'Open Exact-slot review' })).toHaveAttribute(
      'href',
      '/en/admin/preference-cards/catalog-qa/slot-options?q=PRD-NONE01',
    )
    expect(within(region).queryByRole('button', { name: /apply|approve/i })).not.toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('exports an enabled product scope while keeping evidence and approval states distinct', async () => {
    const user = userEvent.setup()
    fetchMock.mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) =>
          ({
            'content-disposition': 'attachment; filename="exact-slot-review-PRD-VALVE01.xlsx"',
            'x-proposal-count': '3',
          })[name.toLocaleLowerCase()] ?? null,
      },
      blob: async () => new Blob(['product workbook']),
    } as Response)

    render(
      <ExactSlotReviewWorkbookControls
        locale="en"
        totalCount={447}
        filteredCount={3}
        requiredCount={313}
        productId="PRD-VALVE01"
        productName="Example endobronchial valve"
        productProposalCount={3}
      />,
    )

    const region = screen.getByRole('region', { name: 'Excel clinician review' })
    expect(region).toHaveTextContent(
      'This page displays evidence and review context. Clinician decisions are recorded through the Exact-slot Excel review workflow.',
    )
    expect(region).toHaveTextContent(
      'The Verified badge is the current evidence state, not a clinician approval.',
    )
    const exportButton = within(region).getByRole('button', {
      name: 'Export exact-slot proposals for Example endobronchial valve',
    })
    expect(exportButton).toBeEnabled()

    await user.click(exportButton)

    await waitFor(() =>
      expect(within(region).getByText('Workbook downloaded with 3 proposals.')).toBeInTheDocument(),
    )
    expect(fetchMock).toHaveBeenCalledWith('/api/preference-cards/exact-slot-review/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scope: 'product',
        locale: 'en',
        productId: 'PRD-VALVE01',
      }),
    })
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect(anchorClickMock).toHaveBeenCalledTimes(1)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:exact-slot-review-test')
    expect(within(region).queryByRole('button', { name: /apply|approve/i })).not.toBeInTheDocument()
  })
})

describe('ExactSlotReviewImportWorkbench', () => {
  it('associates file constraints with the input and rejects wrong or oversized files locally', async () => {
    const user = userEvent.setup({ applyAccept: false })
    render(<ExactSlotReviewImportWorkbench locale="en" totalCount={447} />)

    const region = screen.getByRole('region', { name: 'Import and validate' })
    const input = within(region).getByLabelText('Completed clinician review workbook')
    const submit = within(region).getByRole('button', { name: 'Import and validate workbook' })

    expect(input).toHaveAttribute('type', 'file')
    expect(input).toHaveAttribute('accept', `.xlsx,${XLSX_MIME}`)
    expect(input).toHaveAccessibleDescription(
      'Macro-free .xlsx only, up to 20 MB. Do not include patient information in the workbook or filename. Formulas in review rows are rejected.',
    )
    const fileHelp = within(region).getByText(/patient information in the workbook or filename/i)
    expect(input).toHaveAttribute('aria-describedby', fileHelp.id)
    expect(submit).toBeDisabled()

    await user.upload(
      input,
      new File(['macro workbook'], 'completed-review.xlsm', {
        type: 'application/vnd.ms-excel.sheet.macroEnabled.12',
      }),
    )
    await user.click(submit)

    expect(await within(region).findByRole('alert')).toHaveTextContent(
      'Choose a macro-free .xlsx workbook no larger than 20 MB.',
    )
    expect(fetchMock).not.toHaveBeenCalled()

    const oversizedWorkbook = new File(['oversized workbook'], 'completed-review.xlsx', {
      type: XLSX_MIME,
    })
    Object.defineProperty(oversizedWorkbook, 'size', {
      configurable: true,
      value: MAX_WORKBOOK_BYTES + 1,
    })
    await user.upload(input, oversizedWorkbook)
    await user.click(submit)

    expect(await within(region).findByRole('alert')).toHaveTextContent(
      'Choose a macro-free .xlsx workbook no larger than 20 MB.',
    )
    expect(fetchMock).not.toHaveBeenCalled()
    expect(within(region).queryByRole('button', { name: /apply|approve/i })).not.toBeInTheDocument()
  })

  it('renders a focused stale preview and gates normalized downloads on acknowledgment', async () => {
    const user = userEvent.setup()
    const preview = importPreview(true)
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => preview,
    } as Response)

    render(<ExactSlotReviewImportWorkbench locale="en" totalCount={447} />)

    const input = screen.getByLabelText('Completed clinician review workbook')
    const workbook = new File(['completed workbook'], 'completed review.xlsx', {
      type: XLSX_MIME,
    })
    await user.upload(input, workbook)
    await user.click(screen.getByRole('button', { name: 'Import and validate workbook' }))

    const previewHeading = await screen.findByRole('heading', {
      name: 'Normalized import preview',
    })
    expect(animationFrameCallbacks).toHaveLength(1)
    animationFrameCallbacks[0](0)
    expect(previewHeading).toHaveFocus()
    expect(window.location.hash).toBe('#preview')
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/preference-cards/exact-slot-review/import?filename=completed%20review.xlsx&locale=en',
      {
        method: 'POST',
        headers: { 'Content-Type': XLSX_MIME },
        body: workbook,
      },
    )
    const previewDescription = screen.getByText(/validated in memory/i)
    expect(previewDescription).toHaveTextContent(
      'This preview has not changed any canonical or generated data.',
    )
    expect(previewDescription).toHaveClass('break-words')
    expect(
      screen.getByText('Manufacturer evidence supports review for this exact slot.'),
    ).toHaveClass('break-words')

    const staleAlert = screen.getByRole('alert')
    expect(staleAlert).toHaveTextContent('Stale workbook warning')
    expect(staleAlert).toHaveTextContent(
      'The workbook proposal artifact differs from the current proposal artifact.',
    )
    const acknowledge = within(staleAlert).getByRole('checkbox', {
      name: /current proposal identity and protected values remain authoritative/i,
    })
    const jsonDownload = screen.getByRole('button', { name: 'Download normalized JSON' })
    const csvDownload = screen.getByRole('button', { name: 'Download normalized CSV' })
    expect(jsonDownload).toBeDisabled()
    expect(csvDownload).toBeDisabled()
    expect(
      screen.getByText(/acknowledge the stale-workbook warning before downloading/i),
    ).toBeInTheDocument()

    const artifactActions = jsonDownload.parentElement
    expect(artifactActions).toHaveClass('grid', 'sm:grid-cols-2', 'lg:grid-cols-3')
    expect(jsonDownload).toHaveClass('w-full')
    expect(csvDownload).toHaveClass('w-full')
    expect(screen.queryByRole('button', { name: /apply|approve/i })).not.toBeInTheDocument()

    await user.click(acknowledge)

    expect(jsonDownload).toBeEnabled()
    expect(csvDownload).toBeEnabled()
    await user.click(jsonDownload)

    await waitFor(() =>
      expect(screen.getByText('Normalized JSON review artifact downloaded.')).toBeInTheDocument(),
    )
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect(anchorClickMock).toHaveBeenCalledTimes(1)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:exact-slot-review-test')
  })
})
