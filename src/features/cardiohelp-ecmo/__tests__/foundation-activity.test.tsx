import { advanceFoundationOnce, reachFoundationStep } from '../test-support/foundationJourney'
import { buildFoundationStageLesson } from '../components/stage/adapters/foundationStageAdapter'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import { criticalCareLearningPathway } from '@/features/critical-care/content/learningPathways'
import { nextPathwaySection } from '@/features/learning-module/curriculum/types'

import { EcmoFoundationLessonActivity } from '../components/EcmoFoundationLessonActivity'
import { ecmoDeliveryAttribution } from '../content/deliveryAttribution'
import { ecmoFoundationLearningItemsFor } from '../content/foundationLearningItems'
import {
  ecmoFoundationLessonRuntime,
  ecmoInteractiveFoundationSectionIds,
  ecmoSharedFoundationSectionIds,
  ecmoVaOnlyFoundationSectionIds,
  ecmoVvOnlyFoundationSectionIds,
  type EcmoInteractiveFoundationSectionId,
} from '../content/foundationLessonRuntime'
import type { SupportMode } from '../engine/types'
import {
  CircuitMapAnswerFieldset,
  type CircuitMapAnswerProps,
} from '../components/circuit-map/CircuitMapAnswerFieldset'

/**
 * Mount tests for the foundation Learn activity, now rendered on the lesson stage.
 *
 * The activity's guarantees were previously asserted by matching regular expressions against its
 * own source text. That checks the code still looks the way it looked; it cannot check what the
 * component does once it is running, and the one blocking defect this package found — a free
 * running clock walking the capstone past the authored change it was supposed to sit in front of —
 * was invisible to every one of those assertions. It is visible here in the first two cases.
 *
 * Everything is read through the rendered DOM: which state is loaded, whether the clock is held,
 * which track the header offers, and what the teaching panel reports. The six authored phases are
 * now six steps in one ordered list, and forward movement is only ever through the Now card, so
 * the helpers here move the way a learner moves: one primary action at a time.
 */

const mockPush = jest.fn()

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
  useRouter: () => ({ push: mockPush, replace: jest.fn(), refresh: jest.fn() }),
  usePathname: () => '/cardiohelp-ecmo/learn',
}))

// The device panes are replaced with markers. None is what any assertion here reads, and the
// circuit view pulls three.js in through EcmoCircuit3D, which does not render under jsdom. The
// stage renders the four monitor surfaces by name, so all four named exports are stubbed.
jest.mock('../components/CardiohelpConsole', () => ({
  CardiohelpConsole: () => <div data-testid="cardiohelp-console" />,
}))
jest.mock('../components/CircuitAndMonitors', () => ({
  // The map is asserted as a drawing in circuit-map-emphasis.test.tsx. Here it records what the
  // stage asked it to mark and how much it was allowed to disclose, so the leak contract below can
  // read the props rather than the pixels.
  CircuitSchematic: (props: {
    locationDisclosure?: string
    circuitPresentation?: { kind: string; sensorSiteIds?: readonly string[] } | null
    mapAnswer?: CircuitMapAnswerProps | null
  }) => (
    <div
      data-testid="circuit-schematic"
      data-location-disclosure={props.locationDisclosure ?? 'full'}
      data-presentation-kind={props.circuitPresentation?.kind ?? 'none'}
      data-presentation-sites={(props.circuitPresentation?.sensorSiteIds ?? []).join(' ')}
    >
      {/*
        The drawing is mocked; the answer control it now carries is not. A prediction about a place
        is answered by pointing at the circuit (`content/mapAnswerTargets`), so the real fieldset
        renders here — plain HTML over the drawing, with nothing this suite needs to stub.
      */}
      {props.mapAnswer ? <CircuitMapAnswerFieldset {...props.mapAnswer} /> : null}
    </div>
  ),
  GasBlenderPanel: () => <div data-testid="gas-blender-panel" />,
  PatientMonitor: () => <div data-testid="patient-monitor" />,
  TrendPanel: () => <div data-testid="trend-panel" />,
}))

type Phase = 'recognize' | 'predict' | 'act' | 'observe' | 'explain' | 'transfer'

/** The section the harness last mounted, so the attribution helper can find its registry entry. */
let mountedSectionId: EcmoInteractiveFoundationSectionId = 'why-extracorporeal-support'

function mount(
  sectionId: EcmoInteractiveFoundationSectionId,
  supportMode: SupportMode = 'vv',
  initialPhase?: Phase,
) {
  mountedSectionId = sectionId
  return render(
    <EcmoFoundationLessonActivity
      sectionId={sectionId}
      supportMode={supportMode}
      initialPhase={initialPhase}
    />,
  )
}

/** The text of one row of the capstone's live findings column. */
function liveFinding(id: string): string {
  const cell = document.querySelector(`[data-live-finding="${id}"]`)
  if (!cell) throw new Error(`no live finding rendered for ${id}`)
  return cell.textContent ?? ''
}

function loadedVariantId(): string | null {
  return (
    document
      .querySelector('[data-active-state-variant]')
      ?.getAttribute('data-active-state-variant') ?? null
  )
}

/**
 * The text of the "State on screen" card.
 *
 * Assertions about which state is loaded read this card rather than the whole page: the variant
 * label also appears in the restore button and in the status line, so a page-wide text query would
 * be answered by copy that is not the thing under test.
 */
function loadedStateCard(): string {
  const card = document.querySelector('[data-active-state-variant]')
  if (!card) throw new Error('no loaded-state card rendered')
  return card.textContent ?? ''
}

function clockToggle(): HTMLElement {
  const button = document.querySelector<HTMLElement>('[data-clock-running]')
  if (!button) throw new Error('no clock toggle rendered')
  return button
}

function clockIsRunning(): boolean {
  return clockToggle().getAttribute('data-clock-running') === 'true'
}

function guidedAction(id: string): HTMLElement {
  const button = document.querySelector<HTMLElement>(`[data-guided-action="${id}"]`)
  if (!button) throw new Error(`no guided action rendered for ${id}`)
  return button
}

function stageFrame(): HTMLElement {
  const frame = document.querySelector<HTMLElement>('[data-ecmo-stage-frame]')
  if (!frame) throw new Error('no stage frame rendered')
  return frame
}

/**
 * The step the stage is on, read from the shell root and cross-checked against the one row that
 * carries `aria-current="step"`. The two are written from the same state; reading both is what
 * catches a list that stops following the stage.
 */
function currentStepId(): string {
  const stage = document.querySelector('[data-ecmo-shell="learn"]')?.getAttribute('data-stage')
  if (!stage) throw new Error('no stage id on the shell root')
  const current = document.querySelectorAll('[data-step-list] [aria-current="step"]')
  expect(current).toHaveLength(1)
  expect(current[0].closest('li')?.getAttribute('data-step-id')).toBe(stage)
  return stage
}

function currentPhase(): Phase {
  currentStepId()
  return document.querySelector('[data-active-phase]')?.getAttribute('data-active-phase') as Phase
}

function stepRow(phase: Phase): HTMLLIElement {
  const row = document.querySelector<HTMLLIElement>(
    `[data-step-list] li[data-step-id$="-${phase}"]`,
  )
  if (!row) throw new Error(`no step row rendered for ${phase}`)
  return row
}

/** The one primary action of the Now card. */
function nowPrimary(): HTMLButtonElement {
  const button = document.querySelector<HTMLButtonElement>('[data-now-card] [data-now-primary]')
  if (!button) throw new Error('no Now card primary action rendered')
  return button
}

/** A read step's Continue, or the verdict's Continue after a committed prediction. */
function continueStep() {
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
}

/** Move forward through the Now card until the stage is on `phase`. Never skips a step. */

/**
 * Satisfy an attribution step if that is where the traversal has stopped. See the twin of this in
 * `foundation-phase-restoration.test.tsx`: the first section's Act step is now a judgement to make,
 * not a Continue to click, and the keyed component lives only in the registry.
 */
function answerAttributionIfPresent(): boolean {
  const commit = screen.queryByRole('button', { name: 'Submit these answers' })
  if (!commit) return false
  for (const row of Array.from(
    document.querySelectorAll<HTMLElement>('[data-attribution-candidate]'),
  )) {
    const candidateId = row.getAttribute('data-attribution-candidate')
    const select = row.querySelector('select')
    if (!candidateId || !select) continue
    const keyed = ecmoDeliveryAttribution(mountedSectionId)?.candidates.find(
      (candidate) => candidate.id === candidateId,
    )
    if (!keyed) continue
    fireEvent.change(select, { target: { value: keyed.componentId } })
  }
  fireEvent.click(screen.getByRole('button', { name: 'Submit these answers' }))
  return true
}

function continueTo(phase: Phase) {
  for (let guard = 0; currentPhase() !== phase; guard += 1) {
    if (guard > 40) throw new Error(`could not reach ${phase}; stuck at ${currentPhase()}`)
    if (answerAttributionIfPresent()) continue
    advanceFoundationOnce()
  }
}

function predictionChoice(sectionId: EcmoInteractiveFoundationSectionId): HTMLInputElement {
  const { prediction } = ecmoFoundationLearningItemsFor(sectionId)
  const input = document.querySelector<HTMLInputElement>(
    `fieldset[data-prediction-choices] input[value="${prediction.choices[0].id}"]`,
  )
  if (!input) throw new Error('no prediction choice rendered')
  return input
}

/**
 * Commit the section's prediction, staying on the Predict step.
 *
 * Commitment — not step — is the authority for every answer-bearing surface, so tests that need
 * a later step have to commit the way a learner does: choose one option, then press the primary.
 * Nothing else unlocks those steps.
 */
function commitPredictionChoice(sectionId: EcmoInteractiveFoundationSectionId) {
  continueTo('predict')
  fireEvent.click(predictionChoice(sectionId))
  fireEvent.click(screen.getByRole('button', { name: /^(Commit this prediction|Submit answer)$/ }))
}

/** Commit, then follow the explicit Continue into the Act step. */
function commitAndContinue(sectionId: EcmoInteractiveFoundationSectionId) {
  commitPredictionChoice(sectionId)
  continueStep()
  expect(currentPhase()).toBe('act')
}

function runModeledSeconds(seconds: number) {
  act(() => {
    jest.advanceTimersByTime(seconds * 1000)
  })
}

beforeEach(() => {
  jest.useFakeTimers()
  mockPush.mockReset()
})

afterEach(() => {
  jest.useRealTimers()
})

/** The simulator pane's pressure-zone map (mocked above), as the stage handed it its marking. */
function circuitMap(): HTMLElement {
  const map = document.querySelector<HTMLElement>('[data-testid="circuit-schematic"]')
  if (!map) throw new Error('No circuit map on the stage')
  return map
}

/** The sensor sites the stage asked the map to ring for the current walk stop. */
function ringedSensorSites(): string[] {
  const sites = circuitMap().getAttribute('data-presentation-sites') ?? ''
  return sites ? sites.split(' ') : []
}

describe('the lesson clock belongs to the loaded state, not to the component', () => {
  it('holds the capstone in front of the change it opens on', () => {
    mount('vv-integration-capstone')

    expect(loadedVariantId()).toBe('gas-source-before-change')
    expect(document.querySelector('[data-clock-held]')).not.toBeNull()
    expect(clockIsRunning()).toBe(false)
    expect(liveFinding('gas-source-status')).toContain('connected')

    // The authored change is at the fifth modeled second and this state opens at the fourth. A
    // clock left running would have crossed it within one tick and the learner would be reading a
    // panel that says the change has not happened yet beside a circuit where it already has.
    runModeledSeconds(5)

    expect(liveFinding('gas-source-status')).toContain('connected')
    expect(liveFinding('gas-source-status')).not.toContain('interrupted')
    expect(loadedVariantId()).toBe('gas-source-before-change')
  })

  it('lets the learner start the clock and watch the change arrive', () => {
    mount('vv-integration-capstone')

    fireEvent.click(clockToggle())
    expect(clockIsRunning()).toBe(true)
    expect(screen.getByRole('button', { name: 'Pause the circuit' })).toBeInTheDocument()

    runModeledSeconds(1)

    expect(liveFinding('gas-source-status')).toContain('interrupted')
  })

  it('re-holds the clock every time the held state is reloaded', () => {
    mount('vv-integration-capstone')

    fireEvent.click(clockToggle())
    runModeledSeconds(1)
    expect(liveFinding('gas-source-status')).toContain('interrupted')

    commitAndContinue('vv-integration-capstone')
    fireEvent.click(guidedAction('restore-case-before-change'))

    // Holding is a property of the variant, so it is re-applied by the restore rather than being
    // something the previous state's running clock gets to carry forward.
    expect(clockIsRunning()).toBe(false)
    expect(liveFinding('gas-source-status')).toContain('connected')

    runModeledSeconds(10)
    expect(liveFinding('gas-source-status')).toContain('connected')
  })

  it('leaves a state that is not authored to be held running', () => {
    mount('vv-normal-state')

    expect(clockIsRunning()).toBe(true)
    expect(document.querySelector('[data-clock-held]')).toBeNull()
    expect(screen.getByRole('button', { name: 'Pause the circuit' })).toBeInTheDocument()
  })

  it('pauses on request, and stays paused', () => {
    mount('vv-normal-state')

    fireEvent.click(clockToggle())
    expect(clockIsRunning()).toBe(false)
    expect(screen.getByRole('button', { name: 'Let the circuit run on' })).toBeInTheDocument()

    runModeledSeconds(30)
    expect(clockIsRunning()).toBe(false)
  })

  it('restores the primary state from the state card', () => {
    mount('vv-series-physiology')
    commitAndContinue('vv-series-physiology')
    fireEvent.click(guidedAction('load-recirculation-preview'))
    expect(loadedVariantId()).toBe('recirculation-preview')

    const restore = document.querySelector<HTMLElement>('[data-restore-primary]')
    expect(restore).toHaveTextContent('Restore VV reference circuit')
    fireEvent.click(restore!)
    expect(loadedVariantId()).toBe('reference-circuit')
  })
})

describe('a VV-only section never offers the VA track', () => {
  it.each(ecmoVvOnlyFoundationSectionIds)('fixes the pathway indicator on %s', (sectionId) => {
    mount(sectionId)

    expect(stageFrame().getAttribute('data-fixed-pathway')).toBe('vv')
    expect(screen.queryByRole('radiogroup', { name: 'ECMO support mode' })).toBeNull()
    expect(screen.queryByRole('radio', { name: /track/ })).toBeNull()
  })

  it.each(ecmoVvOnlyFoundationSectionIds)(
    'ignores a requested VA track on %s and runs VV anyway',
    (sectionId) => {
      mount(sectionId, 'va')

      expect(stageFrame().getAttribute('data-support-mode')).toBe('vv')
      expect(stageFrame().getAttribute('data-fixed-pathway')).toBe('vv')
      expect(screen.queryByRole('radiogroup', { name: 'ECMO support mode' })).toBeNull()
    },
  )

  it('loads no VA reference behind VV teaching when VA is asked for', () => {
    mount('vv-series-physiology', 'va')

    expect(loadedVariantId()).toBe('reference-circuit')
    expect(loadedStateCard()).toContain('VV reference circuit')
    expect(loadedStateCard()).not.toContain('VA reference circuit')
  })
})

describe('a VA-only section never offers the VV track', () => {
  it.each(ecmoVaOnlyFoundationSectionIds)('fixes the pathway indicator on %s', (sectionId) => {
    mount(sectionId, 'va')

    expect(stageFrame().getAttribute('data-fixed-pathway')).toBe('va')
    expect(screen.queryByRole('radiogroup', { name: 'ECMO support mode' })).toBeNull()
  })

  it.each(ecmoVaOnlyFoundationSectionIds)(
    'ignores a requested VV track on %s and runs VA anyway',
    (sectionId) => {
      mount(sectionId, 'vv')

      expect(stageFrame().getAttribute('data-support-mode')).toBe('va')
      expect(stageFrame().getAttribute('data-fixed-pathway')).toBe('va')
      expect(screen.queryByRole('radiogroup', { name: 'ECMO support mode' })).toBeNull()
    },
  )

  it('loads no VV reference behind VA teaching when VV is asked for', () => {
    mount('va-parallel-physiology', 'vv')

    expect(loadedVariantId()).toBe('reference-circuit')
    expect(loadedStateCard()).toContain('VA reference circuit')
    expect(loadedStateCard()).not.toContain('VV reference circuit')
  })

  it('does not describe a VA section as teaching series physiology', () => {
    // The indicator's copy used to be a hardcoded VV sentence. A VA section rendering it would have
    // told the learner the circuit in front of them runs in series with the native lung. The
    // sentence now sits in the header's meta line, one per track.
    mount('va-parallel-physiology', 'va')
    const indicator = screen.getByText(/^VA pathway · /).textContent ?? ''

    expect(indicator).toContain('parallel circulation')
    expect(indicator).toContain('always runs on the VA reference circuit')
    expect(indicator).not.toContain('series physiology')

    cleanup()
    mount('vv-series-physiology', 'vv')
    const vvIndicator = screen.getByText(/^VV pathway · /).textContent ?? ''
    expect(vvIndicator).toContain('series physiology')
    expect(vvIndicator).toContain('always runs on the VV reference circuit')
    expect(vvIndicator).not.toContain('parallel circulation')
  })
})

describe('the VA lessons load the states they are authored over', () => {
  it('opens the parallel-physiology lesson on the settled VA reference, running', () => {
    mount('va-parallel-physiology', 'va')

    expect(loadedVariantId()).toBe('reference-circuit')
    expect(clockIsRunning()).toBe(true)
  })

  it('loads each parallel mechanism cleanly, without compounding them', () => {
    mount('va-parallel-physiology', 'va')
    commitAndContinue('va-parallel-physiology')

    fireEvent.click(guidedAction('load-differential-hypoxemia-preview'))
    expect(loadedVariantId()).toBe('differential-hypoxemia-preview')

    fireEvent.click(guidedAction('load-lv-loading-preview'))
    expect(loadedVariantId()).toBe('lv-loading-preview')

    fireEvent.click(guidedAction('restore-va-reference'))
    expect(loadedVariantId()).toBe('reference-circuit')
  })

  it('opens the VA capstone on the presenting case', () => {
    mount('va-integration-capstone', 'va')

    expect(loadedVariantId()).toBe('mixed-circulation-case')
    // Unlike the VV capstone this case carries its finding from the first frame, so there is no
    // authored change to sit in front of and the clock is free to run.
    expect(clockIsRunning()).toBe(true)
    expect(document.querySelector('[data-clock-held]')).toBeNull()
  })

  it('holds the clock on the one VA preview that sits before an authored change', () => {
    mount('va-integration-capstone', 'va')
    commitAndContinue('va-integration-capstone')
    continueTo('explain')

    fireEvent.click(guidedAction('preview-va-gas-source-before-change'))
    expect(loadedVariantId()).toBe('va-gas-source-before-change')
    expect(clockIsRunning()).toBe(false)
    expect(document.querySelector('[data-clock-held]')).not.toBeNull()

    runModeledSeconds(5)
    // Still held, so the gas case has not walked past its own change.
    expect(loadedVariantId()).toBe('va-gas-source-before-change')
    expect(clockIsRunning()).toBe(false)
  })

  it('lets the learner start that clock and watch the gas change arrive', () => {
    mount('va-integration-capstone', 'va')
    commitAndContinue('va-integration-capstone')
    continueTo('explain')
    fireEvent.click(guidedAction('preview-va-gas-source-before-change'))

    fireEvent.click(clockToggle())
    runModeledSeconds(1)

    expect(clockIsRunning()).toBe(true)
  })

  it('keeps every VA capstone action reachable in the transfer phase', () => {
    mount('va-integration-capstone', 'va')
    commitAndContinue('va-integration-capstone')
    continueTo('transfer')

    expect(document.querySelector('details[data-bounded-actions]')).not.toBeNull()
    for (const guided of ecmoFoundationLessonRuntime('va-integration-capstone').guidedActions) {
      expect(guidedAction(guided.id)).toBeInTheDocument()
    }
  })

  it('captures and advances on the VA normal state', () => {
    mount('va-normal-state', 'va')
    commitAndContinue('va-normal-state')

    fireEvent.click(guidedAction('capture-reference-snapshot'))
    fireEvent.click(guidedAction('run-twenty-modeled-seconds'))

    expect(document.querySelector('[data-interaction="capture-reference-snapshot"]')).not.toBeNull()
    expect(document.querySelector('[data-interaction="run-twenty-modeled-seconds"]')).not.toBeNull()
  })
})

describe('a shared section keeps both tracks', () => {
  it.each(ecmoSharedFoundationSectionIds)('offers both tracks on %s', (sectionId) => {
    mount(sectionId)

    const group = screen.getByRole('radiogroup', { name: 'ECMO support mode' })
    const vv = screen.getByRole('radio', { name: 'VV track' })
    const va = screen.getByRole('radio', { name: 'VA track' })
    expect(group).toContainElement(vv)
    expect(group).toContainElement(va)
    expect(vv).toHaveAttribute('aria-checked', 'true')
    expect(va).toHaveAttribute('aria-checked', 'false')
    expect(stageFrame().hasAttribute('data-fixed-pathway')).toBe(false)

    // Choosing the other track is a navigation to the same section on that track, nothing else.
    fireEvent.click(va)
    expect(mockPush).toHaveBeenCalledTimes(1)
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/cardiohelp-ecmo/learn',
      query: { lesson: sectionId, track: 'va' },
    })
  })

  it('honours the requested track, so the VV-only rule is not a blanket one', () => {
    mount('why-extracorporeal-support', 'va')

    expect(stageFrame().getAttribute('data-support-mode')).toBe('va')
    expect(screen.getByRole('radio', { name: 'VA track' })).toHaveAttribute('aria-checked', 'true')
    expect(stageFrame()).toHaveAttribute('data-support-mode', 'va')
    expect(document.querySelector('[data-simulator-surfaces]')).toBeNull()
  })
})

describe('bounded actions', () => {
  it('lands a restore-and-apply directly on the settled state', () => {
    mount('vv-integration-capstone')
    commitAndContinue('vv-integration-capstone')
    continueTo('observe')

    fireEvent.click(guidedAction('reveal-evolved-state'))

    expect(loadedVariantId()).toBe('gas-source-after-change')
    // The values are the settled ones, in one transition — not a restored frame that then walks
    // forward while the learner watches.
    expect(liveFinding('gas-source-status')).toContain('interrupted')
    expect(liveFinding('paco2-and-ph')).toContain('79.6 mmHg')
    expect(liveFinding('paco2-and-ph')).toContain('pH 7.12')
    // The blood path is undisturbed, which is the entire point of the case.
    expect(liveFinding('displayed-circuit-flow')).toContain('4.05 L/min')
  })

  it('never compounds one preview onto another', () => {
    mount('vv-integration-capstone')
    commitAndContinue('vv-integration-capstone')
    continueTo('explain')

    fireEvent.click(guidedAction('preview-recirculation-mechanism'))
    const recirculationFlow = liveFinding('displayed-circuit-flow')

    fireEvent.click(guidedAction('preview-oxygenator-resistance-mechanism'))
    expect(loadedVariantId()).toBe('oxygenator-resistance-preview')
    expect(liveFinding('displayed-circuit-flow')).not.toBe(recirculationFlow)

    fireEvent.click(guidedAction('preview-recirculation-mechanism'))
    expect(liveFinding('displayed-circuit-flow')).toBe(recirculationFlow)
  })

  it('keeps every bounded action reachable in the transfer phase', () => {
    mount('vv-integration-capstone')
    commitAndContinue('vv-integration-capstone')
    continueTo('transfer')

    for (const guided of ecmoFoundationLessonRuntime('vv-integration-capstone').guidedActions) {
      expect(guidedAction(guided.id)).toBeInTheDocument()
    }
    // The transfer item is on screen at the same time; the actions do not give way to it.
    expect(
      screen.getByRole('heading', {
        name: ecmoFoundationLessonRuntime('vv-integration-capstone').phases.transfer.objective,
      }),
    ).toBeInTheDocument()
    expect(document.querySelector('#transfer-heading')).not.toBeNull()
  })

  /*
   * Open on Act and Observe, folded from Explain on, and inside the Now card on Act.
   *
   * Observe used to be folded. A learner review in September 2026 found four sections whose Observe
   * instruction says to compare a value "after each action" or "in both states" while the buttons
   * those sentences mean sat behind a closed disclosure, on a step where the console is not
   * operable either. On the Act step the block is the Now card's interaction body, so the card's
   * "Continue" reads as "I have done this" rather than as the only control on offer.
   */
  it('opens the action list on the Act and Observe steps and folds it afterwards, still reachable', () => {
    mount('vv-integration-capstone')
    commitAndContinue('vv-integration-capstone')

    const onAct = document.querySelector<HTMLDetailsElement>('details[data-bounded-actions]')
    expect(onAct?.open).toBe(true)
    expect(document.querySelector('[data-now-card]')).toContainElement(onAct)
    for (const guided of ecmoFoundationLessonRuntime('vv-integration-capstone').guidedActions) {
      expect(guidedAction(guided.id)).toHaveAttribute('data-guided-action-kind', guided.kind)
    }

    continueTo('observe')
    const onObserve = document.querySelector<HTMLDetailsElement>('details[data-bounded-actions]')
    expect(onObserve?.open).toBe(true)
    expect(guidedAction('reveal-evolved-state')).toBeInTheDocument()

    continueTo('explain')
    const onExplain = document.querySelector<HTMLDetailsElement>('details[data-bounded-actions]')
    expect(onExplain?.open).toBe(false)
    expect(guidedAction('reveal-evolved-state')).toBeInTheDocument()
  })

  it('opens real bounded actions without a prediction and leaves observations unperformed', () => {
    mount('vv-integration-capstone')
    continueTo('predict')
    expect(stepRow('act').querySelector('button')).toBeEnabled()
    fireEvent.click(stepRow('act').querySelector('button')!)
    expect(currentPhase()).toBe('act')
    expect(document.querySelectorAll('[data-guided-action]').length).toBeGreaterThan(0)
    expect(document.querySelector('[data-phase-lock-note]')).toBeNull()
    expect(document.querySelector('[data-comparison-result]')).toBeNull()
    expect(clockIsRunning()).toBe(false)
  })

  /*
   * The instruction promises the other answers, so the card has to carry them.
   *
   * Five sections say "Commit a prediction, then read why the other answers do not fit" and the
   * card showed only the chosen option's rationale, so a learner who went looking for the
   * comparison found nothing. Asserted against the authored item rather than against fixed text, so
   * it keeps holding when the item is rewritten, and asserted absent before the commitment because
   * the whole set of rationales names every mechanism the prediction is asking about.
   */
  it('carries the other answers’ reasoning once the prediction is committed, and not before', () => {
    mount('why-extracorporeal-support')
    const { prediction } = ecmoFoundationLearningItemsFor('why-extracorporeal-support')

    continueTo('predict')
    expect(document.querySelector('[data-other-answers-panel]')).toBeNull()

    fireEvent.click(predictionChoice('why-extracorporeal-support'))
    fireEvent.click(
      screen.getByRole('button', { name: /^(Commit this prediction|Submit answer)$/ }),
    )

    const chosen = prediction.choices[0]
    const panel = document.querySelector('[data-other-answers-panel]')
    expect(panel).not.toBeNull()
    expect(document.querySelector(`[data-other-answer="${chosen.id}"]`)).toBeNull()
    for (const choice of prediction.choices.filter((option) => option.id !== chosen.id)) {
      const row = document.querySelector(`[data-other-answer="${choice.id}"]`)
      expect(`${choice.id}: ${row ? 'given a reason' : 'silent'}`).toBe(
        `${choice.id}: given a reason`,
      )
      expect(row).toHaveTextContent(choice.rationale)
    }
  })

  it('records what was looked at, and clears it when the state is reloaded', () => {
    mount('vv-integration-capstone')
    commitAndContinue('vv-integration-capstone')

    fireEvent.click(guidedAction('inspect-gas-source-connection'))
    fireEvent.click(guidedAction('review-pressure-zones'))
    expect(
      document.querySelector('[data-interaction="inspect-gas-source-connection"]'),
    ).not.toBeNull()
    expect(document.querySelector('[data-interaction="review-pressure-zones"]')).not.toBeNull()

    fireEvent.click(guidedAction('restore-case-before-change'))

    // Evidence never carries across a state change: what is listed is what was looked at since the
    // state on screen was loaded.
    expect(document.querySelector('[data-interaction="inspect-gas-source-connection"]')).toBeNull()
    expect(document.querySelector('[data-interaction="review-pressure-zones"]')).toBeNull()
    expect(document.querySelector('[data-interaction="restore-case-before-change"]')).not.toBeNull()
  })

  it('advances the clock by the authored number of seconds without changing anything else', () => {
    mount('vv-normal-state')
    commitAndContinue('vv-normal-state')

    fireEvent.click(guidedAction('capture-reference-snapshot'))
    fireEvent.click(guidedAction('run-twenty-modeled-seconds'))

    expect(document.querySelector('[data-interaction="run-twenty-modeled-seconds"]')).not.toBeNull()
    // The capture survives the advance, because the comparison is the reason for advancing.
    expect(document.querySelector('[data-interaction="capture-reference-snapshot"]')).not.toBeNull()
  })
})

describe('committing a prediction', () => {
  it('does not advance the phase on its own', () => {
    mount('vv-series-physiology')
    continueTo('predict')

    // Nothing can be committed until one option is chosen.
    expect(nowPrimary()).toHaveTextContent('Commit this prediction')
    expect(nowPrimary()).toBeDisabled()
    fireEvent.click(predictionChoice('vv-series-physiology'))
    expect(nowPrimary()).toBeEnabled()
    fireEvent.click(nowPrimary())

    // Still in predict: the reasoning is on screen and the actions have not appeared behind it.
    expect(currentPhase()).toBe('predict')
    expect(document.querySelector('[data-verdict]')).not.toBeNull()
    expect(document.querySelectorAll('[data-guided-action]')).toHaveLength(0)
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(currentPhase()).toBe('act')
    expect(document.querySelectorAll('[data-guided-action]').length).toBeGreaterThan(0)
  })

  it('cannot be changed once committed', () => {
    mount('vv-series-physiology')
    commitPredictionChoice('vv-series-physiology')

    const chosen = predictionChoice('vv-series-physiology')
    const choices = Array.from(
      document.querySelectorAll<HTMLInputElement>('fieldset[data-prediction-choices] input'),
    )
    expect(choices.length).toBeGreaterThan(1)
    for (const choice of choices) expect(choice).toBeDisabled()
    expect(chosen).toBeChecked()
    expect(document.querySelector('[data-now-status]')).toHaveTextContent('Committed.')
  })
})

describe('the phase carried by the URL', () => {
  // Nothing persists the phase: no storage key, DTO, adapter, or payload version, and ProgressV2 is
  // untouched. The URL is the whole mechanism, which means the activity has to both read it and
  // write it — a parameter the resource never produces would resume nothing.
  it('opens at the first phase when none is supplied', () => {
    mount('vv-integration-capstone')

    expect(currentPhase()).toBe('recognize')
    expect(document.querySelectorAll('[data-guided-action]')).toHaveLength(0)
    expect(document.querySelector('[data-ecmo-resumed-note]')).toBeNull()
  })

  it('restarts a direct explanation URL honestly and lets the learner open the explanation', () => {
    mount('vv-integration-capstone', 'vv', 'explain')
    expect(currentPhase()).toBe('recognize')
    expect(stepRow('explain').querySelector('button')).toBeEnabled()
    expect(document.querySelectorAll('[data-guided-action]')).toHaveLength(0)
    expect(document.querySelector('[data-ecmo-resumed-note]')).toHaveTextContent(
      'Earlier choices, snapshots, and actions were not restored',
    )
    fireEvent.click(stepRow('explain').querySelector('button')!)
    expect(currentPhase()).toBe('explain')
    expect(guidedAction('preview-recirculation-mechanism')).toBeInTheDocument()
  })

  it('opens a transfer from a restarted link without inventing a response', () => {
    mount('vv-integration-capstone', 'vv', 'transfer')
    expect(currentPhase()).toBe('recognize')
    expect(stepRow('transfer').querySelector('button')).toBeEnabled()
    fireEvent.click(stepRow('transfer').querySelector('button')!)
    expect(currentPhase()).toBe('transfer')
    expect(guidedAction('preview-recirculation-mechanism')).toBeInTheDocument()
    expect(document.querySelector('[data-committed-choice]')).toBeNull()
    expect(document.querySelector('[data-comparison-result]')).toBeNull()
  })

  it('still opens on the authored state, held, when resumed mid-lesson', () => {
    mount('vv-integration-capstone', 'vv', 'observe')

    // Resuming restores a clean state source rather than a state carried over from wherever the
    // learner had got to, so the held case is held again — at the predict phase the gated URL was
    // clamped to, which for this lesson resolves the same opening state.
    expect(loadedVariantId()).toBe('gas-source-before-change')
    expect(clockIsRunning()).toBe(false)
    runModeledSeconds(5)
    expect(liveFinding('gas-source-status')).toContain('connected')
  })

  it('writes the phase into the URL as the learner moves', () => {
    window.history.replaceState(
      null,
      '',
      '/en/cardiohelp-ecmo/learn?lesson=vv-integration-capstone&track=vv',
    )
    mount('vv-integration-capstone')
    expect(new URL(window.location.href).searchParams.get('phase')).toBe('recognize')
    commitAndContinue('vv-integration-capstone')
    expect(new URL(window.location.href).searchParams.get('phase')).toBe('act')

    continueTo('observe')
    expect(new URL(window.location.href).searchParams.get('phase')).toBe('observe')

    continueTo('transfer')
    expect(new URL(window.location.href).searchParams.get('phase')).toBe('transfer')

    // The lesson and track it was reached by are left alone.
    const params = new URL(window.location.href).searchParams
    expect(params.get('lesson')).toBe('vv-integration-capstone')
    expect(params.get('track')).toBe('vv')
  })

  it('writes the phase when the prediction hands over to the next one', () => {
    window.history.replaceState(null, '', '/en/cardiohelp-ecmo/learn?lesson=vv-series-physiology')
    mount('vv-series-physiology')

    commitPredictionChoice('vv-series-physiology')
    expect(new URL(window.location.href).searchParams.get('phase')).toBe('predict')
    continueStep()

    expect(new URL(window.location.href).searchParams.get('phase')).toBe('act')
  })

  it('gives a clean state source when resumed at a different phase', () => {
    const { rerender } = render(
      <EcmoFoundationLessonActivity
        sectionId="vv-integration-capstone"
        supportMode="vv"
        initialPhase="recognize"
      />,
    )

    commitAndContinue('vv-integration-capstone')
    continueTo('observe')
    fireEvent.click(guidedAction('reveal-evolved-state'))
    expect(loadedVariantId()).toBe('gas-source-after-change')

    rerender(
      <EcmoFoundationLessonActivity
        sectionId="vv-integration-capstone"
        supportMode="vv"
        initialPhase="explain"
      />,
    )

    // Arriving at a different phase remounts, exactly as a section or track change does, so the
    // state behind the new phase is the lesson's own opening state and not whatever the previous
    // phase happened to leave loaded. The remount also discards the earlier commitment — nothing
    // persists it — so the gated URL clamps to predict and the learner commits again.
    expect(loadedVariantId()).toBe('gas-source-before-change')
    expect(clockIsRunning()).toBe(false)
    expect(currentPhase()).toBe('recognize')
    expect(stepRow('explain').querySelector('button')).toBeEnabled()
    expect(document.querySelector('[data-phase-lock-note]')).toBeNull()
  })

  it('adds no history entry per phase, so leaving the lesson takes one step back', () => {
    window.history.replaceState(null, '', '/en/cardiohelp-ecmo/learn?lesson=vv-normal-state')
    const pushState = jest.spyOn(window.history, 'pushState')
    try {
      mount('vv-normal-state')
      const before = window.history.length

      commitAndContinue('vv-normal-state')
      continueTo('observe')
      continueTo('explain')

      expect(window.history.length).toBe(before)
      expect(pushState).not.toHaveBeenCalled()
      expect(new URL(window.location.href).searchParams.get('phase')).toBe('explain')
    } finally {
      pushState.mockRestore()
    }
  })
})

describe('the recognize phase is reading only', () => {
  // The capstone's recognize copy used to ask the learner to "record" an impression, in a phase
  // that renders no control at all and in a module that deliberately records nothing. The copy now
  // says nothing is entered at this step; these cases are what hold it to that.
  it.each(ecmoInteractiveFoundationSectionIds)('offers nothing to fill in on %s', (sectionId) => {
    mount(sectionId)

    const task = document.querySelector('[data-pane="task"]')
    expect(task).not.toBeNull()
    expect(currentPhase()).toBe('recognize')
    expect(task!.querySelectorAll('[data-guided-action]')).toHaveLength(0)
    expect(task!.querySelectorAll('[data-prediction-choices], [data-attribution]')).toHaveLength(0)
    // The one thing to do is read and continue; the Now card says as much.
    expect(nowPrimary()).toHaveTextContent(/Continue|Follow blood/i)
    expect(
      screen.getByRole('heading', {
        name: buildFoundationStageLesson(sectionId, 'vv').steps[0].title,
      }),
    ).toBeInTheDocument()
  })

  it('promises no entry the capstone cannot take', () => {
    const recognize = ecmoFoundationLessonRuntime('vv-integration-capstone').phases.recognize
    expect(recognize.requiredAction).toContain('Nothing is entered at this step')
    expect(recognize.requiredAction).not.toMatch(/\brecord\b/)
  })
})

describe('every interactive section mounts', () => {
  it.each(ecmoInteractiveFoundationSectionIds)(
    'renders a heading, a teaching panel, and a loaded state for %s',
    (sectionId) => {
      mount(sectionId)

      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
      if (sectionId === 'why-extracorporeal-support')
        expect(document.querySelector('[data-simulator-surfaces]')).toBeNull()
      else expect(loadedVariantId()).toBe(ecmoFoundationLessonRuntime(sectionId).primaryVariantId)
      expect(document.querySelector('[data-pane="teaching"]')).not.toBeNull()
      expect(document.querySelector(`[data-teaching-panel="${sectionId}"]`)).not.toBeNull()
      expect(document.querySelector('[data-device-boundary]')).not.toBeNull()
      // Six steps, one progression, one current row.
      expect(document.querySelectorAll('[data-step-list] li[data-step-id]')).toHaveLength(
        buildFoundationStageLesson(sectionId, 'vv').steps.length,
      )
      expect(currentStepId()).toBe(`${sectionId}-recognize`)
    },
  )
})

describe('the stage shell around the section', () => {
  it('keeps every section one click away behind the Sections drawer', () => {
    mount('circuit-flow-path')

    const drawer = document.querySelector<HTMLDetailsElement>('details[data-sections-drawer]')
    expect(drawer).not.toBeNull()
    expect(drawer?.open).toBe(false)
    const nav = screen.getByRole('navigation', { name: 'VV learning pathway sections' })
    expect(drawer).toContainElement(nav)
  })

  it('answers "What do I do now?" with the current step, in a dialog', () => {
    mount('circuit-flow-path')

    const dialog = document.querySelector<HTMLDialogElement>('dialog[data-ecmo-help-dialog]')
    expect(dialog).not.toBeNull()
    expect(dialog?.textContent).toBe('')

    fireEvent.click(screen.getByRole('button', { name: 'What do I do now?' }))
    expect(dialog).toHaveAttribute('open')
    expect(dialog?.textContent).toContain(
      buildFoundationStageLesson('circuit-flow-path', 'vv').steps[0].instruction,
    )
  })

  it('restarts the section from a clean, uncommitted state', () => {
    mount('vv-series-physiology')
    commitAndContinue('vv-series-physiology')
    fireEvent.click(guidedAction('load-recirculation-preview'))
    expect(loadedVariantId()).toBe('recirculation-preview')

    fireEvent.click(screen.getByRole('button', { name: 'Restart section' }))

    expect(currentPhase()).toBe('recognize')
    expect(loadedVariantId()).toBe('reference-circuit')
    expect(document.querySelectorAll('[data-guided-action]')).toHaveLength(0)
    expect(document.querySelector('[data-phase-lock-note]')).toBeNull()
  })

  it('leaves for the hub on Save & exit', () => {
    mount('circuit-flow-path')
    fireEvent.click(screen.getByRole('button', { name: 'Save & exit' }))
    expect(mockPush).toHaveBeenCalledWith('/cardiohelp-ecmo')
  })

  it('offers the next section once the transfer answer is committed', () => {
    mount('why-extracorporeal-support')
    commitAndContinue('why-extracorporeal-support')
    continueTo('transfer')
    expect(document.querySelector('[data-stage-completion]')).toBeNull()

    const { transfer } = ecmoFoundationLearningItemsFor('why-extracorporeal-support')
    fireEvent.click(screen.getByRole('radio', { name: transfer.choices[0].label }))
    fireEvent.click(screen.getByRole('button', { name: /^(Commit this answer|Submit answer)$/ }))

    expect(document.querySelector('[data-stage-completion]')).not.toBeNull()
    const next = nextPathwaySection(
      criticalCareLearningPathway('cardiohelp-ecmo', 'vv'),
      'why-extracorporeal-support',
    )
    expect(next).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Continue to next section/ }))
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/cardiohelp-ecmo/learn',
      query: { lesson: next!.id, track: 'vv' },
    })
  })

  it('reads baseline signal groups before mounting the combined stable-run view', () => {
    mount('vv-normal-state')
    for (const group of ['drainage-and-load', 'membrane-and-return', 'gas-side', 'patient']) {
      expect(document.querySelectorAll('[data-baseline-group]')).toHaveLength(1)
      expect(document.querySelector('[data-baseline-group]')).toHaveAttribute(
        'data-baseline-group',
        group,
      )
      expect(document.querySelector('[data-testid="cardiohelp-console"]')).toBeNull()
      fireEvent.click(nowPrimary())
    }
    expect(document.querySelectorAll('[data-baseline-group]')).toHaveLength(4)
    expect(document.querySelectorAll('[data-testid="cardiohelp-console"]')).toHaveLength(1)
    expect(currentPhase()).toBe('recognize')
  })
})

describe('the circuit walk, driven the way a learner drives it', () => {
  function walkCard(): HTMLElement {
    const card = document.querySelector<HTMLElement>('[data-circuit-walk]')
    if (!card) throw new Error('no walk card rendered')
    return card
  }

  function stopId(): string | null {
    return walkCard().getAttribute('data-walk-stop')
  }

  function press(selector: string) {
    const button = document.querySelector<HTMLButtonElement>(
      selector === '[data-walk-next]'
        ? '[data-now-primary]'
        : selector === '[data-walk-back]'
          ? '[data-now-back]'
          : selector,
    )
    if (!button) throw new Error(`no ${selector} button`)
    fireEvent.click(button)
  }

  it('walks the flow path forward and back, one stop at a time', () => {
    mount('circuit-flow-path')
    expect(stopId()).toBe('walk-drainage')

    press('[data-walk-next]')
    expect(stopId()).toBe('walk-pump')
    press('[data-walk-next]')
    expect(stopId()).toBe('walk-membrane')
    press('[data-walk-next]')
    expect(stopId()).toBe('walk-return')

    // One progression covers the last blood stop and the next authored gas-path task.
    expect(walkCard().querySelector('[data-walk-next]')).toBeNull()
    expect(document.querySelector('[data-now-primary]')).toHaveTextContent(
      'Continue to the gas path',
    )

    press('[data-walk-back]')
    expect(stopId()).toBe('walk-membrane')
  })

  it('offers no way back from the first stop, and says so rather than dead-ending', () => {
    mount('circuit-flow-path')
    expect(document.querySelector('[data-now-back]')).toBeNull()
    expect(walkCard().textContent).toMatch(/first stop in this section/i)
  })

  it('moves focus to the stop heading, so a keyboard lands where the content changed', () => {
    mount('circuit-flow-path')
    press('[data-walk-next]')
    const heading = walkCard().querySelector('h3')
    expect(document.activeElement).toBe(heading)
    expect(heading?.textContent).toBe('The pump')
  })

  it('does not steal focus on arrival', () => {
    mount('circuit-flow-path')
    // The walk records its opening stop without focusing it. Where focus does rest on arrival is
    // the stage's own landing — the Now card — not a heading three sections down the teaching pane.
    expect(walkCard().contains(document.activeElement)).toBe(false)
    expect(document.activeElement).toHaveAttribute('data-now-focus')
  })

  it('announces the stop, and only the stop', () => {
    mount('circuit-flow-path')
    press('[data-walk-next]')
    const status = walkCard().querySelector('[data-walk-status]')
    expect(status?.getAttribute('role')).toBe('status')
    expect(status?.textContent).toMatch(/^Stop 2 of 4 in this section\. The pump\./)
    // No live value in the announcement: the clock ticks every modelled second and a screen-reader
    // user would be read a stream rather than a change they asked about.
    expect(status?.textContent).not.toMatch(/mmHg|L\/min/)
  })

  /*
   * Reversed 2026-09-07. This used to assert the opposite, on the reasoning that "stop five of six"
   * would tell a learner arriving at the second section that they were near the end. The only
   * learner to walk the pathway read it the other way twice, a day apart: first as sections being
   * out of order, then — after a sentence was added saying the walk carries on — as two stops that
   * simply were not there ("once I went to stop 4 of 6, there were no stops 5 or 6").
   *
   * The authored ordinals are unchanged and still run 1..6 across both sections; only the count the
   * card shows is this section's, so every denominator on screen is reachable from where the learner
   * is standing.
   */
  it('counts this section’s stops, and says the walk is longer than the section', () => {
    mount('pump-and-pressure-zones')
    expect(walkCard().textContent).toMatch(/stop 1 of 2/i)
    expect(walkCard().textContent).toMatch(/began in the previous section/i)
    reachFoundationStep('pump-and-pressure-zones', 'loading')
    expect(walkCard().textContent).toMatch(/stop 2 of 2/i)
  })

  it('says so on the last stop of a section the walk continues past', () => {
    mount('circuit-flow-path')
    expect(walkCard().textContent).toMatch(/stop 1 of 4/i)
    expect(walkCard().textContent).toMatch(/first stop in this section/i)
    for (let step = 0; step < 3; step += 1) press('[data-walk-next]')
    expect(walkCard().textContent).toMatch(/stop 4 of 4/i)
    expect(walkCard().textContent).toMatch(/carries on in the next section/i)
  })

  it.each(['vv', 'va'] as const)(
    '%s: opens each walk section at its own first stop, with no stale stop from the other track',
    (supportMode) => {
      mount('circuit-flow-path', supportMode)
      expect(stopId()).toBe('walk-drainage')
      cleanup()

      mount('pump-and-pressure-zones', supportMode)
      expect(stopId()).toBe('walk-pump-under-load')
    },
  )

  it('keeps learned locations available during optional retrieval', () => {
    mount('circuit-flow-path')
    expect(walkCard().textContent).toMatch(/Reported here.*drainage pressure/i)
    expect(circuitMap()).toHaveAttribute('data-location-disclosure', 'full')
    expect(ringedSensorSites()).toEqual(['pVen'])
    reachFoundationStep('circuit-flow-path', 'pressure-sites')
    fireEvent.click(screen.getByRole('button', { name: /^pInt$/ }))
    expect(
      document.querySelector('[data-active-foundation-block="pressure-sites"]'),
    ).toHaveTextContent('Between pump and oxygenator')
    expect(ringedSensorSites()).toEqual(['pInt'])
    reachFoundationStep('circuit-flow-path', 'predict')
    expect(circuitMap()).toHaveAttribute('data-location-disclosure', 'full')
    expect(circuitMap()).toHaveAttribute('data-presentation-kind', 'none')
    expect(document.querySelector('[data-circuit-walk]')).toBeNull()
  })

  it('retains ordinary teaching when Back returns from the retrieval question', () => {
    mount('circuit-flow-path')
    commitPredictionChoice('circuit-flow-path')
    fireEvent.click(document.querySelector('[data-now-back]')!)
    expect(currentPhase()).toBe('observe')
    expect(circuitMap()).toHaveAttribute('data-location-disclosure', 'full')
    expect(document.querySelector('[data-circuit-pressure-identity]')).not.toBeNull()
    continueStep()
    expect(document.querySelector('fieldset[data-prediction-choices]')).toBeDisabled()
  })

  it('teaches a speed increase before asking about a different speed change', () => {
    mount('pump-and-pressure-zones')
    reachFoundationStep('pump-and-pressure-zones', 'predict')
    expect(document.querySelector('[data-pane="task"]')).toHaveTextContent(/reduced by 300 rpm/i)
    expect(document.querySelector('[data-circuit-walk]')).toBeNull()
    expect(document.querySelector('[data-other-answers-panel]')).toBeNull()
  })

  it('leaves a stop conclusion that answers nothing on screen throughout', () => {
    mount('circuit-flow-path')
    // Stop one's conclusion is about what a drainage pressure is for, which no item asks.
    expect(walkCard().querySelector('[data-walk-takeaway]')?.textContent).toMatch(
      /what is available to drain/i,
    )
  })

  it('offers one required comparison before the independent question', () => {
    mount('pump-and-pressure-zones')
    reachFoundationStep('pump-and-pressure-zones', 'act')
    expect(nowPrimary()).toHaveTextContent('Increase pump speed by 300 rpm')
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull()
    expect(walkCard().querySelectorAll('[data-walk-beat]')).toHaveLength(0)
    fireEvent.click(nowPrimary())
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled()
  })

  it('loads the existing return-resistance comparison only on its own task', () => {
    mount('pump-and-pressure-zones')
    reachFoundationStep('pump-and-pressure-zones', 'loading')
    fireEvent.click(nowPrimary())
    expect(loadedVariantId()).toBe('return-resistance-preview')
    expect(loadedStateCard()).toMatch(/Return-side resistance — mechanism preview/i)
  })

  it('offers no comparison beats on a stop that is not a comparison', () => {
    mount('pump-and-pressure-zones')
    expect(stopId()).toBe('walk-pump-under-load')
    expect(walkCard().querySelector('[data-walk-comparison]')).toBeNull()
  })

  it('leaves the loaded state alone when the learner only changes stop', () => {
    mount('circuit-flow-path')
    const before = loadedVariantId()
    press('[data-walk-next]')
    expect(loadedVariantId()).toBe(before)
  })
})

/**
 * The Act step of the first foundation section, which used to have nothing to do.
 *
 * An owner review in September 2026: "This one says ACT and to select the terms but there isn't
 * anything to select... it says to select the ledger term but nothing selects, you just read it."
 * The step now asks the learner to assign each of four proposed bedside changes to the component of
 * oxygen delivery it acts on, and commits the set in one go.
 *
 * Two of the candidates act on oxygen content by different routes, so revealing any row before the
 * set is committed would give the others away. These pin that nothing is revealed early.
 */
describe('assigning proposed changes to the component they act on', () => {
  const SECTION = 'why-extracorporeal-support'

  function rows(): HTMLElement[] {
    return Array.from(document.querySelectorAll<HTMLElement>('[data-attribution-candidate]'))
  }

  function commitButton(): HTMLElement {
    return screen.getByRole('button', { name: 'Submit these answers' })
  }

  function answer(candidateId: string, componentId: string) {
    const row = rows().find((node) => node.dataset.attributionCandidate === candidateId)
    if (!row) throw new Error(`no row for ${candidateId}`)
    fireEvent.change(row.querySelector('select')!, { target: { value: componentId } })
  }

  function openActStep() {
    mount(SECTION)
    commitAndContinue(SECTION)
  }

  it('offers one real control per proposed change, which is what was missing', () => {
    openActStep()
    const attribution = ecmoDeliveryAttribution(SECTION)!

    expect(rows()).toHaveLength(attribution.candidates.length)
    for (const candidate of attribution.candidates) {
      const row = rows().find((node) => node.dataset.attributionCandidate === candidate.id)
      expect(row).toBeDefined()
      const select = row!.querySelector('select')!
      expect(select).toBeEnabled()
      // Every component is offered on every row; the step is a judgement, not a process of
      // elimination against a shrinking list.
      expect(
        Array.from(select.options)
          .map((option) => option.value)
          .filter(Boolean),
      ).toEqual(attribution.components.map((component) => component.id))
    }
  })

  it('will not commit until every change has been assigned', () => {
    openActStep()
    const attribution = ecmoDeliveryAttribution(SECTION)!
    expect(commitButton()).toBeDisabled()

    attribution.candidates.slice(0, -1).forEach((candidate) => {
      answer(candidate.id, candidate.componentId)
    })
    expect(commitButton()).toBeDisabled()
    expect(document.querySelector('[data-now-disabled-reason]')?.textContent).toMatch(
      /one change still needs a component/i,
    )

    const last = attribution.candidates.at(-1)!
    answer(last.id, last.componentId)
    expect(commitButton()).toBeEnabled()
  })

  it('reveals nothing — no outcome, no reasoning, no definitions — before the set is committed', () => {
    openActStep()
    const attribution = ecmoDeliveryAttribution(SECTION)!
    for (const candidate of attribution.candidates) {
      answer(candidate.id, candidate.componentId)
    }

    // Answered but not committed: still nothing given away.
    for (const row of rows()) expect(row).not.toHaveAttribute('data-attribution-outcome')
    expect(document.querySelector('[data-attribution-outcome-label]')).toBeNull()
    expect(document.querySelector('[data-attribution-components]')).toBeNull()
    const text = document.body.textContent ?? ''
    for (const candidate of attribution.candidates) {
      expect(text).not.toContain(candidate.rationale)
    }
  })

  it('says explicitly, per change, whether the learner was right', () => {
    openActStep()
    const attribution = ecmoDeliveryAttribution(SECTION)!
    const [first, ...rest] = attribution.candidates
    // One deliberately wrong: assign the transfusion to consumption.
    answer(first.id, 'oxygen-consumption')
    rest.forEach((candidate) => answer(candidate.id, candidate.componentId))
    fireEvent.click(commitButton())

    const wrongRow = rows().find((node) => node.dataset.attributionCandidate === first.id)!
    expect(wrongRow).toHaveAttribute('data-attribution-outcome', 'not-correct')
    expect(wrongRow.querySelector('[data-attribution-outcome-label]')?.textContent).toBe(
      'Not correct.',
    )
    // And it names where the change actually acts, rather than only marking the answer.
    expect(wrongRow.textContent).toContain('oxygen content')
    expect(wrongRow.textContent).toContain(first.rationale)

    for (const candidate of rest) {
      const row = rows().find((node) => node.dataset.attributionCandidate === candidate.id)!
      expect(row).toHaveAttribute('data-attribution-outcome', 'correct')
      expect(row.querySelector('[data-attribution-outcome-label]')?.textContent).toBe('Correct.')
      expect(row.textContent).toContain(candidate.rationale)
    }
  })

  it('locks the answers once committed and lets the learner move on', () => {
    openActStep()
    const attribution = ecmoDeliveryAttribution(SECTION)!
    for (const candidate of attribution.candidates) {
      answer(candidate.id, candidate.componentId)
    }
    fireEvent.click(commitButton())

    for (const row of rows()) expect(row.querySelector('select')).toBeDisabled()
    expect(document.querySelector('[data-now-status]')?.textContent).toMatch(/answers recorded/i)
    expect(document.querySelector('[data-attribution-components]')).not.toBeNull()

    continueStep()
    expect(currentPhase()).toBe('transfer')
  })

  it('leaves track-specific sections on their existing bounded actions', () => {
    mount('vv-normal-state')
    commitAndContinue('vv-normal-state')
    expect(currentPhase()).toBe('act')
    expect(rows()).toHaveLength(0)
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument()
  })
})

/**
 * The teaching pane has to change as the steps advance.
 *
 * Owner review, September 2026: "we have had four steps but nothing has changed as far as content
 * in the ledger or things the user is supposed to do — it basically is just saying to read the same
 * thing four times." Every step rendered the whole panel, so the step list moved and the pane did
 * not. Each block now names the steps it is the focus of, and folds elsewhere rather than vanishing.
 */
describe('what the teaching pane shows, step by step', () => {
  const SECTION = 'why-extracorporeal-support'
  it('opens the delivery relationship and keeps the advanced explorer optional', () => {
    mount(SECTION)
    expect(document.querySelector('[data-active-foundation-block="delivery"]')).toHaveTextContent(
      /oxygen content/i,
    )
    const explorer = document.querySelector('[data-oxygen-delivery-explorer]')
    expect(explorer).not.toBeNull()
    expect(explorer?.closest('details')).not.toHaveAttribute('open')
  })
  it('opens the worked example on entry, before asking for an answer', () => {
    mount(SECTION)
    continueStep()
    expect(
      document.querySelector('[data-active-foundation-block="support-example"]'),
    ).not.toBeNull()
    expect(document.querySelector('[data-prediction-choices]')).toBeNull()
  })
  it('does not mount case reasoning or the reference explorer beside an independent case', () => {
    mount(SECTION)
    reachFoundationStep(SECTION, 'predict')
    expect(document.querySelector('[data-oxygen-delivery-explorer]')).toBeNull()
    for (const choice of ecmoFoundationLearningItemsFor(SECTION).prediction.choices) {
      expect(document.body.textContent).not.toContain(choice.rationale)
    }
  })
  it('mounts only the active explanation and restores earlier teaching through Back', () => {
    mount(SECTION)
    continueStep()
    expect(document.querySelectorAll('details[data-foundation-reference]')).toHaveLength(0)
    expect(
      document.querySelector('[data-active-foundation-block="support-example"]'),
    ).not.toBeNull()
    fireEvent.click(document.querySelector('[data-now-back]')!)
    expect(document.querySelector('[data-active-foundation-block="delivery"]')).not.toBeNull()
  })
})
