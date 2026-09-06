'use client'

import {
  ECMO_STAGE_PANE_NAMES,
  type EcmoPhaseLocation,
} from '../../content/foundationLessonRuntime'

/**
 * "Where to look: Teaching panel — Circuit walk."
 *
 * One sentence naming the pane this step is worked in and the thing inside it, in the same words
 * `StageLayout` prints on the pane. A learner review in September 2026 walked four steps guessing
 * which of three panes an instruction meant, on a stage whose panes had no visible names at all;
 * this is the half of the fix that lives in the step, and the pane caption is the other half.
 *
 * A second pane is named only where the step is genuinely worked across two — the flow-path Observe
 * step reads the channels on the console and the set of them in the teaching pane — and the content
 * validator rejects a location that names the same pane twice or names half of a second one.
 */
export function EcmoLookInLine({ location }: { readonly location: EcmoPhaseLocation }) {
  return (
    <>
      Where to look: <strong>{ECMO_STAGE_PANE_NAMES[location.pane]}</strong> — {location.landmark}
      {location.alsoPane && location.alsoLandmark ? (
        <>
          , and <strong>{ECMO_STAGE_PANE_NAMES[location.alsoPane]}</strong> —{' '}
          {location.alsoLandmark}
        </>
      ) : null}
      .
    </>
  )
}
