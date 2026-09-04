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
  const stage = currentStepId()
  return stage.slice(stage.lastIndexOf('-') + 1) as Phase
}

function stepRow(phase: Phase): HTMLLIElement {
  const row = document.querySelector<HTMLLIElement>(
    `[data-step-list] li[data-step-id$="-${phase}"]`,
  )
  if (!row) throw new Error(`no step row rendered for ${phase}`)
  return row
}

function stepRowState(phase: Phase): string | null {
  return stepRow(phase).getAttribute('data-step-state')
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
  const commit = screen.queryByRole('button', { name: 'Commit these answers' })
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
  fireEvent.click(screen.getByRole('button', { name: 'Commit these answers' }))
  return true
}

function continueTo(phase: Phase) {
  for (let guard = 0; currentPhase() !== phase; guard += 1) {
    if (guard > 8) throw new Error(`could not reach ${phase}; stuck at ${currentPhase()}`)
    if (answerAttributionIfPresent()) continue
    continueStep()
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
  fireEvent.click(screen.getByRole('button', { name: 'Commit this prediction' }))
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
    expect(loadedStateCard()).toContain('VA reference circuit')
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

  it('opens the action list on the Act step and folds it afterwards, still reachable', () => {
    mount('vv-integration-capstone')
    commitAndContinue('vv-integration-capstone')

    const onAct = document.querySelector<HTMLDetailsElement>('details[data-bounded-actions]')
    expect(onAct?.open).toBe(true)
    for (const guided of ecmoFoundationLessonRuntime('vv-integration-capstone').guidedActions) {
      expect(guidedAction(guided.id)).toHaveAttribute('data-guided-action-kind', guided.kind)
    }

    continueTo('observe')
    const onObserve = document.querySelector<HTMLDetailsElement>('details[data-bounded-actions]')
    expect(onObserve?.open).toBe(false)
    expect(guidedAction('reveal-evolved-state')).toBeInTheDocument()
  })

  it('offers no state-loading action before the prediction has been committed', () => {
    mount('vv-integration-capstone')

    expect(document.querySelectorAll('[data-guided-action]')).toHaveLength(0)
    expect(document.querySelector('[data-bounded-actions]')).toBeNull()
    continueTo('predict')
    expect(document.querySelectorAll('[data-guided-action]')).toHaveLength(0)
    // The Act row is locked and its button disabled, and the list says why. Clicking it
    // uncommitted is a no-op: the transition itself consults the commitment. This was the
    // reproduced bypass — a phase click used to unlock it.
    expect(stepRowState('act')).toBe('locked')
    fireEvent.click(stepRow('act').querySelector('button')!)
    expect(currentPhase()).toBe('predict')
    expect(document.querySelectorAll('[data-guided-action]')).toHaveLength(0)
    expect(document.querySelector('[data-phase-lock-note]')).toHaveTextContent(
      'The later steps unlock when you commit your prediction.',
    )

    commitAndContinue('vv-integration-capstone')
    expect(document.querySelectorAll('[data-guided-action]').length).toBeGreaterThan(0)
    expect(document.querySelector('[data-phase-lock-note]')).toBeNull()
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

  it('fails closed on a direct URL into a commitment-gated phase', () => {
    mount('vv-integration-capstone', 'vv', 'explain')

    // The mount is clamped to predict: no commitment exists in this session and none is
    // reconstructed from the URL, so the phase the URL asked for stays locked until one is made.
    expect(currentPhase()).toBe('predict')
    expect(stepRowState('explain')).toBe('locked')
    expect(stepRow('explain').querySelector('button')).toBeDisabled()
    expect(document.querySelectorAll('[data-guided-action]')).toHaveLength(0)
    // And the note says what happened rather than pretending the URL was honoured.
    const note = document.querySelector('[data-ecmo-resumed-note]')?.textContent ?? ''
    expect(note).toContain('opened at the predict step')
    expect(note).toContain('The explain step unlocks when you commit')

    // Committing unlocks exactly what the learner asked for.
    commitPredictionChoice('vv-integration-capstone')
    continueTo('explain')
    expect(guidedAction('preview-recirculation-mechanism')).toBeInTheDocument()
  })

  it('fails closed on a direct URL into the transfer phase', () => {
    mount('vv-integration-capstone', 'vv', 'transfer')

    expect(currentPhase()).toBe('predict')
    expect(stepRowState('transfer')).toBe('locked')
    expect(stepRow('transfer').querySelector('button')).toBeDisabled()
    expect(document.querySelectorAll('[data-guided-action]')).toHaveLength(0)
    expect(document.querySelector('[data-ecmo-resumed-note]')?.textContent).toContain(
      'The transfer step unlocks when you commit',
    )

    commitPredictionChoice('vv-integration-capstone')
    continueTo('transfer')
    expect(guidedAction('preview-recirculation-mechanism')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        name: ecmoFoundationLessonRuntime('vv-integration-capstone').phases.transfer.objective,
      }),
    ).toBeInTheDocument()
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
    expect(currentPhase()).toBe('predict')
    expect(stepRowState('explain')).toBe('locked')
    expect(document.querySelector('[data-phase-lock-note]')).not.toBeNull()
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
    expect(task!.querySelectorAll('input, textarea, select')).toHaveLength(0)
    // The one thing to do is read and continue; the Now card says as much.
    expect(nowPrimary()).toHaveTextContent('Continue')
    expect(
      screen.getByRole('heading', {
        name: ecmoFoundationLessonRuntime(sectionId).phases.recognize.objective,
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
      expect(loadedVariantId()).toBe(ecmoFoundationLessonRuntime(sectionId).primaryVariantId)
      expect(document.querySelector('[data-pane="teaching"]')).not.toBeNull()
      expect(document.querySelector(`[data-teaching-panel="${sectionId}"]`)).not.toBeNull()
      expect(document.querySelector('[data-device-boundary]')).not.toBeNull()
      // Six steps, one progression, one current row.
      expect(document.querySelectorAll('[data-step-list] li[data-step-id]')).toHaveLength(6)
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
      ecmoFoundationLessonRuntime('circuit-flow-path').phases.recognize.requiredAction,
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
    expect(document.querySelector('[data-phase-lock-note]')).not.toBeNull()
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
    fireEvent.click(screen.getByRole('button', { name: 'Commit this answer' }))

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

  it('keeps the circuit surface open on every step and the others mounted behind disclosures', () => {
    mount('vv-normal-state')
    const surfaces = document.querySelector('[data-pane="simulator"] [data-simulator-surfaces]')
    expect(surfaces).not.toBeNull()
    expect(surfaces!.querySelectorAll('section[data-surface]')).toHaveLength(4)
    expect(surfaces!.querySelector('[data-testid="cardiohelp-console"]')).not.toBeNull()

    const phases: readonly Phase[] = [
      'recognize',
      'predict',
      'act',
      'observe',
      'explain',
      'transfer',
    ]
    for (const phase of phases) {
      if (phase === 'act') commitAndContinue('vv-normal-state')
      else continueTo(phase)
      const circuit = surfaces!.querySelector('section[data-surface="circuit"]')
      expect(circuit?.getAttribute('data-open')).toBe('true')
      expect(circuit?.querySelector('[data-testid="circuit-schematic"]')).not.toBeNull()
      // A closed surface is hidden, not gone: its control ids stay in the document.
      for (const other of ['gas', 'trends'] as const) {
        const section = surfaces!.querySelector(`section[data-surface="${other}"]`)
        expect(section?.getAttribute('data-open')).toBe('false')
        const body = section?.querySelector('[hidden]')
        expect(body).not.toBeNull()
        expect(body?.children.length).toBeGreaterThan(0)
      }
    }
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
    const button = walkCard().querySelector<HTMLButtonElement>(selector)
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

    // The last stop of this section: there is nowhere further to go inside it.
    expect(walkCard().querySelector<HTMLButtonElement>('[data-walk-next]')?.disabled).toBe(true)

    press('[data-walk-back]')
    expect(stopId()).toBe('walk-membrane')
  })

  it('offers no way back from the first stop, and says so rather than dead-ending', () => {
    mount('circuit-flow-path')
    expect(walkCard().querySelector<HTMLButtonElement>('[data-walk-back]')?.disabled).toBe(true)
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
    expect(status?.textContent).toMatch(/^Stop 2 of 6\. The pump\./)
    // No live value in the announcement: the clock ticks every modelled second and a screen-reader
    // user would be read a stream rather than a change they asked about.
    expect(status?.textContent).not.toMatch(/mmHg|L\/min/)
  })

  it('counts the whole walk, not this section’s share of it', () => {
    mount('pump-and-pressure-zones')
    expect(walkCard().textContent).toMatch(/stop 5 of 6/i)
    press('[data-walk-next]')
    expect(walkCard().textContent).toMatch(/stop 6 of 6/i)
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

  /*
   * The gate that keeps the walk from answering the question next door.
   *
   * `circuit-flow-path` asks the learner to place a named channel, and its own `act` instruction is
   * to find the channels on the map. So the stop does not name what it reports until the learner
   * has committed — the one authority every answer-bearing surface reads.
   */
  it('withholds the reading names until the prediction is committed', () => {
    mount('circuit-flow-path')
    // Asserted on the card's whole text, not on the two blocks that carry the names.
    // The first version of this checked `[data-walk-reported-here]` and `[data-walk-live-signals]`
    // were absent — and passed while the card's own text equivalent printed "Reported here: …"
    // four lines below them. The accessible copy was the surface leaking the answer.
    expect(walkCard().textContent).not.toMatch(/Reported here/i)
    expect(walkCard().textContent).not.toMatch(/\bpVen\b/)
    expect(walkCard().querySelector('[data-walk-reported-here]')).toBeNull()
    expect(walkCard().querySelector('[data-walk-live-signals]')).toBeNull()
    // The map does not ring them either: ringing exactly the channel the prediction asks a learner
    // to place would be a sharper pointer than the seven this map flagged before the walk existed.
    // The map is the simulator pane's pressure-zone map now, which withholds its channel placements
    // for this section until commitment — so there is no flag to ring, and nothing is rung.
    expect(circuitMap().getAttribute('data-location-disclosure')).toBe('withheld')
    expect(circuitMap().getAttribute('data-presentation-kind')).toBe('walk-stop')
    expect(ringedSensorSites()).toHaveLength(0)

    // Reaching for the Act step uncommitted is the bypass the independent review reproduced; it
    // reveals nothing now, because the step is not the authority and the row will not move.
    continueTo('predict')
    expect(stepRowState('act')).toBe('locked')
    fireEvent.click(stepRow('act').querySelector('button')!)
    expect(currentPhase()).toBe('predict')
    expect(walkCard().textContent).not.toMatch(/Reported here/i)
    expect(ringedSensorSites()).toHaveLength(0)
    cleanup()

    mount('circuit-flow-path')
    commitAndContinue('circuit-flow-path')
    expect(walkCard().querySelector('[data-walk-reported-here]')?.textContent).toMatch(
      /drainage pressure \(pVen\)/,
    )
    // Committed: the placements are drawn, and the stop's own reading is rung on the map.
    expect(circuitMap().getAttribute('data-location-disclosure')).toBe('full')
    expect(ringedSensorSites()).toEqual(['pVen'])
  })

  it('keeps the walk open when a committed learner reviews an earlier step', () => {
    mount('circuit-flow-path')
    commitAndContinue('circuit-flow-path')
    expect(walkCard().querySelector('[data-walk-reported-here]')).not.toBeNull()

    // Reviewing recognize is re-reading, not un-committing: the performed row expands its recap in
    // place, the stage stays where it was, the commitment is preserved for the session, so the
    // teaching stays open and the later steps stay reachable.
    expect(stepRowState('recognize')).toBe('done')
    fireEvent.click(stepRow('recognize').querySelector('button')!)
    expect(stepRow('recognize').querySelector('[data-step-recap]')).not.toBeNull()
    expect(currentPhase()).toBe('act')
    expect(walkCard().querySelector('[data-walk-reported-here]')).not.toBeNull()
    expect(document.querySelector('[data-phase-lock-note]')).toBeNull()
    continueTo('observe')
    expect(walkCard().querySelector('[data-walk-reported-here]')).not.toBeNull()
  })

  /*
   * The stop whose conclusion is its own section's keyed answer.
   *
   * `pump-and-pressure-zones` opens on stop five, so this card is what sits beside the prediction
   * however the learner arrives. Its takeaway is both halves of the keyed choice — flow follows
   * speed, and it is bought with suction — and it shipped ungated.
   */
  it('withholds a stop conclusion that would answer its own section', () => {
    mount('pump-and-pressure-zones')
    continueTo('predict')
    expect(walkCard().getAttribute('data-walk-stop')).toBe('walk-pump-under-load')

    // The question is on screen...
    expect(document.body.textContent).toMatch(/pump speed is about to be raised/i)
    // ...and the answer is not.
    expect(walkCard().querySelector('[data-walk-takeaway]')).toBeNull()
    expect(walkCard().textContent).not.toMatch(/bought with suction/i)
    expect(walkCard().textContent).not.toMatch(/more negative/i)
    expect(walkCard().textContent).not.toMatch(/pulls harder|pulling harder/i)

    // The conclusion arrives with the commitment itself, not with a step change.
    commitPredictionChoice('pump-and-pressure-zones')
    expect(currentPhase()).toBe('predict')
    expect(walkCard().querySelector('[data-walk-takeaway]')?.textContent).toMatch(
      /bought with suction/i,
    )
  })

  it('leaves a stop conclusion that answers nothing on screen throughout', () => {
    mount('circuit-flow-path')
    // Stop one's conclusion is about what a drainage pressure is for, which no item asks.
    expect(walkCard().querySelector('[data-walk-takeaway]')?.textContent).toMatch(
      /what is available to drain/i,
    )
  })

  it('offers no comparison before the section has taken its prediction', () => {
    // The activity hides its "Bounded actions" block in recognize and predict. These beats load
    // states through those very actions, so an ungated beat button was a second door into a room
    // the first door is locked out of.
    mount('pump-and-pressure-zones')
    continueTo('predict')
    press('[data-walk-next]')
    expect(stopId()).toBe('walk-downstream-load')
    expect(walkCard().querySelector('[data-walk-comparison]')).toBeNull()
    expect(walkCard().querySelectorAll('[data-walk-beat]')).toHaveLength(0)
  })

  it('runs a comparison beat through the action the section already declares', () => {
    mount('pump-and-pressure-zones')
    commitAndContinue('pump-and-pressure-zones')
    press('[data-walk-next]')
    expect(stopId()).toBe('walk-downstream-load')

    const beats = [...walkCard().querySelectorAll('[data-walk-beat]')].map((node) =>
      node.getAttribute('data-walk-beat'),
    )
    expect(beats).toEqual([
      'walk-return-load-baseline',
      'walk-return-load-obstructed',
      'walk-return-load-matched-flow',
    ])

    fireEvent.click(walkCard().querySelector('[data-walk-beat="walk-return-load-obstructed"]')!)
    // The state on screen is the one the beat named, reached through the lesson's own variant.
    expect(loadedVariantId()).toBe('return-resistance-preview')
    expect(loadedStateCard()).toMatch(/Return-side resistance — mechanism preview/i)
  })

  it('offers no comparison beats on a stop that is not a comparison', () => {
    mount('pump-and-pressure-zones')
    expect(stopId()).toBe('walk-pump-under-load')
    expect(walkCard().querySelector('[data-walk-comparison]')).toBeNull()
  })

  it('leaves the loaded state alone when the learner only changes stop', () => {
    mount('pump-and-pressure-zones')
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
    return screen.getByRole('button', { name: 'Commit these answers' })
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
    expect(currentPhase()).toBe('observe')
  })

  it('leaves the other nine sections on their bounded actions', () => {
    mount('circuit-flow-path')
    commitAndContinue('circuit-flow-path')
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

  function openBlocks(): string[] {
    return Array.from(document.querySelectorAll<HTMLElement>('[data-teaching-panel] > *'))
      .filter((node) => !(node.tagName === 'DETAILS' && node.hasAttribute('data-phase-collapsed')))
      .map((node) => node.querySelector('h3,summary')?.textContent?.trim() ?? '')
      .filter(Boolean)
  }

  function explorerIsFolded(): boolean {
    const explorer = document.querySelector('[data-oxygen-delivery-explorer]')
    if (!explorer) return true
    return explorer.closest('[data-phase-collapsed]') !== null
  }

  it('foregrounds the components while the learner is reading and predicting', () => {
    mount(SECTION)
    expect(openBlocks().join(' | ')).toMatch(/component by component/i)
    // Nothing to manipulate yet; the explorer is folded away rather than absent.
    expect(explorerIsFolded()).toBe(true)
    expect(document.querySelector('[data-oxygen-delivery-explorer]')).not.toBeNull()
  })

  it('brings the interactive controls forward on the step that asks the learner to act', () => {
    mount(SECTION)
    commitAndContinue(SECTION)
    expect(currentPhase()).toBe('act')
    expect(explorerIsFolded()).toBe(false)
    expect(screen.getByLabelText('Hemoglobin')).toBeInTheDocument()
    expect(screen.getByLabelText(/^Cardiac output/)).toBeInTheDocument()
  })

  it('moves the pane on as the steps advance, rather than repeating one view', () => {
    mount(SECTION)
    const seen = new Map<string, string>()
    seen.set('recognize', openBlocks().join(' | '))
    commitPredictionChoice(SECTION)
    seen.set('predict', openBlocks().join(' | '))
    for (const phase of ['act', 'observe', 'explain'] as const) {
      continueTo(phase)
      seen.set(phase, openBlocks().join(' | '))
    }

    /*
     * Recognize and Predict deliberately share their reference material — the learner reads the
     * components, then is asked about them, and the question's own stem carries every value it
     * needs. What the review found was the *whole* section standing still, so what is pinned is
     * that the pane actually moves: three distinct views across the five steps, with the steps that
     * ask for something different showing something different.
     */
    expect(new Set(seen.values()).size).toBeGreaterThanOrEqual(3)
    expect(seen.get('act')).not.toBe(seen.get('recognize'))
    expect(seen.get('observe')).not.toBe(seen.get('predict'))
    expect(seen.get('explain')).not.toBe(seen.get('act'))
  })

  it('keeps every folded block reachable, so nothing already read becomes lost', () => {
    mount(SECTION)
    commitAndContinue(SECTION)
    const folded = Array.from(
      document.querySelectorAll<HTMLDetailsElement>('[data-phase-collapsed]'),
    )
    expect(folded.length).toBeGreaterThan(0)
    for (const node of folded) {
      // A native disclosure: keyboard-operable, announced, and openable with no script.
      expect(node.tagName).toBe('DETAILS')
      expect(node.querySelector('summary')?.textContent?.trim()).toBeTruthy()
    }
  })
})
