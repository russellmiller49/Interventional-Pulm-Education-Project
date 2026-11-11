import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, fireEvent } from '@testing-library/react'

import { derivedFigureMetricId } from '../content/derivedFigure'
import { hemodynamicsSectionIds } from '../content/sectionSpecs'
import { hemodynamicsStageItems } from '../content/stageItems'
import { hemodynamicsStageLesson } from '../content/stageLessons'
import { hemodynamicsTaskPresentation } from '../content/taskPresentation'
import {
  clickPrimary,
  commitChoice,
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
  it('is every task of the opening section, and the reading, questions and Explain cards of the flow and derived-values sections', () => {
    for (const sectionId of hemodynamicsSectionIds) {
      const lesson = hemodynamicsStageLesson(sectionId)
      for (const step of lesson.steps) {
        const { figure: named } = hemodynamicsTaskPresentation(sectionId, step)
        const kind = step.interaction.kind
        const expected =
          sectionId === 'why-measure'
            ? 'pac-parts'
            : sectionId === 'thermodilution-series' &&
                (kind === 'read' || kind === 'prediction' || kind === 'explain')
              ? 'td-curve'
              : sectionId === 'derived-hemodynamics' &&
                  (kind === 'provenance-drill' || kind === 'prediction' || kind === 'explain')
                ? 'derived-value'
                : sectionId === 'waveform-interpretation' && kind === 'walk'
                  ? 'normal-reference'
                  : 'none'
        expect({ step: step.id, named }).toEqual({ step: step.id, named: expected })
      }
    }
    // The opening section has no case, so every one of its tasks has the drawing.
    expect(
      hemodynamicsStageLesson('why-measure').steps.some((step) => step.interaction.kind === 'case'),
    ).toBe(false)
    // In the flow section: not the series the learner judges, the Fick reading, the comparison of
    // the two methods or the case, each of which has its own screen.
    expect(
      hemodynamicsStageLesson('thermodilution-series')
        .steps.filter(
          (step) => hemodynamicsTaskPresentation('thermodilution-series', step).figure === 'none',
        )
        .map((step) => step.interaction.kind),
    ).toEqual(['simulator-task', 'observe', 'disagreement', 'case'])
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

describe('the flow section on the stage', () => {
  const curve = () => document.querySelector<HTMLElement>('[data-section-figure="td-curve"]')

  it('keeps the reference curve beside both pages of its first task, its parts named', () => {
    mountSection('thermodilution-series')
    // Page one names the parts of the raw record in words; the curve is beside it.
    expect(document.querySelector('[data-reading-part="td-method"]')).not.toBeNull()
    expect(curve()!.closest('[data-flow-visual]')).not.toBeNull()
    expect(document.querySelector('[data-single-column]')).toBeNull()
    const names = [...curve()!.querySelectorAll('[data-curve-names] text')].map((text) =>
      text.textContent?.trim(),
    )
    expect(names).toEqual(['baseline', 'onset', 'peak change', 'decay back toward baseline'])
    // The caption is the method's own sentence about the raw record.
    expect(curve()!.querySelector('[data-curve-record]')).toHaveTextContent(
      /stable baseline, an onset, a peak change away from baseline, a decay back toward baseline/,
    )

    // Page two used to hold the only drawing. It now points at the one beside it.
    clickPrimary()
    expect(document.querySelector('[data-reading-part="td-curve"]')).not.toBeNull()
    expect(curve()).not.toBeNull()
    expect(
      document.querySelectorAll('[data-now-card] svg[class*="thermoTrialCurve"]'),
    ).toHaveLength(0)
    expect(document.querySelector('[data-now-card] [data-figure-pointer]')).toHaveTextContent(
      'The reference curve is the drawing of the raw record',
    )
  })

  it('shows the same curve beside the section’s questions and Explain cards, and nowhere else', () => {
    const { lesson } = mountSection('thermodilution-series')
    const seen: Record<string, boolean> = {}
    for (let guard = 0; guard < 40; guard += 1) {
      const id = currentStepId()!
      seen[id] = seen[id] ?? curve() !== null
      if (id === lesson.steps.at(-1)!.id) break
      leaveTask()
    }
    for (const step of lesson.steps) {
      const kind = step.interaction.kind
      expect({ step: step.id, curve: seen[step.id] }).toEqual({
        step: step.id,
        curve: kind === 'read' || kind === 'prediction' || kind === 'explain',
      })
    }
  })

  it('does not name the parts on a learner’s own trial: reading them off it is the task', () => {
    const { lesson } = mountSection('thermodilution-series')
    const series = lesson.steps.find((step) => step.interaction.kind === 'simulator-task')!
    for (let guard = 0; currentStepId() !== series.id && guard < 20; guard += 1) leaveTask()
    expect(currentStepId()).toBe(series.id)
    expect(document.querySelector('[data-curve-names]')).toBeNull()
  })
})

describe('the derived-values section on the stage', () => {
  const drawing = () => document.querySelector<HTMLElement>('[data-derived-figure]')
  const inputs = () =>
    [...drawing()!.querySelectorAll<HTMLElement>('[data-derived-input]')].map((input) => ({
      id: input.getAttribute('data-derived-input'),
      usable: input.getAttribute('data-usable'),
      text: input.textContent,
    }))

  it('names the value each task is about', () => {
    expect(derivedFigureMetricId('recognize', 'metric:pulmonaryVascularResistance')).toBe(
      'pulmonaryVascularResistance',
    )
    // The first question and its explanation are about SVR; the new patient's are about PPV.
    expect(derivedFigureMetricId('predict', undefined)).toBe('systemicVascularResistance')
    expect(derivedFigureMetricId('explain', undefined)).toBe('systemicVascularResistance')
    expect(derivedFigureMetricId('transfer', undefined)).toBe('pulsePressureVariationPercent')
    // Held to the questions themselves, so a rewritten question cannot leave the wrong drawing.
    const items = hemodynamicsStageItems['derived-hemodynamics']
    expect(items.prediction.stem).toMatch(/^SVR is calculated/)
    expect(items.transfer.stem).toMatch(/calculate PPV/)
  })

  it('draws the value the page reads, from the same worked episode, and follows the page', () => {
    mountSection('derived-hemodynamics')
    expect(drawing()!.closest('[data-flow-visual]')).not.toBeNull()
    expect(drawing()).toHaveAttribute('data-derived-figure', 'cardiacIndexLMinM2')
    expect(drawing()).toHaveAttribute('data-derived-values', 'shown')
    expect(inputs().map((input) => input.id)).toEqual(['cardiacOutputLMin', 'bodySurfaceAreaM2'])
    expect(drawing()!.querySelector('[data-derived-formula]')).toHaveTextContent('CI = CO / BSA')
    // The drawing's result is the card's result.
    const cardResult = document.querySelector('[data-now-card] [data-metric-result] strong')!
    expect(drawing()!.querySelector('[data-derived-result] strong')).toHaveTextContent(
      cardResult.textContent!,
    )
    expect(drawing()!.querySelector('[data-derived-result]')).toHaveAttribute(
      'data-derived-result',
      'available-with-caution',
    )

    // The next page is the next value.
    clickPrimary()
    expect(drawing()).toHaveAttribute('data-derived-figure', 'strokeVolumeMl')
  })

  it('follows the reading’s switch to the episode with no height or weight', () => {
    mountSection('derived-hemodynamics')
    const compare = document.querySelector<HTMLInputElement>(
      '[data-now-card] [data-metric-reading] input[type="checkbox"]',
    )!
    fireEvent.click(compare)
    expect(document.querySelector('[data-now-card] [data-metric-result]')).toHaveAttribute(
      'data-metric-result',
      'withheld',
    )
    expect(drawing()!.querySelector('[data-derived-result]')).toHaveAttribute(
      'data-derived-result',
      'withheld',
    )
    expect(drawing()!.querySelector('[data-derived-result]')).toHaveTextContent('Result withheld')
    const surface = inputs().find((input) => input.id === 'bodySurfaceAreaM2')!
    expect(surface.usable).toBe('false')
    expect(surface.text).toMatch(/Missing/)
    // The switch belongs to the page it was set on.
    clickPrimary()
    expect(drawing()!.querySelector('[data-derived-result]')).not.toHaveAttribute(
      'data-derived-result',
      'withheld',
    )
  })

  it('draws the structure and no numbers beside a question, before and after it is answered', () => {
    const { lesson } = mountSection('derived-hemodynamics')
    const question = lesson.steps[lesson.predictionStepIndex]
    for (let guard = 0; currentStepId() !== question.id && guard < 30; guard += 1) leaveTask()
    expect(currentStepId()).toBe(question.id)
    expect(drawing()).toHaveAttribute('data-derived-figure', 'systemicVascularResistance')
    expect(drawing()).toHaveAttribute('data-derived-values', 'structure')
    expect(inputs().map((input) => input.id)).toEqual(['mapMmHg', 'rapMmHg', 'cardiacOutputLMin'])
    expect(drawing()!.querySelector('[data-derived-input-value]')).toBeNull()
    expect(drawing()!.textContent).not.toMatch(/\d+ (mmHg|L\/min)/)
    expect(drawing()!.querySelector('[data-derived-result]')).toHaveAttribute(
      'data-derived-result',
      'not-shown',
    )
    commitChoice(/Withhold SVR/)
    expect(drawing()).toHaveAttribute('data-derived-values', 'structure')
  })
})

describe('the walk through the four places', () => {
  /*
   * Owner, 2026-11-11: Next stop sat under the stop's waveforms, and pressing it changed a tracing
   * the learner had scrolled past. The tracing is now with the catheter map in the visual column,
   * Next stop is pinned at the foot of the view, and a new stop is read from its top.
   */
  const reference = () => document.querySelector<HTMLElement>('[data-walk-reference]')
  const stop = () =>
    document.querySelector('[data-walk-stop]')?.getAttribute('data-walk-stop') ?? undefined

  it('keeps the stop’s normal tracing with the catheter map, not in the task card', () => {
    mountSection('waveform-interpretation')
    expect(reference()!.closest('[data-flow-visual]')).not.toBeNull()
    expect(reference()!.closest('[data-section-figure]')).toHaveAttribute(
      'data-section-figure',
      'normal-reference',
    )
    // After the map: where the tip is, then what it writes.
    const visual = document.querySelector('[data-flow-visual]')!
    const map = visual.querySelector('[data-simulator-surface]')!
    expect(
      map.compareDocumentPosition(reference()!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    // The card holds the stop's text and points at the tracing; it has no second copy of it.
    expect(document.querySelector('[data-now-card] [data-walk-reference]')).toBeNull()
    expect(document.querySelector('[data-now-card] svg[role="img"]')).toBeNull()
    expect(document.querySelector('[data-now-card] [data-figure-pointer]')).toHaveTextContent(
      'shown with the catheter map',
    )
  })

  it('draws the tracing ahead of the reference’s introduction and controls', () => {
    mountSection('waveform-interpretation')
    const first = reference()!.querySelector('[data-reference-figures-first]')!
    const header = reference()!.querySelector('header')!
    expect(first.compareDocumentPosition(header) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // The same tracing is not drawn a second time further down.
    expect(reference()!.querySelectorAll('[class*="referenceSynchronizedFigures"]')).toHaveLength(1)
    // The sentence that says what moves the walk names where the buttons now are.
    expect(reference()!.querySelector('[data-reference-progress]')).toHaveTextContent(
      'Next stop and Previous stop on the task card',
    )
  })

  it('follows the stop: Next stop changes the map’s stop and the tracing together', () => {
    mountSection('waveform-interpretation')
    const seen: (readonly [string | undefined, string | null | undefined])[] = []
    for (let guard = 0; guard < 6; guard += 1) {
      seen.push([stop(), reference()?.getAttribute('data-walk-reference')])
      if (!/Next stop/.test(document.querySelector('[data-now-primary]')?.textContent ?? '')) break
      clickPrimary()
    }
    expect(seen).toEqual([
      ['ra', 'ra'],
      ['rv', 'rv'],
      ['pa', 'pa'],
      ['wedge', 'wedge'],
    ])
  })

  it('pins Next stop at the foot of the view on the walk, and only there', () => {
    mountSection('waveform-interpretation')
    const card = document.querySelector('[data-now-card]')!
    expect(card).toHaveAttribute('data-pinned-actions')
    expect(card.querySelector('[data-now-footer="pinned"] [data-now-primary]')).toHaveTextContent(
      'Next stop',
    )
    cleanup()
    // The pressure section's walk has one stop; the same rule holds there.
    mountSection('pressure-system')
    expect(document.querySelector('[data-now-card]')).toHaveAttribute('data-pinned-actions')
    cleanup()
    // A task that is not a walk keeps its action row where it was.
    mountSection('why-measure')
    expect(document.querySelector('[data-now-card]')).not.toHaveAttribute('data-pinned-actions')
  })

  it('reads a new stop from its top', () => {
    const scrolled = jest.fn()
    Element.prototype.scrollIntoView = scrolled
    mountSection('waveform-interpretation')
    scrolled.mockClear()
    clickPrimary()
    expect(stop()).toBe('rv')
    expect(scrolled).toHaveBeenCalledWith({ block: 'start', behavior: 'instant' })
  })
})

describe('the walk’s layout rules', () => {
  const flow = readFileSync(
    join(
      process.cwd(),
      'src/features/icu-hemodynamics/components/stage/hemodynamics-flow.module.css',
    ),
    'utf8',
  )

  it('sets the catheter map and the tracing side by side wherever the workspace has two panes', () => {
    expect(flow).toMatch(
      /@container hemo-activity \(min-width: 75rem\) \{\s*\.activity\s*> \[data-flow-content\]\[data-has-visual\]\s*> \[data-flow-visual\]:has\(> \[data-section-figure='normal-reference'\]\) \{\s*display: grid;\s*grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\);/,
    )
  })

  it('leaves the walk out of the rule that gives the text half the width', () => {
    expect(flow).toMatch(
      /\[data-section-figure\]:not\(\[data-section-figure='normal-reference'\]\)/,
    )
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
      /\[data-flow-content\]\[data-has-visual\]:has\(\s*> \[data-flow-visual\] > \[data-section-figure\]:not\(\[data-section-figure='normal-reference'\]\)\s*\) \{\s*grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\);/,
    )
  })
})
