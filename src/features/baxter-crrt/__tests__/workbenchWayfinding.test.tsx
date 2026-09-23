import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import { BaxterCrrtAssess } from '../components/BaxterCrrtAssess'
import { BaxterCrrtPractice } from '../components/BaxterCrrtPractice'
import { selectCrrtCaseNavigation } from '../caseNavigation'
import { baxterCrrtAdditionalCaseIds, baxterCrrtCoreCaseIds, getBaxterCrrtCase } from '../content'
import { BAXTER_CRRT_PROGRESS_STORAGE_KEY } from '../engine/progress'

/**
 * CRRT-FELLOW-03 — F-09 / F-11 / F-12 / F-22. The workbench keeps the task, the supported
 * evidence and the case controls together; Help opens a visible surface and changes nothing;
 * the Cases control routes through the one canonical case identity; the role control is a
 * truthful reading perspective that never discards the run.
 */

const push = jest.fn()

jest.mock('@/features/critical-care/analytics', () => ({ recordCriticalCareEvent: jest.fn() }))
jest.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: (...args: unknown[]) => push(...args), replace: jest.fn() }),
  Link: ({
    href,
    children,
    ...rest
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string; query?: Record<string, string> }
    children: ReactNode
  }) => (
    <a
      href={
        typeof href === 'string'
          ? href
          : `${href.pathname}?${new URLSearchParams(href.query ?? {}).toString()}`
      }
      {...rest}
    >
      {children}
    </a>
  ),
}))

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

const clock = () =>
  document.querySelector('[aria-label="Advance simulated time"]')?.textContent ?? ''
const evidence = () =>
  screen.getByRole('region', { name: 'Live patient, prescription, and circuit' })

beforeEach(() => {
  window.localStorage.clear()
  push.mockClear()
})

describe('CRRT workbench evidence (F-11 / F-12)', () => {
  it('shows every clinical item the old strip carried as labelled, grouped rows', async () => {
    render(<BaxterCrrtPractice locale="en" initialCaseId="CRRT-02" />)
    await settle()
    const panel = evidence()
    const labels = within(panel)
      .getAllByRole('term')
      .map((term) => term.textContent)
    expect(labels).toEqual([
      'Active alert · live model',
      'Weight · MAP',
      'Supplied labs at case start',
      'Therapy · blood flow set',
      'Prescribed dose · fluid removal set',
      'Blood flow through the circuit',
      'Delivered dose · whole-patient balance',
      'Access · filter · return · effluent pressure',
    ])
    // Grouped by where each value comes from, so a supplied number is never read as modelled.
    const groups = within(panel)
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent)
    expect(groups).toEqual([
      'Supplied at case start · not modeled over time',
      'Current settings · prescription in force',
      'Live model output · simulation, now',
    ])
    // The decisive supplied labs of the hyperkalemia case are on screen with their units and the
    // Batch-01 containment statement, not the evolving pool.
    expect(panel).toHaveTextContent(/K 6\.9 mmol\/L · HCO₃ 10(?:\.0)? mmol\/L · pH 7\.08/)
    expect(panel).toHaveTextContent('not modeled over time')
    // Safety constraints and device identity stay one named disclosure away.
    const more = within(panel)
      .getByText('Device profile and safety constraints')
      .closest('details')!
    expect(within(more).getByRole('list', { name: 'Safety constraints' })).toBeInTheDocument()
  })

  it('keeps blood flow set and blood flow through the circuit as two separate readings', async () => {
    const row = (id: string) =>
      evidence().querySelector(`[data-evidence-id="${id}"] dd`)?.textContent
    const running = render(<BaxterCrrtPractice locale="en" initialCaseId="CRRT-02" />)
    await settle()
    expect(row('therapy')).toBe('CVVHD · 140 mL/min')
    expect(row('actual-flow')).toBe('140 mL/min')
    running.unmount()

    // CRRT-04 opens with its prescription at zero and nothing delivering: the circuit carries a
    // computed zero, shown as zero rather than as missing, under its own label (CRRT-FELLOW-02).
    render(<BaxterCrrtPractice locale="en" initialCaseId="CRRT-04" />)
    await settle()
    expect(row('therapy')).toBe('CVVHD · 0 mL/min')
    expect(row('actual-flow')).toBe('0 mL/min')
    expect(
      evidence().querySelector('[data-evidence-id="actual-flow"]')?.closest('[data-basis]'),
    ).toHaveAttribute('data-basis', 'model')
    expect(
      evidence().querySelector('[data-evidence-id="therapy"]')?.closest('[data-basis]'),
    ).toHaveAttribute('data-basis', 'setting')
  })

  it('puts no fixed or sticky layer over the case on a narrow screen and folds only task detail', async () => {
    render(<BaxterCrrtPractice locale="en" initialCaseId="CRRT-02" />)
    await settle()
    const task = screen.getByRole('region', { name: 'Current task' })
    const toggle = within(task).getByRole('button', { name: 'Show task details' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    // The immediate goal is never folded away.
    expect(within(task).getByText('Immediate goal')).toBeInTheDocument()
    fireEvent.click(toggle)
    expect(within(task).getByRole('button', { name: 'Hide task details' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    // Reference and Evidence are two separately named buttons, not one phrase in a footer.
    const material = within(task).getByRole('group', { name: 'Hint and reference material' })
    expect(within(material).getByRole('button', { name: 'Reference' })).toBeInTheDocument()
    expect(within(material).getByRole('button', { name: 'Evidence' })).toBeInTheDocument()
    const footer = document.querySelector('[data-critical-care-activity-shell] > footer')!
    expect(within(footer as HTMLElement).queryByRole('button')).toBeNull()
  })
})

describe('CRRT Help (F-09)', () => {
  function stateFingerprint() {
    return {
      clock: clock(),
      completed: screen.queryAllByRole('button', { name: 'Completed' }).length,
      heading: document.getElementById('practice-case-heading')?.textContent,
      storage: window.localStorage.getItem(BAXTER_CRRT_PROGRESS_STORAGE_KEY),
      evidence: evidence().textContent,
    }
  }

  it('opens a visible dialog with the case hint from the mouse, closes on Escape and returns focus', async () => {
    render(<BaxterCrrtPractice locale="en" initialCaseId="CRRT-11" />)
    await settle()
    fireEvent.click(screen.getAllByRole('button', { name: 'Perform' })[0])
    fireEvent.click(screen.getByRole('button', { name: '+1 hr' }))
    const before = stateFingerprint()

    const help = screen.getByRole('button', { name: 'Help' })
    help.focus()
    fireEvent.click(help)
    const dialog = await screen.findByRole('dialog', { name: 'Help for this case' })
    const hint = getBaxterCrrtCase('CRRT-11').hintLadder[0]!.text
    expect(within(dialog).getByText(hint)).toBeVisible()
    expect(dialog).toHaveAccessibleDescription(/Opening help changes nothing in your run/)
    expect(dialog.contains(document.activeElement)).toBe(true)

    fireEvent.keyDown(dialog, { key: 'Escape' })
    await settle()
    expect(screen.queryByRole('dialog', { name: 'Help for this case' })).toBeNull()
    expect(document.activeElement).toBe(help)

    // Nothing about the run, the case identity or the stored record moved.
    expect(stateFingerprint()).toEqual(before)
    expect(clock()).toMatch(/^60 min/)
    expect(push).not.toHaveBeenCalled()
  })

  it('opens from the keyboard and closes from its own Close button, back to Help', async () => {
    render(<BaxterCrrtPractice locale="en" initialCaseId="CRRT-02" />)
    await settle()
    const help = screen.getByRole('button', { name: 'Help' })
    help.focus()
    // A native button activates on Enter/Space as a click; the dialog must be the result.
    fireEvent.keyDown(help, { key: 'Enter' })
    fireEvent.click(help)
    const dialog = await screen.findByRole('dialog', { name: 'Help for this case' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    await settle()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(help)
  })

  it('is available on the Challenge with the same no-change guarantee', async () => {
    render(<BaxterCrrtAssess locale="en" />)
    await settle()
    const storage = window.localStorage.getItem(BAXTER_CRRT_PROGRESS_STORAGE_KEY)
    fireEvent.click(screen.getByRole('button', { name: 'Help' }))
    const dialog = await screen.findByRole('dialog', { name: 'Help for this case' })
    expect(within(dialog).queryByText(/^Cases$/)).toBeNull()
    fireEvent.keyDown(dialog, { key: 'Escape' })
    await settle()
    expect(window.localStorage.getItem(BAXTER_CRRT_PROGRESS_STORAGE_KEY)).toBe(storage)
  })
})

describe('CRRT Cases control (F-09)', () => {
  it('shows the current case location as a place in a list, not a score', async () => {
    render(<BaxterCrrtPractice locale="en" initialCaseId="CRRT-02" />)
    await settle()
    const nav = screen.getByRole('navigation', { name: 'Practice cases' })
    expect(within(nav).getByText('Core case 2 of 10')).toBeInTheDocument()
    expect(nav).toHaveTextContent('not a measure of progress or a requirement')
    expect(within(nav).getByRole('combobox', { name: 'Cases' })).toHaveValue('CRRT-02')
  })

  it('steps to the previous and next core case through the canonical URL', async () => {
    render(<BaxterCrrtPractice locale="en" initialCaseId="CRRT-02" />)
    await settle()
    const nav = screen.getByRole('navigation', { name: 'Practice cases' })
    fireEvent.click(within(nav).getByRole('button', { name: /^Next case: / }))
    expect(push).toHaveBeenLastCalledWith({
      pathname: '/baxter-crrt/practice',
      query: { case: baxterCrrtCoreCaseIds[2] },
    })
    await settle()
    fireEvent.click(
      within(screen.getByRole('navigation', { name: 'Practice cases' })).getByRole('button', {
        name: /^Previous case: /,
      }),
    )
    expect(push).toHaveBeenLastCalledWith({
      pathname: '/baxter-crrt/practice',
      query: { case: baxterCrrtCoreCaseIds[1] },
    })
  })

  it('states the ends of each list instead of showing an unexplained disabled button', async () => {
    const first = render(
      <BaxterCrrtPractice locale="en" initialCaseId={baxterCrrtCoreCaseIds[0]} />,
    )
    await settle()
    let nav = screen.getByRole('navigation', { name: 'Practice cases' })
    expect(within(nav).getByText('First core case')).toBeInTheDocument()
    expect(within(nav).queryByRole('button', { name: /^Previous case/ })).toBeNull()
    first.unmount()

    render(<BaxterCrrtPractice locale="en" initialCaseId={baxterCrrtCoreCaseIds.at(-1)} />)
    await settle()
    nav = screen.getByRole('navigation', { name: 'Practice cases' })
    expect(within(nav).getByText('Core case 10 of 10')).toBeInTheDocument()
    expect(within(nav).getByText('Last core case · more in Cases')).toBeInTheDocument()
  })

  it('places an additional case in its own optional list', async () => {
    const additional = baxterCrrtAdditionalCaseIds[1]
    render(<BaxterCrrtPractice locale="en" initialCaseId={additional} />)
    await settle()
    const nav = screen.getByRole('navigation', { name: 'Practice cases' })
    expect(within(nav).getByText('Additional case 2 of 7 · optional')).toBeInTheDocument()
    fireEvent.click(within(nav).getByRole('button', { name: /^Next case: / }))
    expect(push).toHaveBeenLastCalledWith({
      pathname: '/baxter-crrt/practice',
      query: { case: baxterCrrtAdditionalCaseIds[2] },
    })
  })

  it('keeps one case identity: a route change moves the Cases control with the case', async () => {
    const view = render(<BaxterCrrtPractice locale="en" initialCaseId="CRRT-01" />)
    await settle()
    view.rerender(<BaxterCrrtPractice locale="en" initialCaseId="CRRT-04" />)
    await settle()
    const nav = screen.getByRole('navigation', { name: 'Practice cases' })
    expect(within(nav).getByRole('combobox', { name: 'Cases' })).toHaveValue('CRRT-04')
    expect(within(nav).getByText('Core case 3 of 10')).toBeInTheDocument()
  })

  it('agrees with the navigation model for every practice case', () => {
    for (const [index, id] of baxterCrrtCoreCaseIds.entries()) {
      const place = selectCrrtCaseNavigation(id)
      expect([place.group, place.position, place.total]).toEqual(['core', index + 1, 10])
      expect(place.previousCaseId).toBe(baxterCrrtCoreCaseIds[index - 1] ?? null)
      expect(place.nextCaseId).toBe(baxterCrrtCoreCaseIds[index + 1] ?? null)
    }
    for (const [index, id] of baxterCrrtAdditionalCaseIds.entries()) {
      const place = selectCrrtCaseNavigation(id)
      expect([place.group, place.position, place.total]).toEqual(['additional', index + 1, 7])
    }
  })
})

describe('CRRT role control is a truthful reading perspective (F-22)', () => {
  it('says what it does and keeps the run across repeated switches', async () => {
    render(<BaxterCrrtPractice locale="en" initialCaseId="CRRT-11" />)
    await settle()
    const roles = screen.getByRole('group', { name: 'Reading perspective' })
    expect(roles).toHaveAccessibleDescription(
      /Switching keeps your run: it changes no patient value, device control, action or record, and it is not judged or saved\./,
    )
    // Role change before any action.
    fireEvent.click(within(roles).getByRole('button', { name: 'Prescriber' }))
    expect(clock()).toMatch(/^0 min/)

    fireEvent.click(screen.getAllByRole('button', { name: 'Perform' })[0])
    fireEvent.click(screen.getByRole('button', { name: '+1 hr' }))
    const reassessment = screen.getByRole('group', {
      name: 'Select every reassessment you actually completed',
    })
    fireEvent.click(within(reassessment).getAllByRole('checkbox')[0])
    fireEvent.click(screen.getByRole('button', { name: 'Commit reassessment' }))
    const evidenceBefore = evidence().textContent
    const completed = screen.getAllByRole('button', { name: 'Completed' }).length
    const storage = window.localStorage.getItem(BAXTER_CRRT_PROGRESS_STORAGE_KEY)

    for (const role of ['Operator', 'Both roles', 'Prescriber', 'Operator', 'Both roles']) {
      fireEvent.click(
        within(screen.getByRole('group', { name: 'Reading perspective' })).getByRole('button', {
          name: role,
        }),
      )
      await settle()
      expect(clock()).toMatch(/^60 min/)
      expect(screen.getAllByRole('button', { name: 'Completed' })).toHaveLength(completed)
      expect(evidence().textContent).toBe(evidenceBefore)
    }
    // Only the perspective prompt changed; nothing was recorded for the role.
    expect(window.localStorage.getItem(BAXTER_CRRT_PROGRESS_STORAGE_KEY)).toBe(storage)
    expect(push).not.toHaveBeenCalled()
  })
})
