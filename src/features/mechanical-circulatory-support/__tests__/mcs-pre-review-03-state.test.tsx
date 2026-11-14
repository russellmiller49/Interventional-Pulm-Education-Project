/**
 * MCS-PRE-REVIEW-03 — presentation never moves the model.
 *
 * Every operation this slice made more prominent or added — opening the monitor, the Sections
 * drawer, the trend table, the case's Current task and jump links, and since the text-left layout
 * the simulator's All device controls (which took over from the run details) — and the ones a
 * learner does to the page itself — changing the theme, resizing, moving focus, enlarging the text —
 * is performed on a live section and a live case, and after each one nothing that belongs to the
 * model or the learner's progress has moved: the simulated time, the step, the chosen answer, the
 * revealed explanation, the action and inspection records, and what is saved in the browser.
 *
 * The clock is faked and never advanced, so any change of simulated time can only have come from
 * the operation itself.
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { McsSimulationState } from '../engine'

let mockMonitorState: McsSimulationState | null = null
jest.mock('../components/McsMonitor', () => {
  const actual = jest.requireActual('../components/McsMonitor')
  const { createElement } = jest.requireActual('react')
  return {
    ...actual,
    McsMonitor: (props: { state: McsSimulationState }) => {
      mockMonitorState = props.state
      return createElement(actual.McsMonitor, props)
    },
  }
})

jest.mock('@/i18n/navigation', () =>
  jest.requireActual('../test-support/mcsWorkbenchStubs').navigationModule(),
)
jest.mock('../components/McsAnatomy3D', () =>
  jest.requireActual('../test-support/mcsWorkbenchStubs').anatomyModule(),
)

import { McsWorkbench } from '../components/McsWorkbench'
import { mcsSectionLearningContractById } from '../content/sectionLearningContracts'
import {
  currentStepId,
  mountSection,
  nowCard,
  setupMcsStage,
  teardownMcsStage,
} from '../test-support/mcsStage'

beforeEach(() => {
  mockMonitorState = null
  setupMcsStage()
  jest.useFakeTimers()
})
afterEach(() => {
  cleanup()
  teardownMcsStage()
  document.documentElement.classList.remove('dark', 'light')
  document.documentElement.style.fontSize = ''
})

interface Snapshot {
  readonly modelState: string
  readonly clock: string
  readonly step: string
  readonly checked: readonly string[]
  readonly explanationShown: boolean
  readonly worked: number
  readonly stored: string
  readonly monitorTime: string
}

function snapshot(): Snapshot {
  expect(mockMonitorState).not.toBeNull()
  return {
    modelState: JSON.stringify(mockMonitorState),
    // The clock bar carries whether the circulation runs and its simulated time.
    clock: `${document.querySelector('[data-clock-bar]')?.getAttribute('data-clock-state') ?? ''} · ${
      document.querySelector('[data-clock-time]')?.textContent ?? ''
    }`,
    step: currentStepId(),
    checked: [...document.querySelectorAll<HTMLInputElement>('input[type="radio"]:checked')].map(
      (radio) => `${radio.name}=${radio.value}`,
    ),
    explanationShown: document.querySelector('[data-provided-explanation]') !== null,
    worked: document.querySelectorAll('[data-worked-through]').length,
    stored: JSON.stringify({ ...window.localStorage }),
    monitorTime:
      document.querySelector('[aria-label="Synchronized mechanical-support bedside monitor"] time')
        ?.textContent ?? '',
  }
}

function toggle(details: HTMLDetailsElement) {
  fireEvent.click(details.querySelector('summary')!)
  // jsdom does not toggle <details> on a summary click; set it the way the browser would.
  details.open = !details.open
  fireEvent(details, new Event('toggle'))
}

describe('a live Learn section: presentation operations change nothing the model or progress owns', () => {
  function prepared() {
    const sectionId = 'iabp-efficacy-limits'
    mountSection(sectionId, 'predict')
    // A chosen answer and a revealed explanation, so their preservation is tested too.
    const contract = mcsSectionLearningContractById.get(sectionId)!
    const choice = contract.predictionItem.choices[1]
    fireEvent.click(
      within(
        document.querySelector<HTMLElement>('fieldset[data-prediction-choices]')!,
      ).getByLabelText(choice.label),
    )
    fireEvent.click(within(nowCard()).getByRole('button', { name: 'Show answer' }))
    const taken = snapshot()
    // Not vacuous: there is an answer, an explanation and a running clock to lose.
    expect(taken.checked).toHaveLength(1)
    expect(taken.explanationShown).toBe(true)
    expect(taken.monitorTime).toMatch(/\d+\.\d s/)
    expect(taken.clock).toMatch(/^running · Time \d+\.\d s$/)
    return taken
  }

  const operations: readonly [string, () => void][] = [
    [
      'closing and reopening the monitor the step opened',
      () => {
        const monitor = screen
          .getByRole('region', { name: /Synchronized mechanical-support bedside monitor/ })
          .closest('details')!
        toggle(monitor)
        toggle(monitor)
      },
    ],
    [
      'opening and closing All device controls',
      () => {
        const button = within(
          document.querySelector<HTMLElement>('[data-full-exploration]')!,
        ).getByRole('button', { name: 'All device controls' })
        fireEvent.click(button)
        expect(button).toHaveAttribute('aria-expanded', 'true')
        fireEvent.click(button)
        expect(button).toHaveAttribute('aria-expanded', 'false')
      },
    ],
    [
      'opening the Sections drawer and closing it with Escape',
      () => {
        const drawer = document.querySelector<HTMLDetailsElement>('[data-sections-drawer]')!
        toggle(drawer)
        fireEvent.keyDown(drawer, { key: 'Escape' })
      },
    ],
    [
      'opening every other disclosure on the page, then closing them',
      () => {
        const all = [...document.querySelectorAll<HTMLDetailsElement>('main details')].filter(
          (details) => !details.hasAttribute('data-sections-drawer'),
        )
        for (const details of all) toggle(details)
        for (const details of all) toggle(details)
      },
    ],
    [
      'switching the site theme to dark and back',
      () => {
        document.documentElement.classList.add('dark')
        document.documentElement.classList.remove('dark')
        document.documentElement.classList.add('light')
      },
    ],
    [
      'resizing the window',
      () => {
        act(() => {
          window.dispatchEvent(new Event('resize'))
        })
      },
    ],
    [
      'enlarging the root text',
      () => {
        document.documentElement.style.fontSize = '200%'
        act(() => {
          window.dispatchEvent(new Event('resize'))
        })
      },
    ],
    [
      'moving focus through the header, the Now card and the clock bar',
      () => {
        for (const element of [
          document.querySelector<HTMLElement>('[data-sections-drawer] summary'),
          document.querySelector<HTMLElement>('[data-stage-help]'),
          nowCard().querySelector<HTMLElement>('button'),
          document.querySelector<HTMLElement>('[data-now-primary]'),
          document.querySelector<HTMLElement>('[data-clock-run]'),
        ]) {
          element?.focus()
          if (element) fireEvent.blur(element)
        }
      },
    ],
  ]

  it.each(operations)('%s', (_name, operate) => {
    const before = prepared()
    operate()
    expect(snapshot()).toEqual(before)
  })

  it('control: a real model operation — stepping one cardiac cycle — does move the clock', () => {
    const before = prepared()
    const clockBar = document.querySelector<HTMLElement>('[data-clock-bar]')!
    fireEvent.click(within(clockBar).getByRole('button', { name: 'One cardiac cycle' }))
    const after = snapshot()
    expect(after.monitorTime).not.toBe(before.monitorTime)
    // Stepping one cycle pauses the circulation where the step ends.
    expect(after.clock).toMatch(/^paused · Paused at \d+\.\d s$/)
  })

  it('all of them in sequence', () => {
    const before = prepared()
    for (const [, operate] of operations) operate()
    expect(snapshot()).toEqual(before)
  })
})

describe('a live case: the case page’s disclosures and jump links change nothing', () => {
  function caseSnapshot() {
    expect(mockMonitorState).not.toBeNull()
    return {
      modelState: JSON.stringify(mockMonitorState),
      response: document.querySelector('#mcs-case-response')?.textContent ?? '',
      time:
        document.querySelector(
          '[aria-label="Synchronized mechanical-support bedside monitor"] time',
        )?.textContent ?? '',
      checked: [...document.querySelectorAll<HTMLInputElement>('input[type="radio"]:checked')].map(
        (radio) => radio.value,
      ),
      complete: [...document.querySelectorAll('[data-complete="true"]')].length,
      stored: JSON.stringify({ ...window.localStorage }),
    }
  }

  it('Current task, the jump links, the map and every disclosure', () => {
    render(<McsWorkbench section="practice" initialActivityId="IABP-01" />)
    const group = screen.getByRole('group', { name: /Optional prediction/ })
    fireEvent.click(within(group).getAllByRole('radio')[1])
    const before = caseSnapshot()
    const currentTask = [...document.querySelectorAll<HTMLDetailsElement>('details')].find(
      (details) => details.querySelector('summary')?.textContent?.includes('Current task'),
    )!
    toggle(currentTask)
    toggle(currentTask)
    for (const link of document.querySelectorAll<HTMLAnchorElement>('a[href^="#mcs-case-"]'))
      fireEvent.click(link)
    for (const details of document.querySelectorAll<HTMLDetailsElement>('main details')) {
      toggle(details)
      toggle(details)
    }
    act(() => {
      window.dispatchEvent(new Event('resize'))
    })
    expect(caseSnapshot()).toEqual(before)
  })
})
