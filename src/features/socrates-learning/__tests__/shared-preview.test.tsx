import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { caseFixture } from '@/features/socrates-study/testing/fixtures'
import { refreshSharedLibrary } from '@/app/[locale]/socrates-library/actions'
import { SharedSlideLibrary } from '../components/SharedSlideLibrary'
import { PROGRESS_KEY, type LearningMode } from '../model'
import type { SharedSlide } from '../shared-library'

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
      if (mode === 'teaching') {
        expect(screen.getByRole('heading', { name: 'Case context' })).toBeVisible()
        fireEvent.click(screen.getByRole('button', { name: 'High magnification' }))
        expect(screen.getByRole('heading', { name: 'High magnification' })).toBeVisible()
      } else {
        expect(screen.getByRole('radio', { name: 'High' })).not.toBeChecked()
        fireEvent.click(screen.getByRole('radio', { name: 'High' }))
      }
    }
    fireEvent.click(screen.getByRole('button', { name: 'Return to editing' }))
    expect(screen.getByText('Slide editor')).toBeVisible()
    expect(screen.queryByTestId('viewer')).not.toBeInTheDocument()
  },
)

describe('shared preview background refreshes', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  function openPreview(mode: LearningMode) {
    const document = caseFixture()
    document.caseContent.vignette = ''
    const slide: SharedSlide = {
      id: document.recordId!,
      importKey: `local:${document.recordId}`,
      version: 1,
      assignment: 'unassigned',
      publishedRevision: null,
      publishedAssignment: null,
      publishedAt: null,
      updatedAt: '2026-09-27T00:00:00Z',
      document,
    }
    jest.mocked(refreshSharedLibrary).mockResolvedValue({ ok: true, slides: [slide] })
    render(
      <SharedSlideLibrary locale="en" userId="editor" canPublish={false} initialSlides={[slide]} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Edit slide' }))
    fireEvent.click(screen.getByRole('button', { name: `Preview ${mode}` }))
  }

  test.each(['High magnification', 'Key learning points', 'Teaching interpretation'])(
    'keeps %s selected through polling, connection errors, and window focus',
    async (station) => {
      openPreview('teaching')
      const steps = within(screen.getByRole('navigation', { name: 'Teaching steps' }))
      expect(steps.getAllByRole('button')).toHaveLength(4)
      fireEvent.click(steps.getByRole('button', { name: station }))
      const expectStation = () => {
        expect(screen.getByRole('heading', { name: station })).toBeVisible()
        expect(steps.getByRole('button', { name: station })).toHaveAttribute('aria-current', 'step')
      }
      expectStation()
      await act(async () => jest.advanceTimersByTime(10000))
      expect(refreshSharedLibrary).toHaveBeenCalledTimes(1)
      expectStation()
      jest.mocked(refreshSharedLibrary).mockResolvedValueOnce({ ok: false, error: 'Offline' })
      await act(async () => jest.advanceTimersByTime(10000))
      expectStation()
      await act(async () => fireEvent.focus(window))
      expect(refreshSharedLibrary).toHaveBeenCalledTimes(3)
      expectStation()
      // Progress in an author preview stays transient.
      expect(localStorage.getItem(PROGRESS_KEY)).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: 'Back' }))
      expect(steps.getByRole('button', { current: 'step' })).not.toHaveAccessibleName(station)
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
      expectStation()
    },
  )

  test('keeps an unfinished testing preview response through a background refresh', async () => {
    openPreview('testing')
    fireEvent.click(screen.getByRole('radio', { name: 'High' }))
    fireEvent.change(screen.getByRole('textbox', { name: /Reasoning/ }), {
      target: { value: 'Synthetic response in progress' },
    })
    await act(async () => jest.advanceTimersByTime(10000))
    expect(screen.getByRole('radio', { name: 'High' })).toBeChecked()
    expect(screen.getByRole('textbox', { name: /Reasoning/ })).toHaveValue(
      'Synthetic response in progress',
    )
    expect(localStorage.getItem(PROGRESS_KEY)).toBeNull()
  })
})
