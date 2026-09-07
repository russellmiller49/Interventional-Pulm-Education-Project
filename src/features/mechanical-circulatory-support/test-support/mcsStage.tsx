/**
 * Drives a section on the real lesson stage over the real reducer.
 *
 * The stubs are the same module boundaries the workbench suites use — navigation, WebGL, the two
 * lazy previews — reached through `mcsWorkbenchStubs`. Everything else is real: the contracts, the
 * specs, the stage adapter, the reducer, the progress functions, the map. Callers register the
 * mocks themselves (a `jest.mock` factory cannot be hoisted out of a test file); `setupMcsStage`
 * and `teardownMcsStage` handle the environment.
 *
 * Every driver moves a control a learner can see and reach. None dispatches a contract's own
 * action id, because satisfying a predicate by re-sending the authoring data proves nothing about
 * the stage.
 */
import { fireEvent, render, screen, within, type RenderResult } from '@testing-library/react'

import { McsStageHost } from '../components/stage/McsStageHost'
import { mcsLessonTransferByLessonId } from '../content/lessonTransfers'
import { mcsSectionLearningContractById } from '../content/sectionLearningContracts'
import { mockRouterPush } from './mcsWorkbenchStubs'

export function setupMcsStage(options: { readonly route?: string } = {}): void {
  mockRouterPush.mockReset()
  window.localStorage.clear()
  window.history.replaceState(null, '', options.route ?? '/mechanical-circulatory-support/learn')
  Object.defineProperty(global, 'fetch', {
    configurable: true,
    writable: true,
    value: jest.fn().mockResolvedValue({ ok: true }),
  })
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    })),
  })
  Object.defineProperty(window.HTMLElement.prototype, 'scrollTo', {
    configurable: true,
    writable: true,
    value: jest.fn(),
  })
  Object.defineProperty(window.HTMLDialogElement?.prototype ?? {}, 'showModal', {
    configurable: true,
    writable: true,
    value: function showModal(this: HTMLDialogElement) {
      this.setAttribute('open', '')
    },
  })
}

export function teardownMcsStage(): void {
  jest.useRealTimers()
}

export function mountSection(
  sectionId: string,
  initialPhase: 'recognize' | 'predict' | 'act' | 'observe' | 'explain' | 'transfer' = 'recognize',
): RenderResult {
  return render(<McsStageHost sectionId={sectionId} initialPhase={initialPhase} />)
}

/* ------------------------------------------------------------------ readers */

export function nowCard(): HTMLElement {
  const card = document.querySelector<HTMLElement>('[data-now-card]')
  if (!card) throw new Error('No Now card on the stage')
  return card
}

export function nowPrimary(): HTMLButtonElement | HTMLAnchorElement | null {
  return document.querySelector<HTMLButtonElement | HTMLAnchorElement>('[data-now-primary]')
}

export function nowStatus(): string {
  return document.querySelector('[data-now-status]')?.textContent ?? ''
}

export function currentStepId(): string {
  return (
    document
      .querySelector<HTMLElement>('[data-critical-care-activity-shell]')
      ?.getAttribute('data-stage') ?? ''
  )
}

export function stepRowStates(): readonly string[] {
  return [...document.querySelectorAll('[data-step-list] li')].map(
    (row) => row.getAttribute('data-step-state') ?? '',
  )
}

/** The answer control: the fieldset, not the map's pin labels that point into it. */
function answerFieldset(): HTMLElement | null {
  return document.querySelector<HTMLElement>('fieldset[data-prediction-choices]')
}

export function predictionRadios(): readonly HTMLInputElement[] {
  const fieldset = answerFieldset()
  if (!fieldset) return []
  return [...fieldset.querySelectorAll<HTMLInputElement>('input[type="radio"]')]
}

function chooseByLabel(label: string): void {
  const fieldset = answerFieldset()
  if (!fieldset) throw new Error('No choices on the stage')
  const input = within(fieldset).getByLabelText(new RegExp(escape(label)))
  fireEvent.click(input)
}

function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 60)
}

function clickPrimary(): void {
  const primary = nowPrimary()
  if (!primary) throw new Error('No primary action on the Now card')
  if ((primary as HTMLButtonElement).disabled) {
    throw new Error(`Primary action is disabled: ${primary.textContent ?? ''}`)
  }
  fireEvent.click(primary)
}

/* ------------------------------------------------------------------ drivers */

/** The walk on the section that walks the loop: Next stop until the last stop, then Continue. */
export function walkTheLoop(): void {
  for (let guard = 0; guard < 8; guard += 1) {
    const primary = nowPrimary()
    if (!primary) throw new Error('No primary action while walking')
    const label = primary.textContent ?? ''
    fireEvent.click(primary)
    if (/^Continue/.test(label)) return
  }
  throw new Error('The walk did not end')
}

/** Recognize: choose the option asked for (the correct one by default) and commit it. */
export function answerIdentification(
  sectionId: string,
  choose: 'correct' | 'wrong' = 'correct',
): void {
  const contract = mcsSectionLearningContractById.get(sectionId)
  if (!contract) throw new Error(`No contract for ${sectionId}`)
  const option = contract.recognizeOptions.find((candidate) =>
    choose === 'correct' ? candidate.correct : !candidate.correct,
  )
  if (!option) throw new Error(`${sectionId}: no ${choose} identification option`)
  chooseByLabel(option.label)
  clickPrimary()
}

/** Predict: choose the authored best answer (or a named plausibility) and commit it. */
export function commitPrediction(
  sectionId: string,
  plausibility: 'best' | 'unsafe' | 'incorrect-mechanism' | 'reasonable-but-incomplete' = 'best',
): void {
  const contract = mcsSectionLearningContractById.get(sectionId)
  if (!contract) throw new Error(`No contract for ${sectionId}`)
  const choice =
    contract.predictionItem.choices.find((candidate) => candidate.plausibility === plausibility) ??
    contract.predictionItem.choices[0]
  chooseByLabel(choice.label)
  clickPrimary()
}

/** The Continue inside the prediction's verdict, which is the way past the commit point. */
export function continueFromVerdict(): void {
  const button = document.querySelector<HTMLButtonElement>('[data-verdict-continue]')
  if (!button) throw new Error('No Continue in the verdict')
  fireEvent.click(button)
}

export function continueStep(): void {
  clickPrimary()
}

/**
 * Act: move the visible control the section points at until its own predicate is satisfied.
 * One entry per section, each a control a learner can see.
 */
const actionDrivers: Readonly<Record<string, () => void>> = {
  'mcs-foundations-signals': () => {
    for (const label of [
      'Read the arterial pressure',
      'Read the filling pressures and right-sided delivery',
      'Read the device and effective flow',
    ]) {
      fireEvent.click(screen.getByRole('button', { name: label }))
    }
  },
  'mcs-foundations-mechanisms': () => {
    for (const label of [
      'Select the counterpulsation mechanism',
      'Select the transvalvular pump mechanism',
      'Select the durable continuous-flow mechanism',
    ]) {
      fireEvent.click(screen.getByRole('button', { name: label }))
    }
  },
  'iabp-timing-triggering': () => {
    fireEvent.change(screen.getByRole('slider', { name: 'Inflation vs notch' }), {
      target: { value: '0' },
    })
  },
  'iabp-efficacy-limits': () => {
    fireEvent.change(screen.getByRole('slider', { name: 'RV contractility' }), {
      target: { value: '0.3' },
    })
  },
  'impella-unloading-placement': () => {
    fireEvent.change(screen.getByRole('combobox', { name: 'Placement state' }), {
      target: { value: 'too-deep' },
    })
  },
  'impella-suction-purge-rv': () => {
    fireEvent.change(screen.getByRole('combobox', { name: 'Right-sided Impella configuration' }), {
      target: { value: 'rp' },
    })
  },
  'lvad-parameters-assessment': () => {
    fireEvent.change(screen.getByRole('slider', { name: 'SVR' }), { target: { value: '2000' } })
  },
  'lvad-alarms-emergencies': () => {
    fireEvent.click(screen.getByRole('checkbox', { name: /High-power \/ thrombosis pattern/ }))
  },
  'mcs-device-selection-integration': () => {
    fireEvent.change(screen.getByRole('slider', { name: 'Performance level' }), {
      target: { value: '8' },
    })
  },
}

export function performAction(sectionId: string): void {
  const driver = actionDrivers[sectionId]
  if (!driver) throw new Error(`No action driver for section ${sectionId}`)
  driver()
}

/** The control-panel sort on the section that carries it: every candidate to its bin, committed. */
export function commitSort(): void {
  const rows = [...document.querySelectorAll<HTMLElement>('[data-sort-candidate]')]
  if (rows.length === 0) throw new Error('No sort on this step')
  const answers: Readonly<Record<string, string>> = {
    'performance-level': 'setting',
    'displayed-flow': 'monitoring',
    'assist-ratio': 'setting',
    'timing-synchrony': 'monitoring',
    'pump-power': 'monitoring',
    'right-atrial-pressure': 'loading',
    'systemic-resistance': 'loading',
  }
  for (const row of rows) {
    const id = row.getAttribute('data-sort-candidate') ?? ''
    fireEvent.change(within(row).getByRole('combobox'), { target: { value: answers[id] ?? '' } })
  }
  clickPrimary()
}

/** Transfer: work the required actions in the new patient, by their visible controls. */
const transferDrivers: Readonly<Record<string, () => void>> = {
  'mcs-foundations-signals': () => {
    for (const label of [
      'Read the arterial pressure',
      'Read the filling pressures and right-sided delivery',
      'Read the device and effective flow',
    ]) {
      fireEvent.click(screen.getByRole('button', { name: label }))
    }
  },
  'mcs-foundations-mechanisms': () => {
    fireEvent.click(screen.getByRole('button', { name: 'Select the transvalvular pump mechanism' }))
  },
  'iabp-timing-triggering': () => {
    fireEvent.change(screen.getByRole('combobox', { name: 'Trigger source' }), {
      target: { value: 'pressure' },
    })
  },
  'iabp-efficacy-limits': () => {
    fireEvent.click(
      screen.getByRole('button', { name: 'Escalate to the shock / mechanical-support team' }),
    )
  },
  'impella-unloading-placement': () => {
    fireEvent.click(screen.getByRole('button', { name: 'Read the device and effective flow' }))
  },
  'impella-suction-purge-rv': () => {
    fireEvent.change(screen.getByRole('slider', { name: 'Performance level' }), {
      target: { value: '5' },
    })
  },
  'lvad-parameters-assessment': () => {
    fireEvent.click(screen.getByRole('button', { name: 'Read the device and effective flow' }))
  },
  'lvad-alarms-emergencies': () => {
    fireEvent.click(
      screen.getByRole('button', { name: 'Escalate to the shock / mechanical-support team' }),
    )
  },
  'mcs-device-selection-integration': () => {
    for (const label of [
      'Read the filling pressures and right-sided delivery',
      'Read the device and effective flow',
    ]) {
      fireEvent.click(screen.getByRole('button', { name: label }))
    }
  },
}

export function performTransferWork(sectionId: string): void {
  const driver = transferDrivers[sectionId]
  if (!driver) throw new Error(`No transfer driver for section ${sectionId}`)
  driver()
}

export function commitTransfer(sectionId: string): void {
  const transfer = mcsLessonTransferByLessonId.get(sectionId)
  if (!transfer) throw new Error(`No transfer for ${sectionId}`)
  const best =
    transfer.item.choices.find((choice) => choice.plausibility === 'best') ??
    transfer.item.choices[0]
  chooseByLabel(best.label)
  clickPrimary()
}

/** Walks a section from its first step to a worked-through completion, through the interface. */
export function workThroughSection(
  sectionId: string,
  options: { readonly walks?: boolean } = {},
): void {
  if (options.walks) walkTheLoop()
  answerIdentification(sectionId)
  continueStep()
  commitPrediction(sectionId)
  continueFromVerdict()
  performAction(sectionId)
  continueStep()
  continueStep()
  if (document.querySelector('[data-control-panel-sort]')) commitSort()
  continueStep()
  commitTransfer(sectionId)
  performTransferWork(sectionId)
}

export function storedLessonIds(): readonly string[] {
  const raw = window.localStorage.getItem('interventionalpulm:mcs-progress:v1')
  if (!raw) return []
  return (JSON.parse(raw) as { completedLessonIds: string[] }).completedLessonIds
}
