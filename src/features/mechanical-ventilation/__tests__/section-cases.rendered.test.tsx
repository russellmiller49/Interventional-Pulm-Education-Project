import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'

import MechanicalVentilationCaseActivityV2 from '../components/MechanicalVentilationCaseActivityV2'
import { VentilationStageHost } from '../components/stage/VentilationStageHost'
import { isVentilationCaseLive, ventilationSectionLabel } from '../content/learnerMap'
import { ventilationLearningUnits } from '../content/learningCurriculum'
import {
  VENTILATION_SECTION_CASE_TASK_TITLE,
  ventilationCaseHomeUnitId,
  ventilationSectionCase,
  ventilationSectionCases,
} from '../content/sectionCases'
import { ventilationSectionSpec } from '../content/sectionSpecs'
import { ventilationPresentedStepIndexes, ventilationStageLesson } from '../content/stageLessons'
import { VENTILATION_SELF_PACED_KEY } from '../engine/selfPacedProgress'

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string; query?: Record<string, string> }
    children: ReactNode
  }) => (
    <a
      href={
        typeof href === 'string'
          ? href
          : `${href.pathname}${href.query ? `?${new URLSearchParams(href.query).toString()}` : ''}`
      }
      {...props}
    >
      {children}
    </a>
  ),
  useRouter: () => ({ push: jest.fn() }),
}))

beforeEach(() => {
  localStorage.clear()
  jest.useFakeTimers()
})
afterEach(() => {
  cleanup()
  jest.useRealTimers()
})

function mount(unitId: string) {
  render(<VentilationStageHost unitId={unitId} />)
  act(() => jest.advanceTimersByTime(10))
}
const rows = () => [...document.querySelectorAll<HTMLLIElement>('[data-step-list] li')]
const card = () => document.querySelector('[data-now-card]') as HTMLElement
function press(name: string | RegExp, scope: HTMLElement = document.body) {
  act(() => {
    fireEvent.click(within(scope).getByRole('button', { name }))
  })
  act(() => jest.advanceTimersByTime(10))
}
/** Open the section's own last task from the task list. */
function openLastOwnTask() {
  const own = rows().filter((row) => !row.hasAttribute('data-case-row'))
  act(() => {
    fireEvent.click(own.at(-1)!.querySelector('button')!)
  })
  act(() => jest.advanceTimersByTime(10))
}

/**
 * The case is the section's last task.
 *
 * Until November 2026 a section ended with a link to Practice: the case ran on its own page and
 * there was no way back. Each case is now the last task of the section Practice already says it
 * builds on, run inside the section. The pairing itself is unchanged.
 */
describe('which section ends on which case', () => {
  it('is the module’s own mechanism pairing, each case in the first section that pairs it', () => {
    expect(ventilationSectionCases().map((entry) => [entry.sectionNumber, entry.caseId])).toEqual([
      [4, 'MV-13'],
      [6, 'MV-01'],
      [7, 'MV-05'],
      [8, 'MV-07'],
      [11, 'MV-08'],
      [12, 'MV-11'],
      [13, 'MV-15'],
    ])
  })

  it('places no case in two sections and none that is held as a worked explanation', () => {
    const cases = ventilationSectionCases()
    expect(new Set(cases.map((entry) => entry.caseId)).size).toBe(cases.length)
    for (const entry of cases) {
      expect(isVentilationCaseLive(entry.caseId)).toBe(true)
      expect(ventilationSectionSpec(entry.unitId).practicePairing).toEqual({
        kind: 'mechanism-match',
        caseId: entry.caseId,
      })
      expect(ventilationCaseHomeUnitId(entry.caseId)).toBe(entry.unitId)
    }
  })

  it('leaves the other seven sections as they were', () => {
    const without = ventilationLearningUnits
      .filter((unit) => !ventilationSectionCase(unit.id))
      .map((unit) => ventilationLearningUnits.indexOf(unit) + 1)
    // 1, 2, 3 and 5 pair a case only as "next in this part of the pathway"; 9, 10 and 14 pair a
    // case that an earlier section already ends on.
    expect(without).toEqual([1, 2, 3, 5, 9, 10, 14])
  })
})

describe('a section that ends on its case', () => {
  const unitId = 'expiration-and-air-trapping'
  const entry = ventilationSectionCase(unitId)!
  const own = ventilationPresentedStepIndexes(ventilationStageLesson(unitId)).length

  it('lists the case as its last task, under a name that gives nothing away', () => {
    mount(unitId)
    expect(rows()).toHaveLength(own + 1)
    const last = rows().at(-1)!
    expect(last).toHaveAttribute('data-case-row', 'MV-05')
    expect(last.textContent).toBe(`${own + 1}. ${VENTILATION_SECTION_CASE_TASK_TITLE}`)
    // The case's title names what the section's first question asks about.
    expect(document.querySelector('[data-step-list]')!.textContent).not.toMatch(
      /hyperinflation|COPD/i,
    )
    expect(card().textContent).toContain(`Task 1 of ${own + 1}`)
    expect(document.querySelector('[data-section-case]')).toBeNull()
  })

  it('goes on from its own last task to the case, and can pass it over', () => {
    mount(unitId)
    openLastOwnTask()
    expect(card().textContent).toContain(`Task ${own} of ${own + 1}`)
    expect(document.querySelector('[data-section-completion]')).toBeNull()
    expect(within(card()).getByRole('button', { name: 'Continue to the case' })).toBeEnabled()
    expect(within(card()).getByRole('button', { name: 'Skip the case' })).toBeEnabled()
  })

  it('runs the case inside the section, on its own patient, and returns to the section finished', () => {
    mount(unitId)
    openLastOwnTask()
    press('Continue to the case', card())

    const view = document.querySelector('[data-section-case="MV-05"]') as HTMLElement
    expect(view).not.toBeNull()
    // The section's heading and bar stay; its two panes and its patient's console give way.
    expect(document.querySelector('h1')!.textContent).toBe('Does the breath have time to finish?')
    expect(document.querySelector('[data-flow-teaching]')).toBeNull()
    expect(document.querySelector('[data-console-surface]')).toBeNull()
    expect(document.querySelector('[data-stage-frame]')).toHaveAttribute('data-layout', 'case')
    expect(document.querySelector('[data-case-kicker]')!.textContent).toBe(
      `Task ${own + 1} of ${own + 1} · ${VENTILATION_SECTION_CASE_TASK_TITLE}`,
    )
    expect(view.querySelector('[data-case-strip]')!.textContent).toBe(
      `Case · the last task of ${ventilationSectionLabel(unitId)}`,
    )
    expect(view.querySelector('h2[data-case-title]')!.textContent).toBe(entry.title)
    expect(view.querySelectorAll('h1')).toHaveLength(0)
    // One console: the case's.
    expect(document.querySelectorAll('[data-device]').length).toBeLessThanOrEqual(1)
    expect(document.querySelector('[data-ventilation-console]')).toBeNull()
    // The way back is where Practice has its links to other cases.
    expect(within(view).queryByRole('link', { name: /another case/i })).toBeNull()
    expect(within(view).getByRole('button', { name: 'Leave the case' })).toBeEnabled()
    expect(
      within(view).getByRole('button', { name: 'Finish the case · back to Section 7' }),
    ).toBeEnabled()

    // The case is recorded as opened, as Practice records it; the learner's place is the section.
    const saved = JSON.parse(localStorage.getItem(VENTILATION_SELF_PACED_KEY)!)
    expect(saved.visited).toEqual(expect.arrayContaining(['MV-05', unitId]))
    expect(saved.location).toMatchObject({ section: 'learn', id: unitId })

    press('Leave the case', view)
    expect(document.querySelector('[data-section-case]')).toBeNull()
    expect(document.querySelector('[data-flow-teaching]')).not.toBeNull()
    const done = document.querySelector('[data-section-completion]') as HTMLElement
    expect(done.textContent).toContain('Section finished')
    expect(done.querySelector('[data-section-case-outcome]')).toHaveAttribute(
      'data-section-case-outcome',
      'run',
    )
    expect(within(done).getByRole('button', { name: 'Run the case again' })).toBeEnabled()
    expect(
      within(card()).getByRole('button', {
        name: `Continue to ${ventilationSectionLabel('triggering-and-cycling')}`,
      }),
    ).toBeEnabled()
    expect(rows().at(-1)!.textContent).toContain('· done')
  })

  it('finishes the section without the case when it is skipped, and keeps the case one press away', () => {
    mount(unitId)
    openLastOwnTask()
    press('Skip the case', card())
    const done = document.querySelector('[data-section-completion]') as HTMLElement
    expect(done.querySelector('[data-section-case-outcome]')).toHaveAttribute(
      'data-section-case-outcome',
      'skipped',
    )
    expect(document.querySelector('[data-section-case]')).toBeNull()
    press('Open the case', done)
    expect(document.querySelector('[data-section-case="MV-05"]')).not.toBeNull()
  })

  it('opens the case from the task list at any point, and leaving it lands on the last task', () => {
    mount(unitId)
    act(() => {
      fireEvent.click(rows().at(-1)!.querySelector('button')!)
    })
    act(() => jest.advanceTimersByTime(10))
    const view = document.querySelector('[data-section-case="MV-05"]') as HTMLElement
    expect(view).not.toBeNull()
    press('Leave the case', view)
    expect(card().textContent).toContain(`Task ${own} of ${own + 1}`)
    expect(document.querySelector('[data-section-completion]')).not.toBeNull()
  })

  it('closes the case when the section is restarted', () => {
    mount(unitId)
    openLastOwnTask()
    press('Continue to the case', card())
    press('Restart section')
    expect(document.querySelector('[data-section-case]')).toBeNull()
    expect(card().textContent).toContain(`Task 1 of ${own + 1}`)
  })
})

describe('a section whose paired case an earlier section ends on', () => {
  it('keeps its line and link to the case, and says where the case is run', () => {
    mount('ventilation-and-co2')
    expect(rows().some((row) => row.hasAttribute('data-case-row'))).toBe(false)
    openLastOwnTask()
    const done = document.querySelector('[data-section-completion]') as HTMLElement
    expect(done.querySelector('[data-practice-pairing]')!.textContent).toBe(
      `A case on this mechanism: COPD: dynamic hyperinflation with ineffective efforts. It is also the last task of ${ventilationSectionLabel('expiration-and-air-trapping')}.`,
    )
    expect(done.querySelector('a')).toHaveAttribute(
      'href',
      '/mechanical-ventilation/practice?case=MV-05',
    )
    expect(screen.queryByRole('button', { name: 'Continue to the case' })).toBeNull()
  })
})

describe('Practice', () => {
  it('still opens the same case on its own page, with its links to other cases', () => {
    render(
      <MechanicalVentilationCaseActivityV2
        caseId="MV-05"
        deviceId="hamilton-c6"
        mode="practice"
        section="practice"
      />,
    )
    act(() => jest.advanceTimersByTime(10))
    expect(document.querySelector('h1[data-case-title]')!.textContent).toBe(
      'COPD: dynamic hyperinflation with ineffective efforts',
    )
    expect(document.querySelector('[data-case-strip]')).toBeNull()
    expect(document.querySelector('[data-section-case]')).toBeNull()
    expect(screen.getAllByRole('link', { name: /Continue to another case/ }).length).toBe(2)
    expect(screen.queryByRole('button', { name: 'Leave the case' })).toBeNull()
  })
})
