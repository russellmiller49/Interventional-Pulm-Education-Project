import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import { EcmoFoundationLessonActivity } from '../components/EcmoFoundationLessonActivity'
import {
  ecmoFoundationLessonRuntime,
  ecmoInteractiveFoundationSectionIds,
  ecmoSharedFoundationSectionIds,
  ecmoVaOnlyFoundationSectionIds,
  ecmoVvOnlyFoundationSectionIds,
} from '../content/foundationLessonRuntime'
import type { SupportMode } from '../engine/types'

/**
 * Mount tests for the foundation Learn activity.
 *
 * The activity's guarantees were previously asserted by matching regular expressions against its
 * own source text. That checks the code still looks the way it looked; it cannot check what the
 * component does once it is running, and the one blocking defect this package found — a free
 * running clock walking the capstone past the authored change it was supposed to sit in front of —
 * was invisible to every one of those assertions. It is visible here in the first two cases.
 *
 * Everything is read through the rendered DOM: which state is loaded, whether the clock is held,
 * which track links exist, and what the teaching panel reports.
 */

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

// The two device panes are replaced with markers. Neither is what any assertion here reads, and
// the circuit view pulls three.js in through EcmoCircuit3D, which does not render under jsdom.
jest.mock('../components/CardiohelpConsole', () => ({
  CardiohelpConsole: () => <div data-testid="cardiohelp-console" />,
}))
jest.mock('../components/CircuitAndMonitors', () => ({
  CircuitAndMonitors: () => <div data-testid="circuit-and-monitors" />,
}))

function mount(
  sectionId: Parameters<typeof EcmoFoundationLessonActivity>[0]['sectionId'],
  supportMode: SupportMode = 'vv',
) {
  return render(<EcmoFoundationLessonActivity sectionId={sectionId} supportMode={supportMode} />)
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

/** The phase buttons are labelled with the phase name itself. */
function goToPhase(phase: string) {
  fireEvent.click(screen.getByRole('button', { name: phase }))
}

/**
 * Commit the section's prediction, staying in the predict phase.
 *
 * Commitment — not phase — is the authority for every answer-bearing surface, so tests that need
 * a later phase have to commit the way a learner does. Nothing else unlocks those phases.
 */
function commitPredictionChoice() {
  goToPhase('predict')
  const choice = document.querySelector<HTMLElement>('#prediction-heading + div button')
  if (!choice) throw new Error('no prediction choice rendered')
  fireEvent.click(choice)
}

/** Commit, then follow the explicit Continue into the act phase. */
function commitAndContinue() {
  commitPredictionChoice()
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
}

function runModeledSeconds(seconds: number) {
  act(() => {
    jest.advanceTimersByTime(seconds * 1000)
  })
}

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

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

    commitAndContinue()
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
  })

  it('pauses on request, and stays paused', () => {
    mount('vv-normal-state')

    fireEvent.click(clockToggle())
    expect(clockIsRunning()).toBe(false)

    runModeledSeconds(30)
    expect(clockIsRunning()).toBe(false)
  })
})

describe('a VV-only section never offers the VA track', () => {
  it.each(ecmoVvOnlyFoundationSectionIds)('fixes the pathway indicator on %s', (sectionId) => {
    mount(sectionId)

    expect(document.querySelector('[data-fixed-pathway="vv"]')).not.toBeNull()
    expect(document.querySelectorAll('[data-track-link]')).toHaveLength(0)
  })

  it.each(ecmoVvOnlyFoundationSectionIds)(
    'ignores a requested VA track on %s and runs VV anyway',
    (sectionId) => {
      mount(sectionId, 'va')

      expect(document.querySelector('main')).toHaveAttribute('data-support-mode', 'vv')
      expect(document.querySelector('[data-fixed-pathway="vv"]')).not.toBeNull()
      expect(document.querySelectorAll('[data-track-link]')).toHaveLength(0)
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

    expect(document.querySelector('[data-fixed-pathway="va"]')).not.toBeNull()
    expect(document.querySelectorAll('[data-track-link]')).toHaveLength(0)
  })

  it.each(ecmoVaOnlyFoundationSectionIds)(
    'ignores a requested VV track on %s and runs VA anyway',
    (sectionId) => {
      mount(sectionId, 'vv')

      expect(document.querySelector('main')).toHaveAttribute('data-support-mode', 'va')
      expect(document.querySelector('[data-fixed-pathway="va"]')).not.toBeNull()
      expect(document.querySelectorAll('[data-track-link]')).toHaveLength(0)
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
    // told the learner the circuit in front of them runs in series with the native lung.
    mount('va-parallel-physiology', 'va')
    const indicator = document.querySelector('[data-fixed-pathway="va"]')?.textContent ?? ''

    expect(indicator).toContain('parallel circulation')
    expect(indicator).not.toContain('series physiology')

    cleanup()
    mount('vv-series-physiology', 'vv')
    const vvIndicator = document.querySelector('[data-fixed-pathway="vv"]')?.textContent ?? ''
    expect(vvIndicator).toContain('series physiology')
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
    commitAndContinue()

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
    commitAndContinue()
    goToPhase('explain')

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
    commitAndContinue()
    goToPhase('explain')
    fireEvent.click(guidedAction('preview-va-gas-source-before-change'))

    fireEvent.click(clockToggle())
    runModeledSeconds(1)

    expect(clockIsRunning()).toBe(true)
  })

  it('keeps every VA capstone action reachable in the transfer phase', () => {
    mount('va-integration-capstone', 'va')
    commitAndContinue()
    goToPhase('transfer')

    for (const guided of ecmoFoundationLessonRuntime('va-integration-capstone').guidedActions) {
      expect(guidedAction(guided.id)).toBeInTheDocument()
    }
  })

  it('captures and advances on the VA normal state', () => {
    mount('va-normal-state', 'va')
    commitAndContinue()

    fireEvent.click(guidedAction('capture-reference-snapshot'))
    fireEvent.click(guidedAction('run-twenty-modeled-seconds'))

    expect(document.querySelector('[data-interaction="capture-reference-snapshot"]')).not.toBeNull()
    expect(document.querySelector('[data-interaction="run-twenty-modeled-seconds"]')).not.toBeNull()
  })
})

describe('a shared section keeps both tracks', () => {
  it.each(ecmoSharedFoundationSectionIds)('renders both track links on %s', (sectionId) => {
    mount(sectionId)

    expect(document.querySelector('[data-track-link="vv"]')).toHaveAttribute(
      'href',
      `/cardiohelp-ecmo/learn?lesson=${sectionId}&track=vv`,
    )
    expect(document.querySelector('[data-track-link="va"]')).toHaveAttribute(
      'href',
      `/cardiohelp-ecmo/learn?lesson=${sectionId}&track=va`,
    )
    expect(document.querySelector('[data-fixed-pathway]')).toBeNull()
  })

  it('honours the requested track, so the VV-only rule is not a blanket one', () => {
    mount('why-extracorporeal-support', 'va')

    expect(document.querySelector('main')).toHaveAttribute('data-support-mode', 'va')
    expect(loadedStateCard()).toContain('VA reference circuit')
  })
})

describe('bounded actions', () => {
  it('lands a restore-and-apply directly on the settled state', () => {
    mount('vv-integration-capstone')
    commitAndContinue()
    goToPhase('observe')

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
    commitAndContinue()
    goToPhase('explain')

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
    commitAndContinue()
    goToPhase('transfer')

    for (const guided of ecmoFoundationLessonRuntime('vv-integration-capstone').guidedActions) {
      expect(guidedAction(guided.id)).toBeInTheDocument()
    }
    // The transfer item is on screen at the same time; the actions do not give way to it.
    expect(
      screen.getByRole('heading', {
        name: ecmoFoundationLessonRuntime('vv-integration-capstone').phases.transfer.objective,
      }),
    ).toBeInTheDocument()
  })

  it('offers no state-loading action before the prediction has been committed', () => {
    mount('vv-integration-capstone')

    expect(document.querySelectorAll('[data-guided-action]')).toHaveLength(0)
    goToPhase('predict')
    expect(document.querySelectorAll('[data-guided-action]')).toHaveLength(0)
    // Clicking `act` uncommitted is a no-op: the button is disabled and the transition itself
    // consults the commitment. This was the reproduced bypass — a phase click used to unlock it.
    goToPhase('act')
    expect(document.querySelectorAll('[data-guided-action]')).toHaveLength(0)
    expect(screen.getByRole('button', { name: 'act' })).toBeDisabled()

    commitAndContinue()
    expect(document.querySelectorAll('[data-guided-action]').length).toBeGreaterThan(0)
  })

  it('records what was looked at, and clears it when the state is reloaded', () => {
    mount('vv-integration-capstone')
    commitAndContinue()

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
    commitAndContinue()

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
    goToPhase('predict')

    const choice = document.querySelector<HTMLElement>('#prediction-heading + div button')
    expect(choice).not.toBeNull()
    fireEvent.click(choice!)

    // Still in predict: the reasoning is on screen and the actions have not appeared behind it.
    expect(document.querySelectorAll('[data-guided-action]')).toHaveLength(0)
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(document.querySelectorAll('[data-guided-action]').length).toBeGreaterThan(0)
  })

  it('cannot be changed once committed', () => {
    mount('vv-series-physiology')
    goToPhase('predict')

    const choices = Array.from(
      document.querySelectorAll<HTMLButtonElement>('#prediction-heading + div button'),
    )
    fireEvent.click(choices[0])

    for (const choice of choices) expect(choice).toBeDisabled()
    expect(choices[0]).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('the phase carried by the URL', () => {
  // Nothing persists the phase: no storage key, DTO, adapter, or payload version, and ProgressV2 is
  // untouched. The URL is the whole mechanism, which means the activity has to both read it and
  // write it — a parameter the resource never produces would resume nothing.
  it('opens at the first phase when none is supplied', () => {
    mount('vv-integration-capstone')

    expect(screen.getByRole('button', { name: 'recognize' })).toHaveAttribute(
      'aria-current',
      'step',
    )
    expect(document.querySelectorAll('[data-guided-action]')).toHaveLength(0)
  })

  it('fails closed on a direct URL into a commitment-gated phase', () => {
    render(
      <EcmoFoundationLessonActivity
        sectionId="vv-integration-capstone"
        supportMode="vv"
        initialPhase="explain"
      />,
    )

    // The mount is clamped to predict: no commitment exists in this session and none is
    // reconstructed from the URL, so the phase the URL asked for stays locked until one is made.
    expect(screen.getByRole('button', { name: 'predict' })).toHaveAttribute('aria-current', 'step')
    expect(screen.getByRole('button', { name: 'explain' })).toBeDisabled()
    expect(document.querySelectorAll('[data-guided-action]')).toHaveLength(0)
    // And the note says what happened rather than pretending the URL was honoured.
    expect(document.querySelector('[data-phase-clamped="explain"]')).not.toBeNull()

    // Committing unlocks exactly what the learner asked for.
    commitPredictionChoice()
    goToPhase('explain')
    expect(guidedAction('preview-recirculation-mechanism')).toBeInTheDocument()
  })

  it('fails closed on a direct URL into the transfer phase', () => {
    render(
      <EcmoFoundationLessonActivity
        sectionId="vv-integration-capstone"
        supportMode="vv"
        initialPhase="transfer"
      />,
    )

    expect(screen.getByRole('button', { name: 'predict' })).toHaveAttribute('aria-current', 'step')
    expect(screen.getByRole('button', { name: 'transfer' })).toBeDisabled()
    expect(document.querySelectorAll('[data-guided-action]')).toHaveLength(0)
    expect(document.querySelector('[data-phase-clamped="transfer"]')).not.toBeNull()

    commitPredictionChoice()
    goToPhase('transfer')
    expect(guidedAction('preview-recirculation-mechanism')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        name: ecmoFoundationLessonRuntime('vv-integration-capstone').phases.transfer.objective,
      }),
    ).toBeInTheDocument()
  })

  it('still opens on the authored state, held, when resumed mid-lesson', () => {
    render(
      <EcmoFoundationLessonActivity
        sectionId="vv-integration-capstone"
        supportMode="vv"
        initialPhase="observe"
      />,
    )

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
    commitAndContinue()

    goToPhase('observe')
    expect(new URL(window.location.href).searchParams.get('phase')).toBe('observe')

    goToPhase('transfer')
    expect(new URL(window.location.href).searchParams.get('phase')).toBe('transfer')

    // The lesson and track it was reached by are left alone.
    const params = new URL(window.location.href).searchParams
    expect(params.get('lesson')).toBe('vv-integration-capstone')
    expect(params.get('track')).toBe('vv')
  })

  it('writes the phase when the prediction hands over to the next one', () => {
    window.history.replaceState(null, '', '/en/cardiohelp-ecmo/learn?lesson=vv-series-physiology')
    mount('vv-series-physiology')

    goToPhase('predict')
    fireEvent.click(document.querySelector<HTMLElement>('#prediction-heading + div button')!)
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

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

    commitAndContinue()
    goToPhase('observe')
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
    expect(screen.getByRole('button', { name: 'predict' })).toHaveAttribute('aria-current', 'step')
    expect(screen.getByRole('button', { name: 'explain' })).toBeDisabled()
  })

  it('adds no history entry per phase, so leaving the lesson takes one step back', () => {
    window.history.replaceState(null, '', '/en/cardiohelp-ecmo/learn?lesson=vv-normal-state')
    mount('vv-normal-state')
    const before = window.history.length

    commitAndContinue()
    goToPhase('observe')
    goToPhase('explain')

    expect(window.history.length).toBe(before)
  })
})

describe('the recognize phase is reading only', () => {
  // The capstone's recognize copy used to ask the learner to "record" an impression, in a phase
  // that renders no control at all and in a module that deliberately records nothing. The copy now
  // says nothing is entered at this step; these cases are what hold it to that.
  it.each(ecmoInteractiveFoundationSectionIds)('offers nothing to fill in on %s', (sectionId) => {
    mount(sectionId)

    const yourTurn = document.querySelector('[data-pane="your-turn"]')
    expect(yourTurn).not.toBeNull()
    expect(yourTurn!.querySelectorAll('[data-guided-action]')).toHaveLength(0)
    expect(yourTurn!.querySelectorAll('input, textarea, select')).toHaveLength(0)
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
      expect(document.querySelector('[data-device-boundary]')).not.toBeNull()
    },
  )
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
    expect(document.activeElement).toBe(document.body)
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
    // The map does not label them either: ringing exactly the channel the prediction asks a learner
    // to place would be a sharper pointer than the seven this map flagged before the walk existed.
    expect(walkCard().querySelectorAll('[data-map-sensor-site]')).toHaveLength(0)

    // Clicking `act` uncommitted is the bypass the independent review reproduced; it reveals
    // nothing now, because the phase is not the authority and the button will not move.
    goToPhase('act')
    expect(walkCard().textContent).not.toMatch(/Reported here/i)
    expect(walkCard().querySelectorAll('[data-map-sensor-site]')).toHaveLength(0)
    cleanup()

    mount('circuit-flow-path')
    commitAndContinue()
    expect(walkCard().querySelector('[data-walk-reported-here]')?.textContent).toMatch(
      /drainage pressure \(pVen\)/,
    )
    expect(walkCard().querySelectorAll('[data-map-sensor-site]').length).toBeGreaterThan(0)
  })

  it('keeps the walk open when a committed learner navigates back', () => {
    mount('circuit-flow-path')
    commitAndContinue()
    expect(walkCard().querySelector('[data-walk-reported-here]')).not.toBeNull()

    // Returning to recognize is re-reading, not un-committing: the commitment is preserved for
    // the session, so the teaching stays open and the later phases stay reachable.
    goToPhase('recognize')
    expect(walkCard().querySelector('[data-walk-reported-here]')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'observe' })).toBeEnabled()
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
    fireEvent.click(screen.getByRole('button', { name: 'predict' }))
    expect(walkCard().getAttribute('data-walk-stop')).toBe('walk-pump-under-load')

    // The question is on screen...
    expect(document.body.textContent).toMatch(/pump speed is about to be raised/i)
    // ...and the answer is not.
    expect(walkCard().querySelector('[data-walk-takeaway]')).toBeNull()
    expect(walkCard().textContent).not.toMatch(/bought with suction/i)
    expect(walkCard().textContent).not.toMatch(/more negative/i)
    expect(walkCard().textContent).not.toMatch(/pulls harder|pulling harder/i)

    // The conclusion arrives with the commitment itself, not with a phase click.
    commitPredictionChoice()
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
    fireEvent.click(screen.getByRole('button', { name: 'predict' }))
    press('[data-walk-next]')
    expect(stopId()).toBe('walk-downstream-load')
    expect(walkCard().querySelector('[data-walk-comparison]')).toBeNull()
    expect(walkCard().querySelectorAll('[data-walk-beat]')).toHaveLength(0)
  })

  it('runs a comparison beat through the action the section already declares', () => {
    mount('pump-and-pressure-zones')
    commitAndContinue()
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
    expect(
      document
        .querySelector('[data-active-state-variant]')
        ?.getAttribute('data-active-state-variant'),
    ).toBe('return-resistance-preview')
    expect(document.body.textContent).toMatch(/Return-side resistance — mechanism preview/i)
  })

  it('offers no comparison beats on a stop that is not a comparison', () => {
    mount('pump-and-pressure-zones')
    expect(stopId()).toBe('walk-pump-under-load')
    expect(walkCard().querySelector('[data-walk-comparison]')).toBeNull()
  })

  it('leaves the loaded state alone when the learner only changes stop', () => {
    mount('pump-and-pressure-zones')
    const before = document
      .querySelector('[data-active-state-variant]')
      ?.getAttribute('data-active-state-variant')
    press('[data-walk-next]')
    expect(
      document
        .querySelector('[data-active-state-variant]')
        ?.getAttribute('data-active-state-variant'),
    ).toBe(before)
  })
})
