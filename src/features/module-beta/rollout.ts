import type { BetaModule } from './catalog'

/*
 * Which hub modules are ready for outside reviewers, and what a reviewer should know first.
 *
 * This is presentation only. Every module in the catalog stays listed and opens the same way
 * whatever its stage; the stage decides which heading it sits under on the hub page. Kept out of
 * `catalog.ts` because that file is bundled into the proxy and the testing frame.
 *
 * A module moves to `ready` when it clears the gate in `docs/gap-remediation/beta-finish-line.md`.
 */

export interface BetaTesterNote {
  /** One sentence on what the module teaches. */
  readonly summary: string
  /** Rough time to go through it once. */
  readonly minutes: number
  /** Where a reviewer's feedback helps most. */
  readonly lookFor: readonly string[]
  /** Content still under faculty review, and anything known to be unfinished. */
  readonly knownLimits: readonly string[]
}

export type BetaRolloutEntry =
  | { readonly stage: 'preview' }
  | { readonly stage: 'ready'; readonly note: BetaTesterNote }

export type BetaRollout = Readonly<Record<BetaModule['id'], BetaRolloutEntry>>

export const betaRollout: BetaRollout = {
  'ebus-guided': { stage: 'preview' },
  'eus-b-simulator': { stage: 'preview' },
  'synchronized-anatomy': { stage: 'preview' },
  'branch-tracing': { stage: 'preview' },
  'live-anatomy': { stage: 'preview' },
  'peripheral-imaging': { stage: 'preview' },
  'bronchoscopy-foundations': { stage: 'preview' },
  devices: { stage: 'preview' },
  'cardiohelp-ecmo': { stage: 'preview' },
  'baxter-crrt': { stage: 'preview' },
  'icu-hemodynamics': { stage: 'preview' },
  'mechanical-ventilation': { stage: 'preview' },
  'mechanical-circulatory-support': { stage: 'preview' },
}
