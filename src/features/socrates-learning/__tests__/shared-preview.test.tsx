import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { caseFixture } from '@/features/socrates-study/testing/fixtures'
import {
  refreshSharedLibrary,
  saveSharedSlide,
  publishSharedSlide,
} from '@/app/[locale]/socrates-library/actions'
import { SharedSlideLibrary } from '../components/SharedSlideLibrary'
import { PROGRESS_KEY, type LearningMode } from '../model'
import type { SharedSlide } from '../shared-library'
import { createInvenioDemoDocument } from '@/features/socrates-builder/content/invenio-demo-document'

jest.mock('@/app/[locale]/socrates-library/actions', () => ({
  refreshSharedLibrary: jest.fn(),
  saveSharedSlide: jest.fn(),
  publishSharedSlide: jest.fn(),
}))
jest.mock('@/features/socrates-builder/components/SocratesBuilder', () => ({
  SocratesBuilder: (props: unknown) => {
    mockEditor(props)
    return <div>Slide editor</div>
  },
}))
const mockEditor = jest.fn()
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
    document.slide = createInvenioDemoDocument().slide
    document.caseContent.annotationLegend = { reviewed: false, entries: [] }
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
      expect(Boolean(screen.queryByText('Tumor / malignant'))).toBe(mode === 'teaching')
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

test('library edit and preview navigation preserves five Teaching assignments and annotations', () => {
  const slides: SharedSlide[] = Array.from({ length: 5 }, (_, index) => {
    const document = caseFixture()
    document.recordId = `70000000-0000-4000-8000-00000000000${index + 1}`
    document.title = `Saved slide ${index + 1}`
    return {
      id: document.recordId,
      importKey: `local:${document.recordId}`,
      version: 1,
      assignment: 'teaching',
      publishedRevision: null,
      publishedAssignment: null,
      publishedAt: null,
      updatedAt: '2026-10-16T00:00:00Z',
      document,
    }
  })
  const original = JSON.stringify(slides)
  render(
    <SharedSlideLibrary locale="es" userId="editor" canPublish={false} initialSlides={slides} />,
  )
  expect(screen.getByRole('link', { name: 'Open earlier saved slides' })).toHaveAttribute(
    'href',
    '/es/socrates-library/legacy',
  )
  expect(screen.getByRole('link', { name: 'Open published modules ↗' })).toHaveAttribute(
    'href',
    '/es/socrates/learn',
  )
  for (const slide of slides) {
    const card = screen.getByRole('heading', { name: slide.document.title }).closest('article')!
    fireEvent.click(within(card).getByRole('button', { name: 'Edit slide' }))
    expect(mockEditor.mock.lastCall[0]).toMatchObject({
      mode: 'shared',
      embedded: true,
      initialActiveDocument: slide.document,
      initialDocuments: [slide.document],
    })
    expect(screen.getByRole('combobox', { name: /assign/i })).toHaveValue('teaching')
    for (const mode of ['teaching', 'testing']) {
      fireEvent.click(screen.getByRole('button', { name: `Preview ${mode}` }))
      fireEvent.click(screen.getByRole('button', { name: 'Return to editing' }))
      expect(mockEditor.mock.lastCall[0].initialActiveDocument.annotations).toEqual(
        slide.document.annotations,
      )
    }
    fireEvent.click(screen.getByRole('button', { name: '← All slides' }))
  }
  expect(JSON.stringify(slides)).toBe(original)
  expect(saveSharedSlide).not.toHaveBeenCalled()
  expect(publishSharedSlide).not.toHaveBeenCalled()
})
