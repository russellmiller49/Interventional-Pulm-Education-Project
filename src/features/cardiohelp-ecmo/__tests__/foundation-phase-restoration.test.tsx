import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { act, fireEvent, render, screen } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import type { CriticalCareActivityPhase } from '@/features/learning-module/activity/types'

import { EcmoFoundationLessonActivity } from '../components/EcmoFoundationLessonActivity'
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

// Neither device pane is read here, and the circuit view reaches three.js, which jsdom cannot render.
jest.mock('../components/CardiohelpConsole', () => ({
  CardiohelpConsole: () => <div data-testid="cardiohelp-console" />,
}))
jest.mock('../components/CircuitAndMonitors', () => ({
  CircuitAndMonitors: () => <div data-testid="circuit-and-monitors" />,
}))

function mountAt(
  sectionId: EcmoInteractiveFoundationSectionId,
  supportMode: SupportMode,
  initialPhase: CriticalCareActivityPhase,
) {
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

function currentPhaseButtonName(): string | null {
  return (
    document.querySelector('nav[aria-label="Lesson phases"] [aria-current="step"]')?.textContent ??
    null
  )
}

function restorationNote(): string | null {
  return document.querySelector('[data-phase-restoration-note]')?.textContent ?? null
}

function goToPhase(phase: string) {
  fireEvent.click(screen.getByRole('button', { name: phase }))
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

beforeEach(() => {
  jest.useFakeTimers()
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

      expect(currentPhaseButtonName()).toBe('recognize')
      expect(loadedVariantId()).toBe(ecmoFoundationLessonRuntime(sectionId).primaryVariantId)
      // Nothing was skipped over, so there is nothing to disclose.
      expect(restorationNote()).toBeNull()
    },
  )

  it('opens an unmapped phase on the primary variant and says what was not restored', () => {
    mountAt('vv-normal-state', 'vv', 'explain')

    expect(currentPhaseButtonName()).toBe('explain')
    expect(
      ecmoFoundationInitialVariantId(ecmoFoundationLessonRuntime('vv-normal-state'), 'explain'),
    ).toBe('reference-circuit')
    expect(loadedVariantId()).toBe('reference-circuit')
    expect(restorationNote()).toContain('Opened at the explain phase with a clean teaching state')
    expect(restorationNote()).toContain('Earlier choices, snapshots, and actions were not restored')
    // Never described as a resumed session.
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

describe('a transfer phase authored against a preview opens on that preview', () => {
  const cases = [
    {
      sectionId: 'vv-integration-capstone',
      supportMode: 'vv',
      variantId: 'recirculation-preview',
    },
    {
      sectionId: 'va-parallel-physiology',
      supportMode: 'va',
      variantId: 'lv-loading-preview',
    },
    {
      sectionId: 'va-integration-capstone',
      supportMode: 'va',
      variantId: 'va-gas-source-after-change',
    },
  ] as const

  it.each(cases)(
    'opens $sectionId transfer on $variantId with nothing else restored',
    ({ sectionId, supportMode, variantId }) => {
      mountAt(sectionId, supportMode, 'transfer')

      expect(currentPhaseButtonName()).toBe('transfer')
      expect(loadedVariantId()).toBe(variantId)

      // The transfer item is on screen, and no answer to it has been reinstated.
      const stem = document.querySelector('#transfer-heading')
      expect(stem).not.toBeNull()
      const choices = Array.from(
        document.querySelectorAll<HTMLButtonElement>('#transfer-heading + div button'),
      )
      expect(choices.length).toBeGreaterThan(0)
      for (const choice of choices) {
        expect(choice).toHaveAttribute('aria-pressed', 'false')
        expect(choice).not.toBeDisabled()
      }

      // No prediction was committed either, and no interaction evidence or snapshot exists.
      expect(document.querySelector('#prediction-heading')).toBeNull()
      expect(document.querySelector('[data-interaction-evidence]')).toBeNull()
      expect(document.querySelectorAll('[data-interaction]')).toHaveLength(0)
      expect(restorationNote()).toContain('Opened at the transfer phase')
    },
  )

  it('opens the VV transfer on the state its own item quotes', () => {
    mountAt('vv-integration-capstone', 'vv', 'transfer')

    // The item's stem reads three values off the re-drainage preview: a displayed flow above the
    // reference circuit's, a much higher venous-line saturation, and a much lower adjusted flow.
    const stem = document.querySelector('#transfer-heading')?.textContent ?? ''
    expect(stem).toContain('re-drainage preview beside you')
    expect(loadedVariantId()).toBe('recirculation-preview')
  })

  it('opens the VA capstone transfer on the evolved gas state, not the held one', () => {
    mountAt('va-integration-capstone', 'va', 'transfer')

    expect(loadedVariantId()).toBe('va-gas-source-after-change')
    expect(liveFinding('gas-source-status')).toContain('interrupted')
    // Nothing is held: this state is past its authored change and has stopped moving.
    expect(clockIsRunning()).toBe(true)
    const carbonDioxide = liveFinding('paco2-and-ph')
    runModeledSeconds(20)
    expect(liveFinding('paco2-and-ph')).toBe(carbonDioxide)
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
 * 7. Walking the navigation is not a restoration
 * ------------------------------------------------------------------ */

describe('manual phase navigation leaves the learner’s own state alone', () => {
  it('does not reload the authored state when the phase button is clicked', () => {
    mountAt('vv-integration-capstone', 'vv', 'recognize')

    goToPhase('observe')
    fireEvent.click(guidedAction('reveal-evolved-state'))
    expect(loadedVariantId()).toBe('gas-source-after-change')

    // Transfer *is* authored against a different state. Clicking to it must not apply that, because
    // the state on screen is the one the learner is working on.
    goToPhase('transfer')
    expect(currentPhaseButtonName()).toBe('transfer')
    expect(loadedVariantId()).toBe('gas-source-after-change')

    goToPhase('explain')
    expect(loadedVariantId()).toBe('gas-source-after-change')
  })

  it('keeps interaction evidence across a phase change', () => {
    mountAt('va-integration-capstone', 'va', 'act')

    fireEvent.click(guidedAction('compare-upper-and-lower-body-saturations'))
    fireEvent.click(guidedAction('review-limb-and-bedside-findings'))
    expect(
      document.querySelector('[data-interaction="review-limb-and-bedside-findings"]'),
    ).not.toBeNull()

    goToPhase('transfer')

    expect(loadedVariantId()).toBe('mixed-circulation-case')
    expect(
      document.querySelector('[data-interaction="compare-upper-and-lower-body-saturations"]'),
    ).not.toBeNull()
    expect(
      document.querySelector('[data-interaction="review-limb-and-bedside-findings"]'),
    ).not.toBeNull()
  })

  it('keeps a committed prediction across a phase change', () => {
    mountAt('va-parallel-physiology', 'va', 'predict')

    const choice = document.querySelector<HTMLElement>('#prediction-heading + div button')
    fireEvent.click(choice!)
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    goToPhase('predict')
    const choices = Array.from(
      document.querySelectorAll<HTMLButtonElement>('#prediction-heading + div button'),
    )
    expect(choices[0]).toHaveAttribute('aria-pressed', 'true')
    for (const button of choices) expect(button).toBeDisabled()
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
  it('keeps the phase and takes the VA mapping when VV is asked for', () => {
    mountAt('va-parallel-physiology', 'vv', 'transfer')

    expect(document.querySelector('main')).toHaveAttribute('data-support-mode', 'va')
    expect(currentPhaseButtonName()).toBe('transfer')
    expect(loadedVariantId()).toBe('lv-loading-preview')
    // A VA-sourced preview, not the VV loading state — there is no such thing in the VV registry.
    expect(document.querySelector('[data-va-configuration]')).not.toBeNull()
  })

  it('keeps the phase and takes the VV mapping when VA is asked for', () => {
    mountAt('vv-integration-capstone', 'va', 'transfer')

    expect(document.querySelector('main')).toHaveAttribute('data-support-mode', 'vv')
    expect(currentPhaseButtonName()).toBe('transfer')
    expect(loadedVariantId()).toBe('recirculation-preview')
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

  it('carries the phase in the component key and in the URL, and nowhere else', () => {
    const activitySource = readFileSync(
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

    // The remount key still includes the section, the resolved mode and the phase.
    expect(activitySource).toContain('key={`${sectionId}:${resolvedMode}:${initialPhase}`}')
    for (const source of [activitySource, runtimeSource]) {
      // Comments are stripped first: both files *discuss* stored progress at length, saying that
      // none of it is written, and a guard that fired on the explanation would be deleted rather
      // than obeyed.
      const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
      expect(code).not.toMatch(/localStorage|sessionStorage/)
      expect(code).not.toMatch(/ProgressV2/)
      expect(code).not.toMatch(/from '[^']*progress/i)
      // No engine state is serialized to be replayed: a variant is rebuilt from its authored source.
      expect(code).not.toMatch(/JSON\.(?:stringify|parse)/)
    }
  })

  it('rebuilds the mapped state from its authored source rather than from a stored frame', () => {
    const runtime = ecmoFoundationLessonRuntime('va-integration-capstone')
    const variant = ecmoFoundationInitialVariant(runtime, 'va', 'transfer')

    expect(variant.source).toEqual({ kind: 'scenario', scenarioId: 'va-gas-source-interruption' })
    expect(variant.setupActions?.every((action) => action.type === 'STEP')).toBe(true)
  })
})
