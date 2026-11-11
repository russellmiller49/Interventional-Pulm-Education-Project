import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, fireEvent } from '@testing-library/react'

import { hemodynamicsSectionIds } from '../content/sectionSpecs'
import { hemodynamicsStageLesson } from '../content/stageLessons'
import { hemodynamicsTaskPresentation } from '../content/taskPresentation'
import {
  clickPrimary,
  commitChoice,
  currentStepId,
  installDom,
  mountSection,
} from '../test-support/stageHarness'

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: {
    href: string | { pathname: string }
    children: React.ReactNode
  }) => (
    <a href={typeof href === 'string' ? href : href.pathname} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/icu-hemodynamics/learn',
}))

/**
 * The opening section keeps the catheter drawing beside its text.
 *
 * Walked on screen in November 2026, all six tasks of "Why put a line in at all?" were a single
 * centred text column; the drawing of the catheter and its parts sat below the fold of the first
 * task and nowhere on the other five. The section now names that drawing as its figure, and the
 * stage shows it in the visual column on every task. Beside a question that has not been answered
 * it keeps the parts' names and places and holds back what each measures: the section's last
 * question asks exactly that.
 */
const figure = () => document.querySelector<HTMLElement>('[data-section-figure]')
const schematics = () => document.querySelectorAll('[data-pac-component-schematic]')
const functions = () =>
  document.querySelector('[data-pac-component-schematic]')?.getAttribute('data-pac-functions')

beforeAll(() => installDom())
beforeEach(() => {
  jest.useFakeTimers()
  window.localStorage.clear()
  window.sessionStorage.clear()
})
afterEach(() => {
  cleanup()
  jest.useRealTimers()
})

describe('which steps name a section figure', () => {
  it('is every task of the opening section, and no step of any other', () => {
    for (const sectionId of hemodynamicsSectionIds) {
      const lesson = hemodynamicsStageLesson(sectionId)
      for (const step of lesson.steps) {
        const { figure: named } = hemodynamicsTaskPresentation(sectionId, step)
        expect(named).toBe(sectionId === 'why-measure' ? 'pac-parts' : 'none')
      }
    }
    // The opening section has no case, so every one of its tasks has the drawing.
    expect(
      hemodynamicsStageLesson('why-measure').steps.some((step) => step.interaction.kind === 'case'),
    ).toBe(false)
  })
})

describe('the opening section on the stage', () => {
  it('shows the drawing in the visual column, once, with the text pointing at it', () => {
    mountSection('why-measure')
    expect(document.querySelector('[data-single-column]')).toBeNull()
    expect(figure()).toHaveAttribute('data-section-figure', 'pac-parts')
    expect(figure()!.closest('[data-flow-visual]')).not.toBeNull()
    // Not a second copy inside the task card.
    expect(schematics()).toHaveLength(1)
    expect(document.querySelector('[data-now-card] [data-pac-component-schematic]')).toBeNull()
    expect(document.querySelector('[data-now-card] [data-figure-pointer]')).toHaveTextContent(
      'The drawing of the catheter',
    )
    // A reading task: every part says what it measures or does.
    expect(functions()).toBe('shown')
    expect(figure()).toHaveTextContent('thermodilution curve')
  })

  it('keeps the drawing on all six tasks', () => {
    const { lesson } = mountSection('why-measure')
    for (const step of lesson.steps) {
      expect(currentStepId()).toBe(step.id)
      expect(figure()).not.toBeNull()
      expect(schematics()).toHaveLength(1)
      if (step !== lesson.steps.at(-1)) clickPrimary()
    }
  })

  it('holds back what each part measures on a question until it is answered', () => {
    const { lesson } = mountSection('why-measure')
    // The section's last task asks what the catheter itself measures or collects.
    while (currentStepId() !== lesson.steps.at(-1)!.id) clickPrimary()
    expect(functions()).toBe('withheld')
    expect(figure()).toHaveTextContent('Thermistor — near the tip.')
    expect(figure()).not.toHaveTextContent('thermodilution curve')
    expect(figure()).not.toHaveTextContent('mixed-venous')
    expect(document.querySelector('[data-pac-functions-note]')).toHaveTextContent(
      'shown again once you have answered',
    )
    expect(
      document.querySelector('[data-pac-component-schematic] svg')!.getAttribute('aria-label'),
    ).not.toMatch(/thermodilution curve|mixed-venous/)

    commitChoice(/Pressures, a thermodilution curve/)
    expect(functions()).toBe('shown')
    expect(figure()).toHaveTextContent('thermodilution curve')
    expect(document.querySelector('[data-pac-functions-note]')).toBeNull()
  })

  it('holds it back on the sort too, until the sort is checked or its worked answer is opened', () => {
    const { lesson } = mountSection('why-measure')
    const sort = lesson.steps.find((step) => step.interaction.kind === 'sort')!
    while (currentStepId() !== sort.id) clickPrimary()
    expect(functions()).toBe('withheld')
    const show = [...document.querySelectorAll<HTMLButtonElement>('[data-now-card] button')].find(
      (button) => /Show the worked sort/.test(button.textContent ?? ''),
    )!
    fireEvent.click(show)
    expect(functions()).toBe('shown')
  })
})

describe('the stylesheet rule that gives the text half the width beside a drawing', () => {
  const flow = readFileSync(
    join(
      process.cwd(),
      'src/features/icu-hemodynamics/components/stage/hemodynamics-flow.module.css',
    ),
    'utf8',
  )

  it('applies where the visual column holds a section figure', () => {
    expect(flow).toMatch(
      /\[data-flow-content\]\[data-has-visual\]:has\(> \[data-flow-visual\] > \[data-section-figure\]\) \{\s*grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\);/,
    )
  })
})
