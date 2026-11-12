import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { act, cleanup, render } from '@testing-library/react'

import { VentilationStageHost } from '../components/stage/VentilationStageHost'
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

/**
 * What the learner operates and reads beside the console.
 *
 * Walked on screen in November 2026: the tasks say "under Teaching patient, beside the console"
 * and "under Bedside actions, beside the console", and all of it was stacked under the console.
 * At 1600 × 852 the readings were off screen on 79 of 79 tasks, and the teaching patient's sliders
 * on 10 of 10 at any size. They are now one rail, which the stylesheet sets beside the console in
 * a wide pane. jsdom lays nothing out, so these tests hold the structure the stylesheet relies on;
 * the positions are measured in the browser.
 */
function open(unitId: string, lessonIndex: number) {
  render(<VentilationStageHost unitId={unitId} />)
  act(() => jest.advanceTimersByTime(10))
  if (lessonIndex > 0) {
    act(() => chooseStep(lessonIndex))
    act(() => jest.advanceTimersByTime(10))
  }
  return document.querySelector('[data-console-surface]') as HTMLElement
}
const kids = (surface: HTMLElement) =>
  [...surface.children].map(
    (child) =>
      [...child.attributes].find(
        (attribute) =>
          attribute.name.startsWith('data-console-') ||
          attribute.name === 'data-ventilation-console',
      )?.name ?? child.tagName.toLowerCase(),
  )
const railOrder = (surface: HTMLElement) =>
  [...surface.querySelector('[data-console-rail]')!.children].map(
    (child) =>
      [...child.attributes].find((attribute) => attribute.name.startsWith('data-'))?.name ??
      child.tagName.toLowerCase(),
  )

describe('the rail beside the console', () => {
  it('holds the teaching patient, then the readings, on a mechanics task', () => {
    const surface = open('mechanics-load-and-pressure', 2)
    expect(surface).toHaveAttribute('data-has-rail')
    expect(railOrder(surface)).toEqual([
      'data-patient-properties',
      'data-lung-figure',
      'data-live-readings',
    ])
    // The console's own cell comes first and the options fold last, outside the rail.
    expect(kids(surface)).toEqual(['div', 'data-console-rail', 'data-console-options'])
    expect(surface.firstElementChild!.querySelector('[data-clock-bar]')).not.toBeNull()
    expect(surface.firstElementChild!.querySelector('[data-ventilation-console]')).not.toBeNull()
    const sliders = surface.querySelectorAll('[data-patient-properties] input[type="range"]')
    expect(sliders.length).toBeGreaterThan(0)
  })

  it('holds the bedside actions, then the readings; the wide bedside panel stays under the console', () => {
    const surface = open('waveform-reading-sequence', 2)
    // Where the rail opens with bedside actions, the readings the task watches lead the drawing.
    expect(railOrder(surface)).toEqual([
      'data-bedside-actions',
      'data-live-readings',
      'data-lung-figure',
    ])
    expect(kids(surface)).toEqual([
      'div',
      'data-console-rail',
      'data-console-under',
      'data-console-options',
    ])
    const under = surface.querySelector('[data-console-under]')!
    expect(under.querySelector('[data-bedside-panel]')).not.toBeNull()
    expect(surface.querySelector('[data-console-rail] [data-bedside-panel]')).toBeNull()
  })

  it('leads the readings with the patient’s weight, the breath per kilogram and the driving pressure in the lung-protection section', () => {
    const surface = open('lung-protection', 2)
    expect(railOrder(surface)).toEqual([
      'data-lung-figure',
      'data-pbw-context',
      'data-live-readings',
    ])
    expect(surface.querySelector('[data-pbw-context] [data-driving-pressure]')).not.toBeNull()
  })

  it('holds the drawing of the lungs alone where a task has nothing to operate or read', () => {
    const surface = open('breathing-with-support', 0)
    expect(surface).toHaveAttribute('data-has-rail')
    expect(railOrder(surface)).toEqual(['data-lung-figure'])
    expect(kids(surface)).toEqual(['div', 'data-console-rail', 'data-console-options'])
  })
})

describe('the stylesheet that places it', () => {
  const css = readFileSync(
    join(
      process.cwd(),
      'src/features/mechanical-ventilation/components/stage/task-flow.module.css',
    ),
    'utf8',
  )
  const block = css.slice(css.indexOf('@container mv-visual'))

  it('measures the picture pane, not the window', () => {
    expect(css).toMatch(/container:\s*mv-visual\s*\/\s*inline-size/)
    expect(block).toMatch(/^@container mv-visual \(min-width: 60rem\)/)
  })

  it('puts the rail in a second column and leaves the clock bar the whole width', () => {
    expect(block).toMatch(
      /\.consoleSurface\[data-has-rail\]\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) 18\.5rem/,
    )
    expect(block).toMatch(/\[data-clock-bar\]\s*\{[^}]*grid-column:\s*1 \/ -1/)
    expect(block).toMatch(/\.consoleRail\s*\{[^}]*grid-column:\s*2/)
    expect(block).toMatch(/\.consoleUnder\s*\{[^}]*grid-column:\s*1/)
  })
})
