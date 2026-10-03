import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BetaTestingFrame } from './BetaTestingFrame'
import { betaModuleById } from './catalog'
import { feedbackMode } from './config'
import {
  beginOwnerDraftSave,
  deleteOwnerDraft,
  deleteUnreadableOwnerDrafts,
  discardOwnerDraft,
  finishOwnerDraftSave,
  ownerDraftStatus,
  readOwnerDrafts,
  saveOwnerDraft,
  settleOwnerDrafts,
  type OwnerFeedbackDraft,
} from './ownerDraftStore'
import { createOwnerFeedback, ownerFeedbackContent } from './ownerFeedbackStore'

jest.mock('./config', () => ({ feedbackMode: jest.fn() }))
jest.mock('./ownerDraftStore', () => ({
  saveOwnerDraft: jest.fn(),
  readOwnerDrafts: jest.fn(),
  deleteOwnerDraft: jest.fn(),
  deleteUnreadableOwnerDrafts: jest.fn(),
  discardOwnerDraft: jest.fn(),
  beginOwnerDraftSave: jest.fn(),
  finishOwnerDraftSave: jest.fn(),
  ownerDraftStatus: jest.fn(),
  settleOwnerDrafts: jest.fn(),
}))
jest.mock('./ownerFeedbackStore', () => ({
  createOwnerFeedback: jest.fn(),
  ownerFeedbackContent: jest.fn(),
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
const discardStored = jest.mocked(discardOwnerDraft)
const beginSave = jest.mocked(beginOwnerDraftSave)
const finishSave = jest.mocked(finishOwnerDraftSave)
const draftStatus = jest.mocked(ownerDraftStatus)
const settle = jest.mocked(settleOwnerDrafts)
const saveReport = jest.mocked(createOwnerFeedback)
const reportContent = jest.mocked(ownerFeedbackContent)
type Report = Awaited<ReturnType<typeof createOwnerFeedback>>
const first = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const sharedId = '11111111-1111-4111-8111-111111111111'

const pi = betaModuleById('peripheral-imaging')!
const piPath = '/en/peripheral-imaging/learn?section=imaging-questions&phase=recognize'
// A stand-in for the draft database with the same rules: a write lands under its own ID only
// while that ID is open and at the revision the caller last saw.
let stored: OwnerFeedbackDraft[]
let closedIds: Map<string, 'saved' | 'discarded'>
let revisions: number
let forks: number
const forkId = () => `ffffffff-ffff-4fff-8fff-${String(++forks).padStart(12, '0')}`
// What another tab's Save or Discard does to the stored draft.
function closeElsewhere(id: string, outcome: 'saved' | 'discarded', covered: string) {
  closedIds.set(id, outcome)
  const row = stored.find((entry) => entry.id === id)
  stored = stored.filter((entry) => entry.id !== id)
  if (!row || row.revision === covered) return false
  stored = [{ ...row, id: forkId(), forked_from: id }, ...stored]
  return true
}
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
    revision: 'r0',
    forked_from: null,
    schema_version: 2,
    screenshot: null,
    ...overrides,
  }
}
beforeEach(() => {
  stored = []
  closedIds = new Map()
  revisions = 0
  forks = 0
  unreadable = []
  location = `https://site.test${piPath}&token=secret`
  selection = ''
  ids = [first, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb']
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
  saveDraft.mockImplementation(async (input, image, base = '') => {
    const existing = stored.find((entry) => entry.id === input.id)
    const superseded =
      closedIds.get(input.id) ?? (existing && existing.revision !== base ? 'edited' : null)
    const id = superseded ? forkId() : input.id
    const row = storedDraft({
      id,
      host_module_id: input.hostModuleId,
      module_id: input.moduleId,
      page_path: input.pagePath,
      comment: input.comment,
      selected_text: input.selectedText,
      annotations: input.annotations as OwnerFeedbackDraft['annotations'],
      screenshot: image ?? null,
      revision: `r${++revisions}`,
      forked_from: superseded ? input.id : null,
    })
    stored = [row, ...stored.filter((entry) => entry.id !== id)]
    return { draft: row, superseded }
  })
  deleteDraft.mockImplementation(async (id, base) => {
    stored = stored.filter((entry) => entry.id !== id || entry.revision !== base)
  })
  discardStored.mockImplementation(async (id, base) => ({
    preserved: closedIds.has(id) ? false : closeElsewhere(id, 'discarded', base),
  }))
  beginSave.mockImplementation(async (id) => ({ closed: closedIds.get(id) ?? null }))
  finishSave.mockImplementation(async (id, base, created) =>
    created
      ? { closed: null, preserved: closeElsewhere(id, 'saved', base) }
      : { closed: closedIds.get(id) ?? 'saved', preserved: false },
  )
  draftStatus.mockImplementation(async (id) => ({
    closed: closedIds.get(id) ?? null,
    keptAs: null,
  }))
  settle.mockImplementation(async (report) => {
    for (const row of [...stored]) if (await report(row.id)) closeElsewhere(row.id, 'saved', 'r0')
  })
  deleteUnreadable.mockImplementation(async () => {
    unreadable = []
  })
  reportContent.mockResolvedValue(null)
  saveReport.mockImplementation(
    async (input) => ({ entry: { id: input.id }, created: true }) as Report,
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
    // A draft that was never stored has no ID to close.
    expect(discardStored).not.toHaveBeenCalled()
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
      '',
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
    await waitFor(() => expect(discardStored).toHaveBeenCalledWith(first, expect.any(String)))
    expect(closedIds.get(first)).toBe('discarded')
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
    expect(discardStored).toHaveBeenCalledTimes(1)
    expect(discardStored).toHaveBeenCalledWith(sharedId, 'r0')
    expect(deleteDraft).not.toHaveBeenCalled()
    expect(saveReport).not.toHaveBeenCalled()
    expect(feedbackButton()).toHaveTextContent('Give feedback')
  })
  it('clears the draft only after the report has committed', async () => {
    let commit!: () => void
    saveReport.mockImplementation(
      (input) =>
        new Promise((resolve) => {
          commit = () => resolve({ entry: { id: input.id }, created: true } as Report)
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
    expect(beginSave).toHaveBeenCalledWith(first, 'r1')
    expect(finishSave).not.toHaveBeenCalled()
    expect(closedIds.size).toBe(0)
    expect(stored).toHaveLength(1)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    commit()
    await waitFor(() => expect(stored).toEqual([]))
    expect(finishSave).toHaveBeenCalledWith(first, 'r1', true)
    expect(closedIds.get(first)).toBe('saved')
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
    expect(finishSave).not.toHaveBeenCalled()
    expect(closedIds.size).toBe(0)
    await waitFor(() => expect(stored).toHaveLength(1))
    await user.click(screen.getByRole('button', { name: 'Save feedback locally' }))
    await waitFor(() => expect(stored).toEqual([]))
    expect(saveReport.mock.calls.map(([input]) => input.id)).toEqual([first, first])
  })
  it('finishes clearing a draft whose report already committed instead of offering it again', async () => {
    stored = [storedDraft()]
    reportContent.mockResolvedValue({
      module_id: 'peripheral-imaging',
      page_path: piPath,
      comment: 'Stored unsent comment',
      selected_text: 'Stored selection',
      hasScreenshot: false,
    })
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

describe('a draft another tab saved or discarded', () => {
  const restored = async () => {
    stored = [storedDraft({ id: sharedId })]
    await mount()
    await waitFor(() => expect(feedbackButton()).toHaveTextContent('Continue feedback'))
  }
  it.each(['saved', 'discarded'] as const)(
    'keeps a later edit as a new draft once the other tab has %s it',
    async (outcome) => {
      const user = userEvent.setup()
      await restored()
      closeElsewhere(sharedId, outcome, 'r0')
      draftStatus.mockResolvedValueOnce({ closed: null, keptAs: null })
      await user.click(feedbackButton())
      await user.type(commentBox(), ' plus newer words')
      await waitFor(() => expect(stored).toHaveLength(1), { timeout: 3000 })
      expect(stored[0]).toMatchObject({
        comment: 'Stored unsent comment plus newer words',
        selected_text: 'Stored selection',
        page_path: piPath,
        forked_from: sharedId,
        created_at: '2026-10-02T10:00:00.000Z',
      })
      expect(stored[0].id).not.toBe(sharedId)
      expect(
        await within(screen.getByRole('dialog')).findByText(
          new RegExp(`Another tab (already )?${outcome} an earlier version of this draft`),
        ),
      ).toBeInTheDocument()
      // Still the same open draft: nothing typed is lost and further edits update the new one.
      await user.type(commentBox(), '!')
      await waitFor(() => expect(stored[0].comment).toBe('Stored unsent comment plus newer words!'))
      expect(stored).toHaveLength(1)
      await user.click(screen.getByRole('button', { name: 'Save feedback locally' }))
      await waitFor(() => expect(saveReport).toHaveBeenCalledTimes(1))
      expect(saveReport.mock.calls[0][0]).toMatchObject({
        id: stored[0]?.id ?? expect.any(String),
        comment: 'Stored unsent comment plus newer words!',
      })
      expect(saveReport.mock.calls[0][0].id).not.toBe(sharedId)
    },
  )
  it('puts away an unchanged copy without creating a draft or a report', async () => {
    const user = userEvent.setup()
    await restored()
    closeElsewhere(sharedId, 'saved', 'r0')
    await user.click(feedbackButton())
    await closed()
    expect(screen.getByText('This draft was already saved in another tab.')).toBeInTheDocument()
    expect(feedbackButton()).toHaveTextContent('Give feedback')
    expect(stored).toEqual([])
    expect(saveDraft).not.toHaveBeenCalled()
    expect(saveReport).not.toHaveBeenCalled()
  })
  it('never saves over the other tab’s report: unsaved edits stay open as a new draft', async () => {
    const user = userEvent.setup()
    await restored()
    await user.click(feedbackButton())
    await user.type(commentBox(), ' edited here')
    closeElsewhere(sharedId, 'saved', 'r0')
    await user.click(screen.getByRole('button', { name: 'Save feedback locally' }))
    expect(
      await within(screen.getByRole('dialog')).findByText(/Save again to add it as a new report/),
    ).toBeInTheDocument()
    expect(saveReport).not.toHaveBeenCalled()
    expect(commentBox()).toHaveValue('Stored unsent comment edited here')
    expect(stored.map((entry) => entry.comment)).toEqual(['Stored unsent comment edited here'])
    await user.click(screen.getByRole('button', { name: 'Save feedback locally' }))
    await waitFor(() => expect(stored).toEqual([]))
    expect(saveReport).toHaveBeenCalledTimes(1)
    expect(saveReport.mock.calls[0][0].id).toMatch(/^ffffffff/)
  })
  it('keeps this tab’s work when the report ID turns out to be taken', async () => {
    saveReport.mockImplementationOnce(async (input) => {
      closedIds.set(input.id, 'saved')
      return { entry: { id: input.id }, created: false } as Report
    })
    const user = userEvent.setup()
    await restored()
    await user.click(feedbackButton())
    await user.click(screen.getByRole('button', { name: 'Save feedback locally' }))
    expect(
      await within(screen.getByRole('dialog')).findByText(/Save again to add it as a new report/),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Feedback saved/)).not.toBeInTheDocument()
    expect(stored.some((entry) => entry.id.startsWith('ffffffff'))).toBe(true)
  })
  it('says when discarding here kept a newer version from another tab', async () => {
    const user = userEvent.setup()
    await restored()
    stored = [storedDraft({ id: sharedId, comment: 'Newer from the other tab', revision: 'r9' })]
    await user.click(feedbackButton())
    await user.click(screen.getByRole('button', { name: 'Discard draft' }))
    await closed()
    expect(await screen.findByText(/A newer version stored by another tab was kept/)).toBeVisible()
    expect(closedIds.get(sharedId)).toBe('discarded')
    expect(stored.map((entry) => entry.comment)).toEqual(['Newer from the other tab'])
    expect(stored[0].id).not.toBe(sharedId)
    await waitFor(() => expect(feedbackButton()).toHaveTextContent('Continue feedback'))
  })
  it('keeps both versions when the other tab edited the same draft first', async () => {
    const user = userEvent.setup()
    await restored()
    stored = [storedDraft({ id: sharedId, comment: 'Other tab edit', revision: 'r9' })]
    await user.click(feedbackButton())
    await user.type(commentBox(), ' mine')
    await waitFor(() => expect(stored).toHaveLength(2), { timeout: 3000 })
    expect(stored.map((entry) => entry.comment).sort()).toEqual([
      'Other tab edit',
      'Stored unsent comment mine',
    ])
    expect(
      await within(screen.getByRole('dialog')).findByText(/also changed in another tab/),
    ).toBeInTheDocument()
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
    for (const call of [
      readDrafts,
      saveDraft,
      deleteDraft,
      deleteUnreadable,
      discardStored,
      beginSave,
      finishSave,
      draftStatus,
      settle,
      saveReport,
      reportContent,
    ])
      expect(call).not.toHaveBeenCalled()
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
