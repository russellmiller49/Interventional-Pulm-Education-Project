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

export const VIEW_DESCRIPTION: Readonly<Record<ScopeState['signals']['view'], string>> = {
  clear: 'A clear view through the scope',
  'red-out': 'A red field through the scope',
  contaminated: 'A smeared view through the scope',
  dark: 'A dark field through the scope',
}
