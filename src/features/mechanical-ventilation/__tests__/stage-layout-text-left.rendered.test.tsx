/**
 * The Learn layout the owner asked for on 2026-10-15, rendered:
 *
 *   - every step takes the same width (reading steps were capped at a narrower column);
 *   - the text — the Now card and the step's reading — is always ahead of the visual: on its left
 *     on a desktop, above it when the two stack (console steps used to put the console first, with
 *     the reading on its right);
 *   - on a desktop the page does not scroll and the two columns scroll on their own, so the
 *     sources move to the end of the text column; below that they stay at the end of the page,
 *     after the console.
 *
 * jsdom performs no layout, so the geometry is browser-measured (both panes 712 px tall at
 * 1660 × 900, page locked); this holds the DOM order, the scroll-owner declaration and the
 * stylesheet rules that produce it.
 */
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, cleanup, render } from '@testing-library/react'

import { VentilationStageHost } from '../components/stage/VentilationStageHost'
import { ventilationLearningUnits } from '../content/learningCurriculum'
import { ventilationPresentedStepIndexes, ventilationStageLesson } from '../content/stageLessons'
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

const originalMatchMedia = window.matchMedia

/** A desktop (or not) for the host's workspace query; every other query does not match. */
function emulateDesktop(desktop: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: desktop && query === '(min-width: 1024px) and (min-height: 700px)',
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia
}

beforeEach(() => {
  localStorage.clear()
  jest.useFakeTimers()
})
afterEach(() => {
  cleanup()
  jest.useRealTimers()
  window.matchMedia = originalMatchMedia
})

const precedes = (a: Element, b: Element) =>
  Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

function expectTextAheadOfVisual(where: string) {
  const content = document.querySelector('[data-flow-content]')!
  const text = content.querySelector(':scope > [data-flow-teaching]')!
  const visual = content.querySelector(':scope > [data-flow-visual]')!
  expect({ where, visualFirst: content.hasAttribute('data-visual-first') }).toEqual({
    where,
    visualFirst: false,
  })
  expect({ where, textFirst: precedes(text, visual) }).toEqual({ where, textFirst: true })
  // The task card is part of the text column, so it sits beside the visual, not above both.
  expect({ where, nowInText: text.contains(document.querySelector('[data-now-card]')) }).toEqual({
    where,
    nowInText: true,
  })
}

describe('Learn layout: text ahead of the visual in every task of every section', () => {
  it.each(ventilationLearningUnits.map((unit) => unit.id))('%s', (unitId) => {
    emulateDesktop(true)
    const lesson = ventilationStageLesson(unitId)
    render(<VentilationStageHost unitId={unitId} />)
    act(() => jest.advanceTimersByTime(10))
    for (const index of ventilationPresentedStepIndexes(lesson)) {
      chooseStep(
        index,
        lesson.steps.map((step) => step.id),
      )
      act(() => jest.advanceTimersByTime(50))
      expectTextAheadOfVisual(lesson.steps[index].id)
    }
  })
})

describe('Learn layout: where the sources go', () => {
  it('ends the text column on a desktop, where the page does not scroll', () => {
    emulateDesktop(true)
    render(<VentilationStageHost unitId="waveform-anatomy" />)
    act(() => jest.advanceTimersByTime(10))
    const sources = document.getElementById('mv-section-sources')!
    expect(document.querySelector('[data-stage-frame]')).toHaveAttribute('data-workspace', 'true')
    expect(document.querySelector('[data-flow-teaching]')!.contains(sources)).toBe(true)
    expect(document.querySelector('[data-flow-teaching]')!.lastElementChild).toBe(sources)
    expect(document.querySelector('[data-learning-scroll-owner]')).toHaveAttribute(
      'data-learning-scroll-owner',
      'workspace',
    )
  })

  it('stays at the end of the page, after the console, when the columns stack', () => {
    emulateDesktop(false)
    render(<VentilationStageHost unitId="waveform-anatomy" />)
    act(() => jest.advanceTimersByTime(10))
    const sources = document.getElementById('mv-section-sources')!
    expect(document.querySelector('[data-stage-frame]')).not.toHaveAttribute('data-workspace')
    expect(document.querySelector('[data-flow-teaching]')!.contains(sources)).toBe(false)
    expect(precedes(document.querySelector('[data-flow-visual]')!, sources)).toBe(true)
  })
})

describe('Learn layout: what shares the console pane', () => {
  /*
   * Fitting the console into its pane at 900 px (2026-10-15): the one-line breath map moved to the
   * head of the text column, the task's cue rides the clock bar instead of a line of its own, and
   * the console takes its compact sizes in the desktop workspace. Browser-measured afterwards: the
   * console's tab row in view on every console task at 1660 × 900 (94 of 94).
   */
  function openFirstSimulatorTask(desktop: boolean) {
    emulateDesktop(desktop)
    const lesson = ventilationStageLesson('waveform-anatomy')
    render(<VentilationStageHost unitId="waveform-anatomy" />)
    act(() => jest.advanceTimersByTime(10))
    const task = lesson.steps.findIndex((step) => step.interaction.kind === 'simulator-task')
    chooseStep(
      task,
      lesson.steps.map((step) => step.id),
    )
    act(() => jest.advanceTimersByTime(50))
  }

  it('puts the one-line breath map in the text column and the cue on the clock bar', () => {
    openFirstSimulatorTask(true)
    const text = document.querySelector('[data-flow-teaching]')!
    const visual = document.querySelector('[data-flow-visual]')!
    expect(text.querySelector('[data-breath-map-variant="strip"]')).not.toBeNull()
    expect(visual.querySelector('[data-breath-map]')).toBeNull()
    const cue = visual.querySelector('[data-console-cue]')!
    expect(cue.closest('[data-clock-bar]')).not.toBeNull()
    expect(cue).toHaveAttribute('aria-hidden', 'true')
  })

  it('compacts the console in the desktop workspace only', () => {
    openFirstSimulatorTask(true)
    expect(document.querySelector('[data-console-surface]')).toHaveAttribute(
      'data-mv-density',
      'laptop',
    )
    cleanup()
    openFirstSimulatorTask(false)
    expect(document.querySelector('[data-console-surface]')).not.toHaveAttribute('data-mv-density')
  })
})

describe('Learn layout: the stylesheet rules behind it', () => {
  const read = (...parts: string[]) =>
    readFileSync(
      join(process.cwd(), 'src/features/mechanical-ventilation/components', ...parts),
      'utf8',
    )

  it('gives reading steps the same width as console steps', () => {
    expect(read('stage', 'task-flow.module.css')).not.toMatch(
      /data-layout='concept'\][^{]*\{[^}]*max-width/,
    )
  })

  it('locks the desktop page and lets each column scroll on its own', () => {
    const flow = read('stage', 'task-flow.module.css')
    const workspace = flow.slice(flow.indexOf('@media (min-width: 1024px) and (min-height: 700px)'))
    expect(workspace).toMatch(
      /\[data-flow-teaching\], \[data-flow-visual\]\)\s*\{[^}]*position: relative;[^}]*overflow-y: auto;[^}]*overscroll-behavior: contain;/,
    )
    // The text column is block flow: as a grid, the console's fit-to-width measurement re-laid the
    // whole lesson on mount and a section took 11.9 s to show its task (0.9 s in block flow).
    expect(flow).not.toMatch(/\.flow \[data-flow-teaching\] \{[^}]*display: grid/)
    expect(flow).toMatch(/\.flow \[data-flow-teaching\] > \* \+ \* \{\s*margin-top: 1rem;/)
    // The clock stays at the head of the console pane while the console under it scrolls.
    expect(workspace).toMatch(/\[data-flow-visual\] \[data-clock-bar\] \{[^}]*position: sticky;/)
    const shell = read('mechanical-ventilation-module.module.css')
    expect(shell).toMatch(
      /@media \(min-width: 1024px\) and \(min-height: 700px\) \{\s*\.moduleShell\[data-activity-mode='true'\]\[data-task-flow='true'\] \{[^}]*height: calc\(100dvh - var\(--site-header-height, 4rem\)\);[^}]*overflow: hidden;/,
    )
  })
})
