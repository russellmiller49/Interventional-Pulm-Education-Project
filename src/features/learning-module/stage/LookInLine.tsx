'use client'

import { STAGE_PANE_NAMES, type StageStepLocation } from './stageModel'

/**
 * "Where to look: Teaching panel — Circuit walk."
 *
 * One sentence naming the pane this step is worked in and the thing inside it, in the same words
 * `StageLayout` prints on the pane's caption. A learner review of the ECMO module in September 2026
 * walked four steps guessing which of three panes an instruction meant, on a stage whose panes had
 * no visible names at all; this is the half of the fix that lives in the step, and the pane caption
 * is the other half. A second pane is named only where the step is genuinely worked across two.
 */
export function LookInLine({ location }: { readonly location: StageStepLocation }) {
  return (
    <>
      Where to look: <strong>{STAGE_PANE_NAMES[location.pane]}</strong> — {location.landmark}
      {location.alsoPane && location.alsoLandmark ? (
        <>
          , and <strong>{STAGE_PANE_NAMES[location.alsoPane]}</strong> — {location.alsoLandmark}
        </>
      ) : null}
      .
    </>
  )
}
