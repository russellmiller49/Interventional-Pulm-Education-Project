import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { AnchorHTMLAttributes, ComponentProps, ReactNode } from 'react'

import { BaxterCrrtAssess } from '../components/BaxterCrrtAssess'
import { BaxterCrrtPractice } from '../components/BaxterCrrtPractice'
import type { CrrtCasePlayer } from '../components/CrrtCasePlayer'
import { BAXTER_CRRT_PROGRESS_STORAGE_KEY } from '../engine/progress'

let mockPlayer: ComponentProps<typeof CrrtCasePlayer>
// Observe real state at the component boundary; retain the actual player and reducer.
jest.mock('../components/CrrtCasePlayer', () => {
  const actual = jest.requireActual('../components/CrrtCasePlayer')
  return {
    ...actual,
    CrrtCasePlayer: (props: ComponentProps<typeof CrrtCasePlayer>) => {
      mockPlayer = props
      return <actual.CrrtCasePlayer {...props} />
    },
  }
})
jest.mock('@/features/critical-care/analytics', () => ({ recordCriticalCareEvent: jest.fn() }))
jest.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  Link: ({
    href,
    children,
    ...rest
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string; query?: Record<string, string> }
    children: ReactNode
  }) => (
    <a
      href={typeof href === 'string' ? href : `${href.pathname}?${new URLSearchParams(href.query)}`}
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
const storage = () => window.localStorage.getItem(BAXTER_CRRT_PROGRESS_STORAGE_KEY)
const snapshot = () => JSON.stringify(mockPlayer.session)
beforeEach(() => window.localStorage.clear())

async function openCloseHelp() {
  const before = { session: snapshot(), progress: storage(), url: window.location.href }
  const help = screen.getByRole('button', { name: 'Help' })
  help.focus()
  fireEvent.click(help)
  const dialog = await screen.findByRole('dialog', { name: 'Help for this case' })
  expect(
    within(dialog).getByText(mockPlayer.session.caseDefinition.hintLadder[0]!.text),
  ).toBeVisible()
  fireEvent.keyDown(dialog, { key: 'Escape' })
  await settle()
  expect(document.activeElement).toBe(help)
  expect({ session: snapshot(), progress: storage(), url: window.location.href }).toEqual(before)
}

it.each(['practice', 'assess'])(
  'Help preserves the complete %s state, including committed answers and machine draft',
  async (mode) => {
    const component =
      mode === 'practice' ? <BaxterCrrtPractice initialCaseId="CRRT-11" /> : <BaxterCrrtAssess />
    const view = render(component)
    await settle()
    await openCloseHelp()
    act(() => mockPlayer.dispatch({ type: 'ENTER_PRECOMMIT_REASONING_PHASE', phase: 'predict' }))
    await openCloseHelp()
    const definition = mockPlayer.session.caseDefinition
    act(() =>
      mockPlayer.dispatch({
        type: 'COMMIT_PREDICTION',
        prediction: {
          goalOptionId: definition.goalOptions[0].id,
          mechanismOptionId: definition.mechanismOptions[0].id,
          controlOptionIds: [definition.controlOptions[0].id],
          responseOptionId: definition.responseOptions[0].id,
          reassessmentOptionIds: [definition.reassessmentOptions[0].id],
        },
      }),
    )
    expect(mockPlayer.session.prediction).not.toBeNull()
    act(() =>
      mockPlayer.dispatch({
        type: 'DEVICE_ACTION',
        action: { type: 'SET_PRESCRIPTION_VALUE', field: 'bloodFlowMlMin', value: 155 },
      }),
    )
    fireEvent.click(screen.getAllByRole('button', { name: 'Perform' })[0])
    fireEvent.click(screen.getByRole('button', { name: '+1 hr' }))
    const checks = screen.getByRole('group', {
      name: 'Select every reassessment you actually completed',
    })
    fireEvent.click(within(checks).getAllByRole('checkbox')[0])
    fireEvent.click(screen.getByRole('button', { name: 'Commit reassessment' }))
    expect(mockPlayer.session.reassessment.committed).toBe(true)
    await openCloseHelp()
    view.rerender(component)
    await openCloseHelp()
    for (const label of [
      'Operator',
      'Prescriber',
      'Both roles',
      'Operator',
      'Prescriber',
      'Both roles',
    ]) {
      const before = mockPlayer.session
      const bytes = storage()
      fireEvent.click(
        within(screen.getByRole('group', { name: 'Reading perspective' })).getByRole('button', {
          name: label,
        }),
      )
      await settle()
      expect(mockPlayer.session).toEqual({
        ...before,
        roleLens: mockPlayer.session.roleLens,
        simulation: { ...before.simulation, roleLens: mockPlayer.session.roleLens },
      })
      expect(storage()).toBe(bytes)
      await openCloseHelp()
    }
    if (mode === 'practice') {
      view.rerender(<BaxterCrrtPractice initialCaseId="CRRT-02" />)
      await settle()
      expect(mockPlayer.session.caseDefinition.id).toBe('CRRT-02')
      await openCloseHelp()
    }
  },
)
