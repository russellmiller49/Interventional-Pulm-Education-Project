import { cleanup, fireEvent, render } from '@testing-library/react'

import { FickCalculationFigure } from '../components/FickCalculationFigure'
import { FICK_EPISODES } from '../components/FickMethodWorkbench'
import { requireCardiacOutputParameter } from '../content/cardiacOutputSourceBoundaries'
import { hemodynamicsStageLesson } from '../content/stageLessons'
import { hemodynamicsTaskPresentation } from '../content/taskPresentation'
import { HEMODYNAMICS_NUMBERS } from '../content/teachingNumbers'
import { CARDIAC_OUTPUT_MODEL_CONSTANTS, fickCardiacOutput } from '../engine/fick'
import {
  clickPrimary,
  currentStepId,
  installDom,
  leaveTask,
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
 * The flow section's Fick reading keeps a drawing beside it (owner ruling hd-e4-fick-drawing,
 * 2026-11-14): the six reading pages of task 4 were the module's last reading task with no
 * drawing. The drawing is the derived-values layout — inputs, formula, result — filled from the
 * page's own episode, and beside the task's question it holds every number and every provenance
 * back.
 */
const drawing = () => document.querySelector<HTMLElement>('[data-fick-figure]')
const inputs = () =>
  [...drawing()!.querySelectorAll<HTMLElement>('[data-fick-input]')].map((input) => ({
    id: input.getAttribute('data-fick-input'),
    value: input.querySelector('[data-fick-input-value]')?.textContent ?? null,
    usable: input.getAttribute('data-usable'),
  }))
const stages = () =>
  [...drawing()!.querySelectorAll('p')]
    .map((p) => p.textContent)
    .filter((text) => text === 'Inputs' || text === 'Formula' || text === 'Result')

const observeStep = () =>
  hemodynamicsStageLesson('thermodilution-series').steps.find(
    (step) => step.interaction.kind === 'observe',
  )!

function goToFickPages() {
  mountSection('thermodilution-series')
  const target = observeStep().id
  for (let guard = 0; currentStepId() !== target && guard < 20; guard += 1) leaveTask()
  expect(currentStepId()).toBe(target)
}

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

describe('which task names the Fick drawing', () => {
  it('is task 4 of the flow section, the Fick reading, and no other', () => {
    expect(observeStep().ordinal).toBe(4)
    for (const step of hemodynamicsStageLesson('thermodilution-series').steps) {
      const { figure } = hemodynamicsTaskPresentation('thermodilution-series', step)
      expect({ step: step.id, figure: figure === 'fick-calculation' }).toEqual({
        step: step.id,
        figure: step.interaction.kind === 'observe',
      })
    }
  })
})

describe('the drawing beside the six reading pages', () => {
  it('draws the three stages beside the first page, in the visual column, from the page’s episode', () => {
    goToFickPages()
    expect(drawing()!.closest('[data-flow-visual]')).not.toBeNull()
    expect(document.querySelector('[data-now-card] [data-fick-figure]')).toBeNull()
    expect(document.querySelectorAll('[data-fick-figure]')).toHaveLength(1)
    expect(stages()).toEqual(['Inputs', 'Formula', 'Result'])
    expect(drawing()).toHaveAttribute('data-fick-figure', 'measured-uptake')
    expect(drawing()).toHaveAttribute('data-fick-values', 'shown')

    const episode = FICK_EPISODES[0].inputs
    expect(inputs()).toEqual([
      { id: 'vo2', value: `${episode.vo2MlMin} mL/min`, usable: 'true' },
      { id: 'hemoglobin', value: `${episode.hemoglobinGDl} g/dL`, usable: 'true' },
      {
        id: 'arterial-saturation',
        value: `${Math.round(episode.arterialSaturationFraction! * 100)}%`,
        usable: 'true',
      },
      {
        id: 'mixed-venous-saturation',
        value: `${Math.round(episode.mixedVenousSaturationFraction! * 100)}%`,
        usable: 'true',
      },
      { id: 'venous-sample-site', value: 'Pulmonary artery', usable: 'true' },
    ])
    // The constant in the formula is the engine's, and the one the page's qualifier names.
    const constant = CARDIAC_OUTPUT_MODEL_CONSTANTS.hemoglobinOxygenBindingCapacityMlPerG
    expect(requireCardiacOutputParameter('hemoglobin-oxygen-binding-capacity').valueShown).toBe(
      `${constant} mL/g`,
    )
    expect(drawing()!.querySelector('[data-fick-formula]')).toHaveTextContent(
      `Oxygen content = ${constant} mL/g × hemoglobin × saturation`,
    )

    // The drawing's result is the card's result, to the digit.
    const engine = fickCardiacOutput(FICK_EPISODES[0].inputs)
    const card = document.querySelector('[data-now-card] [data-status="calculated"] strong')!
    expect(card).toHaveTextContent(`${engine.cardiacOutputLMin!.toFixed(2)} L/min`)
    expect(drawing()!.querySelector('[data-fick-result] strong')).toHaveTextContent(
      card.textContent!,
    )
    expect(drawing()!.querySelector('[data-fick-division]')).toHaveTextContent(
      `${episode.vo2MlMin} ÷ (${engine.contentDifferenceMlDl!.toFixed(2)} × 10) = ${engine.cardiacOutputLMin!.toFixed(2)} L/min`,
    )
  })

  it('follows the pages, one episode each, and agrees with every card', () => {
    goToFickPages()
    FICK_EPISODES.forEach((episode, index) => {
      if (index > 0) clickPrimary()
      expect(drawing()).toHaveAttribute('data-fick-figure', episode.id)
      const engine = fickCardiacOutput(episode.inputs)
      const cardOutcome = document.querySelector('[data-now-card] [data-status] strong')!
      expect(drawing()!.querySelector('[data-fick-result]')).toHaveAttribute(
        'data-fick-result',
        engine.status,
      )
      expect(drawing()!.querySelector('[data-fick-result] strong')).toHaveTextContent(
        engine.status === 'calculated' ? cardOutcome.textContent! : 'Result withheld',
      )
      expect(cardOutcome.textContent).toBe(
        engine.status === 'calculated'
          ? `${engine.cardiacOutputLMin!.toFixed(2)} L/min`
          : 'Result withheld',
      )
    })
  })

  it('marks the input a withheld result turns on, and places the numbers the pages give', () => {
    render(<FickCalculationFigure episodeId="central-venous-specimen" />)
    expect(inputs().find((input) => input.id === 'venous-sample-site')).toEqual({
      id: 'venous-sample-site',
      value: 'Superior vena cava',
      usable: 'false',
    })
    expect(drawing()!.querySelector('[data-fick-withheld]')).toHaveTextContent(
      /not a true mixed-venous specimen/,
    )
    cleanup()

    render(<FickCalculationFigure episodeId="contradictory-inputs" />)
    expect(inputs().find((input) => input.id === 'arterial-saturation')).toEqual({
      id: 'arterial-saturation',
      value: 'Not available',
      usable: 'false',
    })
    expect(drawing()!.querySelector('[data-fick-placed]')).toHaveAttribute(
      'data-fick-placed',
      'not-computed',
    )
    cleanup()

    // The narrow difference: the rounded figures shown do not reproduce the result exactly.
    render(<FickCalculationFigure episodeId="narrow-content-difference" />)
    const narrow = fickCardiacOutput(FICK_EPISODES[2].inputs)
    expect(drawing()!.querySelector('[data-fick-division]')).toHaveTextContent(
      `≈ ${narrow.cardiacOutputLMin!.toFixed(2)} L/min`,
    )
    cleanup()

    render(<FickCalculationFigure episodeId="assumed-uptake" />)
    expect(drawing()!.querySelector('[data-fick-input="vo2"]')).toHaveAttribute(
      'data-provenance',
      'assumed',
    )
    expect(drawing()!.querySelector('[data-fick-result]')).toHaveTextContent(
      'Fick with an assumed oxygen uptake',
    )
  })

  it('carries no number from the teaching-number register, and adds none of its own', () => {
    render(<FickCalculationFigure episodeId="measured-uptake" />)
    const text = drawing()!.textContent!
    const numbers = new Set(text.match(/\d+(\.\d+)?/g))
    const engine = fickCardiacOutput(FICK_EPISODES[0].inputs)
    const episode = FICK_EPISODES[0].inputs
    const allowed = new Set(
      [
        episode.vo2MlMin,
        episode.hemoglobinGDl,
        episode.arterialSaturationFraction,
        episode.mixedVenousSaturationFraction,
        Math.round(episode.arterialSaturationFraction! * 100),
        Math.round(episode.mixedVenousSaturationFraction! * 100),
        CARDIAC_OUTPUT_MODEL_CONSTANTS.hemoglobinOxygenBindingCapacityMlPerG,
        CARDIAC_OUTPUT_MODEL_CONSTANTS.decilitersPerLiter,
      ]
        .map(String)
        .concat(
          [
            engine.arterialOxygenContentMlDl,
            engine.mixedVenousOxygenContentMlDl,
            engine.contentDifferenceMlDl,
            engine.cardiacOutputLMin,
          ].map((value) => value!.toFixed(2)),
        ),
    )
    expect([...numbers].filter((number) => !allowed.has(number))).toEqual([])
    // None of the register's rows is a Fick input, so the drawing reads none.
    expect(
      HEMODYNAMICS_NUMBERS.rows.filter((row) =>
        /oxygen|fick|hemoglobin/i.test(`${row.label} ${row.value}`),
      ),
    ).toEqual([])
  })

  it('is named by its caption', () => {
    render(<FickCalculationFigure episodeId="measured-uptake" />)
    const id = drawing()!.getAttribute('aria-labelledby')!
    expect(document.getElementById(id)).toHaveTextContent(
      'Fick cardiac output: what goes in, and what comes out · Oxygen uptake measured',
    )
  })
})

describe('the drawing beside the task’s question', () => {
  it('holds back every number and every provenance, before and after the answer', () => {
    goToFickPages()
    for (let page = 1; page < FICK_EPISODES.length; page += 1) clickPrimary()
    expect(drawing()).toHaveAttribute('data-fick-figure', FICK_EPISODES.at(-1)!.id)
    // The pages end; the question follows.
    clickPrimary()
    expect(currentStepId()).toBe(observeStep().id)
    expect(document.querySelector('[data-commitment="provenance"]')).not.toBeNull()

    const held = () => {
      expect(drawing()).toHaveAttribute('data-fick-figure', 'structure')
      expect(drawing()).toHaveAttribute('data-fick-values', 'structure')
      expect(stages()).toEqual(['Inputs', 'Formula', 'Result'])
      expect(drawing()!.querySelector('[data-fick-input-value]')).toBeNull()
      expect(drawing()!.querySelector('[data-fick-placed]')).toBeNull()
      expect(drawing()!.querySelector('[data-fick-result]')).toHaveAttribute(
        'data-fick-result',
        'not-shown',
      )
      expect(drawing()!.textContent).not.toMatch(/Measured|Assumed|Sampled|Entered|withheld/)
      expect(drawing()!.textContent).not.toMatch(/\d+ (mL\/min|g\/dL|L\/min)|%/)
    }
    held()
    const choices = [
      ...document.querySelectorAll<HTMLLabelElement>(
        '[data-commitment="provenance"] [data-prediction-choices] label',
      ),
    ]
    fireEvent.click(choices[0].querySelector('input')!)
    fireEvent.click(document.querySelector('[data-commitment="provenance"] [data-question-check]')!)
    expect(document.querySelector('[data-provenance-outcome]')).not.toBeNull()
    held()
  })
})
