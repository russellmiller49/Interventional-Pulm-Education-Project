import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { cleanup, fireEvent } from '@testing-library/react'

import { peripheralImagingSectionIds } from '../content/pathway'
import { imagingStageLesson } from '../content/stageLessons'
import {
  clickPrimary,
  clickSkip,
  currentStepId,
  goalStates,
  installDom,
  mountSection,
  nowPrimary,
  nowSecondary,
  nowSkip,
  nowStatus,
  setRange,
} from '../test-support/stageHarness'

jest.mock(
  '../components/suite/ImagingSuitePane',
  () =>
    jest.requireActual<typeof import('../test-support/SuiteTestDouble')>(
      '../test-support/SuiteTestDouble',
    ).suitePaneDouble,
)
jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string }
    children: ReactNode
  }) => (
    <a href={typeof href === 'string' ? href : href.pathname} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}))

beforeEach(() => {
  jest.useFakeTimers()
  localStorage.clear()
  installDom()
})
afterEach(() => {
  cleanup()
  jest.useRealTimers()
})

function advanceTo(sectionId: Parameters<typeof mountSection>[0], kind: string) {
  const { lesson } = mountSection(sectionId)
  for (let guard = 0; guard < lesson.steps.length; guard++) {
    const step = lesson.steps.find((candidate) => candidate.id === currentStepId())!
    if (step.interaction.kind === kind) return { lesson, step }
    if (step.interaction.kind === 'read') clickPrimary()
    else clickSkip()
  }
  throw new Error(`No ${kind} step in ${sectionId}`)
}

/*
 * PI-FELLOW-02, the rendered side of reports 2.9, 2.13 and 2.3 (AI-assisted fellow walkthrough,
 * PDF pp.17, 19 and 21). The geometry — what is on screen together — is held in the browser suite;
 * these hold the structure that geometry depends on, and the self-paced contract around it.
 */
/*
 * Owner feedback, 2026-10-11 (slide 5): the text column of a hands-on step was an empty box, with
 * the checklist folded into the control dock. The checklist now has one home, the task card in the
 * text column, with what to do and what to watch.
 */
describe('the checklist of a hands-on step is in the text column', () => {
  it('prints the step’s goals once, in the task card, under what to do', () => {
    advanceTo('good-image', 'lab-task')
    const card = document.querySelector('[data-text-column] [data-task-card]')
    expect(card).not.toBeNull()
    expect(card!.querySelector('[data-task-lead]')?.textContent?.length).toBeGreaterThan(40)
    expect(card!.querySelectorAll('[data-step-goals] li').length).toBeGreaterThan(0)
    // Not a second copy beside the controls.
    expect(document.querySelector('[data-suite-goals]')).toBeNull()
    expect(document.querySelectorAll('[data-step-goals]')).toHaveLength(1)
    expect(nowStatus()).toMatch(/checklist/)
    expect(nowStatus()).not.toMatch(/listed (below|with the controls)/)
  })

  it.each(peripheralImagingSectionIds)(
    'never leaves the text column of %s empty on any step',
    (sectionId) => {
      const { lesson } = mountSection(sectionId)
      for (let guard = 0; guard < lesson.steps.length; guard++) {
        const column = document.querySelector('[data-text-column]')
        expect(column?.textContent?.trim().length ?? 0).toBeGreaterThan(0)
        if (currentStepId() === lesson.steps.at(-1)!.id) break
        const primary = nowPrimary()
        if (primary && !primary.disabled) fireEvent.click(primary)
        else clickSkip()
      }
    },
  )

  it('closes the walk with the six components and the one thing left to do', () => {
    const { lesson } = advanceTo('chain-walk', 'walk')
    for (let stop = 0; stop < 6; stop++) clickPrimary()
    expect(currentStepId()).toBe(lesson.steps[1].id)
    const column = document.querySelector('[data-text-column]')!
    expect(column.querySelectorAll('[data-walk-recap] li')).toHaveLength(6)
    expect(column.querySelector('[data-task-lead]')?.textContent).toMatch(/C-arm obliquity/)
    expect(goalStates()).toEqual(['false'])
    setRange('orbit', 20)
    expect(goalStates()).toEqual(['true'])
  })

  it('shows a goal as met from the learner’s own control change, in that same list', () => {
    const { step } = advanceTo('projection', 'lab-task')
    if (step.interaction.kind !== 'lab-task') throw new Error('not a lab task')
    expect(goalStates()).toContain('false')
    const before = goalStates().filter((state) => state === 'true').length
    setRange('orbit', 40)
    expect(goalStates().filter((state) => state === 'true').length).toBeGreaterThan(before)
  })

  it('keeps the step skippable and never makes the list a gate', () => {
    advanceTo('good-image', 'lab-task')
    const stepId = currentStepId()
    expect(nowSkip()).not.toBeNull()
    clickSkip()
    expect(currentStepId()).not.toBe(stepId)
  })

  it('lists nothing as live work while the learner looks back at the step', () => {
    advanceTo('good-image', 'lab-task')
    clickSkip()
    fireEvent.click(document.querySelector('[data-now-back]')!)
    expect(document.querySelector('[data-step-goals]')).toBeNull()
    expect(document.querySelector('[data-step-review]')).not.toBeNull()
  })
})

describe('report 2.9 — the Look-for cue comes before the figure', () => {
  it.each(['projection', 'good-image', 'time', 'tool-confirmation'] as const)(
    'in %s',
    (sectionId) => {
      mountSection(sectionId)
      const lesson = imagingStageLesson(sectionId)
      // Find the first demonstration that renders a cue.
      for (let guard = 0; guard < lesson.steps.length; guard++) {
        if (document.querySelector('[data-look-for]')) break
        clickPrimary()
      }
      const cue = document.querySelector('[data-look-for]')!
      const pane = document.querySelector('[data-lesson-demonstration] [data-suite-scene]')!
      expect(cue).not.toBeNull()
      expect(pane).not.toBeNull()
      expect(cue.compareDocumentPosition(pane) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(cue.textContent).toMatch(/^Look for…/)
    },
  )
})

describe('report 2.3 — the component walk names itself to the layout', () => {
  it('marks the walk step, keeps its text and its way out, and drops the mark afterwards', () => {
    advanceTo('chain-walk', 'walk')
    const shell = document.querySelector('[data-imaging-flow]')!
    expect(shell.getAttribute('data-step-kind')).toBe('walk')
    expect(document.querySelector('[data-walk-stop]')).not.toBeNull()
    expect(nowSkip()?.textContent).toBe('Skip the walk')
    const first = document.querySelector('[data-walk-stop]')!.getAttribute('data-walk-stop')
    clickPrimary()
    expect(document.querySelector('[data-walk-stop]')!.getAttribute('data-walk-stop')).not.toBe(
      first,
    )
    clickSkip()
    expect(shell.getAttribute('data-step-kind')).not.toBe('walk')
  })
})

describe('the explanation stays a first-class option on a check', () => {
  it('is offered before any answer, with the check action natively disabled beside it', () => {
    advanceTo('chain-walk', 'prediction')
    const check = document.querySelector<HTMLButtonElement>('[data-now-primary]')!
    expect(check.disabled).toBe(true)
    expect(nowSecondary()?.textContent).toBe('Show the explanation')
    expect(nowSecondary()?.disabled).toBe(false)
    expect(nowSkip()).not.toBeNull()
  })
})
