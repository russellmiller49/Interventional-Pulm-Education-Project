import { act, fireEvent, render } from '@testing-library/react'

import { ImagingStageHost } from '../components/stage/ImagingStageHost'
import { controlElementId } from '../components/suite/types'
import { imagingStageLesson, type ImagingStageLesson } from '../content/stageLessons'
import type { ImagingSectionId } from '../content/pathway'

/**
 * Drives a section on the real lesson stage over the real engine, the way a learner does: the
 * Now card's one primary action, a control on the suite, a pin on the chain map. Nothing here
 * reaches into the session.
 *
 * Callers mount the suite double first:
 * `jest.mock('../components/suite/ImagingSuitePane', () => require('../test-support/SuiteTestDouble').suitePaneDouble)`
 * and mock `@/i18n/navigation`; both are per-suite concerns.
 */
export function mountSection(sectionId: ImagingSectionId): { lesson: ImagingStageLesson } {
  const lesson = imagingStageLesson(sectionId)
  window.history.replaceState(null, '', `/peripheral-imaging/learn?section=${sectionId}`)
  render(<ImagingStageHost sectionId={sectionId} />)
  act(() => {
    jest.advanceTimersByTime(10)
  })
  return { lesson }
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

/** Choose a stop on the chain map's answer fieldset and commit it. */
export function commitChainChoice(pattern: RegExp) {
  const labels = [...document.querySelectorAll<HTMLLabelElement>('[data-chain-answer] label')]
  const label = labels.find((candidate) => pattern.test(candidate.textContent ?? ''))
  if (!label) {
    throw new Error(
      `No chain choice matches ${pattern} on step ${currentStepId()}; choices: ${labels.map((l) => l.textContent?.trim()).join(' | ')}`,
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
  const element = document.getElementById(controlElementId(key))
  if (!element) throw new Error(`No control ${key} on step ${currentStepId()}`)
  return element
}

export function setRange(key: string, value: number) {
  fireEvent.input(control(key), { target: { value: String(value) } })
  fireEvent.change(control(key), { target: { value: String(value) } })
}

export function setToggle(key: string, checked: boolean) {
  const element = control(key) as HTMLInputElement
  if (element.checked !== checked) fireEvent.click(element)
}

export function setSelect(key: string, value: string) {
  fireEvent.change(control(key), { target: { value } })
}

/** Place every row of the open sort on its keyed origin, or on the given origin ids. */
export function placeSortRows(answers?: Readonly<Record<string, string>>) {
  const rows = [...document.querySelectorAll<HTMLElement>('[data-imaging-sort] [data-sort-row]')]
  if (rows.length === 0) throw new Error(`No sort on step ${currentStepId()}`)
  for (const row of rows) {
    const select = row.querySelector('select')!
    const rowId = row.getAttribute('data-sort-row')!
    const value = answers?.[rowId] ?? [...select.options].find((option) => option.value)!.value
    fireEvent.change(select, { target: { value } })
  }
}

/** The whole document, hidden nodes included, with the answer fieldsets removed. */
export function scannableText(): string {
  const clone = document.body.cloneNode(true) as HTMLElement
  for (const node of clone.querySelectorAll('[data-prediction-choices], [data-chain-answer]'))
    node.remove()
  for (const node of clone.querySelectorAll('script, style')) node.remove()
  return clone.textContent ?? ''
}

export function attributesText(): string {
  return [...document.body.querySelectorAll('*')]
    .flatMap((node) =>
      [...node.attributes]
        .filter((a) =>
          /^(aria-|title|alt|data-verdict|data-plausibility|data-lit|data-chain-outcome)/.test(
            a.name,
          ),
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

/** Coached work through real controls; used before the independent boundary assertions. */
export function performGuidedStep(lesson: ImagingStageLesson) {
  const step = lesson.steps.find((s) => s.id === currentStepId())!
  if (step.interaction.kind === 'read') {
    clickPrimary()
    return
  }
  if (step.interaction.kind === 'sort') {
    for (const row of step.interaction.sort.rows)
      fireEvent.change(document.querySelector(`[data-sort-row="${row.id}"] select`)!, {
        target: { value: row.origin },
      })
    clickPrimary()
    clickPrimary()
    return
  }
  const observe = step.interaction.kind === 'observe'
  const clickControl = (key: string) => fireEvent.click(control(key))
  switch (lesson.sectionId) {
    case 'chain-walk':
      setRange('orbit', 25)
      for (let i = 0; i < 6; i++) clickPrimary()
      break
    case 'projection':
      setRange('orbit', observe ? 0 : 35)
      break
    case 'signal':
      setRange('orbit', -35)
      break
    case 'field':
      if (observe) {
        setToggle('crop', true)
        setRange('zoom', 1.5)
      } else setRange('field', 90)
      break
    case 'time':
      if (observe) {
        setRange('width', 5)
        setSelect('rate', '3.75')
      } else setRange('width', 10)
      break
    case 'good-image':
      setRange('orbit', 35)
      setRange('zoom', 1.5)
      break
    case 'two-dimensional':
      setRange('orbit', 35)
      setRange('field', 90)
      setRange('zoom', 1.5)
      break
    case 'current-anatomy':
      if (observe) clickControl('capture')
      else setRange('shift', 20)
      break
    case 'changing-anatomy':
      if (observe) setToggle('overlay', false)
      else {
        clickControl('capture')
        setRange('shift', 20)
      }
      break
    case 'dts-acquisition':
      if (observe) setRange('sweep', 50)
      else {
        setRange('plane', -18)
        setRange('plane', 0)
      }
      break
    case 'cbct-acquisition':
      if (observe) setRange('offsetX', 20)
      else {
        clickControl('center')
        ;['target', 'clearance', 'state', 'protection'].forEach((k) => setToggle(k, true))
        clickControl('captured')
      }
      break
    case 'fixed-suite':
      setRange('acquisitionOrbit', 35)
      setRange('offsetX', 5)
      break
    case 'mobile-suite':
      clickControl('center')
      setRange('acquisitionOrbit', 35)
      break
    case 'tool-confirmation':
      if (observe) {
        setToggle('slab', true)
        setToggle('slab', false)
        setToggle('revealed', true)
      } else {
        setRange('tipX', 10)
        setRange('tipY', 0)
        setRange('tipZ', 0)
      }
      break
    case 'staff-protection':
      if (observe) {
        setToggle('shield', true)
        setRange('orbit', 60)
      } else setRange('distance', 2.5)
      break
    case 'dose-reporting':
      setRange('area', 100)
      break
    default:
      throw new Error(`No guided action authored in harness for ${lesson.sectionId}`)
  }
  clickPrimary()
}

export function reachIndependent(lesson: ImagingStageLesson) {
  for (let count = 0; currentStepId() !== lesson.steps[lesson.predictionStepIndex].id; count++) {
    if (count > lesson.steps.length) throw new Error('Independent interpretation not reachable')
    performGuidedStep(lesson)
  }
}
