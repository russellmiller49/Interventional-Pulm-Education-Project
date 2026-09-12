import { act, fireEvent, render } from '@testing-library/react'

import { scopeControlId, type ScopeCommand } from '../components/scope/types'
import { BronchStageHost } from '../components/stage/BronchStageHost'
import { ledgerRowMg } from '../components/stage/BronchLedgerControl'
import type { BronchSectionId } from '../content/pathway'
import {
  bronchStageLesson,
  type BronchStageLesson,
  type BronchStageStep,
} from '../content/stageLessons'
import { ScopePilot, type ScopeTransport } from './scopePilot'
import { latestScopePaneProps } from './ScopeTestDouble'
import { teachingCase } from './teachingCase'

/**
 * Drives a section on the real lesson stage over the real engine, the way a learner does: the
 * Now card's one primary action, a control on the scope pane, a row on a card. Nothing here
 * reaches into the session.
 *
 * Callers mount the pane double and the graph-only case first:
 * `jest.mock('../components/scope/ScopePane', () => require('../test-support/ScopeTestDouble').scopePaneDouble)`
 * `jest.mock('../components/stage/scopeCaseLoader', () => ({ loadStageScopeCase: () => Promise.resolve(require('../test-support/teachingCase').teachingCase()) }))`
 * and mock `@/i18n/navigation`; all are per-suite concerns.
 */
export async function mountSection(
  sectionId: BronchSectionId,
): Promise<{ lesson: BronchStageLesson }> {
  const lesson = bronchStageLesson(sectionId)
  window.history.replaceState(null, '', `/bronchoscopy-foundations/learn?section=${sectionId}`)
  render(<BronchStageHost sectionId={sectionId} />)
  await settle()
  return { lesson }
}

/** Flushes timers, the case loader's promise and the effects that follow it. */
export async function settle() {
  await act(async () => {
    jest.advanceTimersByTime(10)
    await Promise.resolve()
  })
  await act(async () => {
    await Promise.resolve()
  })
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

export function verdictOutcome(): string | null {
  return (
    document.querySelector('[data-answer-verdict]')?.getAttribute('data-verdict-outcome') ?? null
  )
}

export function stepRows(): readonly string[] {
  return [...document.querySelectorAll('[data-step-list] li')].map(
    (row) => row.getAttribute('data-step-state') ?? '',
  )
}

/** The keyed choice of a prediction step, by id — the test never depends on the item's words. */
export function keyedChoiceId(step: BronchStageStep): string {
  if (step.interaction.kind !== 'prediction') throw new Error(`${step.id} is not a prediction`)
  const best = step.interaction.stage.item.choices.find((choice) => choice.plausibility === 'best')
  if (!best) throw new Error(`${step.id} has no keyed choice`)
  return best.id
}

export function otherChoiceId(step: BronchStageStep): string {
  if (step.interaction.kind !== 'prediction') throw new Error(`${step.id} is not a prediction`)
  const other = step.interaction.stage.item.choices.find((choice) => choice.plausibility !== 'best')
  if (!other) throw new Error(`${step.id} has no distractor`)
  return other.id
}

export function commitById(choiceId: string) {
  const input = document.querySelector<HTMLInputElement>(
    `[data-prediction-choices] input[value="${choiceId}"]`,
  )
  if (!input) throw new Error(`No choice ${choiceId} on step ${currentStepId()}`)
  fireEvent.click(input)
  clickPrimary()
}

export function goalStates(): readonly string[] {
  return [...document.querySelectorAll('[data-step-goals] li')].map(
    (item) => item.getAttribute('data-met') ?? 'unknown',
  )
}

export function control(key: string): HTMLElement {
  const element = document.getElementById(scopeControlId(key))
  if (!element) throw new Error(`No control ${key} on step ${currentStepId()}`)
  return element
}

export function controlsFieldset(): HTMLFieldSetElement | null {
  return document.querySelector<HTMLFieldSetElement>('[data-scope-controls]')
}

export function setRange(key: string, value: number) {
  fireEvent.input(control(key), { target: { value: String(value) } })
  fireEvent.change(control(key), { target: { value: String(value) } })
}

/**
 * The scope through the host: every command goes through the pane's `onCommand` — the same seam
 * the dock's controls use — inside `act`, and the state read back is the one the host handed the
 * pane on its last render.
 */
export function scopeTransport(): ScopeTransport {
  const props = () => {
    const latest = latestScopePaneProps()
    if (!latest) throw new Error(`No scope pane on step ${currentStepId()}`)
    return latest
  }
  return {
    get view() {
      return props().view
    },
    get state() {
      return props().state
    },
    scopeCase: teachingCase(),
    send(command: ScopeCommand) {
      act(() => {
        props().onCommand(command, 'keyboard')
      })
    },
  }
}

export function scopePilot(): ScopePilot {
  return new ScopePilot(scopeTransport())
}

/** Place every row of the open sort on its keyed origin, or on the given origin ids. */
export function placeSortRows(step: BronchStageStep, answers?: Readonly<Record<string, string>>) {
  if (step.interaction.kind !== 'sort') throw new Error(`${step.id} is not a sort`)
  for (const row of step.interaction.sort.rows) {
    const select = document.querySelector<HTMLSelectElement>(
      `[data-bronch-sort] [data-sort-row="${row.id}"] select`,
    )
    if (!select) throw new Error(`No sort row ${row.id} on step ${currentStepId()}`)
    fireEvent.change(select, { target: { value: answers?.[row.id] ?? row.origin } })
  }
}

/** Name every row of the open identify set with its keyed choice, or with the given choices. */
export function nameIdentifyRows(
  step: BronchStageStep,
  answers?: Readonly<Record<string, string>>,
) {
  if (step.interaction.kind !== 'identify') throw new Error(`${step.id} is not an identify`)
  for (const row of step.interaction.identify.rows) {
    const value = answers?.[row.id] ?? row.answerId
    const input = document.querySelector<HTMLInputElement>(
      `[data-identify-row="${row.id}"] input[value="${value}"]`,
    )
    if (!input) throw new Error(`No choice ${value} on identify row ${row.id}`)
    fireEvent.click(input)
  }
}

function sequencePositions(): string[] {
  return [...document.querySelectorAll('[data-bronch-sequence] [data-sequence-step]')].map(
    (item) => item.getAttribute('data-sequence-step')!,
  )
}

/** Move the open sequence into the given order (the authored one by default), one step at a time. */
export function orderSequence(step: BronchStageStep, order?: readonly string[]) {
  if (step.interaction.kind !== 'sequence') throw new Error(`${step.id} is not a sequence`)
  const target = order ?? step.interaction.sequence.steps.map((entry) => entry.id)
  for (let index = 0; index < target.length; index += 1) {
    let position = sequencePositions().indexOf(target[index])
    if (position < 0) throw new Error(`Sequence step ${target[index]} is not on the card`)
    while (position > index) {
      const item = document.querySelector<HTMLElement>(
        `[data-bronch-sequence] [data-sequence-step="${target[index]}"]`,
      )
      const up = item?.querySelector<HTMLButtonElement>('button[aria-label^="Move up"]')
      if (!up) throw new Error(`No move-up control for ${target[index]}`)
      fireEvent.click(up)
      position = sequencePositions().indexOf(target[index])
    }
  }
}

/** Enter the arithmetic for every measured line of the open ledger. */
export function fillLedgerEntries(step: BronchStageStep) {
  if (step.interaction.kind !== 'ledger') throw new Error(`${step.id} is not a ledger`)
  for (const row of step.interaction.ledger.rows) {
    if (row.kind !== 'measured') continue
    const input = document.querySelector<HTMLInputElement>(
      `[data-ledger-row="${row.id}"] input[type="number"]`,
    )
    if (!input) throw new Error(`No entry for ledger row ${row.id}`)
    fireEvent.change(input, {
      target: { value: String(ledgerRowMg(row.concentrationMgPerMl, row.volumeMl)) },
    })
  }
}

/** Answer the open ledger's question with the choice of the given plausibility. */
export function answerLedger(
  step: BronchStageStep,
  plausibility: 'best' | 'unsafe' | 'incorrect-mechanism' | 'reasonable-but-incomplete',
) {
  if (step.interaction.kind !== 'ledger') throw new Error(`${step.id} is not a ledger`)
  const choice = step.interaction.ledger.totalChoices.find(
    (candidate) => candidate.plausibility === plausibility,
  )
  if (!choice) throw new Error(`The ledger has no ${plausibility} total`)
  const input = document.querySelector<HTMLInputElement>(
    `[data-ledger-total] input[value="${choice.id}"]`,
  )
  if (!input) throw new Error(`No ledger total ${choice.id}`)
  fireEvent.click(input)
  const answer = document.querySelector<HTMLButtonElement>('[data-ledger-answer]')
  if (!answer) throw new Error('No ledger answer control')
  fireEvent.click(answer)
}

/** Choose an option on one report field: the first supported one, or the first unsupported. */
export function chooseReportOption(step: BronchStageStep, fieldId: string, supported: boolean) {
  if (step.interaction.kind !== 'report') throw new Error(`${step.id} is not a report`)
  const field = step.interaction.report.fields.find((candidate) => candidate.id === fieldId)
  const option = field?.options.find((candidate) => candidate.supported === supported)
  if (!option)
    throw new Error(`Field ${fieldId} has no ${supported ? 'supported' : 'unsupported'} option`)
  const input = document.querySelector<HTMLInputElement>(
    `[data-report-field="${fieldId}"] input[value="${option.id}"]`,
  )
  if (!input) throw new Error(`No option ${option.id} on field ${fieldId}`)
  fireEvent.click(input)
}

export function fillReport(step: BronchStageStep) {
  if (step.interaction.kind !== 'report') throw new Error(`${step.id} is not a report`)
  for (const field of step.interaction.report.fields) chooseReportOption(step, field.id, true)
}

/** Decide the current scenario frame with the choice of the given plausibility. */
export function decideFrame(
  step: BronchStageStep,
  plausibility: 'best' | 'unsafe' | 'incorrect-mechanism' | 'reasonable-but-incomplete',
) {
  if (step.interaction.kind !== 'scenario') throw new Error(`${step.id} is not a scenario`)
  const frameId = document
    .querySelector('[data-bronch-scenario] [data-scenario-frame]')
    ?.getAttribute('data-scenario-frame')
  const frame = step.interaction.scenario.frames.find((candidate) => candidate.id === frameId)
  if (!frame) throw new Error('No open scenario frame')
  const choice = frame.choices.find((candidate) => candidate.plausibility === plausibility)
  if (!choice) throw new Error(`Frame ${frame.id} has no ${plausibility} choice`)
  const input = document.querySelector<HTMLInputElement>(
    `[data-scenario-frame="${frame.id}"] input[value="${choice.id}"]`,
  )
  if (!input) throw new Error(`No choice ${choice.id} on frame ${frame.id}`)
  fireEvent.click(input)
  const decide = document.querySelector<HTMLButtonElement>('[data-scenario-decide]')
  if (!decide) throw new Error('No decide control')
  fireEvent.click(decide)
}

export function decideAllFrames(step: BronchStageStep) {
  if (step.interaction.kind !== 'scenario') throw new Error(`${step.id} is not a scenario`)
  for (let i = 0; i < step.interaction.scenario.frames.length; i += 1) decideFrame(step, 'best')
}

/** The whole document, hidden nodes included, with the answer fieldsets removed. */
export function scannableText(): string {
  const clone = document.body.cloneNode(true) as HTMLElement
  for (const node of clone.querySelectorAll('[data-prediction-choices], [data-tree-answer]'))
    node.remove()
  for (const node of clone.querySelectorAll('script, style')) node.remove()
  return clone.textContent ?? ''
}

export function attributesText(): string {
  return [...document.body.querySelectorAll('*')]
    .flatMap((node) =>
      [...node.attributes]
        .filter((a) =>
          /^(aria-|title|alt|data-verdict|data-plausibility|data-lit|data-tree-outcome)/.test(
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
