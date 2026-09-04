import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import type { CriticalCareActivityPhase } from '@/features/learning-module/activity/types'

import { EcmoFoundationLessonActivity } from '../components/EcmoFoundationLessonActivity'
import { ecmoDeliveryAttribution } from '../content/deliveryAttribution'
import { ecmoFoundationLearningItemsFor } from '../content/foundationLearningItems'
import { CARDIOHELP_PROGRESS_STORAGE_KEY, parseProgress } from '../engine/progress'
import {
  ecmoFoundationInitialVariant,
  ecmoFoundationInitialVariantId,
  ecmoFoundationLessonRuntime,
  ecmoFoundationLessonRuntimes,
  ecmoInteractiveFoundationSectionIds,
  validateEcmoFoundationRuntimes,
  type EcmoFoundationLessonRuntime,
  type EcmoInteractiveFoundationSectionId,
} from '../content/foundationLessonRuntime'
import type { SupportMode } from '../engine/types'

/**
 * What a `?phase=` URL restores, and what it must never pretend to restore.
 *
 * The route validated the parameter and handed it to the activity, and the activity then initialized
 * every phase from the lesson's primary variant. That restored the navigation and not the state the
 * phase's own copy is written against — a link into the VV capstone's transfer phase, whose item
 * opens "In the re-drainage preview beside you", opened on the held gas case instead.
 *
 * These cases are mounted against the real activity, because the defect was in what the component
 * initialized rather than in what the content declared. They assert both halves: that the authored
 * clean state for the phase is the one that loads, and that nothing else about a session — a
 * committed answer, a captured snapshot, an interaction record, a control sequence, a stored key — is
 * reconstructed alongside it.
 *
 * The activity now renders on the lesson stage: six steps in one list, forward movement only through
 * the Now card, and a URL into any step past the prediction clamped to the Predict step. The
 * helpers below move the way a learner moves.
 */

const mockPush = jest.fn()
/** The section the harness last mounted, so the attribution helper can find its registry entry. */
let mountedSectionId: EcmoInteractiveFoundationSectionId = 'why-extracorporeal-support'

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

// No device pane is read here, and the circuit view reaches three.js, which jsdom cannot render.
// The stage renders the four monitor surfaces by name, so all four named exports are stubbed.
jest.mock('../components/CardiohelpConsole', () => ({
  CardiohelpConsole: () => <div data-testid="cardiohelp-console" />,
}))
jest.mock('../components/CircuitAndMonitors', () => ({
  CircuitSchematic: () => <div data-testid="circuit-schematic" />,
  GasBlenderPanel: () => <div data-testid="gas-blender-panel" />,
  PatientMonitor: () => <div data-testid="patient-monitor" />,
  TrendPanel: () => <div data-testid="trend-panel" />,
}))

function mountAt(
  sectionId: EcmoInteractiveFoundationSectionId,
  supportMode: SupportMode,
  initialPhase: CriticalCareActivityPhase,
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

function loadedVariantId(): string | null {
  return (
    document
      .querySelector('[data-active-state-variant]')
      ?.getAttribute('data-active-state-variant') ?? null
  )
}

function liveFinding(id: string): string {
  const cell = document.querySelector(`[data-live-finding="${id}"]`)
  if (!cell) throw new Error(`no live finding rendered for ${id}`)
  return cell.textContent ?? ''
}

function clockIsRunning(): boolean {
  return (
    document.querySelector('[data-clock-running]')?.getAttribute('data-clock-running') === 'true'
  )
}

function guidedAction(id: string): HTMLElement {
  const button = document.querySelector<HTMLElement>(`[data-guided-action="${id}"]`)
  if (!button) throw new Error(`no guided action rendered for ${id}`)
  return button
}

/** The current step's phase, read from the shell root and cross-checked against the step list. */
function currentPhase(): CriticalCareActivityPhase {
  const stage = document.querySelector('[data-ecmo-shell="learn"]')?.getAttribute('data-stage')
  if (!stage) throw new Error('no stage id on the shell root')
  const current = document.querySelectorAll('[data-step-list] [aria-current="step"]')
  expect(current).toHaveLength(1)
  expect(current[0].closest('li')?.getAttribute('data-step-id')).toBe(stage)
  return stage.slice(stage.lastIndexOf('-') + 1) as CriticalCareActivityPhase
}

function stepRow(phase: CriticalCareActivityPhase): HTMLLIElement {
  const row = document.querySelector<HTMLLIElement>(
    `[data-step-list] li[data-step-id$="-${phase}"]`,
  )
  if (!row) throw new Error(`no step row rendered for ${phase}`)
  return row
}

function restorationNote(): string | null {
  return document.querySelector('[data-ecmo-resumed-note]')?.textContent ?? null
}

function predictionChoices(): HTMLInputElement[] {
  return Array.from(
    document.querySelectorAll<HTMLInputElement>('fieldset[data-prediction-choices] input'),
  )
}

/** Move forward through the Now card until the stage is on `phase`. Never skips a step. */

/**
 * Satisfy an attribution step, if that is where the traversal has stopped.
 *
 * The first foundation section's Act step asks the learner to assign each proposed change to the
 * component of oxygen delivery it acts on, so walking past it is no longer one Continue click. The
 * keyed component comes from the registry, which is the only place it exists — the DOM deliberately
 * does not carry it before the commitment.
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

function continueTo(phase: CriticalCareActivityPhase) {
  for (let guard = 0; currentPhase() !== phase; guard += 1) {
    if (guard > 8) throw new Error(`could not reach ${phase}; stuck at ${currentPhase()}`)
    if (answerAttributionIfPresent()) continue
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
  }
}

/** Choose one option and commit the prediction, staying on the Predict step. */
function commitPrediction(sectionId: EcmoInteractiveFoundationSectionId) {
  continueTo('predict')
  const { prediction } = ecmoFoundationLearningItemsFor(sectionId)
  const choice = document.querySelector<HTMLInputElement>(
    `fieldset[data-prediction-choices] input[value="${prediction.choices[0].id}"]`,
  )
  if (!choice) throw new Error('no prediction choice rendered')
  fireEvent.click(choice)
  fireEvent.click(screen.getByRole('button', { name: 'Commit this prediction' }))
}

/** Commit the prediction and follow Continue into Act — the only way past the commitment gate. */
function commitPredictionAndContinue(sectionId: EcmoInteractiveFoundationSectionId) {
  commitPrediction(sectionId)
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
  expect(currentPhase()).toBe('act')
}

/** Choose and commit the transfer answer — the one thing this activity persists. */
function commitTransfer(sectionId: EcmoInteractiveFoundationSectionId) {
  const { transfer } = ecmoFoundationLearningItemsFor(sectionId)
  fireEvent.click(screen.getByRole('radio', { name: transfer.choices[0].label }))
  fireEvent.click(screen.getByRole('button', { name: 'Commit this answer' }))
}

function runModeledSeconds(seconds: number) {
  act(() => {
    jest.advanceTimersByTime(seconds * 1000)
  })
}

/** A runtime with one field replaced, for the validation cases. */
function withRuntime(
  sectionId: EcmoInteractiveFoundationSectionId,
  overrides: Partial<EcmoFoundationLessonRuntime>,
): Readonly<Partial<Record<EcmoInteractiveFoundationSectionId, EcmoFoundationLessonRuntime>>> {
  return {
    ...ecmoFoundationLessonRuntimes,
    [sectionId]: { ...ecmoFoundationLessonRuntimes[sectionId], ...overrides },
  }
}

/** Source with block and line comments stripped, so a guard cannot fire on an explanation. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

beforeEach(() => {
  jest.useFakeTimers()
  mockPush.mockReset()
})

afterEach(() => {
  jest.useRealTimers()
})

/* ------------------------------------------------------------------ *
 * 1–2. The default, and a phase nobody authored a state for
 * ------------------------------------------------------------------ */

describe('a phase with no authored state opens on the lesson’s own opening state', () => {
  it.each(ecmoInteractiveFoundationSectionIds)(
    'opens %s at recognize on its primary variant, with no restoration note',
    (sectionId) => {
      mountAt(sectionId, 'vv', 'recognize')

      expect(currentPhase()).toBe('recognize')
      expect(loadedVariantId()).toBe(ecmoFoundationLessonRuntime(sectionId).primaryVariantId)
      // Nothing was skipped over, so there is nothing to disclose.
      expect(restorationNote()).toBeNull()
    },
  )

  it('opens a predict URL at predict, with the plain restoration note', () => {
    // `predict` is the one non-opening phase a URL may still land on directly: it sits before the
    // commitment, so there is nothing to fail closed about.
    mountAt('vv-normal-state', 'vv', 'predict')

    expect(currentPhase()).toBe('predict')
    expect(loadedVariantId()).toBe('reference-circuit')
    expect(restorationNote()).toContain('Opened at the predict step with a clean teaching state')
    expect(restorationNote()).toContain('Earlier choices, snapshots, and actions were not restored')
    // Never described as a resumed session.
    expect(restorationNote()?.toLowerCase()).not.toContain('progress')
    expect(restorationNote()?.toLowerCase()).not.toContain('resumed')
    // The recognize step it skipped is marked done rather than left as if it were still waiting.
    expect(stepRow('recognize').getAttribute('data-step-state')).toBe('done')
  })

  it('clamps a gated-phase URL to predict and says which phase is waiting on the commitment', () => {
    mountAt('vv-normal-state', 'vv', 'explain')

    // The commitment lives only in session state, so a fresh mount cannot honour a URL into a
    // phase that requires one — it fails closed at the gate instead of fabricating a commitment.
    expect(currentPhase()).toBe('predict')
    expect(stepRow('explain').getAttribute('data-step-state')).toBe('locked')
    // The authored mapping still resolves — the helper is the contract a future consumer reads.
    expect(
      ecmoFoundationInitialVariantId(ecmoFoundationLessonRuntime('vv-normal-state'), 'explain'),
    ).toBe('reference-circuit')
    expect(loadedVariantId()).toBe('reference-circuit')
    expect(restorationNote()).toContain('opened at the predict step')
    expect(restorationNote()).toContain('The explain step unlocks when you commit')
    expect(restorationNote()).toContain('Earlier choices, snapshots, and actions were not restored')
    expect(restorationNote()?.toLowerCase()).not.toContain('progress')
    expect(restorationNote()?.toLowerCase()).not.toContain('resumed')
  })

  it('leaves most phases unmapped, which is the authored outcome rather than an omission', () => {
    const mapped = ecmoInteractiveFoundationSectionIds.flatMap((sectionId) =>
      Object.keys(ecmoFoundationLessonRuntimes[sectionId].initialVariantIdByPhase ?? {}).map(
        (phase) => `${sectionId}:${phase}`,
      ),
    )
    expect(mapped).toEqual([
      'vv-integration-capstone:transfer',
      'va-parallel-physiology:transfer',
      'va-integration-capstone:transfer',
    ])
  })
})

/* ------------------------------------------------------------------ *
 * 3–4. States that must arrive held
 * ------------------------------------------------------------------ */

describe('a lesson that opens before an authored change opens before it at every early phase', () => {
  it.each(['recognize', 'predict', 'act', 'observe', 'explain'] as const)(
    'holds the VV capstone in front of its gas fault at %s',
    (phase) => {
      mountAt('vv-integration-capstone', 'vv', phase)

      expect(loadedVariantId()).toBe('gas-source-before-change')
      expect(clockIsRunning()).toBe(false)
      expect(document.querySelector('[data-clock-held]')).not.toBeNull()
      expect(liveFinding('gas-source-status')).toContain('connected')

      // The authored change is at the fifth modeled second and this state opens at the fourth.
      runModeledSeconds(30)

      expect(liveFinding('gas-source-status')).toContain('connected')
      expect(liveFinding('gas-source-status')).not.toContain('interrupted')
      expect(loadedVariantId()).toBe('gas-source-before-change')
    },
  )

  it('refuses to let an early phase open past the change, by validation rather than by comment', () => {
    const errors = validateEcmoFoundationRuntimes(
      withRuntime('vv-integration-capstone', {
        initialVariantIdByPhase: { predict: 'gas-source-after-change' },
      }),
    )
    expect(errors.join('\n')).toContain('vv-integration-capstone/predict')
    expect(errors.join('\n')).toContain('does not hold the clock')
  })

  it('maps no phase onto the VA held gas preview, and reaches it held through its own action', () => {
    // Nothing is authored against the pre-change gas state: it exists to be read *before* a change,
    // and the phase that reads it loads it deliberately. Asserted rather than assumed, because a
    // future mapping onto it would have to re-establish that it still arrives held.
    for (const sectionId of ecmoInteractiveFoundationSectionIds) {
      const mapped = Object.values(
        ecmoFoundationLessonRuntimes[sectionId].initialVariantIdByPhase ?? {},
      )
      expect(mapped).not.toContain('va-gas-source-before-change')
    }

    mountAt('va-integration-capstone', 'va', 'explain')
    expect(loadedVariantId()).toBe('mixed-circulation-case')

    // The gated URL clamped to predict; the held preview is reached the way a learner reaches it.
    commitPredictionAndContinue('va-integration-capstone')
    continueTo('explain')
    fireEvent.click(guidedAction('preview-va-gas-source-before-change'))

    expect(loadedVariantId()).toBe('va-gas-source-before-change')
    expect(clockIsRunning()).toBe(false)
    expect(liveFinding('gas-source-status')).toContain('connected')
    runModeledSeconds(30)
    expect(liveFinding('gas-source-status')).toContain('connected')
  })
})

/* ------------------------------------------------------------------ *
 * 5. Transfer phases with an authored state
 * ------------------------------------------------------------------ */

describe('a transfer URL fails closed at the commitment gate', () => {
  /*
   * These three lessons author a transfer→preview mapping, and until the correction a transfer URL
   * honoured it with nothing committed — which is exactly the bypass the independent review
   * reproduced. The mapping itself is still authored, validated, and resolvable through
   * `ecmoFoundationInitialVariantId`; what changed is that no mount reaches a gated phase, so the
   * URL lands at predict on the predict-phase state and the learner commits their way forward. The
   * authored state is then loaded when the learner enters the Transfer step, not before.
   */
  const cases = [
    {
      sectionId: 'vv-integration-capstone',
      supportMode: 'vv',
      mappedVariantId: 'recirculation-preview',
      predictVariantId: 'gas-source-before-change',
    },
    {
      sectionId: 'va-parallel-physiology',
      supportMode: 'va',
      mappedVariantId: 'lv-loading-preview',
      predictVariantId: 'reference-circuit',
    },
    {
      sectionId: 'va-integration-capstone',
      supportMode: 'va',
      mappedVariantId: 'va-gas-source-after-change',
      predictVariantId: 'mixed-circulation-case',
    },
  ] as const

  it.each(cases)(
    'clamps a $sectionId transfer URL to predict, with nothing revealed and nothing restored',
    ({ sectionId, supportMode, mappedVariantId, predictVariantId }) => {
      mountAt(sectionId, supportMode, 'transfer')

      expect(currentPhase()).toBe('predict')
      expect(loadedVariantId()).toBe(predictVariantId)
      // The mapping is not lost, only unhonoured at an uncommitted mount.
      expect(
        ecmoFoundationInitialVariantId(ecmoFoundationLessonRuntime(sectionId), 'transfer'),
      ).toBe(mappedVariantId)

      // No transfer item, no bounded actions, and nothing reinstated.
      expect(document.querySelector('#transfer-heading')).toBeNull()
      expect(document.querySelectorAll('[data-guided-action]')).toHaveLength(0)
      expect(document.querySelector('[data-interaction-evidence]')).toBeNull()
      expect(document.querySelectorAll('[data-interaction]')).toHaveLength(0)
      expect(restorationNote()).toContain('The transfer step unlocks when you commit')
      expect(stepRow('transfer').getAttribute('data-step-state')).toBe('locked')

      // The prediction item is on screen, uncommitted — the gate the URL was clamped to.
      const choices = predictionChoices()
      expect(choices.length).toBeGreaterThan(0)
      for (const choice of choices) {
        expect(choice).not.toBeChecked()
        expect(choice).not.toBeDisabled()
      }
      expect(screen.getByRole('button', { name: 'Commit this prediction' })).toBeDisabled()
    },
  )

  it('reaches the transfer item and its actions through the commitment, not around it', () => {
    mountAt('vv-integration-capstone', 'vv', 'transfer')
    commitPredictionAndContinue('vv-integration-capstone')
    continueTo('transfer')

    expect(currentPhase()).toBe('transfer')
    // The item's stem reads the re-drainage preview, and that is the state the step opens on:
    // the authored transfer mapping, loaded on entry rather than fabricated at the mount.
    const stem = document.querySelector('#transfer-heading')?.textContent ?? ''
    expect(stem).toContain('re-drainage preview beside you')
    expect(loadedVariantId()).toBe(
      ecmoFoundationInitialVariantId(
        ecmoFoundationLessonRuntime('vv-integration-capstone'),
        'transfer',
      ),
    )
    // Its own action still loads that preview, so a learner who wandered can get it back.
    fireEvent.click(guidedAction('preview-oxygenator-resistance-mechanism'))
    expect(loadedVariantId()).toBe('oxygenator-resistance-preview')
    fireEvent.click(guidedAction('preview-recirculation-mechanism'))
    expect(loadedVariantId()).toBe('recirculation-preview')
  })
})

/* ------------------------------------------------------------------ *
 * 6. Normal-state lessons fabricate nothing
 * ------------------------------------------------------------------ */

describe('a normal-state lesson opened at a comparison phase fabricates no earlier reading', () => {
  it.each(['observe', 'explain'] as const)(
    'opens the VA baseline at %s with no snapshot',
    (phase) => {
      mountAt('va-normal-state', 'va', phase)

      expect(loadedVariantId()).toBe('reference-circuit')
      expect(document.querySelectorAll('[data-interaction]')).toHaveLength(0)
      expect(document.querySelector('[data-interaction-evidence]')).toBeNull()

      // The baseline review says what it is comparing with, and with no capture it is this circuit's
      // own starting state rather than a snapshot that was never taken.
      const teaching =
        document.querySelector('[data-teaching-panel="va-normal-state"]')?.textContent ?? ''
      expect(teaching).toContain('this circuit’s starting state')
      expect(teaching).not.toContain('the snapshot captured in this session')
      expect(restorationNote()).toContain('snapshots')
    },
  )

  it('opens the VV baseline the same way', () => {
    mountAt('vv-normal-state', 'vv', 'observe')

    const teaching =
      document.querySelector('[data-teaching-panel="vv-normal-state"]')?.textContent ?? ''
    expect(teaching).not.toContain('the snapshot captured in this session')
    expect(document.querySelectorAll('[data-interaction]')).toHaveLength(0)
  })
})

/* ------------------------------------------------------------------ *
 * 7. Walking the progression is not a restoration
 * ------------------------------------------------------------------ */

describe('moving between steps leaves the learner’s own state alone', () => {
  it('does not reload any state when a performed step row is reviewed', () => {
    mountAt('vv-integration-capstone', 'vv', 'recognize')

    commitPredictionAndContinue('vv-integration-capstone')
    continueTo('observe')
    fireEvent.click(guidedAction('reveal-evolved-state'))
    expect(loadedVariantId()).toBe('gas-source-after-change')

    // Every performed row can be reviewed in place. None of them re-runs anything: the state on
    // screen is the one the learner is working on, and the stage stays where it was.
    for (const phase of ['recognize', 'predict', 'act'] as const) {
      expect(stepRow(phase).getAttribute('data-step-state')).toBe('done')
      fireEvent.click(stepRow(phase).querySelector('button')!)
      expect(stepRow(phase).querySelector('[data-step-recap]')).not.toBeNull()
      expect(currentPhase()).toBe('observe')
      expect(loadedVariantId()).toBe('gas-source-after-change')
      expect(clockIsRunning()).toBe(true)
    }
  })

  it('keeps the learner’s state through the steps that author none of their own', () => {
    mountAt('vv-integration-capstone', 'vv', 'recognize')

    commitPredictionAndContinue('vv-integration-capstone')
    continueTo('observe')
    fireEvent.click(guidedAction('reveal-evolved-state'))
    expect(loadedVariantId()).toBe('gas-source-after-change')

    // Explain authors no state, so entering it changes nothing on the simulator.
    continueTo('explain')
    expect(
      ecmoFoundationLessonRuntime('vv-integration-capstone').initialVariantIdByPhase,
    ).not.toHaveProperty('explain')
    expect(loadedVariantId()).toBe('gas-source-after-change')

    // Transfer *is* authored against a different state — the re-drainage preview its item reads —
    // and entering it loads exactly that authored state, the same one the helper resolves. The
    // learner's evolved case is not silently carried under copy written for a different circuit.
    continueTo('transfer')
    expect(loadedVariantId()).toBe(
      ecmoFoundationInitialVariantId(
        ecmoFoundationLessonRuntime('vv-integration-capstone'),
        'transfer',
      ),
    )
    expect(loadedVariantId()).toBe('recirculation-preview')
  })

  it('keeps interaction evidence across the step changes that load nothing', () => {
    mountAt('va-integration-capstone', 'va', 'act')

    // The act URL clamped to predict; the actions appear once the learner commits their way in.
    commitPredictionAndContinue('va-integration-capstone')
    fireEvent.click(guidedAction('compare-upper-and-lower-body-saturations'))
    fireEvent.click(guidedAction('review-limb-and-bedside-findings'))
    expect(
      document.querySelector('[data-interaction="review-limb-and-bedside-findings"]'),
    ).not.toBeNull()

    for (const phase of ['observe', 'explain'] as const) {
      continueTo(phase)
      expect(loadedVariantId()).toBe('mixed-circulation-case')
      expect(
        document.querySelector('[data-interaction="compare-upper-and-lower-body-saturations"]'),
      ).not.toBeNull()
      expect(
        document.querySelector('[data-interaction="review-limb-and-bedside-findings"]'),
      ).not.toBeNull()
    }

    // Transfer loads its authored gas-source state, and evidence never carries across a state
    // change — what is listed is what was looked at since the state on screen was loaded.
    continueTo('transfer')
    expect(loadedVariantId()).toBe('va-gas-source-after-change')
    expect(document.querySelector('[data-interaction-evidence]')).toBeNull()
  })

  it('keeps a committed prediction across a step change', () => {
    mountAt('va-parallel-physiology', 'va', 'predict')

    commitPrediction('va-parallel-physiology')
    const chosen = predictionChoices().find((choice) => choice.checked)
    expect(chosen).toBeDefined()
    for (const choice of predictionChoices()) expect(choice).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(currentPhase()).toBe('act')

    // Reviewing the Predict row shows the committed choice, still committed: the gate stays open
    // and nothing offers to take the prediction again.
    fireEvent.click(stepRow('predict').querySelector('button')!)
    const { prediction } = ecmoFoundationLearningItemsFor('va-parallel-physiology')
    expect(stepRow('predict').querySelector('[data-step-recap]')?.textContent).toContain(
      `You chose: ${prediction.choices[0].label}`,
    )
    expect(document.querySelector('[data-phase-lock-note]')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Commit this prediction' })).toBeNull()
    expect(document.querySelectorAll('[data-guided-action]').length).toBeGreaterThan(0)
  })
})

/* ------------------------------------------------------------------ *
 * 8. A bad mapping fails loudly
 * ------------------------------------------------------------------ */

describe('the authored mapping is validated at import', () => {
  it('accepts the shipped runtimes', () => {
    expect(validateEcmoFoundationRuntimes()).toEqual([])
  })

  it('rejects a mapping onto a variant the lesson does not offer', () => {
    const errors = validateEcmoFoundationRuntimes(
      withRuntime('va-normal-state', {
        initialVariantIdByPhase: { transfer: 'lv-loading-preview' },
      }),
    )
    expect(errors.join('\n')).toContain('va-normal-state/transfer')
    expect(errors.join('\n')).toContain('is not authored')
  })

  it('rejects a mapping keyed by something that is not a phase', () => {
    const errors = validateEcmoFoundationRuntimes(
      withRuntime('vv-normal-state', {
        initialVariantIdByPhase: {
          debrief: 'reference-circuit',
        } as unknown as EcmoFoundationLessonRuntime['initialVariantIdByPhase'],
      }),
    )
    expect(errors.join('\n')).toContain('unknown phase debrief')
  })

  it('rejects a mapping with no variant id', () => {
    const errors = validateEcmoFoundationRuntimes(
      withRuntime('vv-normal-state', {
        initialVariantIdByPhase: {
          explain: '',
        } as unknown as EcmoFoundationLessonRuntime['initialVariantIdByPhase'],
      }),
    )
    expect(errors.join('\n')).toContain('has no variant id')
  })

  it('rejects a shared lesson mapped onto one track’s preview only', () => {
    // The shared lessons author one reference variant per mode. A mapping onto a VV-only preview
    // resolves in neither, and would have opened a shared lesson on a state its copy never describes.
    const errors = validateEcmoFoundationRuntimes(
      withRuntime('blood-flow-versus-sweep', {
        initialVariantIdByPhase: { transfer: 'recirculation-preview' },
      }),
    )
    expect(
      errors.filter((error) => error.includes('blood-flow-versus-sweep/transfer')),
    ).toHaveLength(2)
  })
})

/* ------------------------------------------------------------------ *
 * 9. Track canonicalization
 * ------------------------------------------------------------------ */

describe('a track-fixed lesson resolves its own track before resolving the state', () => {
  function stageFrame(): HTMLElement {
    const frame = document.querySelector<HTMLElement>('[data-ecmo-stage-frame]')
    if (!frame) throw new Error('no stage frame rendered')
    return frame
  }

  it('canonicalizes to VA before clamping when VV is asked for', () => {
    mountAt('va-parallel-physiology', 'vv', 'transfer')

    expect(stageFrame().getAttribute('data-support-mode')).toBe('va')
    expect(stageFrame().getAttribute('data-fixed-pathway')).toBe('va')
    // The gated URL fails closed the same way it does on the canonical track.
    expect(currentPhase()).toBe('predict')
    expect(loadedVariantId()).toBe('reference-circuit')
    // A VA panel over a VA state — there is no such thing as this lesson in the VV registry.
    expect(document.querySelector('[data-va-configuration]')).not.toBeNull()
  })

  it('canonicalizes to VV before clamping when VA is asked for', () => {
    mountAt('vv-integration-capstone', 'va', 'transfer')

    expect(stageFrame().getAttribute('data-support-mode')).toBe('vv')
    expect(stageFrame().getAttribute('data-fixed-pathway')).toBe('vv')
    expect(currentPhase()).toBe('predict')
    expect(loadedVariantId()).toBe('gas-source-before-change')
  })

  it('resolves the same variant the helper resolves, in the canonical mode', () => {
    for (const sectionId of ecmoInteractiveFoundationSectionIds) {
      const runtime = ecmoFoundationLessonRuntime(sectionId)
      for (const supportMode of ['vv', 'va'] as const) {
        const resolvedMode = runtime.supportMode ?? supportMode
        const variant = ecmoFoundationInitialVariant(runtime, resolvedMode, 'transfer')
        expect(variant.id).toBe(ecmoFoundationInitialVariantId(runtime, 'transfer'))
      }
    }
  })
})

/* ------------------------------------------------------------------ *
 * 10. Nothing is stored, and nothing is serialized
 * ------------------------------------------------------------------ */

describe('phase restoration writes nothing and reconstructs no engine state', () => {
  it('touches no storage while opening at a mapped phase', () => {
    // Spied on the prototype rather than on the instance: jsdom's `localStorage` is exposed through
    // an accessor, so spying on the instance property does not produce a restorable mock.
    const setItem = jest.spyOn(Storage.prototype, 'setItem')
    const getItem = jest.spyOn(Storage.prototype, 'getItem')
    const removeItem = jest.spyOn(Storage.prototype, 'removeItem')
    try {
      window.localStorage.clear()
      mountAt('va-integration-capstone', 'va', 'transfer')
      commitPredictionAndContinue('va-integration-capstone')
      // Reading, loading states, and walking the steps write nothing either.
      fireEvent.click(guidedAction('review-limb-and-bedside-findings'))
      continueTo('transfer')

      expect(setItem).not.toHaveBeenCalled()
      expect(getItem).not.toHaveBeenCalled()
      expect(removeItem).not.toHaveBeenCalled()
      expect(window.localStorage.length).toBe(0)
      expect(window.sessionStorage.length).toBe(0)
    } finally {
      setItem.mockRestore()
      getItem.mockRestore()
      removeItem.mockRestore()
    }
  })

  it('carries the phase in the URL with replaceState, never pushState, and in nothing stored', () => {
    window.history.replaceState(null, '', '/en/cardiohelp-ecmo/learn?lesson=vv-normal-state')
    const pushState = jest.spyOn(window.history, 'pushState')
    const replaceState = jest.spyOn(window.history, 'replaceState')
    try {
      mountAt('vv-normal-state', 'vv', 'act')
      // The clamp is what the URL now says, not what it asked for.
      expect(new URL(window.location.href).searchParams.get('phase')).toBe('predict')

      commitPredictionAndContinue('vv-normal-state')
      expect(new URL(window.location.href).searchParams.get('phase')).toBe('act')
      continueTo('explain')
      expect(new URL(window.location.href).searchParams.get('phase')).toBe('explain')
      expect(new URL(window.location.href).searchParams.get('lesson')).toBe('vv-normal-state')

      expect(pushState).not.toHaveBeenCalled()
      expect(replaceState).toHaveBeenCalled()
      expect(window.localStorage.length).toBe(0)
      expect(window.sessionStorage.length).toBe(0)
    } finally {
      pushState.mockRestore()
      replaceState.mockRestore()
    }
  })

  it('carries the phase in the component key and in the URL, and nowhere else', () => {
    const hostSource = readFileSync(
      join(process.cwd(), 'src/features/cardiohelp-ecmo/components/stage/FoundationStageHost.tsx'),
      'utf8',
    )
    const shimSource = readFileSync(
      join(
        process.cwd(),
        'src/features/cardiohelp-ecmo/components/EcmoFoundationLessonActivity.tsx',
      ),
      'utf8',
    )
    const runtimeSource = readFileSync(
      join(process.cwd(), 'src/features/cardiohelp-ecmo/content/foundationLessonRuntime.ts'),
      'utf8',
    )

    // The remount key still includes the section, the resolved mode and the requested phase, so a
    // URL into a different phase is a fresh session rather than a state carried over.
    const key = code(hostSource).match(/key=\{`([^`]*)`\}/)?.[1] ?? ''
    expect(key).toContain('${sectionId}')
    expect(key).toContain('${resolvedMode}')
    expect(key).toContain('${initialPhase}')
    for (const source of [hostSource, shimSource, runtimeSource]) {
      // Comments are stripped first: these files *discuss* stored progress at length, saying what is
      // and is not written, and a guard that fired on the explanation would be deleted rather than
      // obeyed.
      expect(code(source)).not.toMatch(/localStorage|sessionStorage/)
      expect(code(source)).not.toMatch(/ProgressV2/)
      // No engine state is serialized to be replayed: a variant is rebuilt from its authored source.
      expect(code(source)).not.toMatch(/JSON\.(?:stringify|parse)/)
    }

    // The host reaches persistence exactly once, through one named writer that takes the section
    // id and nothing else. The phase is not passed to it, so it cannot be stored by it — which is
    // the property this test exists to protect. The shim and the runtime file reach it not at all.
    const hostCode = code(hostSource)
    expect(hostCode.match(/from '[^']*progress'/gi)).toHaveLength(1)
    expect(hostCode).toContain(
      "import { persistFoundationSectionCompleted } from '../../engine/progress'",
    )
    expect(hostCode.match(/persistFoundationSectionCompleted\(/g)).toHaveLength(1)
    expect(hostCode).toContain('persistFoundationSectionCompleted(sectionId)')
    expect(code(shimSource)).not.toMatch(/from '[^']*progress'/i)
    expect(runtimeSource).not.toMatch(/from '[^']*progress'/i)
  })

  /**
   * The behavioural half of the persistence contract.
   *
   * Source-string bans cannot prove this on their own — a writer reached through the `../engine`
   * barrel would slip past every one of them — so the write is exercised for real: nothing on
   * mount, exactly one write when the learner commits the transfer answer, and a payload that
   * carries the section id and no score, mastery, or Practice pointer with it.
   */
  it('writes nothing on mount and exactly one traversal marker on transfer commit', () => {
    window.localStorage.clear()
    const setItem = jest.spyOn(Storage.prototype, 'setItem')
    try {
      mountAt('why-extracorporeal-support', 'vv', 'transfer')
      expect(setItem).not.toHaveBeenCalled()

      // Committing the prediction and walking to transfer writes nothing either: the one write is
      // the transfer commitment itself. Choosing an answer without committing it is not a write.
      commitPredictionAndContinue('why-extracorporeal-support')
      continueTo('transfer')
      const { transfer } = ecmoFoundationLearningItemsFor('why-extracorporeal-support')
      expect(document.querySelector('#transfer-heading')?.textContent).toBe(transfer.stem)
      fireEvent.click(screen.getByRole('radio', { name: transfer.choices[0].label }))
      expect(setItem).not.toHaveBeenCalled()

      fireEvent.click(screen.getByRole('button', { name: 'Commit this answer' }))

      expect(setItem).toHaveBeenCalledTimes(1)
      const [key, payload] = setItem.mock.calls[0] as [string, string]
      expect(key).toBe(CARDIOHELP_PROGRESS_STORAGE_KEY)

      const stored = parseProgress(payload)
      expect(stored?.completedFoundationSectionIds).toEqual(['why-extracorporeal-support'])
      // Worked, not mastered: nothing on the scoring side moved.
      expect(stored?.completedLearnLessonIds).toEqual([])
      expect(stored?.completedLabs).toEqual([])
      expect(stored?.bestScores).toEqual({})
      expect(stored?.mastery).toBe(false)
      expect(stored?.lastVisited).toBeUndefined()

      // The section reads as worked, and the answer cannot be taken again.
      expect(document.querySelector('[data-stage-completion]')).not.toBeNull()
      expect(document.querySelector('[data-now-status]')).toHaveTextContent(
        'Done. This section has been worked through.',
      )
      for (const choice of predictionChoices()) expect(choice).toBeDisabled()
    } finally {
      setItem.mockRestore()
      window.localStorage.clear()
    }
  })

  it('does not write again when a section that was already worked is committed again', () => {
    window.localStorage.clear()
    try {
      mountAt('why-extracorporeal-support', 'vv', 'transfer')
      commitPredictionAndContinue('why-extracorporeal-support')
      continueTo('transfer')
      commitTransfer('why-extracorporeal-support')
      cleanup()

      const setItem = jest.spyOn(Storage.prototype, 'setItem')
      try {
        mountAt('why-extracorporeal-support', 'vv', 'transfer')
        commitPredictionAndContinue('why-extracorporeal-support')
        continueTo('transfer')
        commitTransfer('why-extracorporeal-support')
        expect(setItem).not.toHaveBeenCalled()
      } finally {
        setItem.mockRestore()
      }
    } finally {
      window.localStorage.clear()
    }
  })

  it('rebuilds the mapped state from its authored source rather than from a stored frame', () => {
    const runtime = ecmoFoundationLessonRuntime('va-integration-capstone')
    const variant = ecmoFoundationInitialVariant(runtime, 'va', 'transfer')

    expect(variant.source).toEqual({ kind: 'scenario', scenarioId: 'va-gas-source-interruption' })
    expect(variant.setupActions?.every((action) => action.type === 'STEP')).toBe(true)
  })
})

/**
 * Going back to a step already worked, without restarting the section.
 *
 * An owner review in September 2026 found that the only way to revisit a step was the step list's
 * inline recap, which nothing advertised, so learners were using "Restart section" and losing
 * everything. The Now card now carries an explicit Back control. What these pin is that it is a
 * real return rather than a reset: the section keeps its progress, a committed prediction stays
 * committed, forward still works afterwards, and the card says the learner is looking back rather
 * than leaving them to wonder whether they have undone something.
 */
describe('the way back to a step already worked', () => {
  function backControl(): HTMLElement | null {
    return document.querySelector<HTMLElement>('[data-now-back]')
  }

  it('offers no way back from the first step, and one from every step after it', () => {
    mountAt('why-extracorporeal-support', 'vv', 'recognize')
    expect(currentPhase()).toBe('recognize')
    expect(backControl()).toBeNull()

    continueTo('predict')
    expect(backControl()).not.toBeNull()
    expect(backControl()?.textContent).toContain('Back to Recognize')
  })

  it('returns to the previous step, keeps the section’s progress, and goes forward again', () => {
    mountAt('why-extracorporeal-support', 'vv', 'recognize')
    commitPredictionAndContinue('why-extracorporeal-support')
    expect(currentPhase()).toBe('act')

    // Back one step: the learner is on Predict again...
    fireEvent.click(backControl()!)
    expect(currentPhase()).toBe('predict')
    // ...with the commitment intact, so nothing has to be answered twice.
    for (const choice of predictionChoices()) expect(choice).toBeDisabled()
    expect(predictionChoices().some((choice) => choice.checked)).toBe(true)
    // ...and the steps already worked still read as worked. Act had only been entered, not
    // performed, so it stays reachable rather than done — going back did not invent progress.
    expect(stepRow('recognize').getAttribute('data-step-state')).toBe('done')
    expect(stepRow('predict').getAttribute('data-step-state')).toBe('done')
    expect(stepRow('act').getAttribute('data-step-state')).toBe('next')

    // And forward is still available from here: the committed prediction keeps its Continue, so
    // coming back is not a dead end.
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(currentPhase()).toBe('act')
  })

  it('says the learner is looking back, rather than leaving them to guess', () => {
    mountAt('why-extracorporeal-support', 'vv', 'recognize')
    commitPredictionAndContinue('why-extracorporeal-support')
    continueTo('observe')

    fireEvent.click(backControl()!)
    expect(currentPhase()).toBe('act')
    const status = document.querySelector('[data-now-status]')?.textContent ?? ''
    expect(status).toMatch(/looking back at an earlier step/i)
    expect(status).toMatch(/nothing you have worked through is lost/i)
  })

  it('walks all the way back to the first step one step at a time', () => {
    mountAt('why-extracorporeal-support', 'vv', 'recognize')
    commitPredictionAndContinue('why-extracorporeal-support')
    continueTo('observe')
    expect(currentPhase()).toBe('observe')

    for (const expected of ['act', 'predict', 'recognize'] as const) {
      fireEvent.click(backControl()!)
      expect(currentPhase()).toBe(expected)
    }
    // At the first step there is nowhere further back to go.
    expect(backControl()).toBeNull()
    // Nothing was lost on the way: every step actually worked still reads as worked. Observe was
    // entered but never performed — entering a step is not performing it — so it stays reachable
    // rather than done.
    for (const phase of ['recognize', 'predict', 'act'] as const) {
      expect(stepRow(phase).getAttribute('data-step-state')).toBe('done')
    }
    expect(stepRow('observe').getAttribute('data-step-state')).toBe('next')
  })

  /**
   * One current step, wherever the learner is standing.
   *
   * Found in the browser rather than here: a backwards move leaves the step already worked marked
   * `done` while it is also the current row, and an implementation that marked both the row moved
   * from and the row moved to would tell a screen reader there are two current steps with no way
   * to tell which one the Now card is describing. Checked at every step of a full walk forward and
   * a full walk back, because the two directions set the current index by different paths.
   */
  it('marks exactly one step as the current one, walking forward and back', () => {
    mountAt('why-extracorporeal-support', 'vv', 'recognize')
    const currentRows = () => document.querySelectorAll('[data-step-list] [aria-current="step"]')

    expect(currentRows()).toHaveLength(1)
    commitPredictionAndContinue('why-extracorporeal-support')
    expect(currentRows()).toHaveLength(1)
    for (const phase of ['observe', 'explain', 'transfer'] as const) {
      continueTo(phase)
      expect(`${phase}: ${currentRows().length}`).toBe(`${phase}: 1`)
    }
    for (const phase of ['explain', 'observe', 'act', 'predict', 'recognize'] as const) {
      fireEvent.click(backControl()!)
      expect(`back to ${phase}: ${currentRows().length}`).toBe(`back to ${phase}: 1`)
      expect(currentPhase()).toBe(phase)
    }
  })

  /**
   * The reason row clicks are not navigation.
   *
   * Entering a step loads the state its copy is written against, so a row that teleported would
   * discard an evolved case built with the bounded actions. Reviewing a row is therefore inert, and
   * this is the assertion that keeps it that way now that a navigating control exists next to it.
   */
  it('leaves row review inert, so only the Back control moves the learner', () => {
    mountAt('vv-integration-capstone', 'vv', 'recognize')
    commitPredictionAndContinue('vv-integration-capstone')
    continueTo('observe')
    fireEvent.click(guidedAction('reveal-evolved-state'))
    expect(loadedVariantId()).toBe('gas-source-after-change')

    fireEvent.click(stepRow('recognize').querySelector('button')!)
    expect(currentPhase()).toBe('observe')
    expect(loadedVariantId()).toBe('gas-source-after-change')
  })
})
