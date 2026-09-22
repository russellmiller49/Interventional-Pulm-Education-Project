import { projectOptical } from '@/lib/bronchoscopy-core/frame'
import { scopeOpticalFrame } from '@/lib/airway-anatomy/transport-frames'

import { OPTICAL_ASPECT, OPTICAL_FOV_DEG } from '../../engine/scope/scopeOstia'
import type { ScopeState, CordsState } from './types'

export const CORD_MORPH_WEIGHT: Readonly<Record<CordsState, number>> = {
  abducted: 0,
  narrowing: 0.5,
  adducted: 1,
}

export function projectScenePins(state: ScopeState) {
  if (!state.pose || state.signals.view !== 'clear') return []
  const frame = scopeOpticalFrame(state.pose)
  return state.ostia.flatMap((pin) => {
    if (!pin.inView) return []
    const projected = projectOptical(pin.pointLps, frame, OPTICAL_ASPECT, OPTICAL_FOV_DEG)
    return projected
      ? [
          {
            ...pin,
            leftPct: (0.5 + projected.x / 2) * 100,
            topPct: (0.5 - projected.y / 2) * 100,
            depthMm: projected.depth,
          },
        ]
      : []
  })
}

/** Move the caption only; leader lines retain the measured optical projection. */
export function layoutOpticalLabels(
  pins: ReturnType<typeof projectScenePins>,
  width: number,
  height: number,
  labelled: boolean,
) {
  if (!labelled)
    return pins.map((pin) => ({
      ...pin,
      labelLeftPct: pin.leftPct,
      labelTopPct: pin.topPct,
      displaced: false,
    }))
  const boxes: { x: number; y: number; halfWidth: number }[] = []
  return pins.map((pin) => {
    const halfWidth = labelled ? Math.max(16, pin.label.length * 4 + 8) : 16
    const x = Math.max(halfWidth + 3, Math.min(width - halfWidth - 3, (pin.leftPct * width) / 100))
    const sourceY = (pin.topPct * height) / 100
    const candidates = [0, 32, -32, 64, -64, 96, -96].map((offset) =>
      Math.max(17, Math.min(height - 17, sourceY + offset)),
    )
    const y =
      candidates.find((candidate) =>
        boxes.every(
          (box) =>
            Math.abs(x - box.x) >= halfWidth + box.halfWidth + 4 ||
            Math.abs(candidate - box.y) >= 30,
        ),
      ) ?? candidates[0]
    boxes.push({ x, y, halfWidth })
    return {
      ...pin,
      labelLeftPct: (x / width) * 100,
      labelTopPct: (y / height) * 100,
      displaced: Math.abs(x - (pin.leftPct * width) / 100) > 1 || Math.abs(y - sourceY) > 1,
    }
  })
}

/**
 * What the model's own view signal records — never a verdict on the picture on the screen.
 *
 * `signals.view` is a model state signal, not a reading of the rendered image. The reducer sets it
 * from two recorded conditions alone, a red-out and a contaminated lens; everything else is
 * `clear`. Three of the values paint the whole field themselves (the `data-lens-state` and
 * `data-view-signal` rules in the two optical stylesheets), so naming the field for those
 * describes what the renderer actually draws. `clear` paints nothing. It means only that neither
 * condition is recorded, and the picture is then whatever the airway ahead gives: deflected
 * against a wall in the left main bronchus, that is mucosa with no lumen in it. So `clear`
 * reports the absence of the recorded conditions and stops. It never says the view, the airway or
 * the lumen is clear, open or good, and it never borrows the differential's own row name, "a
 * clear view of an airway you cannot name", which a learner is taught to read as a usable image
 * (BF-PRE-REVIEW-01 finding 1).
 *
 * What is recorded, never why: the cause of a red or dark field is the answer some sections ask
 * for, and a section's deny patterns forbid it, so no value here names a mechanism.
 */
export const VIEW_SIGNAL_WORDS: Readonly<Record<ScopeState['signals']['view'], string>> = {
  clear: 'no red field, smear or dark field',
  'red-out': 'a red field over the whole view',
  contaminated: 'a smeared field over the whole view',
  dark: 'a dark field over the whole view',
}

/** The lead both optical surfaces share, so the signal is read as a record, not as approval. */
export const VIEW_SIGNAL_LEAD = 'Scope view · what the model records:'

/**
 * The accessible name of an optical surface. The scene and the fallback both name their field
 * through this one function, so neither renderer can hand a learner the stronger claim.
 */
export function opticalViewName(view: ScopeState['signals']['view']): string {
  return `${VIEW_SIGNAL_LEAD} ${VIEW_SIGNAL_WORDS[view]}`
}
