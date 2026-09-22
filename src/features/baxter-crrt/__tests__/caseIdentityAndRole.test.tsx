import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import { BaxterCrrtPractice } from '../components/BaxterCrrtPractice'
import { BAXTER_CRRT_PROGRESS_STORAGE_KEY } from '../engine/progress'
import { readCrrtSelfPacedProgress } from '../selfPacedProgress'

const push = jest.fn()

jest.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: (...args: unknown[]) => push(...args), replace: jest.fn() }),
  Link: ({
    href,
    children,
    ...rest
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string; query?: Record<string, string> }
    children: ReactNode
  }) => {
    const resolved =
      typeof href === 'string'
        ? href
        : `${href.pathname}?${new URLSearchParams(href.query ?? {}).toString()}`
    return (
      <a href={resolved} {...rest}>
        {children}
      </a>
    )
  },
}))

const casePicker = () =>
  screen.getByRole('combobox', { name: 'Station-grouped core case' }) as HTMLSelectElement
const timeControls = () =>
  document.querySelector('[aria-label="Advance simulated time"]')?.textContent ?? ''

async function settle() {
  // The visit effect runs on a macrotask timer, so a microtask flush is not enough.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

beforeEach(() => {
  window.localStorage.clear()
  push.mockClear()
})

describe('CRRT practice keeps one current case identity', () => {
  it('renders the case the query actually requests when the route changes', async () => {
    const view = render(<BaxterCrrtPractice locale="en" initialCaseId="CRRT-01" />)
    await settle()
    expect(screen.getByRole('heading', { level: 2, name: /Set CRRT priorities/ })).toBeVisible()
    expect(casePicker().value).toBe('CRRT-01')

    // The route adapter re-renders with the new `?case=` value; that is exactly
    // what "Next recommended", a direct link, reload, back and forward do.
    view.rerender(<BaxterCrrtPractice locale="en" initialCaseId="CRRT-02" />)
    await settle()

    expect(
      screen.getByRole('heading', { level: 2, name: /Prioritize hyperkalemia and acidemia/ }),
    ).toBeVisible()
    expect(screen.queryByRole('heading', { level: 2, name: /Set CRRT priorities/ })).toBeNull()
    expect(casePicker().value).toBe('CRRT-02')
    expect(
      screen.getAllByText(/Practice case · Prioritize hyperkalemia and acidemia/).length,
    ).toBeGreaterThan(0)
  })

  it('moves back and forward with browser history without mixing case data', async () => {
    const view = render(<BaxterCrrtPractice locale="en" initialCaseId="CRRT-01" />)
    await settle()
    view.rerender(<BaxterCrrtPractice locale="en" initialCaseId="CRRT-04" />)
    await settle()
    expect(casePicker().value).toBe('CRRT-04')
    // Back.
    view.rerender(<BaxterCrrtPractice locale="en" initialCaseId="CRRT-01" />)
    await settle()
    expect(casePicker().value).toBe('CRRT-01')
    expect(screen.getByRole('heading', { level: 2, name: /Set CRRT priorities/ })).toBeVisible()
    // Forward.
    view.rerender(<BaxterCrrtPractice locale="en" initialCaseId="CRRT-04" />)
    await settle()
    expect(casePicker().value).toBe('CRRT-04')
    expect(screen.queryByRole('heading', { level: 2, name: /Set CRRT priorities/ })).toBeNull()
  })

  it('puts the selected case in the shareable URL, including the additional cases', async () => {
    render(<BaxterCrrtPractice locale="en" initialCaseId="CRRT-01" />)
    await settle()

    fireEvent.change(casePicker(), { target: { value: 'CRRT-05' } })
    await settle()
    expect(casePicker().value).toBe('CRRT-05')
    expect(push).toHaveBeenCalledWith({
      pathname: '/baxter-crrt/practice',
      query: { case: 'CRRT-05' },
    })

    push.mockClear()
    const extras = screen.getByText(/Additional cases \(/).closest('details')!
    const additional = within(extras).getAllByRole('button')[0]
    fireEvent.click(additional)
    await settle()
    expect(push).toHaveBeenCalledTimes(1)
    const pushedCaseId = push.mock.calls[0][0].query.case as string
    expect(pushedCaseId).not.toBe('CRRT-05')
    // The picker keeps the optional case selected, so the URL and the rendered
    // case agree even for an additional case.
    expect(casePicker().value).toBe(pushedCaseId)
    expect(screen.getAllByText(/Optional · /).length).toBeGreaterThan(0)
  })

  it('falls back explicitly for an unavailable case ID instead of mixing case data', async () => {
    render(<BaxterCrrtPractice locale="en" initialCaseId="CRRT-NOT-A-CASE" />)
    await settle()
    expect(
      screen.getByRole('status', { name: 'Requested practice case unavailable' }),
    ).toHaveTextContent(/not available/i)
    expect(casePicker().value).toBe('CRRT-01')
    expect(screen.getByRole('heading', { level: 2, name: /Set CRRT priorities/ })).toBeVisible()
    expect(readCrrtSelfPacedProgress().visitedCaseIds).toEqual(['CRRT-01'])
  })

  it('keeps the run and the visit record when an unrelated query update re-renders the route', async () => {
    const view = render(<BaxterCrrtPractice locale="en" initialCaseId="CRRT-11" />)
    await settle()
    fireEvent.click(screen.getAllByRole('button', { name: 'Perform' })[0])
    fireEvent.click(screen.getByRole('button', { name: '+1 hr' }))
    expect(timeControls()).toMatch(/^60 min/)

    // Same case, new object identity for the prop — an unrelated query change.
    view.rerender(<BaxterCrrtPractice locale="en" initialCaseId={'CRRT-11'} />)
    await settle()

    expect(timeControls()).toMatch(/^60 min/)
    expect(screen.getAllByRole('button', { name: 'Completed' })).toHaveLength(1)
    const stored = JSON.parse(
      window.localStorage.getItem(BAXTER_CRRT_PROGRESS_STORAGE_KEY) ?? 'null',
    )
    expect(stored.selfPaced.visitedCaseIds).toEqual(['CRRT-11'])
  })

  it('starts exactly one fresh session on a real case change', async () => {
    const view = render(<BaxterCrrtPractice locale="en" initialCaseId="CRRT-11" />)
    await settle()
    fireEvent.click(screen.getAllByRole('button', { name: 'Perform' })[0])
    fireEvent.click(screen.getByRole('button', { name: '+1 hr' }))

    view.rerender(<BaxterCrrtPractice locale="en" initialCaseId="CRRT-13" />)
    await settle()

    expect(timeControls()).toMatch(/^0 min/)
    expect(screen.queryAllByRole('button', { name: 'Completed' })).toHaveLength(0)
    expect(readCrrtSelfPacedProgress().visitedCaseIds).toEqual(['CRRT-11', 'CRRT-13'])
  })
})

describe('CRRT role lens is presentational only', () => {
  it('preserves actions, elapsed time and reassessment across a role change', async () => {
    render(<BaxterCrrtPractice locale="en" initialCaseId="CRRT-11" />)
    await settle()

    fireEvent.click(screen.getAllByRole('button', { name: 'Perform' })[0])
    fireEvent.click(screen.getByRole('button', { name: '+1 hr' }))
    const reassessment = screen.getByRole('group', {
      name: 'Select every reassessment you actually completed',
    })
    fireEvent.click(within(reassessment).getAllByRole('checkbox')[0])
    fireEvent.click(screen.getByRole('button', { name: 'Commit reassessment' }))

    expect(timeControls()).toMatch(/^60 min/)
    const completedBefore = screen.getAllByRole('button', { name: 'Completed' }).length

    fireEvent.click(screen.getByRole('button', { name: 'Operator' }))
    await settle()

    expect(screen.getByRole('button', { name: 'Operator' })).toHaveAttribute('aria-pressed', 'true')
    expect(timeControls()).toMatch(/^60 min/)
    expect(screen.getAllByRole('button', { name: 'Completed' })).toHaveLength(completedBefore)

    fireEvent.click(screen.getByRole('button', { name: 'Prescriber' }))
    await settle()
    expect(timeControls()).toMatch(/^60 min/)
    expect(screen.getAllByRole('button', { name: 'Completed' })).toHaveLength(completedBefore)
  })
})
