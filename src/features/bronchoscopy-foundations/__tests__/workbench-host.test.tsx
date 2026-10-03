import { cleanup, fireEvent } from '@testing-library/react'

import { BRONCH_SELF_PACED_STORAGE_KEY } from '../engine/selfPacedProgress'
import { latestScopePaneProps } from '../test-support/ScopeTestDouble'
import {
  clickPrimary,
  currentStepId,
  installDom,
  mountSection,
  settle,
} from '../test-support/stageHarness'

jest.mock(
  '../components/scope/ScopePane',
  () =>
    jest.requireActual<typeof import('../test-support/ScopeTestDouble')>(
      '../test-support/ScopeTestDouble',
    ).scopePaneDouble,
)
jest.mock('../components/stage/scopeCaseLoader', () => ({
  loadStageScopeCase: () =>
    Promise.resolve(
      jest
        .requireActual<
          typeof import('../test-support/teachingCase')
        >('../test-support/teachingCase')
        .teachingCase(),
    ),
}))
jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: {
    href: string | { pathname: string }
    children: React.ReactNode
    [key: string]: unknown
  }) => (
    <a href={typeof href === 'string' ? href : href.pathname} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/bronchoscopy-foundations/learn',
}))

/**
 * BF-PRE-REVIEW-03 on the real host: help and reference names are advice drawn by the page, and
 * the pane keeps the current goal beside the controls (fellow walkthrough A30, A37).
 *
 * "Nothing recorded" is checked against everything that could carry it: the scope state the host
 * hands the pane (events, inputs, assists, input modes, the inspection record), the goal rows, and
 * the self-paced record on the device.
 */
beforeEach(() => {
  localStorage.clear()
  jest.useFakeTimers()
  installDom()
})
afterEach(() => {
  cleanup()
  jest.useRealTimers()
})

async function reachPractice(section: 'branch-entry' | 'right-side') {
  const { lesson } = await mountSection(section)
  while (lesson.steps.find((step) => step.id === currentStepId())?.course?.kind !== 'practice') {
    clickPrimary()
    await settle()
  }
  return lesson
}

const paneState = () => JSON.stringify(latestScopePaneProps()!.state)
const goalRows = () =>
  [...document.querySelectorAll('[data-step-goals] li')].map((row) => row.getAttribute('data-met'))
const record = () => localStorage.getItem(BRONCH_SELF_PACED_STORAGE_KEY)

function nowButton(name: string): HTMLButtonElement {
  const button = [...document.querySelectorAll<HTMLButtonElement>('[data-now-card] button')].find(
    (candidate) => candidate.textContent?.trim() === name,
  )
  if (!button) throw new Error(`No "${name}" button on the Now card`)
  return button
}

describe('A30 — help is advice, not a move', () => {
  it('names the control and the reason for the current goal, and changes nothing', async () => {
    await reachPractice('right-side')
    const state = paneState()
    const goals = goalRows()
    const saved = record()
    fireEvent.click(nowButton('Show me where'))
    await settle()
    // The step starts in the bronchus intermedius; the first goal needs the tip back in its parent.
    expect(document.querySelector('[data-spotlight="true"]')?.getAttribute('data-control')).toBe(
      'withdraw',
    )
    expect(document.querySelector('[data-goal-help]')?.textContent).toMatch(/^Withdraw/)
    expect(paneState()).toBe(state)
    expect(goalRows()).toEqual(goals)
    expect(record()).toBe(saved)
  })

  it('shows opening names on request without an input, an assist or a record', async () => {
    await reachPractice('right-side')
    const props = latestScopePaneProps()!
    expect(props.view.controls).not.toContain('branchLabels')
    const state = paneState()
    const goals = goalRows()
    const saved = record()
    const toggle = document.querySelector<HTMLButtonElement>('button[data-reference-labels]')!
    expect(toggle.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(toggle)
    await settle()
    expect(
      document.querySelector('button[data-reference-labels]')!.getAttribute('aria-pressed'),
    ).toBe('true')
    expect(latestScopePaneProps()!.referenceLabels).toMatchObject({ on: true, used: true })
    // The model's state, the goals and the device record are exactly as they were.
    expect(paneState()).toBe(state)
    expect(latestScopePaneProps()!.state.assistsUsed).not.toContain('branch-labels')
    expect(latestScopePaneProps()!.state.inputs.branchLabels).toBe(false)
    expect(goalRows()).toEqual(goals)
    expect(record()).toBe(saved)
    // The line about the attempt says the names were shown; it does not call them an assist.
    expect(document.querySelector('[data-input-mode]')!.textContent).toContain(
      'opening names shown for reference',
    )
    fireEvent.click(document.querySelector('button[data-reference-labels]')!)
    await settle()
    expect(latestScopePaneProps()!.referenceLabels).toMatchObject({ on: false, used: true })
    expect(paneState()).toBe(state)
  })

  it('offers no reference names where the step has its own in-view labels', async () => {
    await reachPractice('branch-entry')
    expect(latestScopePaneProps()!.view.controls).toContain('branchLabels')
    expect(document.querySelector('button[data-reference-labels]')).toBeNull()
  })
})

describe('A37 — the current goal sits beside the controls; the full list stays on the card', () => {
  it('shows one current goal in the pane and links to the complete list', async () => {
    const lesson = await reachPractice('branch-entry')
    const step = lesson.steps.find((candidate) => candidate.id === currentStepId())!
    const goals = step.interaction.kind === 'scope-task' ? step.interaction.goals : []
    expect(goals.length).toBe(5)
    const card = document.querySelector('[data-scope-goal-now]')!
    expect(card.getAttribute('data-scope-goal-now')).toBe(goals[0].id)
    expect([...card.querySelectorAll('[data-scope-goals] li')].map((li) => li.textContent)).toEqual(
      [goals[0].label],
    )
    // No second copy of the whole list in the pane.
    expect(document.querySelectorAll('[data-scope-goals] li')).toHaveLength(1)
    const list = document.querySelector<HTMLElement>('[data-step-goals]')!
    expect(list.querySelectorAll('li')).toHaveLength(5)
    expect(list.tabIndex).toBe(-1)
    const link = card.querySelector<HTMLAnchorElement>('a[data-all-goals-link]')!
    expect(link.getAttribute('href')).toBe(`#${list.id}`)
    // The card sits directly above the view, and the view stays next to its controls.
    const view = document.querySelector('[data-view-signal]')!
    const dock = document.querySelector('[data-scope-controls]')!
    expect(card.compareDocumentPosition(view) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(view.compareDocumentPosition(dock) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
