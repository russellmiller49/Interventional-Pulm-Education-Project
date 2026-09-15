import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { axe } from 'jest-axe'
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { BaxterCrrtLearn } from '../components/BaxterCrrtLearn'
import {
  readProgress,
  createDefaultProgress,
  recordLessonCompletion,
  writeProgress,
} from '../engine/progress'
import { readCrrtSelfPacedProgress } from '../selfPacedProgress'
import { crrtFoundationTasks } from '../content/foundationLessons'

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
      href={
        typeof href === 'string'
          ? href
          : `${href.pathname}?${new URLSearchParams(href.query).toString()}`
      }
      {...rest}
    >
      {children}
    </a>
  ),
}))

function button(name: string | RegExp) {
  return screen.getByRole('button', { name })
}
function next() {
  fireEvent.click(button('Continue'))
}
function selections(names: string[]) {
  for (const name of names) fireEvent.click(button(name))
}
function reviewedObservations() {
  fireEvent.click(button('Review observations and continue'))
}
function answer(label: string | RegExp) {
  fireEvent.click(screen.getByRole('radio', { name: label }))
  fireEvent.click(button('Check reasoning'))
}
function reviewedAnswer() {
  fireEvent.click(button('Review feedback and continue'))
}
function modalities() {
  selections(['SCUF', 'CVVH', 'CVVHD', 'CVVHDF'])
  reviewedObservations()
}
function openLesson(id: string) {
  fireEvent.change(screen.getByRole('combobox', { name: 'CRRT lesson' }), { target: { value: id } })
}

beforeEach(() => {
  window.localStorage.clear()
  window.history.replaceState({}, '', '/en/baxter-crrt/learn?lesson=crrt-indications-modality')
})

describe('rendered CRRT introductory pathway', () => {
  it('keeps focused circuit, question and guided builder surfaces accessible', async () => {
    const view = render(<BaxterCrrtLearn initialLessonId="crrt-indications-modality" />)
    expect(await axe(view.container)).toHaveNoViolations()
    next()
    next()
    modalities()
    expect(await axe(view.container)).toHaveNoViolations()
    answer(/Fluid removal alone/)
    expect(await axe(view.container)).toHaveNoViolations()
    openLesson('crrt-prescription-dosing')
    next()
    fireEvent.click(button(/Continue to Construction/))
    expect(await axe(view.container)).toHaveNoViolations()
    fireEvent.change(screen.getByRole('spinbutton', { name: /^Time not running/ }), {
      target: { value: '' },
    })
    fireEvent.click(button(/Continue to Predicted consequences/))
    expect(await axe(view.container)).toHaveNoViolations()
  })
  it('teaches before a changed-case decision, keeps wrong-response feedback in-session and allows review', async () => {
    render(<BaxterCrrtLearn initialLessonId="crrt-indications-modality" />)
    expect(
      screen.getByRole('heading', { name: 'Two treatment goals, one blood circuit' }),
    ).toBeVisible()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    next()
    next()
    modalities()
    const current = crrtFoundationTasks['crrt-indications-modality']![3]
    expect(screen.queryByText(current.choices![0].feedback)).not.toBeInTheDocument()
    answer(/Fluid removal alone/)
    expect(screen.getByRole('status')).toHaveTextContent(
      current.choices!.find((choice) => choice.id === 'fluid-only')!.feedback,
    )
    expect(readProgress().learnTaskHistory).toBeUndefined()
    expect(readProgress().completedLessonIds).toEqual([])
    reviewedAnswer()
    expect(
      screen.getByRole('heading', { name: 'Apply again: a different fluid goal' }),
    ).toBeVisible()
    answer(/Solute support and zero net CRRT removal/)
    expect(readProgress().completedLessonIds).toEqual([])
    reviewedAnswer()
    expect(readCrrtSelfPacedProgress().visitedLessonIds).toContain('crrt-indications-modality')
    expect(readProgress().learnTaskHistory).toBeUndefined()
  })
  it('restarts all transient state on navigation, history, repeat and reload while retaining history', async () => {
    writeProgress(recordLessonCompletion(createDefaultProgress(), 'crrt-prescription-dosing'))
    const view = render(<BaxterCrrtLearn initialLessonId="crrt-indications-modality" />)
    next()
    next()
    modalities()
    answer(/most mechanisms/)
    expect(readProgress().learnTaskHistory).toBeUndefined()
    openLesson('crrt-prescription-dosing')
    await waitFor(() =>
      expect(screen.getByText(/Historical records remain unchanged/)).toBeInTheDocument(),
    )
    expect(
      screen.getByRole('heading', { name: 'One example, one denominator, one interval' }),
    ).toBeVisible()
    act(() => {
      window.history.replaceState({}, '', '/en/baxter-crrt/learn?lesson=crrt-indications-modality')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(
      screen.getByRole('heading', { name: 'Two treatment goals, one blood circuit' }),
    ).toBeVisible()
    expect(screen.queryByRole('radio', { checked: true })).not.toBeInTheDocument()
    next()
    next()
    modalities()
    answer(/Solute\/acid-base support and fluid management/)
    expect(readProgress().learnTaskHistory).toBeUndefined()
    fireEvent.click(button('Restart lesson'))
    expect(
      screen.getByRole('heading', { name: 'Two treatment goals, one blood circuit' }),
    ).toBeVisible()
    const saved = readProgress()
    view.unmount()
    render(<BaxterCrrtLearn initialLessonId="crrt-indications-modality" />)
    expect(readProgress()).toEqual(saved)
    expect(screen.getByText(/Each visit starts a fresh simulation/)).toBeVisible()
    expect(screen.queryByText('Lesson selection restored')).not.toBeInTheDocument()
  })
  it('walks the circuit, links sensors and formulas, reviews known consequences, then accepts uncertainty', () => {
    render(<BaxterCrrtLearn initialLessonId="crrt-circuit-pressures" />)
    expect(button('Review observations and continue')).toBeDisabled()
    selections([
      'Patient access',
      'Pre-pump segment',
      'Blood pump',
      'Filter',
      'Return segment',
      'Patient return',
    ])
    reviewedObservations()
    selections([
      'Dialysate',
      'Pre-filter replacement',
      'Post-filter replacement',
      'PBP',
      'Effluent',
    ])
    reviewedObservations()
    selections([
      'Access pressure',
      'Filter pressure',
      'Return pressure',
      'Effluent pressure',
      'TMP',
      'Filter pressure drop',
    ])
    expect(button('Review observations and continue')).toBeDisabled()
    fireEvent.click(button('Compare return-side resistance'))
    reviewedObservations()
    expect(
      screen.getByText('Return-line obstruction is fixed for this guided comparison.'),
    ).toBeVisible()
    expect(screen.queryByRole('radio', { name: 'Access catheter' })).not.toBeInTheDocument()
    for (const signal of [
      'Access pressure',
      'Filter pressure',
      'Return pressure',
      'Effluent pressure',
      'TMP',
      'Filter pressure drop',
    ])
      fireEvent.click(
        within(screen.getByRole('group', { name: signal })).getByRole('radio', {
          name: 'Unchanged',
        }),
      )
    fireEvent.click(button('Commit prediction'))
    expect(readProgress().learnTaskHistory).toBeUndefined()
    expect(screen.getByText(/Prediction submitted/)).toBeVisible()
    fireEvent.click(button('Reveal pressure pattern'))
    expect(screen.getByRole('heading', { name: /Obstruction at Return line/i })).toBeVisible()
    expect(readProgress().learnTaskHistory).toBeUndefined()
    fireEvent.click(button('Review pressure comparison and continue'))
    expect(
      screen.queryByText(/The access pressure became more negative while/),
    ).not.toBeInTheDocument()
    answer(/An access-side problem is supported/)
    reviewedAnswer()
    answer(/Assess the patient and inspect the return path/)
    reviewedAnswer()
    expect(readCrrtSelfPacedProgress().visitedLessonIds).toContain('crrt-circuit-pressures')
  })
  it('connects membrane mechanisms, constrained modality paths and isolated fluid comparisons', () => {
    render(<BaxterCrrtLearn initialLessonId="crrt-solute-transport" />)
    selections(['Diffusion', 'Convection', 'Ultrafiltration'])
    reviewedObservations()
    modalities()
    selections([
      'Dialysate +500 mL/h',
      'Post-filter replacement +500 mL/h',
      'Net CRRT removal +100 mL/h',
    ])
    reviewedObservations()
    answer(/Dialysate-supported transport and total effluent/)
    reviewedAnswer()
    answer(/More water crosses the membrane with convective/)
    reviewedAnswer()
    expect(readCrrtSelfPacedProgress().visitedLessonIds).toContain('crrt-solute-transport')
  })
  it('requires a valid entered comparison and reviewed interpretation for actual comparison evidence while navigation remains optional', () => {
    render(<BaxterCrrtLearn initialLessonId="crrt-prescription-dosing" />)
    expect(screen.getByText('21.875 mL/kg/h')).toBeVisible()
    next()
    fireEvent.click(button(/Continue to Construction/))
    const downtime = screen.getByRole('spinbutton', { name: /^Time not running in that window/ })
    fireEvent.change(downtime, { target: { value: '' } })
    fireEvent.click(button(/Continue to Predicted consequences/))
    expect(screen.getByText(/Every predicted consequence is unavailable until/)).toBeVisible()
    expect(readProgress().learnTaskHistory ?? []).toHaveLength(0)
    fireEvent.click(button(/Back to Construction/))
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '6' } })
    fireEvent.click(button(/Continue to Predicted consequences/))
    fireEvent.click(screen.getByRole('radio', { name: /projected average dose fell/ }))
    fireEvent.click(button('Check comparison'))
    expect(screen.getByText(/That comparison is supported/)).toBeVisible()
    expect(readProgress().learnTaskHistory).toBeUndefined()
    expect(readProgress().completedLessonIds).not.toContain('crrt-prescription-dosing')
    fireEvent.click(button('Review comparison and continue'))
    next()
    answer(/^12.5 mL\/kg\/h/)
    reviewedAnswer()
    answer(/^\+600 mL/)
    reviewedAnswer()
    expect(readCrrtSelfPacedProgress().visitedLessonIds).toContain('crrt-prescription-dosing')
  })
})
