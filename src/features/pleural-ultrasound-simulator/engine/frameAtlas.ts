import type { FrameAtlas, FrameAtlasEntry } from '@/features/thoracic-ultrasound-simulator/types'
import {
  defaultFrameAtlasTolerance,
  normalizeFrameAtlas as thoracicNormalizeFrameAtlas,
  poseDistanceWithinTolerance as thoracicPoseDistanceWithinTolerance,
  selectNearestReviewedFrame,
} from '@/features/thoracic-ultrasound-simulator/engine/frameAtlas'

import type {
  PleuralFrameAtlas,
  PleuralFrameAtlasEntry,
  PleuralFrameAtlasTolerance,
  PleuralProbeState,
} from '../types'

export { defaultFrameAtlasTolerance }

export interface AtlasFrameSelection {
  entry: PleuralFrameAtlasEntry
  normalizedDistance: number
}

/**
 * Bridge a pleural atlas to the generic one: the pleural ground-truth pattern
 * becomes the generic `groundTruthKey`, everything else is shared. Entries keep
 * their `groundTruthPattern` field through the spread, so mapping back is a
 * cast.
 */
function toGenericAtlas(atlas: PleuralFrameAtlas): FrameAtlas {
  return {
    ...atlas,
    entries: (atlas.entries ?? []).map((entry) => ({
      ...entry,
      groundTruthKey: entry.groundTruthPattern,
    })) as FrameAtlasEntry[],
  }
}

export function normalizeFrameAtlas(
  atlas: PleuralFrameAtlas | null | undefined,
): PleuralFrameAtlas | null {
  if (!atlas || !Array.isArray(atlas.entries)) {
    return null
  }

  const normalized = thoracicNormalizeFrameAtlas(toGenericAtlas(atlas))
  if (!normalized) {
    return null
  }

  return {
    ...atlas,
    selectionTolerance: normalized.selectionTolerance,
    entries: normalized.entries as unknown as PleuralFrameAtlasEntry[],
  }
}

export function poseDistanceWithinTolerance(
  probe: PleuralProbeState,
  entry: PleuralFrameAtlasEntry,
  tolerance: PleuralFrameAtlasTolerance,
) {
  return thoracicPoseDistanceWithinTolerance(probe, entry.probe, tolerance)
}

export function selectNearestReviewedAtlasFrame(
  atlas: PleuralFrameAtlas | null | undefined,
  probe: PleuralProbeState,
): AtlasFrameSelection | null {
  if (!atlas || !Array.isArray(atlas.entries)) {
    return null
  }

  const selection = selectNearestReviewedFrame(toGenericAtlas(atlas), probe)
  if (!selection) {
    return null
  }

  return {
    entry: selection.entry as unknown as PleuralFrameAtlasEntry,
    normalizedDistance: selection.normalizedDistance,
  }
}
