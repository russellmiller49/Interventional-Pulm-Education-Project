'use client'

import { createContext, useSyncExternalStore } from 'react'
import type { DrrLook } from '@fluoroview/volume-drr'

/**
 * Which way round the course shows a fluoroscopic image: dense structures dark, as many fluoroscopy
 * monitors show them, or dense structures bright, as a radiograph shows them.
 *
 * Owner's ruling, 2026-11-12 (pi-display-polarity): “Offer a toggle,” with bone-dark fluoroscopy as
 * the default.
 *
 * This file is the one setting every fluoroscopic image reads: the suite's WebGL projection (the
 * monitor, the detector in the 3D view and the monitor cart all show one texture), the static
 * teaching figures drawn from `lib/ctProjection.ts`, and the practice drill. The choice is a display
 * mapping only. The image's numbers — line integrals, the display curve, the collimation window, the
 * teaching signal measures — are computed denser-is-higher and are the same in both.
 *
 * Cone-beam CT and tomosynthesis are reconstructions and keep the CT convention (bone bright); they
 * never read this setting.
 */
export type FluoroPolarity = 'bone-dark' | 'bone-bright'

export const DEFAULT_FLUORO_POLARITY: FluoroPolarity = 'bone-dark'

/** The setting tomographic images keep regardless of the fluoroscopy display. */
export const CT_CONVENTION: FluoroPolarity = 'bone-bright'

/**
 * The polarity of the image an overlay is drawn on. The monitor provides its own; an overlay outside
 * it (a cone-beam CT frame) is on a CT-convention image.
 */
export const ImagePolarityContext = createContext<FluoroPolarity>(CT_CONVENTION)

export const FLUORO_POLARITY_LABELS: Readonly<Record<FluoroPolarity, string>> = {
  'bone-dark': 'Bone dark',
  'bone-bright': 'Bone bright',
}

/**
 * How bone dark is drawn: the inverted value (1 − the denser-is-higher value) through a window and a
 * gamma, the way a fluoroscopy monitor's look-up table draws its image.
 *
 * Owner's ruling, 2026-11-15 (on #552, “the bone-dark image is pale”): “Tune contrast before merge.”
 * A straight inversion put aerated lung near white, left the ribs faint and lost the overlays on
 * it. Through this curve:
 * - aerated lung is mid-to-light grey, and the curve is steep there, so a nodule in the lung differs
 *   from the lung round it by more grey levels than on bone bright;
 * - ribs, the spine and the mediastinum are clearly darker than the lung;
 * - the white point sits above the brightest value, so an unattenuated beam is light grey, not glare.
 *
 * `inverted` = 0 (densest) to 1 (no attenuation); displayed = clamp((inverted − black) /
 * (white − black))^gamma. Bone bright is not passed through it. Authored display values for this
 * course's CT, as `FLUORO_LOOK` is; not a calibration of any monitor.
 */
export const BONE_DARK_CURVE = { black: 0, white: 1.1, gamma: 2 } as const

/** The bone-dark display value, 0–1, of an inverted value. */
export function boneDarkDisplay(inverted: number): number {
  const { black, white, gamma } = BONE_DARK_CURVE
  const t = Math.min(1, Math.max(0, (inverted - black) / (white - black)))
  return t ** gamma
}

/**
 * A displayed value, 0–1, from the display curve's denser-is-higher value. The WebGL shader applies
 * the same mapping (`uInvert` and `uInvertCurve` in `fluoro-viewer/src/volume-drr.ts`, set by
 * `polarityLook`); a test holds them together.
 */
export function applyPolarity(denserIsHigher: number, polarity: FluoroPolarity): number {
  return polarity === 'bone-dark' ? boneDarkDisplay(1 - denserIsHigher) : denserIsHigher
}

/** What the renderer is asked for, for a polarity: the inversion and the bone-dark curve. */
export function polarityLook(polarity: FluoroPolarity): Pick<DrrLook, 'invert' | 'invertCurve'> {
  return {
    invert: polarity === 'bone-dark',
    invertCurve: [BONE_DARK_CURVE.black, BONE_DARK_CURVE.white, BONE_DARK_CURVE.gamma],
  }
}

/** The denser-is-higher value behind a value displayed in `polarity` (the curve's inverse). */
function denserIsHigherOf(displayed: number, polarity: FluoroPolarity): number {
  if (polarity === 'bone-bright') return displayed
  const { black, white, gamma } = BONE_DARK_CURVE
  const inverted = black + (white - black) * Math.max(0, displayed) ** (1 / gamma)
  return Math.min(1, Math.max(0, 1 - inverted))
}

/** A value displayed in `from`, as `to` displays the same pixel. */
export function repolarize(displayed: number, from: FluoroPolarity, to: FluoroPolarity): number {
  return from === to ? displayed : applyPolarity(denserIsHigherOf(displayed, from), to)
}

/**
 * `repolarize` as an SVG `feFunc` table: a stored frame shown under the other setting is redrawn
 * through it on screen; its own pixels stay as stored. The table is fine enough that a bone-dark
 * frame comes back within a grey level of bone bright except at the densest end, which bone dark
 * has already drawn near black.
 */
export function repolarizeTable(from: FluoroPolarity, to: FluoroPolarity, size = 129): number[] {
  return Array.from({ length: size }, (_, index) =>
    Number(repolarize(index / (size - 1), from, to).toFixed(4)),
  )
}

/**
 * A figure pixel that received no exposure (outside the collimated field) is marked by this alpha in
 * `projectionPixels`. It stays dark in both polarities: no beam reached it.
 */
export const UNEXPOSED_ALPHA = 254

/** `applyPolarity` for a figure's 8-bit denser-is-higher value, drawn bone dark. */
const BONE_DARK_BYTES = Uint8Array.from({ length: 256 }, (_, value) =>
  Math.round(applyPolarity(value / 255, 'bone-dark') * 255),
)

/** Canvas pixels for a fluoroscopic figure, drawn in `polarity`. The input is not changed. */
export function polarityPixels(
  pixels: Uint8ClampedArray,
  polarity: FluoroPolarity,
): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(pixels)
  for (let i = 0; i < out.length; i += 4) {
    const exposed = out[i + 3] !== UNEXPOSED_ALPHA
    if (exposed && polarity === 'bone-dark') {
      out[i] = BONE_DARK_BYTES[out[i]]
      out[i + 1] = BONE_DARK_BYTES[out[i + 1]]
      out[i + 2] = BONE_DARK_BYTES[out[i + 2]]
    }
    out[i + 3] = 255
  }
  return out
}

/* ------------------------------------------------------------------ *
 * The learner's choice, kept for the visit
 * ------------------------------------------------------------------ */

const STORAGE_KEY = 'peripheral-imaging:fluoro-polarity'
const listeners = new Set<() => void>()
let current: FluoroPolarity | null = null

function isPolarity(value: unknown): value is FluoroPolarity {
  return value === 'bone-dark' || value === 'bone-bright'
}

/** The setting now in force. Without storage (a private window, a blocked origin) it is the default. */
export function getFluoroPolarity(): FluoroPolarity {
  if (current) return current
  let stored: string | null = null
  try {
    stored = typeof window === 'undefined' ? null : window.sessionStorage.getItem(STORAGE_KEY)
  } catch {
    stored = null
  }
  current = isPolarity(stored) ? stored : DEFAULT_FLUORO_POLARITY
  return current
}

export function setFluoroPolarity(polarity: FluoroPolarity) {
  current = polarity
  try {
    window.sessionStorage.setItem(STORAGE_KEY, polarity)
  } catch {
    // The choice still holds for this page; it is simply not remembered.
  }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Test seam: forget the remembered choice so the next read starts from storage again. */
export function resetFluoroPolarityForTests() {
  current = null
}

/** The fluoroscopy display setting, shared by every image on the page. */
export function useFluoroPolarity(): FluoroPolarity {
  return useSyncExternalStore(subscribe, getFluoroPolarity, () => DEFAULT_FLUORO_POLARITY)
}
