/**
 * The Learn layout, rendered: the section laid out as the ICU hemodynamics and mechanical
 * ventilation sections are (owner, 2026-10-15 and 2026-10-16).
 *
 *   - the text — the task card with its teaching and its question, then the section's purpose, its
 *     task list and, on a desktop, its sources — is always ahead of the simulator: on its left on a
 *     desktop, above it when the two stack. The simulator used to sit inside the card, arranged
 *     differently for each kind of task;
 *   - the simulator column opens with the one clock (run, pause, one cardiac cycle, the time and
 *     what the console says now), which replaced the step bar, the run details and the context
 *     strip above the lesson;
 *   - the task card has one way on, its Continue, pinned to the foot of the text pane;
 *   - a question about a place is asked over the map it is answered on, and the map lights nothing
 *     until it is answered;
 *   - on a desktop the page does not scroll and the two columns scroll on their own (one column,
 *     scrolling as one, when the task body is under 75rem — a narrow window or enlarged text), and
 *     the sources end the text column; below a desktop the page scrolls and the sources end it.
 *
 * jsdom performs no layout, so the geometry is the browser's to measure; this holds the DOM order,
 * the scroll-owner declaration and the stylesheet rules that produce it.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fireEvent, render, within } from '@testing-library/react'

jest.mock('@/i18n/navigation', () =>
  jest
    .requireActual<
      typeof import('../test-support/mcsWorkbenchStubs')
    >('../test-support/mcsWorkbenchStubs')
    .navigationModule(),
)
jest.mock('../components/McsAnatomy3D', () =>
  jest
    .requireActual<
      typeof import('../test-support/mcsWorkbenchStubs')
    >('../test-support/mcsWorkbenchStubs')
    .anatomyModule(),
)

import { McsModuleFrame } from '../components/McsModuleFrame'
import { McsStageHost } from '../components/stage/McsStageHost'
import { mcsHasPrerequisiteReference } from '../components/stage/McsPrerequisiteReference'
import { mcsMapAnswerSectionIds } from '../content/mapAnswerTargets'
import { mcsSectionLearningContractById } from '../content/sectionLearningContracts'
import { buildMcsStageLesson, mcsStageLessonIds } from '../content/stageLessons'
import {
  currentStepId,
  mountSection,
  nowCard,
  readPrerequisiteReference,
  setupMcsStage,
  teardownMcsStage,
} from '../test-support/mcsStage'

// `setupMcsStage` installs, before every test, a matchMedia that matches nothing: the stacked layout.
beforeEach(() => setupMcsStage())
afterEach(() => teardownMcsStage())

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

const precedes = (a: Element, b: Element) =>
  Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

function primary(): HTMLButtonElement {
  return document.querySelector<HTMLButtonElement>('[data-now-primary]')!
}

/** What is true of every task: where the text, the simulator, the clock and the way on are. */
function expectTaskLayout(where: string, readingOnly: boolean) {
  const content = document.querySelector('[data-flow-content]')!
  const text = content.querySelector(':scope > [data-flow-teaching]')!
  const visual = content.querySelector(':scope > [data-flow-visual]')
  const activity = content.parentElement!
  const fact = (name: string, value: unknown) => ({ where, [name]: value })

  expect(fact('visualFirst', content.hasAttribute('data-visual-first'))).toEqual(
    fact('visualFirst', false),
  )
  // The task card is part of the text column, so it sits beside the simulator, not above both.
  expect(fact('nowInText', text.contains(nowCard()))).toEqual(fact('nowInText', true))
  expect(fact('simulatorInText', text.querySelector('[data-simulator-surfaces]'))).toEqual(
    fact('simulatorInText', null),
  )
  expect(fact('clockInText', text.querySelector('[data-clock-bar]'))).toEqual(
    fact('clockInText', null),
  )

  if (readingOnly) {
    expect(fact('visual', visual)).toEqual(fact('visual', null))
    expect(fact('column', activity.getAttribute('data-single-column'))).toEqual(
      fact('column', 'reading'),
    )
  } else {
    expect(fact('visual', visual !== null)).toEqual(fact('visual', true))
    expect(fact('textFirst', precedes(text, visual!))).toEqual(fact('textFirst', true))
    expect(fact('column', activity.getAttribute('data-single-column'))).toEqual(
      fact('column', null),
    )
    // The one clock heads the simulator column.
    const clock = visual!.querySelector('[data-mcs-visual] > [data-clock-bar]')
    expect(
      fact('clockFirst', clock !== null && clock.parentElement!.firstElementChild === clock),
    ).toEqual(fact('clockFirst', true))
    expect(fact('simulator', visual!.querySelector('[data-simulator-surfaces]') !== null)).toEqual(
      fact('simulator', true),
    )
  }

  // One way on, pinned to the foot of the card.
  const primaries = document.querySelectorAll('[data-now-primary]')
  expect(fact('primaries', primaries.length)).toEqual(fact('primaries', 1))
  expect(fact('pinned', primaries[0].closest('[data-now-footer="pinned"]') !== null)).toEqual(
    fact('pinned', true),
  )

  // Nothing of the old chrome: no step bar, no run details, no context strip above the lesson.
  expect(
    fact(
      'oldChrome',
      document.querySelectorAll('[data-step-bar], [data-step-bar-continue], [data-run-details]')
        .length,
    ),
  ).toEqual(fact('oldChrome', 0))
  const header = document.querySelector('[data-lesson-shell] > header')!
  expect(fact('afterHeader', header.nextElementSibling === activity)).toEqual(
    fact('afterHeader', true),
  )
  for (const line of document.querySelectorAll('[data-context-line]')) {
    expect(fact('contextLineInClock', line.closest('[data-clock-bar]') !== null)).toEqual(
      fact('contextLineInClock', true),
    )
  }
  expect(fact('badge', /Simulated values/.test(document.body.textContent ?? ''))).toEqual(
    fact('badge', false),
  )
}

describe('Learn layout: text ahead of the simulator in every task of every section', () => {
  it.each(mcsStageLessonIds)('%s', (sectionId) => {
    const lesson = buildMcsStageLesson(sectionId)
    render(<McsStageHost sectionId={sectionId} />)
    // The reference read before the patient is a reading column, with no simulator beside it.
    if (mcsHasPrerequisiteReference(sectionId)) {
      expect(document.querySelector('[data-prerequisite-reference]')).not.toBeNull()
      expect(document.querySelector('[data-flow-visual]')).toBeNull()
      expect(document.querySelector('[data-clock-bar]')).toBeNull()
      expect(document.querySelector('[data-single-column]')).toHaveAttribute(
        'data-single-column',
        'reading',
      )
      readPrerequisiteReference()
    }
    expect(document.querySelector('[data-prerequisite-reference]')).toBeNull()

    // Driven with the card's own Continue (Next stop on the walk), as a learner who answers nothing.
    const seen = new Set<string>()
    const last = lesson.steps[lesson.steps.length - 1]
    for (let guard = 0; guard < 60; guard += 1) {
      const step = lesson.steps.find((candidate) => candidate.id === currentStepId())!
      seen.add(step.id)
      expectTaskLayout(step.id, step.presentation === 'unloading-comparison')
      if (step.id === last.id) break
      fireEvent.click(primary())
    }
    expect([...seen]).toEqual(lesson.steps.map((step) => step.id))
  })

  it('reads the unloading worked comparison as a reading column, with no simulator', () => {
    mountSection('impella-unloading-placement')
    fireEvent.click(primary())
    expect(currentStepId()).toBe('impella-unloading-placement-unloading-example')
    const content = document.querySelector('[data-flow-content]')!
    expect(content).not.toHaveAttribute('data-has-visual')
    expect(document.querySelector('[data-flow-visual]')).toBeNull()
    expect(document.querySelector('[data-single-column]')).toHaveAttribute(
      'data-single-column',
      'reading',
    )
    expect(
      document.querySelector('[data-flow-teaching] [data-now-card] [data-unloading-comparison]'),
    ).not.toBeNull()
    // No live patient, so no clock and no device controls.
    expect(document.querySelector('[data-clock-bar]')).toBeNull()
    expect(document.querySelector('[data-full-exploration]')).toBeNull()
  })
})

describe('Learn layout: a place is asked about on the map', () => {
  it.each(mcsMapAnswerSectionIds())(
    '%s asks over the map and lights nothing on it until the answer is checked',
    (sectionId) => {
      mountSection(sectionId)
      const contract = mcsSectionLearningContractById.get(sectionId)!
      const step = buildMcsStageLesson(sectionId).steps.find(
        (candidate) => candidate.interaction.kind === 'identify',
      )!
      expect(currentStepId()).toBe(step.id)
      const visual = document.querySelector<HTMLElement>('[data-flow-visual]')!
      const callout = visual.querySelector('[data-map-question-callout]')
      expect(callout).toHaveTextContent(contract.recognizePrompt)
      const map = visual.querySelector<HTMLElement>('[data-circulation-map]')!
      expect(precedes(callout!, map)).toBe(true)
      const lit = () => ({
        caption: map.querySelector('[data-map-emphasis-caption]')?.textContent ?? null,
        segments: map.querySelectorAll('[data-map-lit]').length,
        markers: map.querySelectorAll('[data-map-stop-marker]').length,
      })
      expect(lit()).toEqual({ caption: null, segments: 0, markers: 0 })

      // A choice is not an answer: still nothing lit.
      const correct = contract.recognizeOptions.find((option) => option.correct)!
      fireEvent.click(
        within(map.querySelector<HTMLElement>('[data-map-answer]')!).getByRole('radio', {
          name: new RegExp(correct.label),
        }),
      )
      expect(lit()).toEqual({ caption: null, segments: 0, markers: 0 })

      fireEvent.click(within(nowCard()).getByRole('button', { name: 'Check answer' }))
      const after = lit()
      expect(after.caption).toMatch(/^This section (stands at|uses \d+ places on the loop)/)
      expect(after.segments).toBeGreaterThan(0)
    },
  )

  it('keeps a question answered in a list in the card, with no callout over the map', () => {
    mountSection('lvad-alarms-emergencies')
    expect(currentStepId()).toBe('lvad-alarms-emergencies-recognize')
    expect(document.querySelector('[data-map-question-callout]')).toBeNull()
    expect(nowCard().querySelector('fieldset[data-prediction-choices]')).not.toBeNull()
  })
})

describe('Learn layout: where the sources go', () => {
  it('ends the text column on a desktop, where the page does not scroll', () => {
    emulateDesktop(true)
    mountSection('mcs-foundations-signals')
    const text = document.querySelector('[data-flow-teaching]')!
    const sources = document.querySelectorAll('[data-stage-sources]')
    expect(sources).toHaveLength(1)
    expect(text.lastElementChild?.contains(sources[0])).toBe(true)
  })

  it('stays at the end of the page, after the simulator, below a desktop', () => {
    emulateDesktop(false)
    mountSection('mcs-foundations-signals')
    const sources = document.querySelectorAll('[data-stage-sources]')
    expect(sources).toHaveLength(1)
    expect(document.querySelector('[data-flow-content]')!.contains(sources[0])).toBe(false)
    expect(precedes(document.querySelector('[data-flow-visual]')!, sources[0])).toBe(true)
  })

  it('follows the reference on a desktop while there is no text column yet', () => {
    emulateDesktop(true)
    render(<McsStageHost sectionId="impella-suction-purge-rv" />)
    const reference = document.querySelector('[data-prerequisite-reference]')!
    const sources = document.querySelectorAll('[data-stage-sources]')
    expect(sources).toHaveLength(1)
    expect(precedes(reference, sources[0])).toBe(true)
    readPrerequisiteReference()
    expect(
      document
        .querySelector('[data-flow-teaching]')!
        .lastElementChild?.contains(document.querySelector('[data-stage-sources]')),
    ).toBe(true)
  })
})

describe('Learn layout: the scroll owner', () => {
  it('declares the workspace for Learn, and the document for a flowing page', () => {
    const owner = (flowing: boolean) => {
      const view = render(
        <McsModuleFrame
          locale="en"
          activeHref="/mechanical-circulatory-support/learn"
          activityMode
          flowing={flowing}
        >
          <div />
        </McsModuleFrame>,
      )
      const value = view.container
        .querySelector('[data-learning-scroll-owner]')
        ?.getAttribute('data-learning-scroll-owner')
      view.unmount()
      return value
    }
    expect(owner(false)).toBe('workspace')
    expect(owner(true)).toBe('document')

    mountSection('mcs-foundations-signals')
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

describe('Learn layout: the stylesheet rules behind it', () => {
  const read = (...parts: string[]) =>
    readFileSync(
      join(process.cwd(), 'src/features/mechanical-circulatory-support/components', ...parts),
      'utf8',
    )
  const flow = read('stage', 'mcs-flow.module.css')
  const workspace = flow.slice(flow.indexOf('@media (min-width: 1024px) and (min-height: 700px)'))

  it('lays the text column out in block flow and keeps a reading measure for reading columns', () => {
    expect(flow).not.toMatch(/\[data-flow-teaching\] \{[^}]*display: grid/)
    expect(flow).toMatch(/\.flow \[data-flow-teaching\] > \* \+ \* \{\s*margin-top: 1rem;/)
    expect(flow).toMatch(/\.activity\[data-single-column='reading'\] \{\s*max-width: 56rem;/)
  })

  it('locks the desktop page and lets each column scroll on its own from a 75rem task body', () => {
    expect(flow).toMatch(/@media \(min-width: 1024px\) and \(min-height: 700px\) \{/)
    // The task body is the container, measured in rem, so the two panes follow the text size.
    expect(workspace).toMatch(
      /\.flow\[data-lesson-shell\] > \.activity \{[^}]*container: mcs-activity \/ inline-size;/,
    )
    // Narrower than 75rem the task body is the one scroller.
    expect(workspace).toMatch(
      /\.activity > \[data-flow-content\],[^{]*\{[^}]*position: relative;[^}]*overflow-y: auto;[^}]*overscroll-behavior: contain;/,
    )
    const twoPanes = flow.slice(flow.indexOf('@container mcs-activity (min-width: 75rem)'))
    expect(twoPanes).toMatch(/^@container mcs-activity \(min-width: 75rem\) \{/)
    expect(twoPanes).toMatch(
      /\[data-has-visual\] \{[^}]*grid-template-columns: minmax\(20rem, 0\.8fr\) minmax\(0, 1\.2fr\);[^}]*overflow: hidden;/,
    )
    expect(twoPanes).toMatch(
      /:is\(\[data-flow-teaching\], \[data-flow-visual\]\) \{[^}]*position: relative;[^}]*overflow-y: auto;[^}]*overscroll-behavior: contain;/,
    )
    // The clock stays at the head of the simulator pane while the pane under it scrolls.
    expect(flow).toMatch(/\.clockBar \{\s*position: sticky;\s*top: 0;/)
    const shell = read('mechanical-circulatory-support.module.css')
    expect(shell).toMatch(
      /@media \(min-width: 1024px\) and \(min-height: 700px\) \{\s*\.moduleShell\[data-activity-mode='true'\] \{[^}]*height: calc\(100dvh - var\(--site-header-height, 4rem\)\);[^}]*overflow: hidden;/,
    )
  })
})
