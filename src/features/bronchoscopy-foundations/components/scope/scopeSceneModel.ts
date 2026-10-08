import { projectOptical, scalar } from '@/lib/bronchoscopy-core/frame'
import type { Vec3 } from '@/lib/airway-anatomy/types'
import { scopeOpticalFrame } from '@/lib/airway-anatomy/transport-frames'

import { OPTICAL_ASPECT, OPTICAL_FOV_DEG } from '../../engine/scope/scopeOstia'
import type { ScopeState, CordsState } from './types'

export const CORD_MORPH_WEIGHT: Readonly<Record<CordsState, number>> = {
  abducted: 0,
  narrowing: 0.5,
  adducted: 1,
}

/**
 * The patient's front and left, as the teaching model's coordinates carry them (LPS: +x left,
 * +y posterior), placed on the rim of the round image through the frame the scope view draws
 * (fellow walkthrough A24). They move when the control section turns because the image does; they
 * are read from the model's geometry, not from the picture, and say nothing about a real patient's
 * image or a device's orientation. A direction that points nearly along the view has no place on
 * the rim and is left out rather than drawn at a guessed angle.
 */
const PATIENT_DIRECTIONS = [
  { id: 'A', lps: [0, -1, 0] },
  { id: 'L', lps: [1, 0, 0] },
] as const
/** Below this share of a direction in the image plane, its place on the rim is not stable. */
const RIM_TICK_MIN = 0.35

export function patientDirectionTicks(state: Pick<ScopeState, 'pose' | 'place'>) {
  if (!state.pose || state.place === 'bench') return []
  const frame = scopeOpticalFrame(state.pose)
  return PATIENT_DIRECTIONS.flatMap((direction) => {
    const x = scalar(direction.lps as unknown as Vec3, frame.right)
    const y = scalar(direction.lps as unknown as Vec3, frame.up)
    const length = Math.hypot(x, y)
    return length < RIM_TICK_MIN ? [] : [{ id: direction.id, x: x / length, y: y / length }]
  })
}

/** What the ticks mean, beside the view. */
export const PATIENT_TICK_LEGEND =
  'Scope view: from the tip, looking along the airway. A marks the patient’s front and L the patient’s left, from the teaching model’s geometry; they move when the control section turns.'

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

/** How far a caption may be pushed from its opening, in steps along its outward direction (px). */
const CAPTION_STEPS = [0, 30, 42, 56, 72, 90, 110, 132]
/**
 * A caption keeps this much clear space (px) from every other opening's attachment point, so two
 * openings a few millimetres apart each get their caption off the ridge between them.
 */
const ANCHOR_CLEARANCE = 26

/**
 * Move the caption only; leader lines retain the measured optical projection (fellow walkthrough
 * A24).
 *
 * Each pin's attachment point is the model's own ostium point, projected through the same frame the
 * renderer draws — never a pixel guessed from the picture. At the main carina both openings begin
 * a few millimetres apart, so both points sit near the middle of the image and centred captions
 * crowd onto the ridge between them. A caption that would crowd is pushed outward, away from the
 * other openings' points (along the line from their centroid through its own point), until it is
 * clear of every other caption and of every other opening's point; a leader line and a dot keep
 * it attached to its own point. Unlabelled pins (the "·" markers) stay on their points.
 */
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
  const anchors = pins.map((pin) => ({
    x: (pin.leftPct * width) / 100,
    y: (pin.topPct * height) / 100,
  }))
  const centroid = anchors.length
    ? {
        x: anchors.reduce((sum, a) => sum + a.x, 0) / anchors.length,
        y: anchors.reduce((sum, a) => sum + a.y, 0) / anchors.length,
      }
    : { x: width / 2, y: height / 2 }
  const boxes: { x: number; y: number; halfWidth: number }[] = []
  const halfHeight = 13
  return pins.map((pin, index) => {
    const halfWidth = Math.max(16, pin.label.length * 4 + 8)
    const anchor = anchors[index]
    const away = (from: { x: number; y: number }) => {
      const dx = anchor.x - from.x
      const dy = anchor.y - from.y
      const length = Math.hypot(dx, dy)
      return length > 1 ? { x: dx / length, y: dy / length } : null
    }
    const direction = (anchors.length > 1 ? away(centroid) : null) ??
      away({ x: width / 2, y: height / 2 }) ?? { x: 0, y: -1 }
    const clamp = (x: number, y: number) => ({
      x: Math.max(halfWidth + 3, Math.min(width - halfWidth - 3, x)),
      y: Math.max(halfHeight + 4, Math.min(height - halfHeight - 4, y)),
    })
    const fits = (x: number, y: number) =>
      boxes.every(
        (box) => Math.abs(x - box.x) >= halfWidth + box.halfWidth + 10 || Math.abs(y - box.y) >= 36,
      ) &&
      anchors.every(
        (other, otherIndex) =>
          otherIndex === index ||
          Math.abs(x - other.x) >= halfWidth + ANCHOR_CLEARANCE ||
          Math.abs(y - other.y) >= halfHeight + ANCHOR_CLEARANCE - 6,
      )
    const candidates = CAPTION_STEPS.map((step) =>
      clamp(anchor.x + direction.x * step, anchor.y + direction.y * step),
    )
    // Outward first; if the edge of the image stops that, the old vertical offsets as a fallback.
    const vertical = [32, -32, 64, -64, 96, -96].map((offset) => clamp(anchor.x, anchor.y + offset))
    const chosen =
      [...candidates, ...vertical].find((candidate) => fits(candidate.x, candidate.y)) ??
      candidates[candidates.length - 1]
    boxes.push({ x: chosen.x, y: chosen.y, halfWidth })
    return {
      ...pin,
      labelLeftPct: (chosen.x / width) * 100,
      labelTopPct: (chosen.y / height) * 100,
      displaced: Math.abs(chosen.x - anchor.x) > 1 || Math.abs(chosen.y - anchor.y) > 1,
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
