import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import type { CriticalCareActivityPhase } from '@/features/learning-module/activity/types'

import { EcmoFoundationLessonActivity } from '../components/EcmoFoundationLessonActivity'
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

/** Commit the prediction and follow Continue into act — the only way past the commitment gate. */
function commitPredictionAndContinue() {
  goToPhase('predict')
  const choice = document.querySelector<HTMLElement>('#prediction-heading + div button')
  if (!choice) throw new Error('no prediction choice rendered')
  fireEvent.click(choice)
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
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

  it('opens a predict URL at predict, with the plain restoration note', () => {
    // `predict` is the one non-opening phase a URL may still land on directly: it sits before the
    // commitment, so there is nothing to fail closed about.
    mountAt('vv-normal-state', 'vv', 'predict')

    expect(currentPhaseButtonName()).toBe('predict')
    expect(loadedVariantId()).toBe('reference-circuit')
    expect(restorationNote()).toContain('Opened at the predict phase with a clean teaching state')
    expect(restorationNote()).toContain('Earlier choices, snapshots, and actions were not restored')
    // Never described as a resumed session.
    expect(restorationNote()?.toLowerCase()).not.toContain('progress')
    expect(restorationNote()?.toLowerCase()).not.toContain('resumed')
  })

  it('clamps a gated-phase URL to predict and says which phase is waiting on the commitment', () => {
    mountAt('vv-normal-state', 'vv', 'explain')

    // The commitment lives only in session state, so a fresh mount cannot honour a URL into a
    // phase that requires one — it fails closed at the gate instead of fabricating a commitment.
    expect(currentPhaseButtonName()).toBe('predict')
    // The authored mapping still resolves — the helper is the contract a future consumer reads.
    expect(
      ecmoFoundationInitialVariantId(ecmoFoundationLessonRuntime('vv-normal-state'), 'explain'),
    ).toBe('reference-circuit')
    expect(loadedVariantId()).toBe('reference-circuit')
    expect(restorationNote()).toContain('opened at the predict phase')
    expect(restorationNote()).toContain('The explain phase unlocks when you commit')
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
    commitPredictionAndContinue()
    goToPhase('explain')
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
   * transfer instruction then tells them to load the preview themselves.
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

      expect(currentPhaseButtonName()).toBe('predict')
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
      expect(restorationNote()).toContain('The transfer phase unlocks when you commit')

      // The prediction item is on screen, uncommitted — the gate the URL was clamped to.
      const choices = Array.from(
        document.querySelectorAll<HTMLButtonElement>('#prediction-heading + div button'),
      )
      expect(choices.length).toBeGreaterThan(0)
      for (const choice of choices) {
        expect(choice).toHaveAttribute('aria-pressed', 'false')
        expect(choice).not.toBeDisabled()
      }
    },
  )

  it('reaches the transfer item and its actions through the commitment, not around it', () => {
    mountAt('vv-integration-capstone', 'vv', 'transfer')
    commitPredictionAndContinue()
    goToPhase('transfer')

    expect(currentPhaseButtonName()).toBe('transfer')
    // The item's stem reads the re-drainage preview; its own instruction loads that preview.
    const stem = document.querySelector('#transfer-heading')?.textContent ?? ''
    expect(stem).toContain('re-drainage preview beside you')
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
 * 7. Walking the navigation is not a restoration
 * ------------------------------------------------------------------ */

describe('manual phase navigation leaves the learner’s own state alone', () => {
  it('does not reload the authored state when the phase button is clicked', () => {
    mountAt('vv-integration-capstone', 'vv', 'recognize')

    commitPredictionAndContinue()
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

    // The act URL clamped to predict; the actions appear once the learner commits their way in.
    commitPredictionAndContinue()
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
  it('canonicalizes to VA before clamping when VV is asked for', () => {
    mountAt('va-parallel-physiology', 'vv', 'transfer')

    expect(document.querySelector('main')).toHaveAttribute('data-support-mode', 'va')
    // The gated URL fails closed the same way it does on the canonical track.
    expect(currentPhaseButtonName()).toBe('predict')
    expect(loadedVariantId()).toBe('reference-circuit')
    // A VA panel over a VA state — there is no such thing as this lesson in the VV registry.
    expect(document.querySelector('[data-va-configuration]')).not.toBeNull()
  })

  it('canonicalizes to VV before clamping when VA is asked for', () => {
    mountAt('vv-integration-capstone', 'va', 'transfer')

    expect(document.querySelector('main')).toHaveAttribute('data-support-mode', 'vv')
    expect(currentPhaseButtonName()).toBe('predict')
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
      commitPredictionAndContinue()

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

    // The remount key still includes the section, the resolved mode and the phase — the phase
    // after the commitment clamp, because that is the phase the workspace actually mounts at.
    expect(activitySource).toContain('key={`${sectionId}:${resolvedMode}:${mountPhase}`}')
    for (const source of [activitySource, runtimeSource]) {
      // Comments are stripped first: both files *discuss* stored progress at length, saying what is
      // and is not written, and a guard that fired on the explanation would be deleted rather than
      // obeyed.
      const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
      expect(code).not.toMatch(/localStorage|sessionStorage/)
      expect(code).not.toMatch(/ProgressV2/)
      // No engine state is serialized to be replayed: a variant is rebuilt from its authored source.
      expect(code).not.toMatch(/JSON\.(?:stringify|parse)/)
    }

    // The activity reaches persistence exactly once, through one named writer that takes the
    // section id and nothing else. The phase is not passed to it, so it cannot be stored by it —
    // which is the property this test exists to protect. The runtime file reaches it not at all.
    const activityCode = activitySource
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
    expect(activityCode.match(/from '[^']*progress/gi)).toHaveLength(1)
    expect(activityCode).toContain(
      "import { persistFoundationSectionCompleted } from '../engine/progress'",
    )
    expect(activityCode.match(/persistFoundationSectionCompleted\(/g)).toHaveLength(1)
    expect(activityCode).toContain('persistFoundationSectionCompleted(sectionId)')
    expect(runtimeSource).not.toMatch(/from '[^']*progress/i)
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
      // the transfer commitment itself.
      commitPredictionAndContinue()
      goToPhase('transfer')
      expect(setItem).not.toHaveBeenCalled()

      const items = ecmoFoundationLearningItemsFor('why-extracorporeal-support')
      fireEvent.click(screen.getByRole('button', { name: items.transfer.choices[0]!.label }))

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
    } finally {
      setItem.mockRestore()
      window.localStorage.clear()
    }
  })

  it('does not write again when a section that was already worked is committed again', () => {
    window.localStorage.clear()
    try {
      const items = ecmoFoundationLearningItemsFor('why-extracorporeal-support')
      mountAt('why-extracorporeal-support', 'vv', 'transfer')
      commitPredictionAndContinue()
      goToPhase('transfer')
      fireEvent.click(screen.getByRole('button', { name: items.transfer.choices[0]!.label }))
      cleanup()

      const setItem = jest.spyOn(Storage.prototype, 'setItem')
      try {
        mountAt('why-extracorporeal-support', 'vv', 'transfer')
        commitPredictionAndContinue()
        goToPhase('transfer')
        fireEvent.click(screen.getByRole('button', { name: items.transfer.choices[0]!.label }))
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
