/**
 * PR #273 independent review, findings 2–4 (inherited, in scope for Prompt 04's route flow).
 *
 * Two state domains stay apart:
 *   - the learner's persisted draft (`branch-tracing.draft.*`): route work and the learner's own
 *     navigation within their route;
 *   - reference viewing (the Lesson 9 worked RS8 route, local worked walkthroughs, Show reference):
 *     component state only. Viewing, stepping, closing and reopening a reference writes nothing.
 * Every draft assertion below compares the stored bytes, so a navigation-only field (active junction,
 * demonstration frame, viewer slice or focus, display orientation, target inspection) is caught,
 * not only marks and counts.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { BranchTracingLesson } from '../components/BranchTracingLesson'
import { BranchTracingPractice } from '../components/BranchTracingPractice'
import { LESSONS } from '../content/lessons'
import { SEGMENT_PRACTICE_TRACES } from '../content/practice'
import {
  ctSessionReducer,
  emptyCtSession,
  reachableThrough,
  type CtAction,
  type CtSession,
} from '../engine/ct-session'
import { DRAFT_PREFIX } from '../engine/ct-draft'
import { targetForTrace, traceById } from '../geometry/native-ct'

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
const ready = () => document.querySelectorAll('image').forEach((image) => fireEvent.load(image))
const click = (name: string | RegExp) => {
  ready()
  fireEvent.click(screen.getByRole('button', { name }))
  ready()
}
const lesson = LESSONS.find((l) => l.id === 'variants-limits')!
const worked = traceById(lesson.example)
const own = traceById(lesson.prediction)
const RS8 = targetForTrace(worked).segment.code
const LS9 = targetForTrace(own).segment.code
const routeKey = `${DRAFT_PREFIX}learn.${lesson.id}`
const raw = (key: string) => localStorage.getItem(key)
const session = () => JSON.parse(raw(routeKey)!).value.session as CtSession
const heading = () => document.querySelector('[data-now-card] h2')?.textContent
/**
 * After a remount the loaded draft is written back in its schema's key order (zod rebuilds the
 * object), whether or not anything was viewed, so a reload is compared by value. Every check within
 * a session compares the stored bytes.
 */
const parsed = (value: string | null) => JSON.parse(value!)
function chooseUnresolvedBranch() {
  fireEvent.click(
    screen
      .getAllByRole('radio')
      .find((input) => (input as HTMLInputElement).value === 'unresolved')!,
  )
}
/** A genuine learner response at the open junction: a daughter choice and a real pixel mark. */
function recordJunction(pixelMark = true) {
  const point = own.checkpoints[session().active]
  if (point.decision)
    fireEvent.click(
      screen
        .getAllByRole('radio')
        .find((input) => (input as HTMLInputElement).value === String(point.sourceEdgeId))!,
    )
  click('Go to response slice')
  if (pixelMark) {
    const svg = screen.getByRole('group', { name: /^CT image\./ })
    fireEvent.keyDown(svg, { key: 'Enter' })
  } else click('Lumen unresolved here')
  click(point.decision ? 'Check this junction' : 'Record nodule approach')
}
async function openOwnTrace() {
  render(<BranchTracingLesson requestedId={lesson.id} />)
  await screen.findByRole('button', { name: `Skip to your own trace: ${LS9}` })
  click(`Skip to your own trace: ${LS9}`)
  click('Use this orientation')
}

describe('finding 3 · browsing the worked RS8 route writes nothing to the learner draft', () => {
  it('leaves the stored draft byte-identical through next, back, rotate, target and a remount', async () => {
    const view = render(<BranchTracingLesson requestedId={lesson.id} />)
    await screen.findByRole('button', { name: `Next worked junction (${RS8} route)` })
    ready()
    const before = raw(routeKey)
    expect(before).not.toBeNull()
    click(`Next worked junction (${RS8} route)`)
    click(`Next worked junction (${RS8} route)`)
    click(`Next worked junction (${RS8} route)`)
    click(/^Previous junction/)
    click(/Flip left–right/)
    click('Show target')
    expect(raw(routeKey)).toBe(before)
    // The worked map keeps the divisions already viewed; it is component state only.
    expect(document.querySelector('[data-map-owner]')).toHaveAttribute(
      'data-map-owner',
      'worked-example',
    )
    expect(document.querySelectorAll('[data-map-division]')).toHaveLength(4)
    view.unmount()
    render(<BranchTracingLesson requestedId={lesson.id} />)
    await screen.findByRole('button', { name: `Next worked junction (${RS8} route)` })
    ready()
    expect(parsed(raw(routeKey))).toEqual(parsed(before))
  })
})

describe('finding 2 · the worked RS8 route reopens without touching ongoing LS9 work', () => {
  it('views RS8, steps forward and back, returns to the same LS9 junction and keeps every stored byte', async () => {
    const view = render(<BranchTracingLesson requestedId={lesson.id} />)
    await screen.findByRole('button', { name: `Skip to your own trace: ${LS9}` })
    click(`Next worked junction (${RS8} route)`)
    click(`Skip to your own trace: ${LS9}`)
    click('Use this orientation')
    recordJunction(true)
    expect(session()).toMatchObject({
      step: 1,
      active: 0,
      recorded: [true, ...own.checkpoints.slice(1).map(() => false)],
    })
    expect(session().marks[0]?.pixel).not.toBeNull()
    const snapshot = raw(routeKey)
    click(`View the worked ${RS8} route (reference)`)
    expect(
      screen.getByRole('heading', { name: `Worked example: the route to ${RS8}` }),
    ).toBeVisible()
    expect(document.querySelector('[data-map-owner]')).toHaveAttribute(
      'data-map-owner',
      'worked-example',
    )
    expect(screen.queryByLabelText('Your mark 1')).toBeNull()
    click(`Next worked junction (${RS8} route)`)
    click(`Next worked junction (${RS8} route)`)
    click(/^Previous junction/)
    click(/Flip left–right/)
    expect(raw(routeKey)).toBe(snapshot)
    click(`Return to your trace: ${LS9}`)
    expect(document.querySelector('[data-route-role="own"]')).toHaveTextContent(
      `Your trace · target ${LS9}`,
    )
    expect(heading()).toBe(`Junction 1 of ${own.checkpoints.length - 1}`)
    expect(screen.getByLabelText('Your mark 1')).toBeInTheDocument()
    expect(raw(routeKey)).toBe(snapshot)
    // Close and reopen once more, then refresh: still nothing written.
    click(`View the worked ${RS8} route (reference)`)
    click(`Return to your trace: ${LS9}`)
    expect(raw(routeKey)).toBe(snapshot)
    view.unmount()
    render(<BranchTracingLesson requestedId={lesson.id} />)
    await screen.findByRole('button', { name: 'Continue to the next division' })
    ready()
    expect(parsed(raw(routeKey))).toEqual(parsed(snapshot))
    // The learner's own route carries on from where it was.
    click('Continue to the next division')
    expect(session()).toMatchObject({ step: 1, active: 1 })
  })
})

describe('finding 3 · local worked walkthroughs and Show reference write nothing', () => {
  it('keeps the draft byte-identical through reference open, next, back, replay, close and reopen, then persists the learner’s own browsing', async () => {
    const key = `${DRAFT_PREFIX}learn.vertical`
    const view = render(<BranchTracingLesson requestedId="vertical" />)
    await screen.findByRole('button', { name: 'Start marking branches' })
    click('Next demonstration slice')
    click('Start marking branches')
    // Partial learner work: Daughter A placed as unresolved.
    click(/^Daughter A · RB1b · slice/)
    click('Lumen unresolved here')
    const before = raw(key)
    expect(JSON.parse(before!).value.marks[0]).toEqual({ slice: 422, pixel: null })
    click('Show reference')
    click('Next demonstration slice')
    click('Next demonstration slice')
    click('Previous demonstration slice')
    click('Show reference')
    click('Replay the worked walkthrough')
    click('Next demonstration slice')
    click('Show reference')
    expect(raw(key)).toBe(before)
    view.unmount()
    render(<BranchTracingLesson requestedId="vertical" />)
    await screen.findByRole('button', { name: 'Show reference' })
    ready()
    expect(parsed(raw(key))).toEqual(parsed(before))
    // The learner's own browsing of their try is still saved.
    click('More cranial CT slice')
    expect(JSON.parse(raw(key)!).value.views).not.toEqual(JSON.parse(before!).value.views)
    expect(JSON.parse(raw(key)!).value.marks).toEqual(JSON.parse(before!).value.marks)
  })
  it('keeps the draft unchanged while the worked example itself is stepped', async () => {
    const key = `${DRAFT_PREFIX}learn.vertical`
    render(<BranchTracingLesson requestedId="vertical" />)
    await screen.findByRole('button', { name: 'Start marking branches' })
    ready()
    const before = raw(key)
    click('Next demonstration slice')
    click('Next demonstration slice')
    click('Previous demonstration slice')
    click('Replay from parent')
    expect(raw(key)).toBe(before)
  })
})

describe('finding 4 · Continue after a skipped stop', () => {
  const reduce = ctSessionReducer(own, traceById(lesson.transfer), worked)
  const run = (actions: CtAction[], s = emptyCtSession(own)) => actions.reduce(reduce, s)
  const record = (s: CtSession): CtAction[] => {
    const point = own.checkpoints[s.active]
    return [
      ...(point.decision
        ? [{ type: 'branch', index: s.active, value: 'unresolved' } as CtAction]
        : []),
      { type: 'mark', index: s.active, mark: { slice: point.slice, pixel: null } },
      { type: 'record-junction' },
    ]
  }
  const start = run([{ type: 'advance' }, { type: 'check-orientation' }])
  const step = (s: CtSession, a: CtAction[]) => run(a, s)

  it('A · skip → record → Continue opens the next stop', () => {
    let s = step(start, [{ type: 'skip-junction' }])
    s = step(s, record(s))
    expect(s).toMatchObject({ active: 1, reached: 1 })
    expect(reachableThrough(s.recorded, s.reached)).toBe(2)
    s = step(s, [{ type: 'active', index: s.active + 1 }])
    expect(s.active).toBe(2)
  })
  it('B · record → skip → record → Continue still works', () => {
    let s = step(start, record(start))
    s = step(s, [{ type: 'active', index: 1 }, { type: 'skip-junction' }])
    s = step(s, record(s))
    s = step(s, [{ type: 'active', index: s.active + 1 }])
    expect(s.active).toBe(3)
  })
  it('C · several skips, then a recorded stop, then Continue', () => {
    let s = step(start, [{ type: 'skip-junction' }, { type: 'skip-junction' }])
    s = step(s, record(s))
    s = step(s, [{ type: 'active', index: s.active + 1 }])
    expect(s.active).toBe(3)
  })
  it('D · skipped stops stay skipped: no mark, branch, record or history appears', () => {
    let s = step(start, [{ type: 'skip-junction' }, { type: 'skip-junction' }])
    s = step(s, record(s))
    s = step(s, [{ type: 'active', index: s.active + 1 }])
    expect(s.recorded.slice(0, 2)).toEqual([false, false])
    expect(s.marks.slice(0, 2)).toEqual([null, null])
    expect(s.branches.slice(0, 2)).toEqual([null, null])
    expect(Object.keys(s.junctionHistory)).toEqual([`${own.id}.${own.checkpoints[2].id}`])
  })
  it('A · in the lesson, Continue after skip then record moves to the next junction', async () => {
    await openOwnTrace()
    click('Continue without recording')
    recordJunction(false)
    expect(heading()).toBe(`Junction 2 of ${own.checkpoints.length - 1}`)
    click('Continue to the next division')
    expect(heading()).toBe(`Junction 3 of ${own.checkpoints.length - 1}`)
    expect(session()).toMatchObject({ active: 2 })
    expect(session().recorded[0]).toBe(false)
    expect(session().marks[0]).toBeNull()
  })
  it('E · a partial route that reaches its last stop moves on truthfully instead of hanging', async () => {
    await openOwnTrace()
    for (let i = 0; i < own.checkpoints.length - 1; i++) click('Continue without recording')
    expect(heading()).toBe('Distal nodule approach')
    recordJunction(false)
    const before = session()
    expect(document.querySelector('[data-now-primary]')).toHaveTextContent(
      'Continue with this partial route',
    )
    expect(
      screen.queryByRole('button', { name: 'Continue without recording this trace' }),
    ).toBeNull()
    click('Continue with this partial route')
    const after = session()
    expect(after.step).toBe(2)
    expect(after.recorded).toEqual(before.recorded)
    expect(after.marks).toEqual(before.marks)
    expect(after.prediction).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Show the comparison without recording' }),
    ).toBeEnabled()
  })
  it('A and E · Practice continues after skip then record, and ends a partial route truthfully', () => {
    const trace = traceById(SEGMENT_PRACTICE_TRACES[2])
    render(<BranchTracingPractice mode="practice" />)
    click('Start CT practice')
    click('Use this orientation')
    click('Continue without recording')
    chooseUnresolvedBranch()
    click('Go to response slice')
    click('Lumen unresolved here')
    click('Check this junction')
    click('Continue to the next division')
    expect(
      screen.getAllByText(`Junction 3 of ${trace.checkpoints.length - 1}`).length,
    ).toBeGreaterThan(0)
    for (let i = 2; i < trace.checkpoints.length - 1; i++) click('Continue without recording')
    click('Go to response slice')
    click('Lumen unresolved here')
    click('Record nodule approach')
    // The primary action itself moves the partial route on; it is no longer a Continue that does
    // nothing, and no second button repeats it.
    const primary = document.querySelector('[data-now-primary]') as HTMLButtonElement
    expect(primary).toHaveTextContent('Compare all routes')
    expect(screen.getAllByRole('button', { name: 'Compare all routes' })).toHaveLength(1)
    ready()
    fireEvent.click(primary)
    expect(
      screen.getByRole('heading', { name: 'Compare your routes with the reference' }),
    ).toBeVisible()
    expect(document.querySelector('[data-route-state="partial"]')).not.toBeNull()
  })
})
