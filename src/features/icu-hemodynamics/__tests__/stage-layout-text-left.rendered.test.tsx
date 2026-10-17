/**
 * The Learn layout the owner asked for on 2026-10-16 ("the same layout issues" as mechanical
 * ventilation), rendered:
 *
 *   - every step with a visual takes the same width (steps were capped at 1160 px, concept steps at
 *     850 px); a step that is reading only keeps a reading measure;
 *   - the text — the Now card, its teaching and its question — is always ahead of the visual: on its
 *     left on a desktop, above it when the two stack. The monitor, map and controls used to sit in
 *     the card under the teaching;
 *   - on a desktop the page does not scroll and the two columns scroll on their own (one column,
 *     scrolling as one, when the task body is under 75rem — a narrow window or enlarged text), and
 *     the sources end the text column; below a desktop the page scrolls and the sources end it.
 *
 * jsdom performs no layout, so the geometry is browser-measured (312 task views at 1660, 1440,
 * 1024 and 390 px, 0 anomalies); this holds the DOM order, the scroll-owner declaration, the
 * empty-simulator rule and the stylesheet rules that produce it.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, cleanup, fireEvent, render } from '@testing-library/react'

import { IcuHemodynamicsModuleFrameV2 } from '../components/IcuHemodynamicsModuleFrameV2'
import {
  HemodynamicsSimulatorPane,
  stageSurfaceHasDock,
} from '../components/stage/HemodynamicsSimulatorPane'
import { hemodynamicsSectionIds } from '../content/sectionSpecs'
import type { StageSurface } from '../content/stageLessons'
import { hemodynamicsTaskPresentation } from '../content/taskPresentation'
import { cleanState } from '../engine/stageRuntime'
import { installDom, mountSection } from '../test-support/stageHarness'

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: {
    href: string | { pathname: string }
    children: React.ReactNode
    [key: string]: unknown
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
  installDom()
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as never
})
afterEach(() => {
  cleanup()
  jest.useRealTimers()
})

const precedes = (a: Element, b: Element) =>
  Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

function expectTextAheadOfVisual(where: string) {
  const content = document.querySelector('[data-flow-content]')!
  const text = content.querySelector(':scope > [data-flow-teaching]')!
  const visual = content.querySelector(':scope > [data-flow-visual]')
  expect({ where, visualFirst: content.hasAttribute('data-visual-first') }).toEqual({
    where,
    visualFirst: false,
  })
  expect({ where, nowInText: text.contains(document.querySelector('[data-now-card]')) }).toEqual({
    where,
    nowInText: true,
  })
  if (!visual) return
  expect({ where, textFirst: precedes(text, visual) }).toEqual({ where, textFirst: true })
  // A visual column is drawn only when there is something in it.
  expect({ where, emptyVisual: visual.children.length === 0 }).toEqual({
    where,
    emptyVisual: false,
  })
  expect({ where, simulatorInText: text.querySelector('[data-simulator-surface]') }).toEqual({
    where,
    simulatorInText: null,
  })
}

describe('Learn layout: text ahead of the visual in every task of every section', () => {
  it.each(hemodynamicsSectionIds)('%s', (sectionId) => {
    mountSection(sectionId)
    const count = document.querySelectorAll('[data-step-list] button').length
    for (let index = 0; index < count; index += 1) {
      const button = document.querySelectorAll<HTMLButtonElement>('[data-step-list] button')[index]
      if (!button.disabled) fireEvent.click(button)
      act(() => {
        jest.advanceTimersByTime(50)
      })
      expectTextAheadOfVisual(
        document.querySelector('[data-stage]')?.getAttribute('data-stage') ?? `${index}`,
      )
    }
  })

  it('gives a reading-only step one column at a reading measure', () => {
    mountSection('why-measure')
    expect(document.querySelector('[data-flow-visual]')).toBeNull()
    expect(document.querySelector('[data-single-column]')).toHaveAttribute(
      'data-single-column',
      'reading',
    )
  })
})

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

describe('Learn layout: where the sources go', () => {
  afterEach(() => {
    window.matchMedia = originalMatchMedia
  })

  it('ends the text column on a desktop, where the page does not scroll', () => {
    emulateDesktop(true)
    mountSection('pressure-system')
    const text = document.querySelector('[data-flow-teaching]')!
    const sources = document.querySelectorAll('[data-stage-sources]')
    expect(sources).toHaveLength(1)
    expect(text.lastElementChild?.contains(sources[0])).toBe(true)
  })

  it('stays at the end of the page, after the visual, below a desktop', () => {
    emulateDesktop(false)
    mountSection('pressure-system')
    const sources = document.querySelectorAll('[data-stage-sources]')
    expect(sources).toHaveLength(1)
    expect(document.querySelector('[data-flow-content]')!.contains(sources[0])).toBe(false)
    expect(precedes(document.querySelector('[data-flow-visual]')!, sources[0])).toBe(true)
  })
})

describe('Learn layout: the scroll owner', () => {
  it('declares the workspace for Learn and keeps the document for a Practice case', () => {
    const owner = (props: { documentFlow?: boolean; desktopWorkspace?: boolean }) => {
      const view = render(
        <IcuHemodynamicsModuleFrameV2 activeHref="/icu-hemodynamics/learn" activityMode {...props}>
          <div />
        </IcuHemodynamicsModuleFrameV2>,
      )
      const value = view.container
        .querySelector('[data-learning-scroll-owner]')
        ?.getAttribute('data-learning-scroll-owner')
      view.unmount()
      return value
    }
    expect(owner({ documentFlow: true, desktopWorkspace: true })).toBe('workspace')
    expect(owner({ documentFlow: true })).toBe('document')
    mountSection('pressure-system')
    expect(document.querySelector('[data-learning-scroll-owner]')).toHaveAttribute(
      'data-learning-scroll-owner',
      'workspace',
    )
    expect(document.querySelector('[data-lesson-shell]')).toHaveAttribute(
      'data-critical-care-activity-shell',
      'true',
    )
  })
})

describe('Learn layout: an empty simulator is no visual', () => {
  const surfaces: readonly StageSurface[] = [
    'none',
    'line',
    'flush',
    'flush-then-tip',
    'tip',
    'wedge',
    'thermodilution',
    'recognition',
    'level-demo',
    'zero-demo',
    'scale-demo',
    'response-demo',
    'component-demo',
    'component-identification',
    'question-trace',
    'freeze',
    'derived',
    'capstone',
  ]
  it.each(surfaces)('the dock rule matches what the pane draws: %s', (surface) => {
    const presentation = {
      kind: 'signal-lab',
      monitor: 'none',
      anatomy: 'none',
      controls: true,
    } as const
    render(
      <HemodynamicsSimulatorPane
        state={cleanState(510, 'pa')}
        dispatch={jest.fn()}
        surface={surface}
        flushLine="pulmonary-artery"
        controlsEnabled
        chamberLabel="shown"
        stops={[]}
        tipVisible
        presentation={presentation}
      />,
    )
    const pane = document.querySelector('[data-simulator-surface]')!
    expect(pane.textContent!.trim().length > 0).toBe(stageSurfaceHasDock(surface))
  })

  it('keeps the presentation rules the predicate reads', () => {
    expect(
      hemodynamicsTaskPresentation('why-measure', {
        surface: 'none',
        interaction: { kind: 'read' },
      } as never),
    ).toMatchObject({ monitor: 'none', anatomy: 'none', controls: false })
  })
})

describe('Learn layout: the stylesheet rules behind it', () => {
  const read = (...parts: string[]) =>
    readFileSync(join(process.cwd(), 'src/features/icu-hemodynamics/components', ...parts), 'utf8')

  it('drops the narrow caps and keeps a reading measure for reading-only steps', () => {
    const flow = read('stage', 'hemodynamics-flow.module.css')
    expect(flow).not.toMatch(/max-width: 1160px/)
    expect(flow).not.toMatch(/data-presentation='concept'\] \.activity/)
    expect(flow).toMatch(/\.activity\[data-single-column='reading'\] \{\s*max-width: 56rem;/)
  })

  it('lays the text column out in block flow and lets each column scroll on its own', () => {
    const flow = read('stage', 'hemodynamics-flow.module.css')
    expect(flow).not.toMatch(/\[data-flow-teaching\] \{[^}]*display: grid/)
    expect(flow).toMatch(/\.flow \[data-flow-teaching\] > \* \+ \* \{\s*margin-top: 1rem;/)
    const workspace = flow.slice(flow.indexOf('@media (min-width: 1024px) and (min-height: 700px)'))
    // Two panes from a 75rem task body, a container query in rem that follows the reader's text.
    const panes = flow.slice(flow.indexOf('@container hemo-activity (min-width: 75rem)'))
    expect(panes).toMatch(
      /\[data-flow-teaching\], \[data-flow-visual\]\)\s*\{[^}]*position: relative;[^}]*overflow-y: auto;[^}]*overscroll-behavior: contain;/,
    )
    expect(workspace).toMatch(/container: hemo-activity \/ inline-size;/)
    const shell = read('stage', 'hemodynamics-stage.module.css')
    expect(shell).toMatch(
      /\.moduleShell\[data-document-flow='true'\]\[data-desktop-workspace='true'\] \{[^}]*height: calc\(100dvh - var\(--site-header-height, 4rem\)\);[^}]*overflow: hidden;/,
    )
  })
})
