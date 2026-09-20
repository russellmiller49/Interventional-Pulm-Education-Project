import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { cleanup, fireEvent } from '@testing-library/react'

import { imagingStageLesson } from '../content/stageLessons'
import {
  clickPrimary,
  clickSkip,
  currentStepId,
  goalStates,
  installDom,
  mountSection,
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
describe('report 2.13 — the checklist is printed with the controls', () => {
  it('hands the step’s goals to the suite pane and prints them nowhere else', () => {
    advanceTo('good-image', 'lab-task')
    const inPane = document.querySelectorAll('[data-suite-goals] li')
    expect(inPane.length).toBeGreaterThan(0)
    // Not a second copy on the Now card, which the comparison workbench puts below the fold.
    expect(document.querySelector('[data-step-goals]')).toBeNull()
    expect(nowStatus()).toContain('listed with the controls')
    expect(nowStatus()).not.toMatch(/listed below/)
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
    expect(document.querySelectorAll('[data-suite-goals] li')).toHaveLength(0)
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
