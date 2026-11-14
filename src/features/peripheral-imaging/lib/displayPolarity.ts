'use client'

import { createContext, useSyncExternalStore } from 'react'

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
 * A displayed value, 0–1, from the display curve's denser-is-higher value. The WebGL shader applies
 * the same mapping (`uInvert` in `fluoro-viewer/src/volume-drr.ts`); a test holds them together.
 */
export function applyPolarity(denserIsHigher: number, polarity: FluoroPolarity): number {
  return polarity === 'bone-dark' ? 1 - denserIsHigher : denserIsHigher
}

/**
 * A figure pixel that received no exposure (outside the collimated field) is marked by this alpha in
 * `projectionPixels`. It stays dark in both polarities: no beam reached it.
 */
export const UNEXPOSED_ALPHA = 254

/** Canvas pixels for a fluoroscopic figure, drawn in `polarity`. The input is not changed. */
export function polarityPixels(
  pixels: Uint8ClampedArray,
  polarity: FluoroPolarity,
): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(pixels)
  for (let i = 0; i < out.length; i += 4) {
    const exposed = out[i + 3] !== UNEXPOSED_ALPHA
    if (exposed && polarity === 'bone-dark') {
      out[i] = 255 - out[i]
      out[i + 1] = 255 - out[i + 1]
      out[i + 2] = 255 - out[i + 2]
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
