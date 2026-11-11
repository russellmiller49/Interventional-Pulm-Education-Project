import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { cleanup, fireEvent, render } from '@testing-library/react'

jest.mock('@/i18n/navigation', () =>
  jest.requireActual('../test-support/mcsWorkbenchStubs').navigationModule(),
)
jest.mock('../components/McsAnatomy3D', () =>
  jest.requireActual('../test-support/mcsWorkbenchStubs').anatomyModule(),
)

import { McsStoryProblems } from '../components/stage/McsStoryProblems'
import {
  MCS_EXPLAIN_FOLDED_PANEL_SECTIONS,
  MCS_WHOLE_GRAMMAR_TABLE_SECTIONS,
} from '../content/explainFocus'
import { mcsStageLessonIds } from '../content/stageLessons'
import { mcsStoryProblemsFor } from '../content/storyProblems'
import { mcsGrammarRowsFor, MCS_SUPPORT_GRAMMAR } from '../content/supportGrammar'
import {
  commitTransfer,
  currentStepId,
  mountSection,
  setupMcsStage,
  teardownMcsStage,
} from '../test-support/mcsStage'

/**
 * The first text cut (2026-11-10). Measured on screen, the module's 68 steps showed about 26,350
 * words; an Explain step opened every block at once, and 12% of the words were paragraphs
 * repeated within a section. These four cuts remove no sentence: each shows something once or
 * folds it under a heading. Together they took about a tenth off the visible text.
 */
afterEach(() => {
  cleanup()
  teardownMcsStage()
})

/** Open a step from "Tasks in this section": every step is open, in any order. */
function openTask(suffix: string) {
  const sectionId = currentStepId().replace(/-[a-z-]+$/, '')
  const list = [...document.querySelectorAll('details')].find((details) =>
    /Tasks in this section/.test(details.querySelector('summary')?.textContent ?? ''),
  )!
  const buttons = [...list.querySelectorAll('button')]
  for (const button of buttons) {
    fireEvent.click(button)
    if (currentStepId().endsWith(`-${suffix}`)) return
  }
  throw new Error(`No ${suffix} step in ${sectionId}`)
}

const q = <T extends Element = HTMLElement>(selector: string) => document.querySelector<T>(selector)

describe('what an Explain step folds, as data', () => {
  it('names only real sections and real panel sub-sections', () => {
    for (const id of MCS_WHOLE_GRAMMAR_TABLE_SECTIONS) expect(mcsStageLessonIds).toContain(id)
    const dir = join(
      process.cwd(),
      'src/features/mechanical-circulatory-support/components/teaching',
    )
    const panels = readdirSync(dir)
      .filter((name) => name.endsWith('Panel.tsx'))
      .map((name) => readFileSync(join(dir, name), 'utf8'))
      .join('\n')
    for (const [sectionId, ids] of Object.entries(MCS_EXPLAIN_FOLDED_PANEL_SECTIONS)) {
      expect(mcsStageLessonIds).toContain(sectionId)
      for (const id of ids) expect(panels).toContain(`id="${id}"`)
    }
  })
})

describe('the diagnostic table on Explain', () => {
  beforeEach(() => setupMcsStage())

  it("prints this section's rows, with the whole table one press away", () => {
    mountSection('impella-suction-purge-rv')
    openTask('explain')
    const mine = q('[data-grammar-rows="section"]')!
    const wanted = mcsGrammarRowsFor('impella-suction-purge-rv').map((row) => row.id)
    expect(
      [...mine.querySelectorAll('[data-grammar-row]')].map((row) =>
        row.getAttribute('data-grammar-row'),
      ),
    ).toEqual(
      MCS_SUPPORT_GRAMMAR.rows.filter((row) => wanted.includes(row.id)).map((row) => row.id),
    )
    const whole = q<HTMLDetailsElement>('[data-grammar-whole]')!
    expect(whole.open).toBe(false)
    expect(whole.querySelectorAll('[data-grammar-row]')).toHaveLength(
      MCS_SUPPORT_GRAMMAR.rows.length,
    )
  })

  it('stays whole where it first stands open and in the capstone', () => {
    for (const id of MCS_WHOLE_GRAMMAR_TABLE_SECTIONS) {
      mountSection(id)
      openTask('explain')
      expect(q('[data-grammar-whole]')).toBeNull()
      expect(document.querySelectorAll('[data-support-grammar] [data-grammar-row]')).toHaveLength(
        MCS_SUPPORT_GRAMMAR.rows.length,
      )
      cleanup()
    }
  })
})

describe('the live panel, on the steps where it stands open', () => {
  beforeEach(() => setupMcsStage())

  it('folds the parts the step is not about, and keeps their live values in the heading', () => {
    mountSection('impella-suction-purge-rv')
    openTask('explain')
    for (const id of MCS_EXPLAIN_FOLDED_PANEL_SECTIONS['impella-suction-purge-rv']) {
      const section = q<HTMLDetailsElement>(`[data-panel-section="${id}"]`)!
      expect(section.tagName).toBe('DETAILS')
      expect(section).toHaveAttribute('data-panel-folded')
      expect(section.open).toBe(false)
      expect(section.querySelector('[data-panel-folded-note]')?.textContent).toMatch(/\S/)
    }
    expect(q('[data-panel-section="rv-papi"] [data-panel-folded-note]')).toHaveTextContent(
      /Right atrial pressure \d+ mm Hg · pulsatility ratio/,
    )
    // The section's idea (two pump numbers, kept apart) and its target stay open.
    expect(q('[data-panel-section="rv-flow"]')!.tagName).toBe('SECTION')
    expect(q('[data-panel-section="rv-pathways"]')!.tagName).toBe('SECTION')
  })

  it('folds the same parts on Recognize, the other step where the panel stands open', () => {
    mountSection('impella-suction-purge-rv')
    expect(currentStepId()).toBe('impella-suction-purge-rv-recognize')
    for (const id of MCS_EXPLAIN_FOLDED_PANEL_SECTIONS['impella-suction-purge-rv'])
      expect(q(`[data-panel-section="${id}"]`)).toHaveAttribute('data-panel-folded')
    expect(q('[data-panel-section="rv-pathways"]')!.tagName).toBe('SECTION')
  })

  it('folds nothing in a section with no entry', () => {
    mountSection('lvad-alarms-emergencies')
    openTask('explain')
    expect(q('[data-panel-folded]')).toBeNull()
  })
})

describe('paragraphs that used to repeat on every step', () => {
  beforeEach(() => setupMcsStage())

  it('opens "What the change does" while acting and on Explain, and folds it on Observe', () => {
    mountSection('lvad-alarms-emergencies')
    const folded = () => q('[data-teaching-block="mechanism"]')!.closest('details') !== null
    openTask('act')
    expect(folded()).toBe(false)
    openTask('observe')
    expect(folded()).toBe(true)
    openTask('explain')
    expect(folded()).toBe(false)
  })

  it('opens each of the three paragraphs where it belongs, in the introductory sections', () => {
    mountSection('lvad-parameters-assessment')
    const inRest = (selector: string) => q(selector)!.closest('[data-why-it-moved-rest]') !== null
    openTask('act')
    expect(inRest('[data-what-the-action-does]')).toBe(false)
    expect(inRest('[data-flow-account-note]')).toBe(true)
    expect(inRest('[data-does-not-establish]')).toBe(true)
    openTask('observe')
    expect(inRest('[data-what-the-action-does]')).toBe(true)
    expect(inRest('[data-flow-account-note]')).toBe(false)
    openTask('explain')
    expect(q('[data-why-it-moved-rest]')).toBeNull()
    openTask('transfer')
    // All three are still there for a learner who opens this step first, one press away.
    expect(q('[data-why-it-moved-rest] summary')).toHaveTextContent(
      'Why it moved, from this section',
    )
    expect(inRest('[data-does-not-establish]')).toBe(true)
  })
})

describe('two story problems that start from one state', () => {
  it('print the starting values once, and say the second is the same illustration', () => {
    const stories = mcsStoryProblemsFor('impella-suction-purge-rv')
    expect(stories[0].baselineId).toBe(stories[1].baselineId)
    const { container } = render(<McsStoryProblems stories={stories} />)
    const [first, second] = [...container.querySelectorAll('[data-story]')]
    expect(first.querySelector('[data-story-baseline-shared]')).toBeNull()
    expect(first.querySelector('[data-story-baseline-id]')!.closest('details')).toBeNull()
    expect(second.querySelector('[data-story-baseline-shared]')).toHaveTextContent(
      'not the patient on the monitor',
    )
    const again = second.querySelector<HTMLDetailsElement>('[data-story-baseline-again]')!
    expect(again.open).toBe(false)
    expect(again.querySelector('[data-story-baseline-id]')).not.toBeNull()
  })
})

describe('the section recap on the last step', () => {
  beforeEach(() => setupMcsStage())

  it('waits under its heading until the closing answer is committed, then opens', () => {
    mountSection('lvad-parameters-assessment')
    openTask('transfer')
    const recap = q('[data-section-recap]')!
    expect(recap).toHaveAttribute('data-recap-folded')
    const fold = recap.querySelector<HTMLDetailsElement>('[data-section-recap-fold]')!
    expect(fold.open).toBe(false)
    // Still there, one press away: the objective and the distinctions are inside the fold.
    expect(fold.querySelector('[data-recap-objective]')).not.toBeNull()
    expect(fold.querySelector('[data-recap-distinctions]')).not.toBeNull()

    commitTransfer('lvad-parameters-assessment')
    expect(q('[data-section-recap]')).not.toHaveAttribute('data-recap-folded')
    expect(q('[data-section-recap-fold]')).toBeNull()
    expect(q('[data-recap-objective]')).not.toBeNull()
  })

  it("keeps the module's one boundary statement outside the fold, on the closing screen", () => {
    mountSection('mcs-device-selection-integration')
    openTask('transfer')
    const statement = q('[data-section-recap] [data-teaching-simulator-statement]')!
    expect(statement).not.toBeNull()
    expect(statement.closest('details')).toBeNull()
  })
})

describe('the "This section" framing', () => {
  beforeEach(() => setupMcsStage())

  it('keeps the question and the one idea open, and folds the rest under one heading', () => {
    mountSection('lvad-alarms-emergencies')
    const framing = q('[data-teaching-block="framing"]')!
    const more = framing.querySelector<HTMLDetailsElement>('[data-framing-more]')!
    expect(more.open).toBe(false)
    expect(more.querySelector('summary')).toHaveTextContent('More about this section')
    expect(more).toHaveTextContent('By the end you can:')
    expect(more).toHaveTextContent('On the screen right now:')
    expect(more).toHaveTextContent('Look here:')
    const open = [...framing.querySelectorAll('p')].filter((p) => !p.closest('details'))
    expect(open.some((p) => p.textContent?.startsWith('One idea:'))).toBe(true)
  })
})
