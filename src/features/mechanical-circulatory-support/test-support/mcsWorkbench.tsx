/**
 * The shared harness the five M5 suites drive the workbench through.
 *
 * Three rules shape everything here.
 *
 * 1. Nothing that carries MCS behaviour is faked. The reducer, the progress reader and writer, the
 *    section learning contracts, the scenario definitions, the lesson transfers and the reveal-stage
 *    function are all imported real. What is replaced lives in `mcsWorkbenchStubs` and is limited to
 *    navigation, WebGL, the two lazy previews, media queries and animation-frame scheduling.
 * 2. The helpers drive the *visible interface*. `satisfyLearnAction` moves the same slider, select or
 *    button a learner would, until the authored `isActionSatisfied` predicate is true — it never
 *    dispatches the contract's own action ids, because a test that replays the authoring data proves
 *    only that the data was replayed.
 * 3. Analytics is read at the network boundary. Every event this module emits, aggregate or
 *    lifecycle, leaves through one `fetch('/api/analytics')` call, so that is where they are counted.
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react'

import {
  mcsLessonTransferByLessonId,
  mcsSectionLearningContractById,
  type McsLearnPhase,
  type McsSectionLearningContract,
} from '../content'
import {
  createDefaultMcsProgress,
  type McsDeviceKind,
  type McsModuleSection,
  type McsProgressV1,
} from '../engine'
import { McsWorkbench } from '../components/McsWorkbench'
import { mockRouterPush } from './mcsWorkbenchStubs'

export { mockRouterPush } from './mcsWorkbenchStubs'

export const MCS_PROGRESS_KEY = 'interventionalpulm:mcs-progress:v1'

/* ------------------------------------------------------------------ environment */

export interface CapturedAnalyticsEvent {
  readonly moduleId: string
  readonly eventType: string
  readonly section?: string
  readonly percentComplete?: number
  readonly routePath: string
  readonly eventPayload?: Record<string, unknown>
}

let reducedMotion = false
let animationFrames: FrameRequestCallback[] = []

/**
 * Installs the browser globals jsdom either lacks or leaves unhelpfully static.
 *
 * `requestAnimationFrame` is captured rather than scheduled so a suite can prove what happens when
 * a queued callback fires after unmount — the case that produces a React state-update warning if
 * the component got it wrong.
 */
export function setupMcsWorkbenchEnvironment(
  options: { readonly route?: string; readonly reducedMotion?: boolean } = {},
): void {
  reducedMotion = options.reducedMotion ?? false
  animationFrames = []
  mockRouterPush.mockReset()
  window.localStorage.clear()
  window.history.replaceState(null, '', options.route ?? '/mechanical-circulatory-support/practice')
  Object.defineProperty(global, 'fetch', {
    configurable: true,
    writable: true,
    value: jest.fn().mockResolvedValue({ ok: true }),
  })
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: reducedMotion && query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    })),
  })
  Object.defineProperty(window, 'requestAnimationFrame', {
    configurable: true,
    writable: true,
    value: (callback: FrameRequestCallback) => {
      animationFrames.push(callback)
      return animationFrames.length
    },
  })
  progressWrites = []
  jest
    .spyOn(Storage.prototype, 'setItem')
    .mockImplementation((key: string, value: string): void => {
      if (key === MCS_PROGRESS_KEY) progressWrites.push(value)
      nativeSetItem.call(window.localStorage, key, value)
    })
}

/** Restores real timers. Browser globals are re-installed by the next `setup` call. */
export function teardownMcsWorkbenchEnvironment(): void {
  jest.useRealTimers()
  animationFrames = []
}

/** Runs every animation-frame callback queued so far, as a browser would on the next frame. */
export function flushAnimationFrames(): void {
  const queued = animationFrames
  animationFrames = []
  for (const callback of queued) callback(0)
}

export function pendingAnimationFrameCount(): number {
  return animationFrames.length
}

/* ------------------------------------------------------------------ analytics */

function fetchMock(): jest.Mock {
  return global.fetch as unknown as jest.Mock
}

export function capturedAnalyticsEvents(): readonly CapturedAnalyticsEvent[] {
  return fetchMock().mock.calls.map(
    ([, request]) => JSON.parse((request as { body: string }).body) as CapturedAnalyticsEvent,
  )
}

/** The module-level aggregate events: device track, station, coarse completion, and nothing else. */
export function aggregateAnalyticsEvents(): readonly CapturedAnalyticsEvent[] {
  return capturedAnalyticsEvents().filter(
    (event) => event.moduleId === 'mechanical-circulatory-support',
  )
}

/** The shared critical-care activity-lifecycle events, as their inner payloads. */
export function lifecycleAnalyticsPayloads(): readonly Record<string, unknown>[] {
  return capturedAnalyticsEvents()
    .filter((event) => event.moduleId === 'critical-care')
    .map((event) => event.eventPayload ?? {})
}

export function lifecycleInteractions(): readonly string[] {
  return lifecycleAnalyticsPayloads().map((payload) => String(payload.interaction))
}

export function countLifecycleInteraction(
  interaction: string,
  options: { readonly activityId?: string } = {},
): number {
  return lifecycleAnalyticsPayloads().filter(
    (payload) =>
      payload.interaction === interaction &&
      (options.activityId === undefined || payload.activityId === options.activityId),
  ).length
}

export function clearCapturedAnalytics(): void {
  fetchMock().mockClear()
}

/* ------------------------------------------------------------------ progress */

const nativeSetItem = Storage.prototype.setItem
let progressWrites: string[] = []

/**
 * Counts writes to the MCS progress key.
 *
 * "Written once" is the contract, not "ends up correct": a record that is rewritten on every
 * simulation tick reaches the same value and would pass any assertion made on the stored payload.
 */
export function progressWriteCount(): number {
  return progressWrites.length
}

export function resetProgressWrites(): void {
  progressWrites = []
}

/** Seeds prior history. Written natively so the fixture is not counted as a workbench write. */
export function seedStoredProgress(overrides: Partial<McsProgressV1> = {}): McsProgressV1 {
  const progress = { ...createDefaultMcsProgress(), ...overrides }
  nativeSetItem.call(window.localStorage, MCS_PROGRESS_KEY, JSON.stringify(progress))
  return progress
}

export function writeMalformedStoredProgress(raw = '{ this is not json'): void {
  nativeSetItem.call(window.localStorage, MCS_PROGRESS_KEY, raw)
}

export function readStoredProgressRaw(): Partial<McsProgressV1> | null {
  const raw = window.localStorage.getItem(MCS_PROGRESS_KEY)
  return raw ? (JSON.parse(raw) as Partial<McsProgressV1>) : null
}

export function storedLessonIds(): readonly string[] {
  return readStoredProgressRaw()?.completedLessonIds ?? []
}

export function storedCompletedCaseIds(): readonly string[] {
  return readStoredProgressRaw()?.completedCaseIds ?? []
}

export function storedMasteredCaseIds(): readonly string[] {
  return readStoredProgressRaw()?.masteredCaseIds ?? []
}

/* ------------------------------------------------------------------ rendering */

export interface RenderWorkbenchOptions {
  readonly section: McsModuleSection
  readonly initialDevice?: McsDeviceKind
  readonly initialActivityId?: string
  readonly locale?: string
}

/**
 * Renders the workbench on one route and lets the zero-delay progress load settle.
 *
 * The load is a `setTimeout(…, 0)`, so it needs a macrotask rather than a resolved promise: without
 * this, every assertion about stored history would be made against the default progress object.
 */
export async function renderWorkbench(options: RenderWorkbenchOptions) {
  const result = render(
    <McsWorkbench
      section={options.section}
      initialDevice={options.initialDevice}
      initialActivityId={options.initialActivityId}
      locale={options.locale}
    />,
  )
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
  return result
}

/** Renders without awaiting the progress load, for the tests that are about that load. */
export function renderWorkbenchWithoutSettling(options: RenderWorkbenchOptions) {
  return render(
    <McsWorkbench
      section={options.section}
      initialDevice={options.initialDevice}
      initialActivityId={options.initialActivityId}
      locale={options.locale}
    />,
  )
}

let intervalDelays: number[] = []
let installedIntervalIds: number[] = []
let clearedIntervalIds: number[] = []

/**
 * Every interval delay installed since the render, in order.
 *
 * The cadence cannot be inferred from how far the clock moves: the workbench ticks 0.1 s every
 * 100 ms and 0.25 s every 250 ms, so a second of wall clock advances the simulation by a second
 * either way. The installed delay is the only thing that distinguishes them.
 */
export function capturedIntervalDelays(): readonly number[] {
  return intervalDelays
}

/** Whether every interval this render installed was cleared again. */
export function everyInstalledIntervalCleared(): boolean {
  return installedIntervalIds.every((id) => clearedIntervalIds.includes(id))
}

/** Renders under fake timers, for the suites that need to drive the simulation interval. */
export async function renderWorkbenchOnFakeTimers(options: RenderWorkbenchOptions) {
  jest.useFakeTimers()
  intervalDelays = []
  installedIntervalIds = []
  clearedIntervalIds = []
  const fakeSetInterval = window.setInterval
  const fakeClearInterval = window.clearInterval
  jest.spyOn(window, 'setInterval').mockImplementation(((
    handler: TimerHandler,
    delay?: number,
    ...args: unknown[]
  ) => {
    const id = (fakeSetInterval as typeof window.setInterval)(
      handler as () => void,
      delay,
      ...(args as []),
    )
    if (typeof delay === 'number') intervalDelays.push(delay)
    installedIntervalIds.push(id)
    return id
  }) as typeof window.setInterval)
  jest.spyOn(window, 'clearInterval').mockImplementation(((id?: number) => {
    if (typeof id === 'number') clearedIntervalIds.push(id)
    return (fakeClearInterval as typeof window.clearInterval)(id)
  }) as typeof window.clearInterval)
  const result = render(
    <McsWorkbench
      section={options.section}
      initialDevice={options.initialDevice}
      initialActivityId={options.initialActivityId}
      locale={options.locale}
    />,
  )
  await act(async () => {
    jest.advanceTimersByTime(0)
  })
  return result
}

/** Runs the simulation forward by wall-clock milliseconds. Fake timers only. */
export function advanceSimulation(milliseconds: number): void {
  act(() => {
    jest.advanceTimersByTime(milliseconds)
  })
}

/* ------------------------------------------------------------------ shared chrome */

export function sharedPhaseStepper(): HTMLElement {
  return screen.getByRole('group', { name: 'MCS shared activity phases' })
}

/** The phase the shared stepper is reporting, read from `aria-current` rather than from a class. */
export function sharedStepperPhase(): string {
  const current = sharedPhaseStepper().querySelector('li[aria-current="step"]')
  return current?.textContent?.trim().replace(/, completed$/, '') ?? ''
}

/** Presses the shared stepper's jump control for a phase the learner is not currently on. */
export function jumpToSharedPhase(label: string): void {
  fireEvent.click(screen.getByRole('button', { name: `Open ${label} phase` }))
}

/** The device tabs Practice and Challenge carry. Learn deliberately has none. */
export const DEVICE_TAB_NAMES: Readonly<Record<McsDeviceKind, RegExp>> = {
  iabp: /Intra-aortic balloon pump/,
  impella: /Impella CP \/ 5\.5 \/ RP/,
  lvad: /Durable continuous-flow LVAD/,
}

export function deviceTrackNav(): HTMLElement {
  return screen.getByRole('navigation', { name: 'Choose device track' })
}

/** Scoped to the device rail, because the controls card carries the same device names. */
export function deviceTab(device: McsDeviceKind): HTMLElement {
  return within(deviceTrackNav()).getByRole('button', { name: DEVICE_TAB_NAMES[device] })
}

export function selectDeviceTrack(device: McsDeviceKind): void {
  fireEvent.click(deviceTab(device))
}

export function pathwayRail(): HTMLElement {
  return screen.getByRole('navigation', { name: 'MCS learning pathway sections' })
}

export function practiceRail(): HTMLElement {
  return screen.getByRole('region', { name: 'Mechanism Studio and device cases' })
}

/** The practice rail entry whose visible short title matches, without regex-escaping every case. */
export function practiceRailButton(shortTitle: string): HTMLElement {
  const match = within(practiceRail())
    .getAllByRole('button')
    .find((button) => button.textContent?.includes(shortTitle))
  if (!match) throw new Error(`No practice rail entry for "${shortTitle}"`)
  return match
}

/* ------------------------------------------------------------------ Learn helpers */

export const LEARN_PHASE_LABELS: Readonly<Record<McsLearnPhase, string>> = {
  recognize: 'Recognize',
  predict: 'Predict',
  act: 'Act',
  observe: 'Observe',
  explain: 'Explain',
  transfer: 'Transfer',
}

const LEARN_PHASE_ORDER: readonly McsLearnPhase[] = [
  'recognize',
  'predict',
  'act',
  'observe',
  'explain',
  'transfer',
]

/** The Learn phase the action pane's own heading reports — `Observe — step 4 of 6`. */
export function learnPhase(): McsLearnPhase {
  const heading = screen.getByRole('heading', { name: /— step \d of 6$/ }).textContent ?? ''
  const found = LEARN_PHASE_ORDER.find((phase) =>
    heading.startsWith(`${LEARN_PHASE_LABELS[phase]} —`),
  )
  if (!found) throw new Error(`Could not read the Learn phase from heading: ${heading}`)
  return found
}

export function learnContract(sectionId: string): McsSectionLearningContract {
  const contract = mcsSectionLearningContractById.get(sectionId)
  if (!contract) throw new Error(`No MCS section learning contract for ${sectionId}`)
  return contract
}

export function learnTransfer(sectionId: string) {
  const transfer = mcsLessonTransferByLessonId.get(sectionId)
  if (!transfer) throw new Error(`No MCS lesson transfer for ${sectionId}`)
  return transfer
}

function chooseRadio(label: string): void {
  fireEvent.click(screen.getByRole('radio', { name: label }))
}

/** Recognize: pick the authored correct option and record it. */
export function completeRecognizePhase(sectionId: string): void {
  const contract = learnContract(sectionId)
  const correct = contract.recognizeOptions.find((option) => option.correct)
  if (!correct) throw new Error(`${sectionId} has no correct recognize option`)
  chooseRadio(correct.label)
  fireEvent.click(screen.getByRole('button', { name: 'Record what you identified' }))
}

/** Predict: commit the authored best answer. Committing shows the verdict and advances nothing. */
export function commitPredictionPhase(sectionId: string): void {
  const contract = learnContract(sectionId)
  const best =
    contract.predictionItem.choices.find((choice) => choice.plausibility === 'best') ??
    contract.predictionItem.choices[0]
  chooseRadio(best.label)
  fireEvent.click(screen.getByRole('button', { name: 'Commit this answer' }))
}

/**
 * Act: drive the visible workspace until the section's own predicate is satisfied.
 *
 * One entry per authored action mode. The entries move a control a learner can see and reach; none
 * of them dispatches the action id the contract lists, because satisfying the predicate by
 * re-sending the authoring data would prove nothing about the interface.
 */
const learnActionDrivers: Readonly<Record<string, () => void>> = {
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

export function satisfyLearnAction(sectionId: string): void {
  const driver = learnActionDrivers[sectionId]
  if (!driver) throw new Error(`No M5 action driver for section ${sectionId}`)
  driver()
}

/** Transfer: work the required actions in the transfer patient, by their visible controls. */
const learnTransferDrivers: Readonly<Record<string, () => void>> = {
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

export function satisfyLearnTransferActions(sectionId: string): void {
  const driver = learnTransferDrivers[sectionId]
  if (!driver) throw new Error(`No M5 transfer driver for section ${sectionId}`)
  driver()
}

/** Transfer: choose an authored answer and commit it. The commit is the section's last step. */
export function commitTransferPhase(sectionId: string): void {
  const transfer = learnTransfer(sectionId)
  const best =
    transfer.item.choices.find((choice) => choice.plausibility === 'best') ??
    transfer.item.choices[0]
  chooseRadio(best.label)
  fireEvent.click(screen.getByRole('button', { name: 'Commit this transfer answer' }))
}

export function continueFromPhase(phase: McsLearnPhase): void {
  const labels: Readonly<Record<McsLearnPhase, string>> = {
    recognize: 'Continue to the prediction',
    predict: 'Continue to the task',
    act: 'Continue to what changed',
    observe: 'Continue to the explanation',
    explain: 'Continue to the transfer patient',
    transfer: 'Continue',
  }
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${labels[phase]}`) }))
}

/** Walks one Learn section from Recognize to a committed transfer answer, through the interface. */
export function workThroughLearnSection(sectionId: string): void {
  completeRecognizePhase(sectionId)
  continueFromPhase('recognize')
  commitPredictionPhase(sectionId)
  continueFromPhase('predict')
  satisfyLearnAction(sectionId)
  continueFromPhase('act')
  continueFromPhase('observe')
  continueFromPhase('explain')
  satisfyLearnTransferActions(sectionId)
  commitTransferPhase(sectionId)
}

/* ------------------------------------------------------------------ Practice / Challenge */

export function caseWorkflow(): HTMLElement {
  return screen.getByRole('region', { name: /simulation workspace$/ })
}

/** Every inspect button a case exposes, keyed by the action the workbench dispatches. */
export const CASE_INSPECT_BUTTONS: Readonly<Record<string, string>> = {
  'inspect:arterial': 'Arterial waveform',
  'inspect:preload': 'Filling & RV',
  'inspect:device': 'Device display',
}

export function inspectInCase(actionId: keyof typeof CASE_INSPECT_BUTTONS): void {
  fireEvent.click(screen.getByRole('button', { name: CASE_INSPECT_BUTTONS[actionId] }))
}

export function commitCasePrediction(optionLabel: string): void {
  chooseRadio(optionLabel)
  fireEvent.click(screen.getByRole('button', { name: /Record initial frame/ }))
}

export function openCausalDebrief(): void {
  fireEvent.click(screen.getByRole('button', { name: 'Open causal debrief' }))
}

export function reassessCase(): void {
  fireEvent.click(screen.getByRole('button', { name: 'Reassess response' }))
}

export function challengeFeedbackToggle(): HTMLElement {
  return screen.getByRole('checkbox', { name: /Show teaching notes after each action/ })
}

/* ------------------------------------------------------------------ context bar */

function patientContextBar(): HTMLElement {
  const bar = screen.getByRole('heading', { name: 'Patient context' }).closest('section')
  if (!bar) throw new Error('No patient-context section')
  return bar as HTMLElement
}

/** Reads one Patient-context row by its label, as the `dd` beside the `dt`. */
export function patientContextValue(label: string): string {
  const term = within(patientContextBar())
    .getAllByRole('term')
    .find((candidate) => candidate.textContent?.trim() === label)
  if (!term) throw new Error(`No patient-context item labelled "${label}"`)
  const value = term.nextElementSibling
  if (!value) throw new Error(`Patient-context item "${label}" has no value`)
  return value.textContent?.trim() ?? ''
}

export function patientContextLabels(): readonly string[] {
  return within(patientContextBar())
    .getAllByRole('term')
    .map((term) => term.textContent?.trim() ?? '')
}

/** Every value in the patient-context bar, for the audits that scan rather than look up. */
export function patientContextValues(): readonly string[] {
  return within(patientContextBar())
    .getAllByRole('definition')
    .map((value) => value.textContent?.trim() ?? '')
}

/** The safety constraints the context bar carries beside the values. */
export function patientContextSafetyConstraints(): readonly string[] {
  const list = within(patientContextBar()).getByRole('list')
  return within(list)
    .getAllByRole('listitem')
    .map((item) => item.textContent?.trim() ?? '')
}
