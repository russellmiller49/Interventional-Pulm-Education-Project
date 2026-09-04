import { fireEvent, render, screen } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import { EcmoFoundationLessonActivity } from '../components/EcmoFoundationLessonActivity'
import {
  CIRCUIT_MAP_FRAME_RECT,
  circuitMapHotspot,
  type CircuitMapRect,
} from '../components/circuit-map/circuitMapGeometry'
import { ecmoFoundationLearningItems } from '../content/foundationLearningItems'
import {
  ecmoMapAnsweredItemIds,
  ecmoMapAnswerTargets,
  validateEcmoMapAnswerTargets,
} from '../content/mapAnswerTargets'

/**
 * The prediction about a place, answered by pointing at the place.
 *
 * An owner review asked for it: "click the location from a set of choices in the animation instead
 * of answering in the right panel". What that buys pedagogically is the reason to keep it — naming
 * a location from a list tests the words, pointing at it on the circuit tests the thing — and what
 * it costs is a control that has to be as good an answer control as the radio list it replaced.
 * It is one, because it *is* one: a real radio group whose labels are pins on the drawing.
 */

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...rest
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string
    children: ReactNode
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn() }),
  usePathname: () => '/cardiohelp-ecmo/learn',
}))

jest.mock('../components/EcmoCircuit3D', () => ({
  EcmoCircuit3D: () => <div data-testid="ecmo-circuit-3d" />,
}))

const PATH_PREDICTION = 'ecmo.foundation.path.prediction'

function allItems() {
  return Object.values(ecmoFoundationLearningItems).flatMap((items) => [
    items.prediction,
    items.transfer,
  ])
}

function overlaps(a: CircuitMapRect, b: CircuitMapRect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

/* ------------------------------------------------------------------ *
 * Which items qualify, and where they point
 * ------------------------------------------------------------------ */

describe('the items answered on the circuit', () => {
  it('validates its registry at import and holds together', () => {
    expect(validateEcmoMapAnswerTargets()).toEqual([])
    expect(ecmoMapAnsweredItemIds).toContain(PATH_PREDICTION)
  })

  it('maps every choice of every item it claims, and no two to the same place', () => {
    for (const itemId of ecmoMapAnsweredItemIds) {
      const targets = ecmoMapAnswerTargets(itemId)
      if (!targets) throw new Error(`${itemId} has no targets`)
      const item = allItems().find((candidate) => candidate.id === itemId)
      if (!item) throw new Error(`${itemId} is not a foundation item`)
      expect(targets.map((target) => target.choiceId).sort()).toEqual(
        item.choices.map((choice) => choice.id).sort(),
      )
      const segments = targets.map((target) => target.segmentId)
      expect(segments).toEqual([...new Set(segments)])
    }
  })

  it('leaves an item alone when one of its answers is not a place', () => {
    /*
     * The rule that decides. Both "where does that pattern localise" items offer "there is not
     * enough information to say" — a real answer, and one that is nowhere on a circuit. Forcing
     * those onto the map would mean deleting the choice that teaches restraint, so they keep their
     * list, and this fails if anyone maps them without removing the reason not to.
     */
    for (const item of allItems()) {
      const hasNonPlace = item.choices.some((choice) =>
        /not enough information|insufficient information/i.test(choice.label),
      )
      expect(`${item.id}: ${hasNonPlace && ecmoMapAnswerTargets(item.id) ? 'mapped' : 'ok'}`).toBe(
        `${item.id}: ok`,
      )
    }
  })

  it('gives every mapped choice a target inside the drawing, and no two that overlap', () => {
    const whole = CIRCUIT_MAP_FRAME_RECT.whole
    for (const itemId of ecmoMapAnsweredItemIds) {
      const targets = ecmoMapAnswerTargets(itemId) ?? []
      const rects = targets.map((target) => {
        const rect = circuitMapHotspot(target.segmentId)
        if (!rect) throw new Error(`${itemId}: ${target.segmentId} has no hotspot`)
        return { id: target.segmentId, rect }
      })
      for (const { id, rect } of rects) {
        expect(`${id}: inside`).toBe(
          `${id}: ${
            rect.x >= whole.x &&
            rect.y >= whole.y &&
            rect.x + rect.width <= whole.x + whole.width &&
            rect.y + rect.height <= whole.y + whole.height
              ? 'inside'
              : 'off the drawing'
          }`,
        )
        // Big enough to aim at: at the pane width the stage gives the map, ~44 CSS px.
        expect(rect.width).toBeGreaterThanOrEqual(90)
        expect(rect.height).toBeGreaterThanOrEqual(70)
      }
      // Two targets a learner can hit at once would make the answer ambiguous.
      for (const a of rects) {
        for (const b of rects) {
          if (a.id === b.id) continue
          expect(`${itemId} ${a.id}/${b.id}: apart`).toBe(
            `${itemId} ${a.id}/${b.id}: ${overlaps(a.rect, b.rect) ? 'overlapping' : 'apart'}`,
          )
        }
      }
    }
  })
})

/* ------------------------------------------------------------------ *
 * The interaction
 * ------------------------------------------------------------------ */

describe('answering on the circuit', () => {
  beforeEach(() => {
    window.localStorage.clear()
    Object.defineProperty(global, 'fetch', {
      configurable: true,
      writable: true,
      value: jest.fn().mockResolvedValue({ ok: true }),
    })
  })

  function mountAtPredict() {
    const view = render(
      <EcmoFoundationLessonActivity
        sectionId="circuit-flow-path"
        supportMode="vv"
        initialPhase="recognize"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    return view
  }

  const item = () => ecmoFoundationLearningItems['circuit-flow-path'].prediction
  const pin = (choiceId: string) =>
    document.querySelector<HTMLElement>(`[data-map-answer-choice="${choiceId}"]`)
  const radio = (choiceId: string) =>
    document.querySelector<HTMLInputElement>(
      `[data-map-answer] input[value="${choiceId}"]`,
    ) as HTMLInputElement

  it('puts the choices on the map and not in the task pane', () => {
    const { container } = mountAtPredict()
    const fieldset = container.querySelector('[data-map-answer]')
    expect(fieldset).not.toBeNull()
    // On the drawing: inside the circuit panel, not in the column that used to list them.
    expect(fieldset?.closest('#cardiohelp-circuit-panel')).not.toBeNull()
    expect(fieldset?.closest('[data-pane="task"]')).toBeNull()
    expect(container.querySelector('[data-pane="task"] [data-prediction-choices]')).toBeNull()
    // The question is still asked where the learner is working, and it says where to answer.
    const prompt = container.querySelector('[data-map-answer-prompt]')
    expect(prompt?.textContent).toContain(item().stem)
    expect(prompt?.textContent).toMatch(/Choose the place on the circuit map/)
  })

  it('is a real radio group, so the browser supplies the behaviour', () => {
    mountAtPredict()
    const inputs = [
      ...document.querySelectorAll<HTMLInputElement>('[data-map-answer] input[type="radio"]'),
    ]
    expect(inputs).toHaveLength(item().choices.length)
    // One group: one name across every option, which is what gives arrow-key selection and a
    // single tab stop without a line of key handling.
    expect(new Set(inputs.map((input) => input.name)).size).toBe(1)
    expect(inputs.map((input) => input.value).sort()).toEqual(
      item()
        .choices.map((choice) => choice.id)
        .sort(),
    )
    // Each radio is named by its pin: the visible numeral, and the place it stands on.
    for (const [index, target] of (ecmoMapAnswerTargets(PATH_PREDICTION) ?? []).entries()) {
      const label = pin(target.choiceId)
      const visible = label?.querySelector('[aria-hidden="true"]')?.textContent?.trim()
      const accessible = label?.textContent ?? ''
      expect(visible).toBe(String(index + 1))
      const choiceLabel = item().choices.find((choice) => choice.id === target.choiceId)?.label
      expect(accessible).toContain(choiceLabel)
      // What is seen is part of what is announced.
      expect(accessible).toContain(String(index + 1))
    }
  })

  it('numbers the pins along the blood path, whatever order the choices are shuffled into', () => {
    mountAtPredict()
    const legend = [...document.querySelectorAll('[data-map-answer-legend-item]')].map((node) =>
      node.getAttribute('data-map-answer-legend-item'),
    )
    expect(legend).toEqual([
      'drainage-side',
      'between-pump-and-membrane',
      'after-membrane',
      'in-the-gas-path',
    ])
  })

  it('echoes the chosen place and commits it', () => {
    const { container } = mountAtPredict()
    expect(container.querySelector('[data-map-answer-chosen]')).toBeNull()

    fireEvent.click(radio('after-membrane'))
    expect(radio('after-membrane').checked).toBe(true)
    expect(pin('after-membrane')?.getAttribute('data-selected')).toBe('true')
    expect(container.querySelector('[data-map-answer-chosen]')?.textContent).toContain(
      'After the membrane lung, on the return limb.',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Commit this prediction' }))
    // The learner's own answer went to the engine, wrong one included.
    expect(container.querySelector('[data-verdict-outcome-label]')?.textContent).toBe(
      'Not correct.',
    )
  })

  it('says nothing about which place is right until the answer is committed', () => {
    const { container } = mountAtPredict()
    for (const choice of item().choices) {
      expect(pin(choice.id)?.getAttribute('data-map-answer-state')).toBeNull()
    }
    expect(container.querySelector('[data-map-answer-flag]')).toBeNull()
    expect(container.querySelector('[data-map-answer]')).not.toBeDisabled()
  })

  it('marks the answer and the keyed place in words once committed, and locks the group', () => {
    const { container } = mountAtPredict()
    fireEvent.click(radio('drainage-side'))
    fireEvent.click(screen.getByRole('button', { name: 'Commit this prediction' }))

    expect(container.querySelector('[data-map-answer]')).toBeDisabled()
    expect(pin('drainage-side')?.getAttribute('data-map-answer-state')).toBe('chosen')
    expect(pin('between-pump-and-membrane')?.getAttribute('data-map-answer-state')).toBe('correct')
    // Not carried by colour: each marked pin says which it is.
    expect(pin('drainage-side')?.textContent).toContain('Your answer')
    expect(pin('between-pump-and-membrane')?.textContent).toContain('Correct')
    for (const choiceId of ['after-membrane', 'in-the-gas-path']) {
      expect(pin(choiceId)?.getAttribute('data-map-answer-state')).toBeNull()
    }
  })

  it('marks one pin when the learner was right', () => {
    mountAtPredict()
    fireEvent.click(radio('between-pump-and-membrane'))
    fireEvent.click(screen.getByRole('button', { name: 'Commit this prediction' }))
    expect(pin('between-pump-and-membrane')?.getAttribute('data-map-answer-state')).toBe(
      'chosen-correct',
    )
    expect(pin('between-pump-and-membrane')?.textContent).toContain('Your answer · correct')
  })

  it('never leaves a learner on the wrong tab with no way to answer', () => {
    const { container } = mountAtPredict()
    // The note lives in the bedside panel, so it is only there for the learner who went looking.
    expect(screen.queryByRole('button', { name: 'Show the pressure-zone map' })).toBeNull()

    fireEvent.click(screen.getByRole('tab', { name: 'Bedside 3D circuit' }))
    expect(container.querySelector('[data-answer-elsewhere]')?.textContent).toContain(
      'answered on the pressure-zone map',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Show the pressure-zone map' }))
    expect(document.getElementById('cardiohelp-diagnostic-view-tab')).toHaveAttribute(
      'aria-selected',
      'true',
    )

    // Once the answer is in, the note has nothing left to say.
    fireEvent.click(radio('between-pump-and-membrane'))
    fireEvent.click(screen.getByRole('button', { name: 'Commit this prediction' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Bedside 3D circuit' }))
    expect(container.querySelector('[data-answer-elsewhere]')).toBeNull()
  })

  it('leaves the sections whose answers are not places on their lists', () => {
    const view = render(
      <EcmoFoundationLessonActivity
        sectionId="why-extracorporeal-support"
        supportMode="vv"
        initialPhase="recognize"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(view.container.querySelector('[data-map-answer]')).toBeNull()
    expect(
      view.container.querySelector('[data-pane="task"] [data-prediction-choices] input'),
    ).not.toBeNull()
  })
})
