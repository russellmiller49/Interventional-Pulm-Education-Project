import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'

import { VentilationStageHost } from '../components/stage/VentilationStageHost'
import { breathStopIds } from '../content/breathSpine'
import { ventilationLocationItemByUnit, ventilationSettingSort } from '../content/stageItems'
import { ventilationStageLesson } from '../content/stageLessons'
import { ventilationExperimentByUnit } from '../content/learningExperiments'
import { parseLabProgress, VENTILATION_LAB_STORAGE_KEY } from '../engine/learningLab'

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
  localStorage.clear()
  jest.useFakeTimers()
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
  }
  Element.prototype.scrollIntoView = jest.fn()
})
afterEach(() => jest.useRealTimers())

const boot = () => act(() => jest.advanceTimersByTime(10))
const simulate = (seconds: number) => act(() => jest.advanceTimersByTime(seconds * 1000))
const nowCard = () => document.querySelector('[data-now-card]') as HTMLElement
const primary = () => document.querySelector('[data-now-primary]') as HTMLButtonElement | null
const stageId = () => document.querySelector('[data-stage]')?.getAttribute('data-stage')

describe('the walk', () => {
  it('visits four synchronized intervals in order before independent application', () => {
    render(<VentilationStageHost unitId="waveform-anatomy" />)
    boot()
    expect(stageId()).toBe(ventilationStageLesson('waveform-anatomy').steps[0].id)
    for (const [index, stopId] of breathStopIds.entries()) {
      expect(document.querySelector('[data-walk-stop]')?.getAttribute('data-walk-stop')).toBe(
        stopId,
      )
      expect(document.querySelector('[data-guided-stop]')?.getAttribute('data-guided-stop')).toBe(
        stopId,
      )
      expect(primary()!.textContent).toMatch(index === 3 ? /Finish the walk/ : /Next stop/)
      fireEvent.click(primary()!)
    }
    expect(within(nowCard()).getByText(/All four stops visited/)).toBeInTheDocument()
    fireEvent.click(primary()!)
    expect(stageId()).toBe(ventilationStageLesson('waveform-anatomy').steps[1].id)
  })
})

describe('answering where on the breath', () => {
  const unitId = 'triggering-and-cycling'
  const location = ventilationLocationItemByUnit.get(unitId)!

  it('places one independent radio group beside unlabelled aligned traces and withholds findings', () => {
    render(<VentilationStageHost unitId={unitId} />)
    boot()
    fireEvent.click(primary()!) // separate normal reference → independent tracing
    const answer = document.querySelector('[data-location-choices]')!
    const radios = within(answer as HTMLElement).getAllByRole('radio')
    expect(radios).toHaveLength(4)
    expect(radios.map((radio) => (radio as HTMLInputElement).name)).toEqual(
      Array(4).fill(radios[0].getAttribute('name')),
    )
    expect(document.querySelector('[data-breath-map]')).toBeNull()
    expect(document.querySelector('[data-phase-band]')).toBeNull()
    // Nothing says which is right, and the findings are not yet available.
    expect(document.querySelector('[data-breath-map-outcome]')).toBeNull()
    expect(document.querySelector('[data-bedside-findings]')).toBeNull()
    expect(document.querySelector('[data-normal-timing]')).toBeNull()
    expect(primary()).toBeDisabled()

    // Choose from a pin's row (the same radio the pin labels), commit, and read the verdict.
    const keyed = location.item.correctChoiceIds[0]
    fireEvent.click(
      within(answer as HTMLElement).getByRole('radio', {
        name: location.item.choices.find((c) => c.id === keyed)!.label,
      }),
    )
    fireEvent.click(primary()!)
    const verdict = document.querySelector('[data-answer-verdict]')!
    expect(verdict.getAttribute('data-verdict-outcome')).toBe('correct')
    expect(document.querySelector('[data-location-choices]')).toBeNull()
    expect(verdict.textContent).toContain(location.item.choices.find((c) => c.id === keyed)!.label)
    const saved = parseLabProgress(localStorage.getItem(VENTILATION_LAB_STORAGE_KEY))
    expect(saved.units[unitId]?.evidence[0].location).toBe(keyed)

    // Continue opens the round's prediction with its baseline rebuilt.
    fireEvent.click(primary()!)
    expect(stageId()).toBe(ventilationStageLesson(unitId).steps[1].id)
    expect(document.querySelector('[data-prediction-choices]')).not.toBeNull()
  })

  it('explains a wrong location after commitment without reoffering its answer form', () => {
    render(<VentilationStageHost unitId={unitId} />)
    boot()
    fireEvent.click(primary()!) // separate normal reference → independent tracing
    const answer = document.querySelector('[data-location-choices]') as HTMLElement
    const wrong = location.item.choices.find((c) => c.plausibility !== 'best')!
    fireEvent.click(within(answer).getByRole('radio', { name: wrong.label }))
    fireEvent.click(primary()!)
    expect(
      document.querySelector('[data-answer-verdict]')?.getAttribute('data-verdict-outcome'),
    ).toBe('not-correct')
    expect(document.querySelector('[data-how-to-distinguish]')).not.toBeNull()
  })
})

describe('the settings sort', () => {
  const unitId = 'controls-and-goals'

  it('comes after the first reveal, commits as a set, and grades each row in words', () => {
    const lesson = ventilationStageLesson(unitId)
    const [first] = ventilationExperimentByUnit.get(unitId)!.rounds
    render(<VentilationStageHost unitId={unitId} />)
    boot()
    fireEvent.click(primary()!) // Recognize → Predict
    fireEvent.click(within(nowCard()).getByRole('radio', { name: first.choices[first.correct] }))
    fireEvent.click(primary()!) // commit
    fireEvent.click(primary()!) // → Act
    fireEvent.change(document.getElementById('mv-quick-vtMl')!, {
      target: { value: '500' },
    })
    fireEvent.click(primary()!) // → Observe
    simulate(first.seconds + 1)
    fireEvent.click(primary()!) // Compare → Interpret
    fireEvent.click(within(nowCard()).getByRole('radio', { name: 'Rose' }))
    fireEvent.click(primary()!) // submit observation
    fireEvent.click(primary()!) // → Explain
    fireEvent.click(primary()!) // → Sort
    const sortIndex = lesson.steps.findIndex((step) => step.interaction.kind === 'sort')
    expect(stageId()).toBe(lesson.steps[sortIndex].id)
    expect(primary()).toBeDisabled()
    for (const row of ventilationSettingSort.rows) {
      fireEvent.change(document.getElementById(`mv-sort-${row.id}`)!, {
        target: { value: row.id === 'exhaled-vt' ? 'set' : row.origin },
      })
    }
    fireEvent.click(primary()!)
    const verdicts = [...document.querySelectorAll('[data-sort-verdict]')]
    expect(verdicts).toHaveLength(ventilationSettingSort.rows.length)
    expect(
      document.querySelector('[data-sort-row="exhaled-vt"]')?.getAttribute('data-outcome'),
    ).toBe('not-correct')
    expect(document.querySelector('[data-sort-row="set-vt"]')?.getAttribute('data-outcome')).toBe(
      'correct',
    )
    expect(
      document.querySelector('[data-sort-row="exhaled-vt"] [data-sort-verdict]')?.textContent,
    ).toMatch(/^Not correct\./)
    const saved = parseLabProgress(localStorage.getItem(VENTILATION_LAB_STORAGE_KEY))
    expect(saved.units[unitId]?.evidence[0].sort?.['exhaled-vt']).toBe('set')
    fireEvent.click(primary()!)
    expect(stageId()).toBe(lesson.steps[lesson.transferPredictionStepIndex].id)
  })
})

describe('a round whose action is a pause', () => {
  const unitId = 'breathing-with-support'

  it('is named as a freeze, guides the reading while the traces are frozen, and reveals what they showed', () => {
    const lesson = ventilationStageLesson(unitId)
    const [first] = ventilationExperimentByUnit.get(unitId)!.rounds
    const act = lesson.steps[2]
    expect(act.title).toBe('Pause or inspect expiration')
    expect(act.title).not.toMatch(/change/i)
    expect(act.guide?.maneuver).toBe('pause')
    expect(lesson.steps[3].title).toBe('Read the captured traces')

    render(<VentilationStageHost unitId={unitId} />)
    boot()
    fireEvent.click(primary()!) // Recognize → Predict
    fireEvent.click(within(nowCard()).getByRole('radio', { name: first.choices[first.correct] }))
    fireEvent.click(primary()!) // commit
    fireEvent.click(primary()!) // → Act
    expect(stageId()).toBe(act.id)
    // The teaching pane opens a guide for the act rather than a stack of folded headings.
    const guide = document.querySelector('[data-teaching-block="guide"]')!
    expect(guide).not.toBeNull()
    expect(guide.getAttribute('data-maneuver')).toBe('pause')
    expect(guide.textContent).toMatch(/Pausing only freezes the display/)
    expect(guide.closest('details')).toBeNull()
    // No readings panel for a pause — nothing is going to move.
    expect(document.querySelector('[data-live-readings]')).toBeNull()
    // The step list does not call Observe done before the learner has reached it.
    expect(
      document
        .querySelector('[data-step-list] [data-step-id="' + lesson.steps[3].id + '"]')
        ?.getAttribute('data-step-state'),
    ).not.toBe('done')

    // Capture with the linked keyboard-equivalent cursor; a timed Pause click is unnecessary.
    const cursor = screen.getByRole('slider', { name: 'Captured breath time cursor' })
    fireEvent.change(cursor, {
      target: { value: Math.floor(Number(cursor.getAttribute('max')) * 0.3) },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Use this captured interval' }))
    expect(within(nowCard()).getByText(/Done\. A breath interval is captured/)).toBeInTheDocument()
    fireEvent.click(primary()!) // → Observe
    expect(stageId()).toBe(lesson.steps[3].id)
    expect(primary()!.textContent).toMatch(/Continue to the reading/)
    fireEvent.click(primary()!) // → Interpret
    fireEvent.click(
      within(nowCard()).getByRole('radio', { name: 'Outward flow with falling volume' }),
    )
    fireEvent.click(primary()!)
    fireEvent.click(primary()!) // → Explain
    const reading = document.querySelector('[data-frozen-reading]')!
    expect(reading).not.toBeNull()
    expect(reading.textContent).toMatch(/below zero — gas is leaving/)
    expect(reading.textContent).toMatch(/falling/)
    expect(document.querySelector('[data-before-after]')).toBeNull()
  })
})
