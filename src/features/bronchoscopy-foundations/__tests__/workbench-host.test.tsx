import { cleanup, fireEvent } from '@testing-library/react'

import { SEGMENTAL_AIRWAY_LABELS, scopeControlId } from '../components/scope/types'
import { airwayDisplayName } from '../content/airwayTree'
import { UNNAMED_AIRWAY_WORDS } from '../engine/scope/inspectionLedger'
import { SCOPE_MESSAGES } from '../engine/scope/scopeMessages'
import { BRONCH_SELF_PACED_STORAGE_KEY } from '../engine/selfPacedProgress'
import { latestScopePaneProps } from '../test-support/ScopeTestDouble'
import {
  currentStepId,
  installDom,
  mountSection,
  scopePilot,
  settle,
} from '../test-support/stageHarness'
import { reachCourseStep } from '../test-support/courseHarness'

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

/** The section's scope practice, reached by doing each earlier step as a learner would. */
async function reachPractice(section: 'larynx-and-entry' | 'right-side' | 'systematic-survey') {
  const { lesson } = await mountSection(section)
  // "Larynx, trachea and carina" has three scope tasks; the carina task is the one with labels.
  const practice = lesson.steps.find((step) =>
    section === 'larynx-and-entry'
      ? step.course?.id === 'carina'
      : step.interaction.kind === 'scope-task',
  )!
  await reachCourseStep(lesson, practice)
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
    // The step starts back in the bronchus intermedius with both openings in view; the first goal
    // still needs the tip turned toward the middle lobe before it can enter it.
    expect(document.querySelector('[data-spotlight="true"]')?.getAttribute('data-control')).toBe(
      'rotate',
    )
    expect(document.querySelector('[data-goal-help]')?.textContent).toMatch(/^Rotate/)
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
    await reachPractice('larynx-and-entry')
    expect(latestScopePaneProps()!.view.controls).toContain('branchLabels')
    expect(document.querySelector('button[data-reference-labels]')).toBeNull()
  })
})

/**
 * The survey keeps its record by naming (educator feedback, 2026-10-13): the question is asked
 * among the controls once the tip is inside a segment, and nothing on the stage hands out the name
 * it is asking for. Held on the real host, through the list the learner chooses from.
 */
describe('the survey’s naming record on the stage', () => {
  const pane = () => latestScopePaneProps()!
  const question = () => document.querySelector('[data-name-segment]')
  const nameList = () =>
    document.getElementById(scopeControlId('name-segment')) as HTMLSelectElement | null
  const choose = async (label: string) => {
    fireEvent.change(nameList()!, { target: { value: label } })
    await settle()
  }
  /** Everything a learner or a screen reader meets, less the list of names being chosen from. */
  function shownOutsideTheQuestion(): string {
    const clone = document.body.cloneNode(true) as HTMLElement
    for (const node of clone.querySelectorAll(
      '[data-name-segment], [data-inspection-ledger], [data-step-goals], [data-scope-goals], script, style',
    ))
      node.remove()
    const spoken = [...clone.querySelectorAll('*')].flatMap((node) =>
      [...node.attributes].filter((a) => /^(aria-|title|alt)/.test(a.name)).map((a) => a.value),
    )
    return `${clone.textContent ?? ''} ${spoken.join(' ')}`
  }

  it('offers no opening names, in view or on request, and waits for a segment', async () => {
    await reachPractice('systematic-survey')
    expect(pane().view.ledger?.naming).toBe(true)
    expect(pane().view.controls).not.toContain('branchLabels')
    expect(document.querySelector('button[data-reference-labels]')).toBeNull()
    expect(pane().referenceLabels?.on ?? false).toBe(false)
    // All eighteen pins are on the map, each a question mark until it is named.
    const pins = [...document.querySelectorAll('[data-airway-map] [data-unnamed="true"]')]
    expect(pins).toHaveLength(SEGMENTAL_AIRWAY_LABELS.length)
    expect(pins.every((pin) => pin.textContent?.trim() === '?')).toBe(true)
    // The record lists what is left to name, with no menu on its rows.
    expect(document.querySelectorAll('[data-inspection-ledger] [data-ledger-row]')).toHaveLength(18)
    expect(document.querySelector('[data-inspection-ledger] select')).toBeNull()
    expect(
      [...document.querySelectorAll('[data-inspection-ledger] tbody td')].every(
        (cell) => cell.textContent === 'To name',
      ),
    ).toBe(true)
    expect(question()?.getAttribute('data-name-segment')).toBe('waiting')
    expect(nameList()).toBeNull()
    expect(document.querySelector('[data-name-segment-count]')?.textContent).toBe('0 of 18 named')
  })

  it('asks inside a segment without printing its name, and fills the record in on the right answer', async () => {
    await reachPractice('systematic-survey')
    const pilot = scopePilot()
    pilot.goInto('RB1')
    await settle()
    const name = airwayDisplayName('RB1')
    // The question is open, and the name is nowhere but in the list to choose from.
    expect(question()?.getAttribute('data-name-segment')).toBe('asked')
    expect([...nameList()!.options].map((option) => option.value)).toEqual([
      '',
      ...SEGMENTAL_AIRWAY_LABELS,
    ])
    expect(pane().caption).toContain(UNNAMED_AIRWAY_WORDS)
    expect(document.querySelector('[data-goal-now]')?.textContent).toContain(UNNAMED_AIRWAY_WORDS)
    expect(shownOutsideTheQuestion()).not.toContain(name)
    expect(shownOutsideTheQuestion()).not.toMatch(/\bRB1\b(?! to RB10)/)

    // A wrong name changes nothing but the message.
    const before = JSON.stringify(pane().state.ledger)
    await choose('RB3')
    expect(JSON.stringify(pane().state.ledger)).toBe(before)
    expect(pane().state.events.at(-1)).toBe('misnamed')
    expect(pane().state.message).toBe(SCOPE_MESSAGES.misnamed)
    expect(question()?.getAttribute('data-name-segment')).toBe('asked')
    expect(shownOutsideTheQuestion()).not.toContain(name)

    // The right one names the row and the pin, and the location is called by its name again.
    await choose('RB1')
    expect(pane().state.ledger.RB1?.identified).toBe(true)
    expect(document.querySelector('[data-ledger-row="RB1"] td')?.textContent).toBe('Named')
    expect(document.querySelector('[data-airway-map] [data-airway-pin="RB1"]')).not.toHaveAttribute(
      'data-unnamed',
    )
    expect(document.querySelectorAll('[data-airway-map] [data-unnamed="true"]')).toHaveLength(17)
    expect(document.querySelector('[data-name-segment-count]')?.textContent).toBe('1 of 18 named')
    expect(document.querySelector('[data-goal-now]')?.textContent).toContain(name)
    // With this segment named there is nothing to ask until the tip is inside another.
    expect(question()?.getAttribute('data-name-segment')).toBe('waiting')
  })

  it('gives help that says where to answer, never which segment this is', async () => {
    await reachPractice('systematic-survey')
    fireEvent.click(nowButton('Show me where'))
    await settle()
    expect(document.querySelector('[data-goal-help]')?.textContent).toMatch(/^Drive into a segment/)
    expect(pane().helpTarget ?? null).toBeNull()
    scopePilot().goInto('RB1')
    await settle()
    const help = document.querySelector('[data-goal-help]')?.textContent ?? ''
    expect(help).toMatch(/^Choose this segment’s name/)
    expect(help).not.toMatch(/\bRB\d|apical/i)
    expect(pane().helpTarget ?? null).toBeNull()
  })
})

describe('A37 — the current goal sits beside the controls; the full list stays on the card', () => {
  it('shows one current goal in the pane and links to the complete list', async () => {
    const lesson = await reachPractice('larynx-and-entry')
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
