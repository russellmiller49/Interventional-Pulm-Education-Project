import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SocratesBuilder } from '@/features/socrates-builder/components/SocratesBuilder'
import { caseFixture } from '../testing/fixtures'

const mockSave = jest.fn()
const mockFetch = jest.fn()
jest.mock('@/app/[locale]/socrates-builder/actions', () => ({
  saveSocratesSlideDocument: (...args: unknown[]) => mockSave(...args),
  publishSocratesSlideDocument: jest.fn(),
  deleteSocratesSandboxDocumentAsAdmin: jest.fn(),
}))
jest.mock('@/app/[locale]/socrates-demo/actions', () => ({
  saveSocratesSandboxDocument: jest.fn(),
  deleteSocratesSandboxDocument: jest.fn(),
}))
jest.mock('@/features/socrates-demo/components/ComparisonSlideViewer', () => ({
  ComparisonSlideViewer: () => <div data-testid="image-viewer" />,
}))

beforeEach(() => {
  jest.clearAllMocks()
  window.localStorage.clear()
  global.fetch = mockFetch
})

test.each(['local', 'protected'] as const)(
  '%s unsaved case-level preview reveals content without regions or participant writes and returns intact',
  async (mode) => {
    const doc = caseFixture()
    doc.annotations = []
    const changed = jest.fn()
    render(
      <SocratesBuilder
        mode={mode === 'local' ? 'local' : 'protected'}
        access={{ canPersist: mode === 'protected', canPublish: false, userEmail: null }}
        initialDocuments={[doc]}
        onLocalWorkspaceChange={changed}
      />,
    )
    fireEvent.change(screen.getByLabelText('Case vignette'), {
      target: { value: 'Unsaved synthetic vignette' },
    })
    fireEvent.change(screen.getByLabelText('Low-magnification observations (one per line)'), {
      target: { value: 'Unsaved observation one\nUnsaved observation two' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Preview teaching view' }))
    expect(screen.getByText('Unsaved synthetic vignette')).toBeVisible()
    expect(screen.getByText('Draft learner preview — not published')).toBeVisible()
    expect(screen.queryByText('LOW_OBSERVATION')).not.toBeInTheDocument()
    expect(screen.queryByText('CANCER_KEY')).not.toBeInTheDocument()
    expect(screen.queryByText('PRIVATE_HIGHLIGHT')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reveal teaching interpretation' }))
    expect(screen.getByText('Unsaved observation one')).toBeVisible()
    expect(screen.getByText('Unsaved observation two')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Continue to high magnification' }))
    expect(screen.getByText('HIGH_OBSERVATION')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Continue to interpretation' }))
    for (const text of [
      'ADEQUACY_KEY',
      'ADEQUACY_REASON',
      'CANCER_KEY',
      'CANCER_REASON',
      'DIAGNOSIS_KEY',
    ])
      expect(screen.getByText(text)).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Review learning points' }))
    expect(screen.getByText('LEARNING_POINT')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Mark case completed' })).not.toBeInTheDocument()
    expect(screen.queryByText('PRIVATE_PROVENANCE')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Return to editing' }))
    expect(screen.getByLabelText('Case vignette')).toHaveValue('Unsaved synthetic vignette')
    expect(screen.getByLabelText('Low-magnification observations (one per line)')).toHaveValue(
      'Unsaved observation one\nUnsaved observation two',
    )
    expect(mockSave).not.toHaveBeenCalled()
    expect(mockFetch).not.toHaveBeenCalled()
    if (mode === 'local') await waitFor(() => expect(changed).toHaveBeenCalled())
  },
)
