/**
 * Two of the author's rulings of 2026-11-12, rendered.
 *
 * "Neutral titles": the task list prints every task's title from the start, so no title may say
 * what a question in the section is keyed to.
 *
 * "Close them before commitment": Section 7's point to keep in mind ("trapped gas", refused by the
 * section's own deny list) and its shaping note on Part 2's cycle-off wait for the answer they bear
 * on; so does Section 12's note that the rise time "shapes the start of the push". The intrinsic
 * PEEP reading tile and the lung drawing's shading on Part 1 stay, by his ruling on PR #523; they
 * are not tested here.
 */
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { act, cleanup, fireEvent, render, within } from '@testing-library/react'

import {
  VENTILATION_LOCATION_HINT,
  VentilationStageHost,
} from '../components/stage/VentilationStageHost'
import { ventilationUnitById } from '../content/learningCurriculum'
import { ventilationExperimentByUnit } from '../content/learningExperiments'
import { ventilationSectionSpec } from '../content/sectionSpecs'
import { ventilationLocationItemByUnit } from '../content/stageItems'
import { ventilationStageLesson } from '../content/stageLessons'
import { chooseStep } from '../test-support/stageHost'

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
const card = () => within(document.querySelector<HTMLElement>('[data-now-card]')!)
const column = () => document.querySelector<HTMLElement>('[data-teaching-column]')!
const taskList = () => document.querySelector<HTMLElement>('[data-step-list]')!.textContent ?? ''

function commitFirstChoice() {
  const radios = card().getAllByRole('radio')
  fireEvent.click(radios[0])
  fireEvent.click(card().getByRole('button', { name: 'Compare my choice' }))
  act(() => jest.advanceTimersByTime(10))
}

describe('neutral task titles (MV-L2, MV-L7)', () => {
  const retired = [
    ['controls-and-goals', 'Separate oxygen from breath delivery'],
    ['mechanics-load-and-pressure', 'Find the pressure spent moving gas'],
    ['modes-and-breath-delivery', 'Change the lung, keep the volume'],
    ['expiration-and-air-trapping', 'Give expiration time back'],
    ['triggering-and-cycling', 'Trigger sensitivity and unanswered efforts'],
    ['triggering-and-cycling', 'Set the flow trigger to 1.5 L/min'],
    ['waveform-reading-sequence', 'Inspect the circuit and clear the condensate'],
    ['dyssynchrony-mechanisms', 'Set the rise time'],
    ['dyssynchrony-mechanisms', 'Rise time on pressure support'],
    ['dyssynchrony-mechanisms', 'Give expiration time back'],
    ['safety-reassessment-and-human-factors', 'Assess the patient and establish communication'],
  ] as const

  it.each(retired)('%s: the task list no longer shows “%s”', (unitId, title) => {
    mount(unitId)
    expect(taskList()).not.toContain(title)
  })

  it('names no section’s keyed answer in a title, from the first task', () => {
    for (const [unitId, experiment] of ventilationExperimentByUnit) {
      const titles = ventilationStageLesson(unitId)
        .steps.map((step) => step.title.toLowerCase())
        .join(' | ')
      for (const round of experiment.rounds)
        expect(titles).not.toContain(round.choices[round.correct].toLowerCase())
      const location = ventilationLocationItemByUnit.get(unitId)
      if (location) {
        const keyed = location.targets[location.item.correctChoiceIds[0]]
        // The location's key, by the setting that acts there: no "trigger" or "rise time" title.
        const cue = { trigger: /trigger/, inspiration: /rise time|push/ }[keyed as string]
        if (cue) expect(titles).not.toMatch(cue)
      }
    }
  })

  it('Section 13 does not title its first action with the answer to its question', () => {
    const lesson = ventilationStageLesson('safety-reassessment-and-human-factors')
    expect(lesson.steps.map((step) => step.title)).toContain(
      'Act at the bedside, then watch the patient',
    )
  })
})

describe('Section 7: closed before the commitment (MV-L6)', () => {
  const unitId = 'expiration-and-air-trapping'
  const boundary = ventilationUnitById.get(unitId)!.boundary!
  const shaping = ventilationSectionSpec(unitId).shapingNote!

  it('refuses its own boundary before the first answer, by its own deny list', () => {
    expect(
      ventilationSectionSpec(unitId).precommitDenyPatterns.some((pattern) =>
        pattern.test(boundary),
      ),
    ).toBe(true)
  })

  it('shows neither before an answer, the boundary after Part 1’s, the note after Part 2’s', () => {
    mount(unitId)
    const lesson = ventilationStageLesson(unitId)
    expect(column().textContent).not.toContain(boundary)
    expect(column().textContent).not.toContain(shaping)
    // The rate note waits for Part 1 as well (2026-11-15), so two notes are held, not one.
    expect(column().textContent).toContain('two of its notes wait until you have answered')

    chooseStep(lesson.predictionStepIndex)
    act(() => jest.advanceTimersByTime(10))
    expect(column().textContent).not.toContain(boundary)
    commitFirstChoice()
    expect(column().textContent).toContain(boundary)
    expect(column().textContent).not.toContain(shaping)
    expect(column().textContent).toContain('its last note waits until you have answered')

    chooseStep(lesson.transferPredictionStepIndex)
    act(() => jest.advanceTimersByTime(10))
    expect(column().textContent).not.toContain(shaping)
    // The preview note above Part 2 no longer says what raising the cycle-off does.
    expect(document.querySelector('[data-part-relation]')!.textContent).not.toMatch(
      /expiration more time|time back/,
    )
    commitFirstChoice()
    expect(column().textContent).toContain(shaping)
    expect(column().textContent).toContain('nothing here is held back')
  })

  it('opens both once the learner has moved on from the question without answering it', () => {
    mount(unitId)
    const lesson = ventilationStageLesson(unitId)
    chooseStep(lesson.steps.length - 1)
    act(() => jest.advanceTimersByTime(10))
    expect(column().textContent).toContain(boundary)
    expect(column().textContent).toContain(shaping)
  })
})

/*
 * The author's ruling of 2026-11-15 on #551: "Section 7’s ‘can trap more gas’ line and Section 12’s
 * inspiration/cycling highlights before the location question … conceal anything that answers the
 * pending question." Each surface found on those two screens is absent before the commitment and
 * present after it.
 */
describe('Section 7, Part 1: every line that answers it waits for the answer (2026-11-15)', () => {
  const unitId = 'expiration-and-air-trapping'
  const unit = ventilationUnitById.get(unitId)!
  const held = [
    // More detail → Why it matters at the bedside (the line the author named).
    unit.why,
    // Worked example (it is the curriculum's own example).
    'Increasing rate can leave even less time.',
    // More detail → Which control, if any: the rate row.
    'Fewer breaths give each expiration more time.',
    // More detail → the one table: this section's row.
    'a rate set too high',
  ]

  it('has the author’s line among them, and the section’s own list refuses every one', () => {
    expect(unit.why).toBe(
      'A patient with slow exhalation can trap more gas when breaths arrive more frequently.',
    )
    expect(unit.example.reasoning).toContain(held[1])
    const deny = ventilationSectionSpec(unitId).precommitDenyPatterns
    for (const text of [unit.why, held[1], held[2], 'too little time to empty'])
      expect([text, deny.some((pattern) => pattern.test(text))]).toEqual([text, true])
  })

  it('holds them on the first task and on the question, and shows them once it is answered', () => {
    mount(unitId)
    const lesson = ventilationStageLesson(unitId)
    const text = () => column().textContent ?? ''
    for (const line of held) expect([line, text().includes(line)]).toEqual([line, false])
    expect(column().querySelector('[data-grammar-row="incomplete-emptying"]')).toBeNull()
    expect(column().querySelector('[data-knob="rate"]')!.getAttribute('data-note-held')).toBe(
      'true',
    )
    expect(text()).toContain(
      'This section’s rows are marked once you have answered its first question.',
    )

    chooseStep(lesson.predictionStepIndex)
    act(() => jest.advanceTimersByTime(10))
    for (const line of held) expect([line, text().includes(line)]).toEqual([line, false])
    // The worked example keeps its normal reference; only the curriculum's example waits.
    expect(column().querySelector('[data-lesson-disclosure="worked-example"]')).not.toBeNull()
    expect(column().querySelector('[data-worked-example]')).toBeNull()
    // The intrinsic PEEP reading and the lung shading stay (author's ruling on #523).
    expect(document.body.textContent).toContain('Intrinsic PEEP')

    commitFirstChoice()
    for (const line of held) expect([line, text().includes(line)]).toEqual([line, true])
    expect(
      column()
        .querySelector('[data-grammar-row="incomplete-emptying"]')!
        .getAttribute('data-highlight'),
    ).toBe('true')
    expect(column().querySelector('[data-knob="rate"]')!.hasAttribute('data-note-held')).toBe(false)
    expect(text()).toContain(
      'Compare every row against this patient’s own baseline. This section’s rows are marked.',
    )
  })

  it('shows them once the learner moves on without answering', () => {
    mount(unitId)
    const lesson = ventilationStageLesson(unitId)
    chooseStep(lesson.predictionStepIndex + 1)
    act(() => jest.advanceTimersByTime(10))
    for (const line of held) expect(column().textContent).toContain(line)
  })
})

describe('Section 12: the location question names no place before it is answered (2026-11-15)', () => {
  const unitId = 'dyssynchrony-mechanisms'
  const round = ventilationExperimentByUnit.get(unitId)!.rounds[0]
  const strip = () => column().querySelector<HTMLElement>('[data-breath-map]')!
  const cardText = () => {
    const copy = document
      .querySelector<HTMLElement>('[data-now-card]')!
      .cloneNode(true) as HTMLElement
    copy.querySelectorAll('fieldset').forEach((node) => node.remove())
    return copy.textContent ?? ''
  }

  it('lights the whole breath, borrows no line that names the push, and marks no row', () => {
    mount(unitId)
    expect(round.look).toMatch(/early in inspiration/)
    // The breath map strip and its accessible name.
    expect(strip().getAttribute('data-lit')).toBe('')
    expect(strip().getAttribute('data-emphasis')).toBe('none')
    expect(strip().querySelector('svg')!.getAttribute('aria-label')).toBe(
      'Breath map, schematic: one breath in four stops. This step stands at the whole breath.',
    )
    // The card: no look line, and nothing outside the choices names the push or inspiration.
    expect(document.querySelector('[data-now-card] [data-step-look]')).toBeNull()
    for (const pattern of ventilationSectionSpec(unitId).locationDenyPatterns!)
      expect([pattern.source, pattern.test(cardText())]).toEqual([pattern.source, false])
    fireEvent.click(card().getByRole('button', { name: 'Hint' }))
    expect(card().getByRole('status').textContent).toBe(VENTILATION_LOCATION_HINT)
    expect(cardText()).not.toContain(round.look)
    expect(cardText()).not.toContain(round.hint)
    // The one table, in More detail: no row of this section marked yet.
    expect(column().querySelectorAll('[data-grammar-row][data-highlight="true"]')).toHaveLength(0)
    expect(column().textContent).toContain(
      'This section’s rows are marked once you have answered its first question.',
    )
  })

  it('shows all of it once the location is answered', () => {
    mount(unitId)
    commitFirstChoice()
    expect(strip().getAttribute('data-lit')).toBe('inspiration cycling')
    expect(strip().querySelector('svg')!.getAttribute('aria-label')).toBe(
      'Breath map, schematic: one breath in four stops. This step stands at inspiration and cycling.',
    )
    expect(document.querySelector('[data-now-card] [data-step-look]')!.textContent).toBe(round.look)
    expect(
      [...column().querySelectorAll('[data-grammar-row][data-highlight="true"]')].map((row) =>
        row.getAttribute('data-grammar-row'),
      ),
    ).toEqual(['cycling-mismatch', 'flow-starvation'])
    expect(column().textContent).toContain('This section’s rows are marked.')
  })
})

describe('the same rule on the other screens it reaches', () => {
  it.each(['triggering-and-cycling', 'waveform-reading-sequence'])(
    '%s: its location question lights the whole breath until it is answered',
    (unitId) => {
      mount(unitId)
      const lit = () => column().querySelector('[data-breath-map]')!.getAttribute('data-lit')
      expect(lit()).toBe('')
      commitFirstChoice()
      expect(lit()).toBe(ventilationStageLesson(unitId).steps[0].stops.join(' '))
    },
  )

  it('oxygenation-response: its worked example, refused by its own list, waits too', () => {
    const unit = ventilationUnitById.get('oxygenation-response')!
    mount(unit.id)
    expect(column().textContent).not.toContain(unit.example.situation)
    const lesson = ventilationStageLesson(unit.id)
    chooseStep(lesson.predictionStepIndex + 1)
    act(() => jest.advanceTimersByTime(10))
    expect(column().textContent).toContain(unit.example.situation)
  })
})

describe('Section 12: the shaping note waits for the location answer (MV-L7)', () => {
  const unitId = 'dyssynchrony-mechanisms'
  const shaping = ventilationSectionSpec(unitId).shapingNote!

  it('holds “shapes the start of the push” until the location question is answered', () => {
    mount(unitId)
    expect(column().textContent).not.toContain(shaping)
    expect(column().textContent).not.toMatch(/this push and this effort/)
    commitFirstChoice()
    expect(column().textContent).toContain(shaping)
  })
})
