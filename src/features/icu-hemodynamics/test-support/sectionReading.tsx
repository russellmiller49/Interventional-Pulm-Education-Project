import { act, cleanup, fireEvent } from '@testing-library/react'

import { hemodynamicsStageLesson } from '../content/stageLessons'
import { currentStepId, mountSection } from './stageHarness'

/**
 * How long a section takes to read, measured from what its task cards draw.
 *
 * The section minutes on the map and in each lesson's header are this reading time plus the
 * section's case (`minutes` on the case definition; cases are timed on their own and are not
 * measured here). Owner ruling 2026-11-14 ("Rebuild per section"): the stated minutes follow the
 * measured on-screen text, the same way the MCS minutes were rebuilt in PR #483.
 *
 * What counts, per task, on the Now card (`[data-now-card]`), walked as a learner who works the
 * section: every task opened in order from "Tasks in this section", and each question answered
 * (its first choice, then Check) before the card is read, so the teaching that opens after the
 * commitment is counted. Words are text nodes split on white space, except
 *   - screen-reader-only text (`sr-only`, the module's `srOnly`, the map's `equivalent`),
 *   - anything under a closed `<details>` other than its `<summary>` (a fold is one press away and
 *     not read by default; this is the measure that made the Explain folds a saving),
 *   - `hidden` elements and SVG text (axis and figure labels are looked at, not read).
 * The case step's card is left out: the case's own minutes cover it.
 *
 * Simulated actions are not performed, so text an action reveals is not counted; the reading time
 * is a floor for a learner who also works the simulator, which is what the case minutes and the
 * rounding absorb.
 *
 * Callers must mock `@/i18n/navigation` and use fake timers, as for `stageHarness`.
 */
export const HEMODYNAMICS_READING_WPM = 200

export interface SectionReading {
  readonly sectionId: string
  /** Words drawn on each task's card, in task order, the case step excluded. */
  readonly steps: readonly { readonly id: string; readonly words: number }[]
  readonly words: number
  /** `words / HEMODYNAMICS_READING_WPM`, rounded to the nearest minute, at least 1. */
  readonly minutes: number
}

const HIDDEN_CLASS = /(^|\s)(sr-only|srOnly|equivalent)(\s|$)/
const SVG_NS = 'http://www.w3.org/2000/svg'

function isDrawn(text: Node, root: Element): boolean {
  for (let el = text.parentElement; el && el !== root.parentElement; el = el.parentElement) {
    if (HIDDEN_CLASS.test(el.getAttribute('class') ?? '')) return false
    if (el.hasAttribute('hidden') || el.namespaceURI === SVG_NS) return false
    if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'TEMPLATE') return false
    const parent = el.parentElement
    if (
      parent?.tagName === 'DETAILS' &&
      !(parent as HTMLDetailsElement).open &&
      el.tagName !== 'SUMMARY'
    )
      return false
  }
  return true
}

/** Words drawn inside `root`, by the rules above. */
export function drawnWords(root: Element): number {
  let total = 0
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!isDrawn(node, root)) continue
    const text = (node.textContent ?? '').trim()
    if (text) total += text.split(/\s+/).length
  }
  return total
}

function answerQuestionIfAny() {
  const choice = document.querySelector<HTMLInputElement>(
    '[data-prediction-choices] input:not(:disabled)',
  )
  if (!choice) return
  fireEvent.click(choice)
  const check = [
    ...document.querySelectorAll<HTMLButtonElement>('[data-now-card] [data-question-check]'),
  ].find((button) => !button.disabled)
  if (check) fireEvent.click(check)
  act(() => {
    jest.advanceTimersByTime(10)
  })
}

function openTask(index: number) {
  const button = document.querySelectorAll<HTMLButtonElement>('[data-step-list] li button')[index]
  if (!button) throw new Error(`No task ${index + 1} in "Tasks in this section"`)
  fireEvent.click(button)
  act(() => {
    jest.advanceTimersByTime(10)
  })
}

export function measureSectionReading(sectionId: string): SectionReading {
  const lesson = hemodynamicsStageLesson(sectionId)
  mountSection(sectionId)
  const steps: { id: string; words: number }[] = []
  try {
    lesson.steps.forEach((step, index) => {
      if (index > 0) openTask(index)
      if (currentStepId() !== step.id) {
        throw new Error(`Expected task ${step.id}, found ${currentStepId()}`)
      }
      if (step.interaction.kind === 'case') return
      answerQuestionIfAny()
      const card = document.querySelector('[data-now-card]')
      if (!card) throw new Error(`No task card on ${step.id}`)
      steps.push({ id: step.id, words: drawnWords(card) })
    })
  } finally {
    cleanup()
  }
  const words = steps.reduce((sum, step) => sum + step.words, 0)
  return {
    sectionId,
    steps,
    words,
    minutes: Math.max(1, Math.round(words / HEMODYNAMICS_READING_WPM)),
  }
}
