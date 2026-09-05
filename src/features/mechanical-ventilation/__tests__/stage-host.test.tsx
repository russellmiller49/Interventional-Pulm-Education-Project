import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'

import { VentilationStageHost } from '../components/stage/VentilationStageHost'
import { ventilationExperimentByUnit } from '../content/learningExperiments'
import { ventilationStageLesson } from '../content/stageLessons'
import { parseLabProgress, VENTILATION_LAB_STORAGE_KEY } from '../engine/learningLab'

const pushes: unknown[] = []
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
  useRouter: () => ({ push: (target: unknown) => pushes.push(target), replace: jest.fn() }),
}))

beforeEach(() => {
  localStorage.clear()
  pushes.length = 0
  jest.useFakeTimers()
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
  }
  Element.prototype.scrollIntoView = jest.fn()
})
afterEach(() => {
  jest.useRealTimers()
})

function boot() {
  act(() => {
    jest.advanceTimersByTime(10)
  })
}

function simulate(seconds: number) {
  act(() => {
    jest.advanceTimersByTime(seconds * 1000)
  })
}

function nowCard() {
  return document.querySelector('[data-now-card]') as HTMLElement
}

function nowPrimary() {
  return document.querySelector('[data-now-primary]') as HTMLButtonElement | null
}

function stageId() {
  return document.querySelector('[data-stage]')?.getAttribute('data-stage')
}

function pressPrimary(label: RegExp) {
  const button = nowPrimary()
  expect(button).not.toBeNull()
  expect(button!.textContent).toMatch(label)
  expect(button).toBeEnabled()
  fireEvent.click(button!)
}

function choose(label: string) {
  fireEvent.click(within(nowCard()).getByRole('radio', { name: label }))
}

describe('the ventilation lesson stage', () => {
  const unitId = 'mechanics-load-and-pressure'
  const lesson = ventilationStageLesson(unitId)
  const [first, second] = ventilationExperimentByUnit.get(unitId)!.rounds

  it('opens on the first step with the console running, the map lit, and nothing revealed', () => {
    render(<VentilationStageHost unitId={unitId} />)
    boot()
    expect(stageId()).toBe(lesson.steps[0].id)
    expect(within(nowCard()).getByText(/Step 1 of 8 · Recognize/)).toBeInTheDocument()
    expect(document.querySelector('[data-ventilation-console]')).not.toBeNull()
    expect(document.querySelector('[data-breath-map]')?.getAttribute('data-lit')).toBe(
      'inspiration',
    )
    // Post-commitment teaching is not in the document before the prediction.
    for (const rationale of first.rationales) expect(screen.queryByText(rationale)).toBeNull()
    expect(document.querySelector('[data-teaching-block="grammar"]')).toBeNull()
    expect(document.querySelector('[data-teaching-block="method"]')).toBeNull()
    // Unreached rows show phase and number only.
    const rows = document.querySelectorAll('[data-step-list] [data-step-state="locked"]')
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) expect(row.textContent).toMatch(/Step \d/)
    expect(
      document.querySelector('[data-stage-sources]')?.getAttribute('data-stage-sources-claims'),
    ).toBe('false')
  })

  it('walks the whole section: predict, act, watch, explain, then the transfer, and records completion', () => {
    render(<VentilationStageHost unitId={unitId} />)
    boot()

    // Recognize → Predict. The baseline is rebuilt and the controls lock.
    pressPrimary(/Continue/)
    expect(stageId()).toBe(lesson.steps[1].id)
    expect(
      document.querySelector('[data-ventilation-console]')?.getAttribute('data-controls-locked'),
    ).toBe('true')
    expect(screen.getByText(/settings are locked while you decide/)).toBeInTheDocument()
    expect(nowPrimary()).toBeDisabled()

    // Commit the keyed answer; the verdict states the outcome and the controls unlock.
    choose(first.choices[first.correct])
    pressPrimary(/Commit my prediction/)
    const verdict = document.querySelector('[data-answer-verdict]')!
    expect(verdict.getAttribute('data-verdict-outcome')).toBe('correct')
    expect(verdict.textContent).toMatch(/^Correct\./)
    expect(stageId()).toBe(lesson.steps[1].id)
    expect(
      document.querySelector('[data-stage-sources]')?.getAttribute('data-stage-sources-claims'),
    ).toBe('true')
    pressPrimary(/Continue/)

    // Act: no primary until the engine holds the change.
    expect(stageId()).toBe(lesson.steps[2].id)
    expect(nowPrimary()).toBeNull()
    const goals = document.querySelectorAll('[data-step-goals] li')
    expect(goals.length).toBe(2)
    fireEvent.change(screen.getByRole('slider', { name: /Patient resistance/ }), {
      target: { value: '2' },
    })
    expect(document.querySelectorAll('[data-step-goals] li[data-met="true"]').length).toBe(1)
    fireEvent.click(screen.getByRole('button', { name: /Perform inspiratory hold/ }))
    simulate(6)
    expect(document.querySelectorAll('[data-step-goals] li[data-met="true"]').length).toBe(2)
    pressPrimary(/Continue/)

    // Observe: compare unlocks only once the interval has elapsed.
    expect(stageId()).toBe(lesson.steps[3].id)
    expect(nowPrimary()).toBeDisabled()
    simulate(first.seconds + 1)
    pressPrimary(/Compare before and after/)

    // Explain: the verdict, the before-and-after, the explanation, the grammar row and the strip.
    expect(stageId()).toBe(lesson.steps[4].id)
    expect(document.querySelector('[data-before-after]')).not.toBeNull()
    expect(screen.getByText(first.explanation)).toBeInTheDocument()
    expect(
      document.querySelector('[data-teaching-block="grammar"] tr[data-highlight="true"]'),
    ).not.toBeNull()
    expect(document.querySelector('[data-teaching-block="knob-strip"]')).not.toBeNull()
    expect(document.querySelector('[data-teaching-block="method"]')).not.toBeNull()
    pressPrimary(/Continue to a new setup/)

    // Transfer: predict again in the new setup, do it and watch, then what changed.
    expect(stageId()).toBe(lesson.steps[5].id)
    expect(
      document.querySelector('[data-ventilation-console]')?.getAttribute('data-controls-locked'),
    ).toBe('true')
    choose(second.choices[second.correct])
    pressPrimary(/Commit my prediction/)
    expect(
      document.querySelector('[data-answer-verdict]')?.getAttribute('data-verdict-outcome'),
    ).toBe('correct')
    pressPrimary(/Continue/)
    expect(stageId()).toBe(lesson.steps[6].id)
    fireEvent.change(screen.getByRole('slider', { name: /Patient compliance/ }), {
      target: { value: '0.5' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Perform inspiratory hold/ }))
    simulate(6 + second.seconds + 1)
    pressPrimary(/Compare before and after/)
    expect(stageId()).toBe(lesson.steps[7].id)
    expect(screen.getByText(second.explanation)).toBeInTheDocument()
    pressPrimary(/Finish this section/)

    // Completion: recorded in the saved record, offered onward.
    const completion = document.querySelector('[data-stage-completion]')!
    expect(completion).not.toBeNull()
    expect(
      within(completion as HTMLElement).getByRole('button', { name: /Apply this in Practice/ }),
    ).toBeInTheDocument()
    const saved = parseLabProgress(localStorage.getItem(VENTILATION_LAB_STORAGE_KEY))
    expect(saved.units[unitId]?.completedAt).toBeTruthy()
    expect(saved.units[unitId]?.evidence[0].prediction).toBe(first.correct)
    expect(saved.units[unitId]?.evidence[1].prediction).toBe(second.correct)
  })

  it('lets the learner look back without losing the patient, and returns to the live step', () => {
    render(<VentilationStageHost unitId={unitId} />)
    boot()
    pressPrimary(/Continue/)
    choose(first.choices[0])
    pressPrimary(/Commit my prediction/)
    pressPrimary(/Continue/)
    expect(stageId()).toBe(lesson.steps[2].id)
    fireEvent.click(within(nowCard()).getByRole('button', { name: /Back to Predict/ }))
    expect(stageId()).toBe(lesson.steps[1].id)
    expect(within(nowCard()).getByText(/looking back/)).toBeInTheDocument()
    // The recap says what was chosen; the controls are not re-offered.
    expect(within(nowCard()).getByText(new RegExp(first.choices[0]))).toBeInTheDocument()
    pressPrimary(/Return to step 3/)
    expect(stageId()).toBe(lesson.steps[2].id)
  })

  it('restores a saved section on the step it was left, paused', () => {
    const { unmount } = render(<VentilationStageHost unitId={unitId} />)
    boot()
    pressPrimary(/Continue/)
    choose(first.choices[first.correct])
    pressPrimary(/Commit my prediction/)
    pressPrimary(/Continue/)
    fireEvent.change(screen.getByRole('slider', { name: /Patient resistance/ }), {
      target: { value: '2' },
    })
    simulate(2)
    unmount()

    render(<VentilationStageHost unitId={unitId} />)
    boot()
    expect(stageId()).toBe(lesson.steps[2].id)
    expect(
      document
        .querySelector('[data-ventilation-transport] [data-paused]')
        ?.getAttribute('data-paused'),
    ).toBe('true')
    expect(document.querySelectorAll('[data-step-goals] li[data-met="true"]').length).toBe(1)
    // The prediction survived the reload and is not asked again.
    fireEvent.click(within(nowCard()).getByRole('button', { name: /Back to Predict/ }))
    expect(
      within(nowCard()).getByText(new RegExp(first.choices[first.correct])),
    ).toBeInTheDocument()
  })

  it('restarts the section from nothing', () => {
    render(<VentilationStageHost unitId={unitId} />)
    boot()
    pressPrimary(/Continue/)
    choose(first.choices[0])
    pressPrimary(/Commit my prediction/)
    fireEvent.click(screen.getByRole('button', { name: 'Restart section' }))
    expect(stageId()).toBe(lesson.steps[0].id)
    expect(document.querySelector('[data-answer-verdict]')).toBeNull()
    const saved = parseLabProgress(localStorage.getItem(VENTILATION_LAB_STORAGE_KEY))
    expect(saved.units[unitId]?.evidence[0].prediction).toBeUndefined()
  })
})
