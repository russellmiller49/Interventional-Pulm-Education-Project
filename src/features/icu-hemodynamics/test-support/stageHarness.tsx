import { act, fireEvent, render } from '@testing-library/react'

import { HemodynamicsStageHost } from '../components/stage/HemodynamicsStageHost'
import { hemodynamicsStageLesson } from '../content/stageLessons'

/**
 * Drives a section on the real lesson stage, over the real engine, the way a learner does: the
 * Now card's one primary action, a control in a dock, a pin on the catheter map. Nothing here
 * reaches into the session; the engine's clock is the fake timer.
 *
 * Callers must mock `@/i18n/navigation` before mounting (the stage links and routes) and use fake
 * timers; both are per-suite concerns.
 */
export function mountSection(sectionId: string) {
  const lesson = hemodynamicsStageLesson(sectionId)
  window.history.replaceState(null, '', `/icu-hemodynamics/learn?activity=${sectionId}`)
  const view = render(<HemodynamicsStageHost sectionId={sectionId} />)
  act(() => {
    jest.advanceTimersByTime(10)
  })
  return { lesson, view }
}

export function currentStepId(): string | null {
  return document.querySelector('[data-stage]')?.getAttribute('data-stage') ?? null
}

export function nowPrimary(): HTMLButtonElement | null {
  return document.querySelector<HTMLButtonElement>('[data-now-card] [data-now-primary]')
}

export function nowStatus(): string {
  return document.querySelector('[data-now-status]')?.textContent?.trim() ?? ''
}

export function clickPrimary() {
  const button = nowPrimary()
  if (!button) throw new Error(`No primary action on step ${currentStepId()}`)
  if (button.disabled) throw new Error(`The primary action is disabled on step ${currentStepId()}`)
  fireEvent.click(button)
}

/** Choose a prediction choice by its label and commit it. */
export function commitChoice(pattern: RegExp) {
  const labels = [...document.querySelectorAll<HTMLLabelElement>('[data-prediction-choices] label')]
  const label = labels.find((candidate) => pattern.test(candidate.textContent ?? ''))
  if (!label) {
    throw new Error(
      `No choice matches ${pattern} on step ${currentStepId()}; choices: ${labels.map((l) => l.textContent?.trim()).join(' | ')}`,
    )
  }
  fireEvent.click(label.querySelector('input')!)
  clickPrimary()
}

export function goalStates(): readonly string[] {
  return [...document.querySelectorAll('[data-step-goals] li')].map(
    (item) => item.getAttribute('data-met') ?? 'unknown',
  )
}

export function control(key: string): HTMLElement {
  const element = document.getElementById(`hemodynamics-control-${key}`)
  if (!element) throw new Error(`No control ${key} on step ${currentStepId()}`)
  return element
}

export function setLevel(levelCm: number) {
  fireEvent.input(control('level'), { target: { value: String(levelCm) } })
  fireEvent.change(control('level'), { target: { value: String(levelCm) } })
}

/** Run the flush, say what it is, and repair the line when the reading needed a repair. */
export function readAndRepairFlush(kind: 'acceptable' | 'overdamped' | 'underdamped') {
  fireEvent.click(control('flush'))
  const label = [
    ...document.querySelectorAll<HTMLLabelElement>('[data-flush-classification] label'),
  ].find((candidate) => new RegExp(kind, 'i').test(candidate.textContent ?? ''))
  if (!label) throw new Error('The flush classification did not render')
  fireEvent.click(label.querySelector('input')!)
  const say = [...document.querySelectorAll<HTMLButtonElement>('[data-dock="flush"] button')].find(
    (button) => button.textContent?.trim() === 'Say what it is',
  )
  if (!say) throw new Error('No "Say what it is" control')
  fireEvent.click(say)
  const repair = document.getElementById('hemodynamics-control-repair')
  if (repair) fireEvent.click(repair)
}

/** The whole document, hidden nodes included, with the answer fieldsets removed. */
export function scannableText(): string {
  const clone = document.body.cloneNode(true) as HTMLElement
  for (const node of clone.querySelectorAll(
    '[data-prediction-choices], [data-catheter-map-answer]',
  ))
    node.remove()
  for (const node of clone.querySelectorAll('script, style')) node.remove()
  return clone.textContent ?? ''
}

export function attributesText(): string {
  return [...document.body.querySelectorAll('*')]
    .flatMap((node) =>
      [...node.attributes]
        .filter((a) =>
          /^(aria-|title|alt|data-verdict|data-plausibility|data-lit|data-tip)/.test(a.name),
        )
        .map((a) => a.value),
    )
    .join(' ')
}

export function leakMatches(text: string, patterns: readonly RegExp[]): readonly string[] {
  return patterns.filter((pattern) => pattern.test(text)).map((pattern) => pattern.source)
}

export function installDom() {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
  }
  Element.prototype.scrollIntoView = jest.fn()
  if (!('clipboard' in navigator)) {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
  }
}
