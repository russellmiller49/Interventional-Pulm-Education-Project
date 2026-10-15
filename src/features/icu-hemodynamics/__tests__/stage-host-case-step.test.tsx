import { act, cleanup, fireEvent, screen } from '@testing-library/react'

import type { HemodynamicAction, HemodynamicSimulationState } from '../engine/types'
import {
  ICU_HEMODYNAMICS_SELF_PACED_STORAGE_KEY,
  parseSelfPacedRecord,
} from '../engine/selfPacedProgress'
import {
  clickPrimary,
  currentStepId,
  installDom,
  mountSection,
  nowPrimary,
  skipCase,
} from '../test-support/stageHarness'

/*
 * Every TICK any engine on the page takes, by whose patient it is: the section's teaching patient
 * runs in `learn` mode, a case in `practice` mode. The real reducer still does the work.
 */
const mockTicks: string[] = []
jest.mock('../engine/reducer', () => {
  const actual = jest.requireActual('../engine/reducer')
  return {
    ...actual,
    icuHemodynamicsReducer: (state: HemodynamicSimulationState, action: HemodynamicAction) => {
      if (action.type === 'TICK') mockTicks.push(state.mode)
      return actual.icuHemodynamicsReducer(state, action)
    },
  }
})

const push = jest.fn()
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
  useRouter: () => ({ push, replace: jest.fn() }),
}))

beforeEach(() => {
  localStorage.clear()
  mockTicks.length = 0
  push.mockClear()
  jest.useFakeTimers()
  installDom()
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as never
})
afterEach(() => {
  cleanup()
  jest.useRealTimers()
})

function tick(seconds: number) {
  act(() => {
    jest.advanceTimersByTime(seconds * 1000)
  })
}

function storedRecord() {
  return parseSelfPacedRecord(localStorage.getItem(ICU_HEMODYNAMICS_SELF_PACED_STORAGE_KEY))
}

function taskButtons() {
  return [...document.querySelectorAll<HTMLButtonElement>('[data-step-list] button')]
}

/** Open the section's last task — its case — from the task list. */
function openCaseStep(sectionId: string, beforeOpening?: () => void) {
  const { lesson } = mountSection(sectionId)
  beforeOpening?.()
  fireEvent.click(taskButtons()[lesson.caseStepIndex])
  expect(currentStepId()).toBe(lesson.steps[lesson.caseStepIndex].id)
  return lesson
}

function nowSecondary(): HTMLButtonElement | null {
  return document.querySelector<HTMLButtonElement>('[data-now-card] [data-now-secondary]')
}

function startCase() {
  clickPrimary()
  // The case's device check settles on the next turn of the clock.
  tick(0.05)
}

function completion() {
  return document.querySelector('[data-stage-completion]')
}

/**
 * The case as a section's last task (owner direction, 2026-10-14): Start the case runs it inside
 * the section on its own engine, Skip finishes the section without it, and Exit case comes back to
 * the section with its completion card. Two simulations never tick at once.
 */
describe('the case step', () => {
  it('pauses the section’s patient, so the case’s engine is the only one ticking', () => {
    const lesson = openCaseStep('pressure-system', () => {
      // Before the case step, the section's patient ticks.
      tick(1)
      expect(mockTicks.length).toBeGreaterThan(0)
      expect(new Set(mockTicks)).toEqual(new Set(['learn']))
    })
    expect(lesson.caseStepIndex).toBe(lesson.steps.length - 1)

    mockTicks.length = 0
    tick(2)
    expect(mockTicks).toEqual([])
    expect((window as { __hemodynamicsStage?: unknown }).__hemodynamicsStage).toBeUndefined()
    // None of the section's patient is on the page: no monitor, no catheter map, no docks.
    expect(document.querySelector('[data-focused-monitor]')).toBeNull()
    expect(document.querySelector('[data-catheter-map]')).toBeNull()
    expect(document.querySelector('[data-dock]')).toBeNull()
    expect(document.querySelector('[data-now-card] p')?.textContent).toBe(
      `Task ${lesson.steps.length} of ${lesson.steps.length} · Apply`,
    )
    expect(
      screen.getByRole('heading', { name: 'Apply it: The numbers do not fit the patient' }),
    ).toBeInTheDocument()
    expect(nowPrimary()?.textContent).toBe('Start the case')
    expect(nowSecondary()?.textContent).toBe('Skip the case · finish the section')

    startCase()
    expect(document.querySelector('[data-now-card] [data-case-flow]')).toHaveAttribute(
      'data-embedded',
      'last-task',
    )
    expect(document.querySelector('[data-case-strip]')?.textContent).toBe(
      'Case · The numbers do not fit the patient · the last task of Section 2',
    )
    mockTicks.length = 0
    tick(2)
    expect(mockTicks.length).toBeGreaterThan(0)
    expect(new Set(mockTicks)).toEqual(new Set(['practice']))

    // The case drives: the card's own actions are gone and the section's tasks wait for it.
    expect(nowPrimary()).toBeNull()
    expect(nowSecondary()).toBeNull()
    expect(document.querySelector('[data-now-back]')).toBeNull()
    expect(taskButtons().every((button) => button.disabled)).toBe(true)
    expect(completion()).toBeNull()
  })

  it('finishes the section on Skip, without opening the case', () => {
    openCaseStep('catheter-advancement')
    skipCase()
    expect(completion()).not.toBeNull()
    expect(document.querySelector('[data-case-flow]')).toBeNull()
    expect(storedRecord()?.reviewedSectionIds).toEqual(['catheter-advancement'])
    expect(storedRecord()?.openedCaseIds).toEqual([])
    expect(document.querySelector('[data-now-status]')?.textContent).toMatch(/^Section finished/)
    // A learner who skipped can still run it.
    expect(nowSecondary()?.textContent).toBe('Start the case')
    expect(completion()?.querySelector('[data-next-section="pawp-capture"]')?.textContent).toMatch(
      /^Continue to the next section: Listening through a stopped branch/,
    )
  })

  it('comes back from Exit case to the section with its completion card', () => {
    const lesson = openCaseStep('pressure-system')
    startCase()
    expect(storedRecord()?.openedCaseIds).toEqual(['HD-08'])
    fireEvent.click(screen.getByRole('button', { name: 'Exit case' }))

    expect(document.querySelector('[data-case-flow]')).toBeNull()
    expect(currentStepId()).toBe(lesson.steps[lesson.caseStepIndex].id)
    expect(completion()).not.toBeNull()
    expect(document.activeElement).toBe(completion())
    expect(storedRecord()?.reviewedSectionIds).toEqual(['pressure-system'])
    expect(push).not.toHaveBeenCalled()
    expect(nowSecondary()?.textContent).toBe('Run the case again')

    // Still on the case step: nothing ticks. Looking back at an earlier task resumes the section's
    // patient where it stopped.
    mockTicks.length = 0
    tick(1)
    expect(mockTicks).toEqual([])
    fireEvent.click(taskButtons()[lesson.caseStepIndex - 1])
    mockTicks.length = 0
    tick(1)
    expect(mockTicks.length).toBeGreaterThan(0)
    expect(new Set(mockTicks)).toEqual(new Set(['learn']))
  })

  it('offers section eight’s second case on its completion card, run the same way', () => {
    openCaseStep('derived-hemodynamics')
    skipCase()
    const second = screen.getByRole('button', {
      name: 'A second case on this mechanism: Warm shock with a low diastolic pressure',
    })
    fireEvent.click(second)
    tick(0.05)
    expect(document.querySelector('[data-case-flow]')).toHaveAttribute(
      'data-embedded',
      'second-case',
    )
    expect(
      screen.getByRole('heading', {
        name: 'A second case on this mechanism: Warm shock with a low diastolic pressure',
      }),
    ).toBeInTheDocument()
    expect(completion()).toBeNull()
    expect(storedRecord()?.openedCaseIds).toEqual(['HD-02'])
    fireEvent.click(screen.getByRole('button', { name: 'Exit case' }))
    expect(document.querySelector('[data-case-flow]')).toBeNull()
    expect(completion()).not.toBeNull()
  })

  it('leaves the orientation and the capstone without a case step', () => {
    const orientation = mountSection('why-measure').lesson
    expect(orientation.caseStepIndex).toBe(-1)
    expect(skipButtonAnywhere()).toBeNull()
    cleanup()

    const capstone = mountSection('pac-signal-validation').lesson
    expect(capstone.caseStepIndex).toBe(-1)
    fireEvent.click(taskButtons()[capstone.steps.length - 1])
    clickPrimary()
    expect(completion()).not.toBeNull()
    expect(completion()?.querySelector('[data-second-case]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Open the applied case' }))
    expect(push).toHaveBeenCalledWith('/icu-hemodynamics/assess')
  })
})

function skipButtonAnywhere() {
  return (
    [...document.querySelectorAll('button')].find((button) =>
      /Skip the case/.test(button.textContent ?? ''),
    ) ?? null
  )
}
