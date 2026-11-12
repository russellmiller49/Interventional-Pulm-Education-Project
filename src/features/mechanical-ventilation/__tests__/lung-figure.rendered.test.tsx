import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { act, cleanup, fireEvent, render } from '@testing-library/react'

import { VentilationStageHost } from '../components/stage/VentilationStageHost'
import { ventilationLearningUnits } from '../content/learningCurriculum'
import { chooseStep, pressClock, runFor, setConsoleControl } from '../test-support/stageHost'

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
function openStep(lessonIndex: number) {
  act(() => chooseStep(lessonIndex))
  act(() => jest.advanceTimersByTime(10))
}
/** Every task the section lists, opened in turn the way a learner opens one. */
function eachListedTask(visit: (row: number) => void) {
  const rows = () => [
    // The section's own tasks. The case that ends some sections is another patient on its own card.
    ...document.querySelectorAll<HTMLButtonElement>(
      '[data-task-map] [data-step-list] li:not([data-case-row]) button',
    ),
  ]
  const count = rows().length
  expect(count).toBeGreaterThan(3)
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
const figure = () => document.querySelector<HTMLElement>('[data-lung-figure]')
const lines = () => [...(figure()?.querySelectorAll('li') ?? [])].map((li) => li.textContent ?? '')
/** The read-out the console prints under a frozen breath: "Cursor at 0.30 s. Airway pressure …". */
const readOut = () =>
  [...document.querySelectorAll('[data-ventilation-console] [data-captured-breath] p')]
    .map((p) => p.textContent ?? '')
    .find((text) => text.startsWith('Cursor at')) ?? null

/**
 * The lungs at the cursor never say more than the cursor's own read-out.
 *
 * Every step of every section is opened. Wherever the drawing appears beside a frozen breath, each
 * thing it states is found in the read-out printed under that breath: the direction of flow, the
 * volume, and effort only where the read-out prints effort. The patient's airway and stiffness
 * appear only on a step that hands the learner their sliders. So the drawing cannot answer a
 * question the traces do not: not the phase questions of the first section, not the cause of the
 * high pressure in the last.
 */
describe('the lung figure against the cursor read-out, on every step', () => {
  it.each(ventilationLearningUnits.map((unit) => unit.id))('%s', (unitId) => {
    mount(unitId)
    let drawn = 0
    let compared = 0
    let trappedSeen = 0
    eachListedTask(() => {
      const node = figure()
      if (!node) return
      drawn += 1
      const said = lines()
      const text = readOut()
      const sliders = document.querySelector('[data-patient-properties]')
      // The patient's properties: only with their sliders on the screen.
      if (!sliders) {
        expect(node).not.toHaveAttribute('data-airway')
        expect(node).not.toHaveAttribute('data-stiffness')
        expect(said.join(' ')).not.toMatch(/resistance|compliance/i)
      }
      // Trapped gas: only in the air-trapping section, and only as the intrinsic PEEP reading
      // printed beside the drawing, with that reading's own number.
      const trappedLine = said.find((line) => line.startsWith('Intrinsic PEEP'))
      if (node.hasAttribute('data-trapped') || trappedLine) {
        expect(unitId).toBe('expiration-and-air-trapping')
        const tile = document.querySelector('[data-live-readings] [data-metric="intrinsicPeep"]')!
        expect(tile.querySelector('dt')!.textContent).toBe('Intrinsic PEEP · model estimate')
        const shown = tile.querySelector('dd')!.textContent!.match(/^(-?\d+\.\d) cmH₂O/)![1]
        expect(trappedLine).toBe(`Intrinsic PEEP ${shown} cmH₂O · model estimate`)
        trappedSeen += 1
      }
      if (!text) return
      compared += 1
      // Flow: the same sign the read-out prints.
      const flow = Number(text.match(/flow (-?\d+\.\d) L\/min/)![1])
      expect(node.getAttribute('data-flow')).toBe(flow > 0 ? 'in' : flow < 0 ? 'out' : 'none')
      // Volume: the read-out's own number.
      const volume = text.match(/to (-?\d+) mL/)![1]
      expect(said[1].startsWith(`${volume} mL · `)).toBe(true)
      // Effort and the machine's phase: only where the read-out prints them.
      const effort = text.match(/Model effort (-?\d+\.\d) cmH₂O; machine (\w+)\./)
      if (!effort) {
        expect(node.getAttribute('data-effort')).toBe('not-shown')
        expect(said.join(' ')).not.toMatch(/effort|machine/i)
      } else {
        expect(said.join(' ')).toContain(`machine ${effort[2]}`)
      }
    })
    // Not a vacuous pass: the drawing is on this section's screens, beside a read-out to hold it to.
    expect(drawn).toBeGreaterThan(0)
    expect(compared).toBeGreaterThan(0)
    // Drawn in the air-trapping section, wherever its reading is on the screen, and nowhere else.
    expect(trappedSeen > 0).toBe(unitId === 'expiration-and-air-trapping')
  })

  it('never draws the airway or the stiffness in the section that asks for the cause', () => {
    mount('high-peak-pressure-integration')
    eachListedTask(() => {
      expect(document.querySelector('[data-patient-properties]')).toBeNull()
      const node = figure()
      if (!node) return
      expect(node).not.toHaveAttribute('data-airway')
      expect(node).not.toHaveAttribute('data-stiffness')
    })
  })
})

describe('trapped gas in the air-trapping section', () => {
  it('is drawn in the first part too, where the owner had its reading added', () => {
    // Part 1 watched rate, flow before the next breath and exhaled volume. Intrinsic PEEP was
    // added to that list on 2026-11-11 so the drawing has a reading on the screen to draw from.
    mount('expiration-and-air-trapping')
    openStep(2)
    const tiles = [...document.querySelectorAll('[data-live-readings] [data-metric]')].map((tile) =>
      tile.getAttribute('data-metric'),
    )
    expect(tiles).toEqual(['rate', 'expiratoryFlow', 'intrinsicPeep', 'volume'])
    const tile = document.querySelector('[data-live-readings] [data-metric="intrinsicPeep"]')!
    const shown = tile.querySelector('dd')!.textContent!.match(/^(-?\d+\.\d) cmH₂O/)![1]
    expect(lines()).toContain(`Intrinsic PEEP ${shown} cmH₂O · model estimate`)
    expect(figure()).toHaveAttribute('data-trapped')
    // The task's own words name the reading with the others it asks the learner to watch.
    expect(document.querySelector('[data-flow-teaching]')!.textContent).toMatch(
      /Flow before next breath, Intrinsic PEEP,? (and )?Exhaled volume/i,
    )
  })

  it('follows the reading as the learner raises the rate and the patient runs', () => {
    mount('expiration-and-air-trapping')
    openStep(2)
    const tileValue = () =>
      Number(
        document
          .querySelector('[data-live-readings] [data-metric="intrinsicPeep"] dd')!
          .textContent!.match(/^(-?\d+\.\d) cmH₂O/)![1],
      )
    const before = tileValue()
    const shadedBefore = Number(figure()!.getAttribute('data-trapped'))
    setConsoleControl('ratePerMin', 26)
    pressClock('run')
    runFor(25_000)
    // Less time to exhale: the reading rises, and the drawing with it.
    expect(tileValue()).toBeGreaterThan(before)
    expect(Number(figure()!.getAttribute('data-trapped'))).toBeGreaterThan(shadedBefore)
    expect(lines()).toContain(`Intrinsic PEEP ${tileValue().toFixed(1)} cmH₂O · model estimate`)
  })

  it('is not drawn on the section’s opening reading, which has no readings beside it', () => {
    mount('expiration-and-air-trapping')
    expect(document.querySelector('[data-live-readings]')).toBeNull()
    expect(figure()).not.toHaveAttribute('data-trapped')
    expect(figure()!.querySelector('[data-trapped-gas]')).toBeNull()
    expect(figure()!.querySelector('[data-trapped-note]')).toBeNull()
  })

  it('is drawn in the second part, shaded at the base of the lungs, and explained one press away', () => {
    mount('expiration-and-air-trapping')
    eachListedTask((row) => {
      if (row !== 5) return
      const node = figure()!
      expect(Number(node.getAttribute('data-trapped'))).toBeGreaterThan(0)
      expect(node.querySelector('[data-trapped-gas]')).not.toBeNull()
      const note = node.querySelector('[data-trapped-note]')!
      expect(note.closest('details')!.open).toBe(false)
      expect(note.textContent).toContain('it is not a measured volume')
      expect(node.querySelector('svg')!.getAttribute('aria-label')).toMatch(
        /Intrinsic PEEP \d+\.\d cmH₂O/,
      )
    })
  })

  it('is not drawn where another section shows the same reading', () => {
    // The owner asked for the air-trapping section only (2026-11-11).
    mount('dyssynchrony-mechanisms')
    eachListedTask(() => {
      expect(figure()).not.toHaveAttribute('data-trapped')
    })
  })
})

describe('the lung figure follows the cursor and the learner’s own changes', () => {
  it('moves from filling to emptying as the cursor crosses the breath', () => {
    mount('mechanics-load-and-pressure')
    openStep(2)
    const cursor = document.querySelector<HTMLInputElement>(
      '[data-ventilation-console] [data-captured-breath] input[type="range"]',
    )!
    expect(figure()).toHaveAttribute('data-flow', 'in')
    const filling = Number(figure()!.getAttribute('data-inflation'))
    act(() => {
      fireEvent.change(cursor, { target: { value: cursor.max } })
    })
    expect(figure()).toHaveAttribute('data-flow', 'out')
    expect(Number(figure()!.getAttribute('data-inflation'))).toBeLessThan(filling)
    // Still the read-out's own volume.
    expect(lines()[1].startsWith(`${readOut()!.match(/to (-?\d+) mL/)![1]} mL · `)).toBe(true)
  })

  it('narrows the airway when the learner raises the patient’s resistance', () => {
    mount('mechanics-load-and-pressure')
    openStep(2)
    expect(figure()).toHaveAttribute('data-airway', '1.00')
    const slider = document.querySelector<HTMLInputElement>(
      '[data-patient-properties] input[type="range"]',
    )!
    act(() => {
      fireEvent.change(slider, { target: { value: '2' } })
    })
    expect(Number(figure()!.getAttribute('data-airway'))).toBeLessThan(1)
    expect(lines()).toContain('Patient resistance 2.00×')
  })

  it('has a spoken name that carries every line, and keeps how it is drawn one press away', () => {
    mount('triggering-and-cycling')
    const svg = figure()!.querySelector('svg')!
    expect(svg).toHaveAttribute('role', 'img')
    for (const line of lines()) expect(svg.getAttribute('aria-label')).toContain(line)
    const about = figure()!.querySelector('details')!
    expect(about.open).toBe(false)
    expect(about.textContent).toContain('not total lung volume')
    expect(about.textContent).toContain('not this patient’s anatomy')
  })
})
