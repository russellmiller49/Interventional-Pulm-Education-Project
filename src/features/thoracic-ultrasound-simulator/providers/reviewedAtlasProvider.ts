import type { FrameAtlasEntry } from '../types'

import { selectNearestReviewedFrame } from '../engine/frameAtlas'
import type { ThoracicFrameProvider } from './types'

export function atlasSourceLabel(entry: FrameAtlasEntry) {
  if (entry.generator.source === 'plus-offline') return 'PLUS offline atlas'
  if (entry.generator.source === 'must-inspired-offline') return 'MUST-inspired atlas'
  if (entry.generator.source === 'browser-raymarcher') return 'Browser-rendered atlas'
  return 'Curated teaching atlas'
}

/**
 * Highest-preference source: reviewed frames embedded in the case manifest,
 * selected by pose proximity. Only entries with reviewStatus 'reviewed' are
 * ever returned.
 */
export function createReviewedAtlasProvider(): ThoracicFrameProvider {
  const resolve = ({ manifest, probe }: Parameters<ThoracicFrameProvider['resolve']>[0]) => {
    const selection = selectNearestReviewedFrame(manifest.frameAtlas, probe)
    if (!selection) {
      return null
    }

    return {
      kind: 'reviewed-atlas' as const,
      quality: 'reviewed' as const,
      sourceLabel: atlasSourceLabel(selection.entry),
      imageUrl: selection.entry.imageUrl,
      entry: selection.entry,
      metrics: selection.entry.metrics,
      educationalUse: selection.entry.educationalUse,
    }
  }

  return {
    id: 'reviewed-atlas',
    kind: 'reviewed-atlas',
    resolve,
    resolveSync: resolve,
  }
}
