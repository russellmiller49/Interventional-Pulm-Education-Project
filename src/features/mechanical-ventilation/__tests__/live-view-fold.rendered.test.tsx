import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { act, cleanup, fireEvent, render } from '@testing-library/react'

import { VentilationStageHost } from '../components/stage/VentilationStageHost'
import { ventilationLearningUnits } from '../content/learningCurriculum'
import {
  chooseStep,
  openConsoleScreen,
  pressClock,
  runFor,
  setConsoleControl,
} from '../test-support/stageHost'

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
function eachListedTask(visit: (row: number) => void) {
  const rows = () => [
    ...document.querySelectorAll<HTMLButtonElement>('[data-task-map] [data-step-list] li button'),
  ]
  const count = rows().length
  for (let row = 0; row < count; row += 1) {
    const button = rows()[row]
    if (!button.disabled) {
      act(() => {
        fireEvent.click(button)
      })
      act(() => jest.advanceTimersByTime(10))
    }
    visit(row)
  }
}
const disclosures = () =>
  [...document.querySelectorAll('[data-teaching-column] > [data-lesson-disclosure]')].map((node) =>
    node.getAttribute('data-lesson-disclosure'),
  )
const liveView = () =>
  document.querySelector<HTMLDetailsElement>('[data-lesson-disclosure="live-view"]')

/**
 * The live view of a section's mechanism has its own name.
 *
 * Measured in November 2026, "More detail" held about 870 words a task, and the one part of it
 * computed from the running patient was the sixth of eight. Opening all of it would have put
 * about 84,000 words on the screens; the live view alone comes out, under its own name, and is
 * open where a result has just been explained.
 */
const WITH_LIVE_VIEW = [
  'lung-protection',
  'expiration-and-air-trapping',
  'triggering-and-cycling',
  'oxygenation-response',
  'ventilation-and-co2',
  'waveform-reading-sequence',
  'dyssynchrony-mechanisms',
  'safety-reassessment-and-human-factors',
  'high-peak-pressure-integration',
]

describe('the live view of the mechanism', () => {
  it.each(ventilationLearningUnits.map((unit) => unit.id))('%s', (unitId) => {
    mount(unitId)
    const expected = WITH_LIVE_VIEW.includes(unitId)
    let open = 0
    let closed = 0
    eachListedTask(() => {
      const fold = liveView()
      if (!expected) {
        expect(fold).toBeNull()
        return
      }
      expect(fold).not.toBeNull()
      // Named for what it is, first of the named parts, and no longer inside "More detail".
      expect(fold!.querySelector('summary')!.textContent).toBe('On this ventilator, right now')
      expect(disclosures()[0]).toBe('live-view')
      expect(fold!.querySelector('[data-teaching-block="panel"]')).not.toBeNull()
      expect(
        document.querySelector(
          '[data-lesson-disclosure="more-detail"] [data-teaching-block="panel"]',
        ),
      ).toBeNull()
      expect(document.querySelectorAll('[data-teaching-block="panel"]')).toHaveLength(1)
      // Open exactly where the step explains a result.
      const explaining =
        document.querySelector('[data-teaching-column]')!.getAttribute('data-teaching-focus') ===
        'reveal'
      expect(fold!.open).toBe(explaining)
      if (fold!.open) open += 1
      else closed += 1
    })
    if (expected) {
      expect(open).toBeGreaterThan(0)
      expect(closed).toBeGreaterThan(0)
    }
  })

  it('leaves the rest of "More detail" where it was', () => {
    mount('lung-protection')
    const more = document.querySelector<HTMLDetailsElement>(
      '[data-lesson-disclosure="more-detail"]',
    )!
    expect(more.open).toBe(false)
    const blocks = [...more.querySelectorAll('[data-teaching-block]')].map((node) =>
      node.getAttribute('data-teaching-block'),
    )
    expect(blocks).toEqual(expect.arrayContaining(['why', 'grammar', 'knob-strip']))
    expect(blocks).not.toContain('panel')
  })
})

describe('driving pressure beside the patient’s weight, in the lung-protection section', () => {
  const readout = () => document.querySelector<HTMLElement>('[data-driving-pressure]')

  it('has no number until an inspiratory hold is acquired, and says so', () => {
    mount('lung-protection')
    act(() => chooseStep(2))
    act(() => jest.advanceTimersByTime(10))
    expect(readout()).toHaveAttribute('data-driving-pressure', 'withheld')
    expect(readout()!.textContent).toBe(
      'Driving pressure: waiting for an inspiratory hold. The plateau on screen is an estimate from the trace.',
    )
    expect(readout()!.closest('[data-pbw-context]')).not.toBeNull()
  })

  it('works it from the acquired plateau once the hold is taken on the quiet patient', () => {
    mount('lung-protection')
    act(() => chooseStep(2))
    act(() => jest.advanceTimersByTime(10))
    setConsoleControl('vtMl', 420)
    openConsoleScreen('tools')
    fireEvent.click(document.getElementById('mv-hold-inspiratory')!)
    pressClock('run')
    runFor(30_000)
    expect(readout()).toHaveAttribute('data-driving-pressure', 'shown')
    const text = readout()!.textContent!
    const [, plateau, totalPeep, value] = text.match(
      /^Driving pressure: plateau (\d+\.\d) − total PEEP (\d+\.\d) = (\d+\.\d) cmH₂O\./,
    )!
    expect(Number(value)).toBeCloseTo(Number(plateau) - Number(totalPeep), 5)
    // The plateau it is worked from is the one the reading tile shows as acquired.
    const tile = document.querySelector('[data-live-readings] [data-metric="plateau"]')!
    expect(tile.querySelector('dd')!.textContent).toContain(`${plateau} cmH₂O`)
  })

  it('is not shown in a section without the patient’s weight card', () => {
    mount('mechanics-load-and-pressure')
    act(() => chooseStep(2))
    act(() => jest.advanceTimersByTime(10))
    expect(readout()).toBeNull()
  })
})
