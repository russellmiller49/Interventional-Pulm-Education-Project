/**
 * MCS-PRE-REVIEW-03 — presentation never moves the model.
 *
 * Every operation this slice made more prominent or added — opening the monitor, the run details,
 * the Sections drawer, the trend table, the case's Current task and jump links — and the ones a
 * learner does to the page itself — changing the theme, resizing, moving focus, enlarging the text —
 * is performed on a live section and a live case, and after each one nothing that belongs to the
 * model or the learner's progress has moved: the simulated time, the step, the chosen answer, the
 * revealed explanation, the action and inspection records, and what is saved in the browser.
 *
 * The clock is faked and never advanced, so any change of simulated time can only have come from
 * the operation itself.
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'

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
  readonly identity: string
  readonly step: string
  readonly checked: readonly string[]
  readonly explanationShown: boolean
  readonly worked: number
  readonly stored: string
  readonly monitorTime: string
}

function snapshot(): Snapshot {
  return {
    // The identity line carries the run and its simulated time; the seed sits in Run details.
    identity: `${document.querySelector('[data-session-identity]')?.textContent ?? ''} ${
      document.querySelector('[data-run-details] p')?.textContent?.match(/Seed \d+/)?.[0] ?? ''
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
    fireEvent.click(within(nowCard()).getByRole('button', { name: 'Show explanation' }))
    const taken = snapshot()
    // Not vacuous: there is an answer, an explanation, a clock and a seed to lose.
    expect(taken.checked).toHaveLength(1)
    expect(taken.explanationShown).toBe(true)
    expect(taken.monitorTime).toMatch(/\d+\.\d s/)
    expect(taken.identity).toMatch(/Seed \d+/)
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
      'opening and closing Run details',
      () => {
        const details = document.querySelector<HTMLDetailsElement>('[data-run-details]')!
        toggle(details)
        toggle(details)
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
      'moving focus through the step bar, the header and the Now card',
      () => {
        for (const element of [
          document.querySelector<HTMLElement>('[data-step-bar-continue]'),
          document.querySelector<HTMLElement>('[data-sections-drawer] summary'),
          document.querySelector<HTMLElement>('[data-stage-help]'),
          nowCard().querySelector<HTMLElement>('button'),
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
    const playback = [...document.querySelectorAll<HTMLDetailsElement>('main details')].find(
      (details) => details.querySelector('summary')?.textContent === 'Display playback',
    )!
    toggle(playback)
    fireEvent.click(within(playback).getByRole('button', { name: 'Step one cardiac cycle' }))
    expect(snapshot().monitorTime).not.toBe(before.monitorTime)
  })

  it('all of them in sequence', () => {
    const before = prepared()
    for (const [, operate] of operations) operate()
    expect(snapshot()).toEqual(before)
  })
})

describe('a live case: the case page’s disclosures and jump links change nothing', () => {
  function caseSnapshot() {
    return {
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
