import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BetaTestingFrame } from './BetaTestingFrame'
import { betaModuleById } from './catalog'
import { feedbackMode } from './config'
import {
  deleteOwnerDraft,
  deleteUnreadableOwnerDrafts,
  readOwnerDrafts,
  saveOwnerDraft,
  type OwnerFeedbackDraft,
} from './ownerDraftStore'
import { ownerFeedbackExists, saveOwnerFeedback } from './ownerFeedbackStore'

jest.mock('./config', () => ({ feedbackMode: jest.fn() }))
jest.mock('./ownerDraftStore', () => ({
  saveOwnerDraft: jest.fn(),
  readOwnerDrafts: jest.fn(),
  deleteOwnerDraft: jest.fn(),
  deleteUnreadableOwnerDrafts: jest.fn(),
}))
jest.mock('./ownerFeedbackStore', () => ({
  saveOwnerFeedback: jest.fn(),
  ownerFeedbackExists: jest.fn(),
}))
jest.mock('./screenshotDraftImage', () => ({
  encodeScreenshotSource: jest.fn(() => ({ blob: new Blob(['png']), token: 'image-token' })),
  decodeScreenshotSource: jest.fn(async () => ({ restored: true })),
}))
// The canvas editor is exercised in the browser suites; here it only edits the shared draft.
jest.mock('./ScreenshotEditor', () => {
  const React = jest.requireActual<typeof import('react')>('react')
  type Draft = { current: { source: unknown; annotations: unknown[] } }
  return {
    createScreenshotDraft: () => ({ source: null, annotations: [] }),
    ScreenshotEditor: React.forwardRef(function Editor(
      { draft, onDraftChange }: { draft: Draft; onDraftChange?: () => void },
      ref: React.Ref<{ exportImage: () => Promise<Blob | null> }>,
    ) {
      React.useImperativeHandle(ref, () => ({
        exportImage: async () =>
          draft.current.source ? new Blob(['annotated'], { type: 'image/png' }) : null,
      }))
      const change = (source: unknown, annotations: unknown[]) => () => {
        draft.current.source = source
        draft.current.annotations = annotations
        onDraftChange?.()
      }
      return React.createElement(
        'div',
        null,
        React.createElement(
          'button',
          { type: 'button', onClick: change({ canvas: true }, [{ tool: 'box' }]) },
          'attach annotated image',
        ),
        React.createElement(
          'button',
          { type: 'button', onClick: change(null, []) },
          'remove image',
        ),
        React.createElement(
          'output',
          { 'aria-label': 'marks' },
          `${draft.current.source ? 'image' : 'no image'}:${draft.current.annotations.length}`,
        ),
      )
    }),
  }
})

const mode = jest.mocked(feedbackMode)
const saveDraft = jest.mocked(saveOwnerDraft)
const readDrafts = jest.mocked(readOwnerDrafts)
const deleteDraft = jest.mocked(deleteOwnerDraft)
const deleteUnreadable = jest.mocked(deleteUnreadableOwnerDrafts)
const saveReport = jest.mocked(saveOwnerFeedback)
const reportExists = jest.mocked(ownerFeedbackExists)

const pi = betaModuleById('peripheral-imaging')!
const piPath = '/en/peripheral-imaging/learn?section=imaging-questions&phase=recognize'
let stored: OwnerFeedbackDraft[]
let unreadable: IDBValidKey[]
let location: string
let selection: string
let ids: string[]
const contentWindow = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow')!
const randomUUID = Object.getOwnPropertyDescriptor(globalThis.crypto, 'randomUUID')

function storedDraft(overrides: Partial<OwnerFeedbackDraft> = {}): OwnerFeedbackDraft {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    host_module_id: 'peripheral-imaging',
    module_id: 'peripheral-imaging',
    page_path: piPath,
    comment: 'Stored unsent comment',
    selected_text: 'Stored selection',
    annotations: [],
    image: null,
    created_at: '2026-10-02T10:00:00.000Z',
    updated_at: '2026-10-02T10:00:00.000Z',
    storage_mode: 'owner-local',
    record_kind: 'draft',
    schema_version: 1,
    screenshot: null,
    ...overrides,
  }
}
beforeEach(() => {
  stored = []
  unreadable = []
  location = `https://site.test${piPath}&token=secret`
  selection = ''
  ids = ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb']
  mode.mockReturnValue('owner-local')
  Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
    configurable: true,
    get: () => ({
      location: { href: location },
      getSelection: () => ({ toString: () => selection }),
    }),
  })
  Object.defineProperty(globalThis.crypto, 'randomUUID', {
    configurable: true,
    value: () => ids.shift()!,
  })
  readDrafts.mockImplementation(async () => ({ drafts: [...stored], unreadable: [...unreadable] }))
  saveDraft.mockImplementation(async (input, image) => {
    const row = storedDraft({
      id: input.id,
      host_module_id: input.hostModuleId,
      module_id: input.moduleId,
      page_path: input.pagePath,
      comment: input.comment,
      selected_text: input.selectedText,
      annotations: input.annotations as OwnerFeedbackDraft['annotations'],
      screenshot: image ?? null,
    })
    stored = [row, ...stored.filter((entry) => entry.id !== row.id)]
    return row
  })
  deleteDraft.mockImplementation(async (id) => {
    stored = stored.filter((entry) => entry.id !== id)
  })
  deleteUnreadable.mockImplementation(async () => {
    unreadable = []
  })
  reportExists.mockResolvedValue(false)
  saveReport.mockImplementation(
    async (input) => ({ id: input.id }) as Awaited<ReturnType<typeof saveOwnerFeedback>>,
  )
})
afterEach(() => {
  Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', contentWindow)
  if (randomUUID) Object.defineProperty(globalThis.crypto, 'randomUUID', randomUUID)
  document.documentElement.style.overflow = ''
})

async function mount() {
  const view = render(<BetaTestingFrame moduleEntry={pi} locale="en" />)
  await waitFor(() => expect(feedbackButton()).toBeEnabled())
  return view
}
const feedbackButton = () => screen.getByRole('button', { name: /^(Give|Continue) feedback$/ })
const commentBox = () => screen.getByLabelText('What should we know?')
const referenceBox = () => screen.getByLabelText(/Text or section/)
const closed = () => waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

describe('truthful pending-draft label', () => {
  it('returns to Give feedback after an empty open and close, by button or Escape', async () => {
    const user = userEvent.setup()
    await mount()
    await user.click(feedbackButton())
    await user.click(screen.getByRole('button', { name: 'Continue testing' }))
    await closed()
    expect(feedbackButton()).toHaveTextContent('Give feedback')
    await user.click(feedbackButton())
    await user.keyboard('{Escape}')
    await closed()
    expect(feedbackButton()).toHaveTextContent('Give feedback')
    expect(saveDraft).not.toHaveBeenCalled()
    expect(deleteDraft).not.toHaveBeenCalled()
  })
  it('ignores a whitespace-only selection but keeps real referenced text', async () => {
    const user = userEvent.setup()
    await mount()
    selection = ' \n​ '
    await user.click(feedbackButton())
    await user.click(screen.getByRole('button', { name: 'Continue testing' }))
    await closed()
    expect(feedbackButton()).toHaveTextContent('Give feedback')
    selection = 'Radial EBUS concentric view'
    await user.click(feedbackButton())
    expect(referenceBox()).toHaveValue('Radial EBUS concentric view')
    await user.click(screen.getByRole('button', { name: 'Continue testing' }))
    await closed()
    expect(feedbackButton()).toHaveTextContent('Continue feedback')
    await waitFor(() =>
      expect(stored[0]).toMatchObject({ comment: '', selected_text: selection, page_path: piPath }),
    )
  })
  it('offers Continue feedback for an annotated image alone, then not once it is removed', async () => {
    const user = userEvent.setup()
    await mount()
    await user.click(feedbackButton())
    await user.click(screen.getByRole('button', { name: 'attach annotated image' }))
    await user.click(screen.getByRole('button', { name: 'Continue testing' }))
    await closed()
    expect(feedbackButton()).toHaveTextContent('Continue feedback')
    await waitFor(() => expect(stored).toHaveLength(1))
    expect(saveDraft).toHaveBeenLastCalledWith(
      expect.objectContaining({ comment: '', selectedText: '', annotations: [{ tool: 'box' }] }),
      expect.objectContaining({ token: 'image-token' }),
    )
    await user.click(feedbackButton())
    expect(screen.getByLabelText('marks')).toHaveTextContent('image:1')
    await user.click(screen.getByRole('button', { name: 'remove image' }))
    await user.click(screen.getByRole('button', { name: 'Continue testing' }))
    await closed()
    expect(feedbackButton()).toHaveTextContent('Give feedback')
    await waitFor(() => expect(stored).toEqual([]))
  })
  it('drops the draft when all of its content is removed again', async () => {
    const user = userEvent.setup()
    await mount()
    await user.click(feedbackButton())
    await user.type(commentBox(), 'Temporary')
    await user.click(screen.getByRole('button', { name: 'Continue testing' }))
    await closed()
    await waitFor(() => expect(stored).toHaveLength(1))
    await user.click(feedbackButton())
    await user.clear(commentBox())
    await user.click(screen.getByRole('button', { name: 'Continue testing' }))
    await closed()
    expect(feedbackButton()).toHaveTextContent('Give feedback')
    await waitFor(() => expect(stored).toEqual([]))
    expect(deleteDraft).toHaveBeenCalledWith('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
  })
})

describe('owner-local draft recovery', () => {
  it('keeps the original sanitized page when the module navigates after the draft began', async () => {
    const user = userEvent.setup()
    await mount()
    await user.click(feedbackButton())
    expect(screen.getByText(`Page: ${piPath}`)).toBeInTheDocument()
    await user.type(commentBox(), 'Contrast is low here')
    await user.click(screen.getByRole('button', { name: 'Continue testing' }))
    await closed()
    location = 'https://site.test/en/peripheral-imaging/practice?case=2'
    selection = 'Later selection'
    await user.click(feedbackButton())
    expect(screen.getByText(`Page: ${piPath}`)).toBeInTheDocument()
    expect(commentBox()).toHaveValue('Contrast is low here')
    expect(referenceBox()).toHaveValue('')
    await user.type(commentBox(), ' and here')
    await user.click(screen.getByRole('button', { name: 'Continue testing' }))
    await waitFor(() => expect(stored[0]?.comment).toBe('Contrast is low here and here'))
    expect(stored).toHaveLength(1)
    expect(stored[0]).toMatchObject({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      host_module_id: 'peripheral-imaging',
      module_id: 'peripheral-imaging',
      page_path: piPath,
    })
  })
  it('restores a stored draft after a reload without opening, saving, or rewriting it', async () => {
    stored = [
      storedDraft({
        annotations: [{ tool: 'text', point: { x: 1, y: 1 }, text: 'Note' }],
        image: { token: 'image-token', type: 'image/png', size: 3, width: 1, height: 1 },
        screenshot: { blob: new Blob(['png']), token: 'image-token' },
      }),
      storedDraft({
        id: '22222222-2222-4222-8222-222222222222',
        host_module_id: 'ebus-guided',
        comment: 'Another testing page',
      }),
    ]
    location = 'https://site.test/en/peripheral-imaging'
    const user = userEvent.setup()
    await mount()
    await waitFor(() => expect(feedbackButton()).toHaveTextContent('Continue feedback'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByText(/Feedback saved/)).not.toBeInTheDocument()
    await user.click(feedbackButton())
    expect(screen.getByText(`Page: ${piPath}`)).toBeInTheDocument()
    expect(commentBox()).toHaveValue('Stored unsent comment')
    expect(referenceBox()).toHaveValue('Stored selection')
    expect(screen.getByLabelText('marks')).toHaveTextContent('image:1')
    expect(saveReport).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Continue testing' }))
    await closed()
    // Nothing changed, so the stored draft and its timestamp are left exactly as they were.
    expect(saveDraft).not.toHaveBeenCalled()
    expect(stored).toHaveLength(2)
  })
  it('discards only that draft and never a saved report', async () => {
    stored = [storedDraft()]
    const user = userEvent.setup()
    await mount()
    await waitFor(() => expect(feedbackButton()).toHaveTextContent('Continue feedback'))
    await user.click(feedbackButton())
    await user.click(screen.getByRole('button', { name: 'Discard draft' }))
    await closed()
    await waitFor(() => expect(stored).toEqual([]))
    expect(deleteDraft).toHaveBeenCalledTimes(1)
    expect(deleteDraft).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111')
    expect(saveReport).not.toHaveBeenCalled()
    expect(feedbackButton()).toHaveTextContent('Give feedback')
  })
  it('clears the draft only after the report has committed', async () => {
    let commit!: () => void
    saveReport.mockImplementation(
      (input) =>
        new Promise((resolve) => {
          commit = () => resolve({ id: input.id } as Awaited<ReturnType<typeof saveOwnerFeedback>>)
        }),
    )
    const user = userEvent.setup()
    await mount()
    await user.click(feedbackButton())
    await user.type(commentBox(), 'Save me')
    await waitFor(() => expect(stored).toHaveLength(1))
    await user.click(screen.getByRole('button', { name: 'Save feedback locally' }))
    await waitFor(() => expect(saveReport).toHaveBeenCalledTimes(1))
    // The request is in flight but nothing has committed: the draft must still be recoverable.
    expect(deleteDraft).not.toHaveBeenCalled()
    expect(stored).toHaveLength(1)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    commit()
    await waitFor(() => expect(stored).toEqual([]))
    expect(deleteDraft).toHaveBeenCalledWith('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
    expect(screen.getByRole('status')).toHaveTextContent(
      'Feedback saved locally. Reference aaaaaaaa',
    )
    expect(feedbackButton()).toHaveTextContent('Give feedback')
  })
  it('keeps the open draft and its stored copy when the save fails, and retries the same ID', async () => {
    saveReport.mockRejectedValueOnce(new Error('Keep your draft and retry.'))
    const user = userEvent.setup()
    await mount()
    await user.click(feedbackButton())
    await user.type(commentBox(), 'Still here')
    await user.click(screen.getByRole('button', { name: 'Save feedback locally' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Keep your draft and retry.')
    expect(commentBox()).toHaveValue('Still here')
    expect(deleteDraft).not.toHaveBeenCalled()
    await waitFor(() => expect(stored).toHaveLength(1))
    await user.click(screen.getByRole('button', { name: 'Save feedback locally' }))
    await waitFor(() => expect(stored).toEqual([]))
    expect(saveReport.mock.calls.map(([input]) => input.id)).toEqual([
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    ])
  })
  it('finishes clearing a draft whose report already committed instead of offering it again', async () => {
    stored = [storedDraft()]
    reportExists.mockResolvedValue(true)
    await mount()
    await waitFor(() => expect(stored).toEqual([]))
    expect(feedbackButton()).toHaveTextContent('Give feedback')
    expect(saveReport).not.toHaveBeenCalled()
  })
  it('says so when the draft cannot be kept, without losing what is open', async () => {
    saveDraft.mockRejectedValue(new Error('Local draft storage failed; it may be full.'))
    const user = userEvent.setup()
    await mount()
    await user.click(feedbackButton())
    await user.type(commentBox(), 'Do not lose this')
    expect(
      await within(screen.getByRole('dialog')).findByRole('alert', {}, { timeout: 3000 }),
    ).toHaveTextContent('Local draft storage failed')
    expect(commentBox()).toHaveValue('Do not lose this')
    await user.click(screen.getByRole('button', { name: 'Continue testing' }))
    await closed()
    expect(feedbackButton()).toHaveTextContent('Continue feedback')
    expect(screen.getByRole('alert')).toHaveTextContent('Local draft storage failed')
  })
  it('names an unreadable draft and removes it only when asked', async () => {
    unreadable = ['damaged']
    const user = userEvent.setup()
    await mount()
    expect(await screen.findByRole('alert')).toHaveTextContent('cannot be opened by this version')
    expect(deleteUnreadable).not.toHaveBeenCalled()
    expect(feedbackButton()).toHaveTextContent('Give feedback')
    await user.click(screen.getByRole('button', { name: 'Remove unreadable draft' }))
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
    expect(deleteUnreadable).toHaveBeenCalledWith(['damaged'])
    expect(deleteDraft).not.toHaveBeenCalled()
  })
})

describe('server mode', () => {
  beforeEach(() => mode.mockReturnValue('server'))
  it('keeps drafts in memory only and never reads or writes owner-local storage', async () => {
    stored = [storedDraft()]
    const fetchMock = jest.fn(async () => ({
      ok: true,
      json: async () => ({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }),
    }))
    const original = globalThis.fetch
    globalThis.fetch = fetchMock as unknown as typeof fetch
    try {
      const user = userEvent.setup()
      const view = await mount()
      expect(feedbackButton()).toHaveTextContent('Give feedback')
      await user.click(feedbackButton())
      await user.click(screen.getByRole('button', { name: 'Continue testing' }))
      await closed()
      expect(feedbackButton()).toHaveTextContent('Give feedback')
      await user.click(feedbackButton())
      await user.type(commentBox(), 'Server draft')
      await user.click(screen.getByRole('button', { name: 'Continue testing' }))
      await closed()
      expect(feedbackButton()).toHaveTextContent('Continue feedback')
      await new Promise((resolve) => setTimeout(resolve, 500))
      view.unmount()
      await mount()
      expect(feedbackButton()).toHaveTextContent('Give feedback')
      await user.click(feedbackButton())
      expect(commentBox()).toHaveValue('')
      await user.type(commentBox(), 'Sent to the server')
      await user.click(screen.getByRole('button', { name: 'Send feedback' }))
      expect(await screen.findByRole('status')).toHaveTextContent('Feedback saved. Reference')
      expect(fetchMock).toHaveBeenCalledWith('/api/module-feedback', expect.anything())
    } finally {
      globalThis.fetch = original
    }
    for (const call of [readDrafts, saveDraft, deleteDraft, deleteUnreadable, saveReport])
      expect(call).not.toHaveBeenCalled()
    expect(reportExists).not.toHaveBeenCalled()
  })
})

it('takes the covered site page out of scrolling and the tab order, and restores it on exit', async () => {
  document.documentElement.style.overflow = 'clip'
  const layout = document.createElement('div')
  layout.innerHTML =
    '<header><a href="/">Site navigation</a></header><main></main><footer inert><a href="/">Footer</a></footer>'
  document.body.appendChild(layout)
  const [siteHeader, main, siteFooter] = Array.from(layout.children)
  const view = render(<BetaTestingFrame moduleEntry={pi} locale="en" />, { container: main })
  await waitFor(() => expect(feedbackButton()).toBeEnabled())
  expect(document.documentElement.style.overflow).toBe('hidden')
  expect(siteHeader).toHaveAttribute('inert')
  expect(main).not.toHaveAttribute('inert')
  view.unmount()
  expect(document.documentElement.style.overflow).toBe('clip')
  expect(siteHeader).not.toHaveAttribute('inert')
  // Something that was already inert for its own reasons is left exactly as it was.
  expect(siteFooter).toHaveAttribute('inert')
  layout.remove()
})
