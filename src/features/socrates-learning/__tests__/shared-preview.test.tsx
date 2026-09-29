import { fireEvent, render, screen } from '@testing-library/react'
import { caseFixture } from '@/features/socrates-study/testing/fixtures'
import { SharedSlideLibrary } from '../components/SharedSlideLibrary'
import type { LearningMode } from '../model'

jest.mock('@/app/[locale]/socrates-library/actions', () => ({
  refreshSharedLibrary: jest.fn(),
  saveSharedSlide: jest.fn(),
  publishSharedSlide: jest.fn(),
}))
jest.mock('@/features/socrates-builder/components/SocratesBuilder', () => ({
  SocratesBuilder: () => <div>Slide editor</div>,
}))
const mockViewer = jest.fn()
jest.mock('@/features/socrates-study/components/StudyViewer', () => ({
  StudyViewer: (props: unknown) => {
    mockViewer(props)
    return <div data-testid="viewer" />
  },
}))

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  jest.clearAllMocks()
})

test.each<LearningMode>(['testing', 'teaching'])(
  'switches shared author previews in both directions when starting with %s',
  (initialMode) => {
    const document = caseFixture()
    render(
      <SharedSlideLibrary
        locale="en"
        userId="editor"
        canPublish={false}
        initialSlides={[
          {
            id: document.recordId!,
            importKey: `local:${document.recordId}`,
            version: 1,
            assignment: 'unassigned',
            publishedRevision: null,
            publishedAssignment: null,
            publishedAt: null,
            updatedAt: '2026-09-27T00:00:00Z',
            document,
          },
        ]}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Edit slide' }))
    const otherMode = initialMode === 'testing' ? 'teaching' : 'testing'
    for (const mode of [initialMode, otherMode, initialMode]) {
      fireEvent.click(screen.getByRole('button', { name: `Preview ${mode}` }))
      expect(screen.getByText(mode === 'testing' ? 'Tissue only' : 'Guided teaching')).toBeVisible()
      expect(mockViewer.mock.lastCall[0]).toMatchObject({ tissueOnly: mode === 'testing' })
      expect(Boolean(screen.queryByRole('region', { name: 'Testing response' }))).toBe(
        mode === 'testing',
      )
      expect(Boolean(screen.queryByText('Synthetic case context'))).toBe(mode === 'teaching')
    }
    fireEvent.click(screen.getByRole('button', { name: 'Return to editing' }))
    expect(screen.getByText('Slide editor')).toBeVisible()
    expect(screen.queryByTestId('viewer')).not.toBeInTheDocument()
  },
)
