/**
 * PR #273 final sanity repair: a local worked or reference walkthrough owns its own display.
 *
 * While a worked walkthrough, Show reference or the comparison is on screen, every display choice made
 * on that CT belongs to the reference: plane, crop focus, Full CT field, magnification, the paired
 * parent airway view, flip and rotation. None of it reaches the persisted learner draft. Closing the
 * reference hands the viewer the learner's own saved display back, and a report the viewer made on
 * the reference's display is never saved as the learner's.
 *
 * Every in-session assertion compares the whole stored draft by its bytes, never a count or one
 * field. A reload is compared by value, because the loaded draft is re-serialised in zod key order.
 */
import { act, fireEvent, render, screen } from '@testing-library/react'
import { BranchTracingLesson } from '../components/BranchTracingLesson'
import { DRAFT_PREFIX } from '../engine/ct-draft'
import type { LocalSession } from '../engine/local-session'

jest.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))
beforeEach(() => {
  window.localStorage.clear()
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})
afterEach(() => jest.restoreAllMocks())
const ready = () => document.querySelectorAll('image').forEach((image) => fireEvent.load(image))
const click = (name: string | RegExp) => {
  ready()
  fireEvent.click(screen.getByRole('button', { name }))
  ready()
}
const key = (id: string) => `${DRAFT_PREFIX}learn.${id}`
const raw = (id: string) => localStorage.getItem(key(id))
const stored = (id: string) => JSON.parse(raw(id)!).value as LocalSession
const parsed = (value: string | null) => JSON.parse(value!)
/**
 * Every draft write from now on, including ones a later write would overwrite: a reference state
 * saved for a single commit is a persisted leak even when the final bytes happen to match.
 */
function draftWrites(id: string) {
  const spy = jest.spyOn(Storage.prototype, 'setItem')
  return {
    distinct: () =>
      new Set(spy.mock.calls.filter(([k]) => k === key(id)).map(([, value]) => value)),
    stop: () => spy.mockRestore(),
  }
}

/** What the viewer is showing now, read from its own controls, not from the draft. */
function shown() {
  const viewer = screen.getByRole('region', { name: 'CT tracing viewer' })
  return {
    orientation: viewer.querySelector('h2 + span')!.textContent,
    full: screen
      .getByRole('button', { name: /^(Full CT field|Airway detail)$/ })
      .getAttribute('aria-pressed'),
    magnification: (screen.getByRole('slider', { name: 'CT magnification' }) as HTMLInputElement)
      .value,
    paired: screen
      .getByRole('button', { name: /^(Show|Hide) parent airway view$/ })
      .getAttribute('aria-pressed'),
    slice: (screen.getByRole('slider', { name: 'CT slice' }) as HTMLInputElement).value,
  }
}
const toggleFull = () => click(/^(Full CT field|Airway detail)$/)
const togglePaired = () => click(/^(Show|Hide) parent airway view$/)
const magnify = (value: string) =>
  fireEvent.change(screen.getByRole('slider', { name: 'CT magnification' }), {
    target: { value },
  })

async function open(id: string) {
  const view = render(<BranchTracingLesson requestedId={id} />)
  await screen.findByRole('region', { name: 'CT tracing viewer' })
  ready()
  if (screen.queryByRole('button', { name: 'Focus on this airway' })) click('Focus on this airway')
  const compare = screen.queryByRole('button', {
    name: /^(Compare with the caudal tracing view|Rotate 90° counterclockwise|Rotate 90° clockwise)$/,
  })
  if (compare) {
    click(compare.textContent!)
    click('Apply this to the same airway')
  }
  return view
}
/** Genuine partial learner work, as in the independent reproduction: one response recorded. */
async function partialWork(id: string) {
  const view = await open(id)
  click('Start marking branches')
  click('Go to response slice')
  click('Lumen unresolved here')
  const draft = stored(id)
  expect(draft.phase).toBe('attempt')
  expect(draft.marks[0]).toMatchObject({ pixel: null })
  return view
}
async function reload(id: string, view: ReturnType<typeof render>) {
  view.unmount()
  const next = render(<BranchTracingLesson requestedId={id} />)
  await screen.findByRole('region', { name: 'CT tracing viewer' })
  ready()
  return next
}

describe.each([
  ['Lesson 4', 'vertical'],
  ['Lesson 7', 'horizontal-oblique'],
])('%s (%s) · reference display never reaches the learner draft', (_, id) => {
  it('A · orientation: flip and rotate on the reference, close, reload', async () => {
    const view = await partialWork(id)
    const before = raw(id)
    const learner = shown()
    click('Show reference')
    click('Next demonstration slice')
    click(/Flip left–right/)
    click(/Rotate 90° right/)
    expect(shown().orientation).not.toBe(learner.orientation)
    expect(raw(id)).toBe(before)
    click('Show reference')
    expect(shown().orientation).toBe(learner.orientation)
    expect(raw(id)).toBe(before)
    await reload(id, view)
    expect(parsed(raw(id))).toEqual(parsed(before))
    expect(stored(id).orientation).toEqual(parsed(before).value.orientation)
    expect(shown().orientation).toBe(learner.orientation)
  })

  it('B · Full CT field on the reference leaves views[exercise].full as the learner saved it', async () => {
    const view = await partialWork(id)
    const before = raw(id)
    const exercise = Object.keys(stored(id).views).find((k) => stored(id).views[k])!
    const full = stored(id).views[exercise].full
    click('Show reference')
    click('Next demonstration slice')
    toggleFull()
    expect(shown().full).toBe(String(!full))
    expect(raw(id)).toBe(before)
    click('Show reference')
    expect(shown().full).toBe(String(full))
    expect(raw(id)).toBe(before)
    await reload(id, view)
    expect(stored(id).views[exercise].full).toBe(full)
    expect(parsed(raw(id))).toEqual(parsed(before))
    expect(shown().full).toBe(String(full))
  })

  it('C · magnification on the reference leaves the draft unchanged', async () => {
    const view = await partialWork(id)
    const before = raw(id)
    const learner = shown()
    click('Show reference')
    magnify('2.2')
    expect(shown().magnification).toBe('2.2')
    expect(raw(id)).toBe(before)
    click('Show reference')
    expect(shown().magnification).toBe(learner.magnification)
    expect(raw(id)).toBe(before)
    await reload(id, view)
    expect(parsed(raw(id))).toEqual(parsed(before))
  })

  it('D · the paired parent airway view on the reference leaves the draft unchanged', async () => {
    const view = await partialWork(id)
    const before = raw(id)
    const learner = shown()
    click('Show reference')
    togglePaired()
    expect(shown().paired).not.toBe(learner.paired)
    expect(raw(id)).toBe(before)
    click('Show reference')
    expect(shown().paired).toBe(learner.paired)
    expect(raw(id)).toBe(before)
    await reload(id, view)
    expect(parsed(raw(id))).toEqual(parsed(before))
  })

  it('E · the whole draft is byte-identical through every reference display control, and the learner display returns', async () => {
    const view = await partialWork(id)
    const before = raw(id)
    const learner = shown()
    const writes = draftWrites(id)
    click('Show reference')
    click('Next demonstration slice')
    click('Next demonstration slice')
    click(/Flip left–right/)
    click(/Rotate 90° left/)
    toggleFull()
    toggleFull()
    magnify('2.4')
    togglePaired()
    click('More cranial CT slice')
    click('Go to response slice')
    click('Previous demonstration slice')
    click('Replay from parent')
    expect(raw(id)).toBe(before)
    click('Show reference')
    expect(shown()).toEqual(learner)
    expect(raw(id)).toBe(before)
    for (const value of writes.distinct()) expect(value).toBe(before)
    writes.stop()
    await reload(id, view)
    expect(parsed(raw(id))).toEqual(parsed(before))
    expect(shown()).toEqual(learner)
  })

  it('F · two close/reopen cycles with different controls leave the draft unchanged', async () => {
    const view = await partialWork(id)
    const before = raw(id)
    const learner = shown()
    click('Show reference')
    click(/Flip left–right/)
    toggleFull()
    magnify('2')
    click('Show reference')
    expect(shown()).toEqual(learner)
    expect(raw(id)).toBe(before)
    click('Show reference')
    // A reopened reference starts from the learner's display, not the last reference.
    expect(shown().orientation).toBe(learner.orientation)
    expect(shown().full).toBe(learner.full)
    click(/Rotate 90° right/)
    togglePaired()
    click('Next demonstration slice')
    click('Show reference')
    expect(shown()).toEqual(learner)
    expect(raw(id)).toBe(before)
    await reload(id, view)
    expect(parsed(raw(id))).toEqual(parsed(before))
  })

  it('G · a reference display change and the close in one batch persist nothing', async () => {
    const view = await partialWork(id)
    const before = raw(id)
    const learner = shown()
    const writes = draftWrites(id)
    click('Show reference')
    click('Next demonstration slice')
    // The Full CT field toggle and the close land in the same React batch: the viewer's report of
    // the reference's full field is made after the host has already left reference mode. The
    // hand-back re-reports the learner's view straight afterwards, so only the write log (not the
    // final bytes) shows whether that stale report was ever saved.
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /^(Full CT field|Airway detail)$/ }))
      fireEvent.click(screen.getByRole('button', { name: 'Show reference' }))
    })
    ready()
    expect(raw(id)).toBe(before)
    expect(shown()).toEqual(learner)
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Show reference' }))
    })
    ready()
    act(() => {
      fireEvent.change(screen.getByRole('slider', { name: 'CT magnification' }), {
        target: { value: '2.1' },
      })
      fireEvent.click(screen.getByRole('button', { name: /Flip left–right/ }))
      fireEvent.click(screen.getByRole('button', { name: 'Show reference' }))
    })
    ready()
    expect(raw(id)).toBe(before)
    expect(shown()).toEqual(learner)
    for (const value of writes.distinct()) expect(value).toBe(before)
    writes.stop()
    // The learner's next genuine navigation starts from their own display, not the reference's.
    click('More cranial CT slice')
    const after = stored(id)
    const exercise = Object.keys(after.views).find((k) => after.views[k])!
    expect(after.views[exercise]).toMatchObject({
      full: parsed(before).value.views[exercise].full,
      magnification: parsed(before).value.views[exercise].magnification,
      showScope: parsed(before).value.views[exercise].showScope,
    })
    expect(after.orientation).toEqual(parsed(before).value.orientation)
    expect(after.marks).toEqual(parsed(before).value.marks)
    await reload(id, view)
    expect(shown().full).toBe(learner.full)
  })
})

describe('leaving a worked example by a lesson transition starts the learner from their own display', () => {
  it('display choices made on the worked walkthrough do not follow Start marking branches', async () => {
    await open('vertical')
    const before = stored('vertical')
    const learnerOrientation = before.orientation
    click('Next demonstration slice')
    click(/Flip left–right/)
    toggleFull()
    magnify('1.9')
    togglePaired()
    click('Start marking branches')
    const after = stored('vertical')
    expect(after.phase).toBe('attempt')
    expect(after.orientation).toEqual(learnerOrientation)
    const view = after.views[Object.keys(after.views)[0]]
    expect(view).toMatchObject({ full: false, magnification: 1 })
    expect(shown()).toMatchObject({ full: 'false', magnification: '1' })
  })

  it('display choices made on the comparison do not follow the learner back into a redo', async () => {
    await partialWork('vertical')
    click(/^Daughter B · /)
    click('Lumen unresolved here')
    const course = screen.queryByRole('combobox', { name: 'Airway course' })
    if (course) fireEvent.change(course, { target: { value: 'uncertain' } })
    const learner = shown()
    const beforeCheck = stored('vertical')
    click('Check my tracing')
    expect(stored('vertical').phase).toBe('compare')
    const before = raw('vertical')
    click(/Flip left–right/)
    toggleFull()
    magnify('2.2')
    togglePaired()
    expect(raw('vertical')).toBe(before)
    click('Redo branch marks (optional)')
    const after = stored('vertical')
    expect(after.phase).toBe('attempt')
    const exercise = Object.keys(after.views)[0]
    // Redo returns to the starting slice; the display is the learner's, not the comparison's.
    expect(after.views[exercise]).toMatchObject({
      full: beforeCheck.views[exercise].full,
      magnification: beforeCheck.views[exercise].magnification,
      showScope: beforeCheck.views[exercise].showScope,
    })
    expect(after.orientation).toEqual({ turns: 0, reflected: false })
    expect(shown()).toMatchObject({
      full: learner.full,
      magnification: learner.magnification,
      paired: learner.paired,
      orientation: 'Standard axial',
    })
  })
})

describe('genuine learner display choices outside reference viewing still persist', () => {
  it.each([['vertical'], ['horizontal-oblique']])(
    '%s · orientation, Full CT field, magnification, paired view and slice survive a reload',
    async (id) => {
      const view = await partialWork(id)
      const before = stored(id)
      const exercise = Object.keys(before.views).find((k) => before.views[k])!
      click(/Flip left–right/)
      click(/Rotate 90° right/)
      toggleFull()
      togglePaired()
      click('More cranial CT slice')
      const mid = stored(id)
      expect(mid.orientation).not.toEqual(before.orientation)
      expect(mid.views[exercise].full).toBe(!before.views[exercise].full)
      expect(mid.views[exercise].showScope).toBe(!before.views[exercise].showScope)
      expect(mid.views[exercise].slice).toBe(before.views[exercise].slice + 1)
      // Full CT field resets magnification, so magnify back in detail view afterwards.
      toggleFull()
      magnify('2.3')
      const learner = shown()
      const saved = raw(id)
      expect(stored(id).views[exercise]).toMatchObject({
        full: before.views[exercise].full,
        magnification: 2.3,
      })
      const reloaded = await reload(id, view)
      expect(parsed(raw(id))).toEqual(parsed(saved))
      expect(shown()).toEqual(learner)
      expect(stored(id).orientation).toEqual(mid.orientation)
      reloaded.unmount()
    },
  )
  it.each([['vertical'], ['horizontal-oblique']])(
    '%s · after a reload, a reference starts from and returns to the restored learner display',
    async (id) => {
      const view = await partialWork(id)
      click(/Flip left–right/)
      toggleFull()
      togglePaired()
      toggleFull()
      magnify('2.3')
      const saved = raw(id)
      const reloaded = await reload(id, view)
      const learner = shown()
      expect(learner).toMatchObject({ full: 'false', magnification: '2.3', paired: 'true' })
      click('Show reference')
      expect(shown()).toMatchObject({ orientation: learner.orientation, full: 'false' })
      toggleFull()
      click(/Rotate 90° left/)
      click('Show reference')
      expect(shown()).toEqual(learner)
      expect(parsed(raw(id))).toEqual(parsed(saved))
      reloaded.unmount()
    },
  )
})
