import type { FrameAtlas } from '../types'

import { normalizeFrameAtlas, selectNearestReviewedFrame } from '../engine/frameAtlas'
import { atlasSourceLabel } from './reviewedAtlasProvider'
import type { ThoracicFrameProvider } from './types'

function resolveImageUrl(imageUrl: string, indexUrl: string) {
  if (
    /^(https?:)?\/\//.test(imageUrl) ||
    imageUrl.startsWith('/') ||
    imageUrl.startsWith('data:')
  ) {
    return imageUrl
  }
  return indexUrl.replace(/[^/]*$/, '') + imageUrl
}

export interface PlusAtlasProviderOptions {
  fetchImpl?: typeof fetch
}

/**
 * Pose-indexed offline frame set produced by an external simulation pipeline
 * and described by a frames.json index next to the images. The index is
 * fetched once and cached; a missing or malformed index simply removes this
 * provider from the stack (the next source answers instead).
 */
export function createPlusAtlasProvider(
  indexUrl: string,
  options: PlusAtlasProviderOptions = {},
): ThoracicFrameProvider {
  const fetchImpl = options.fetchImpl ?? fetch
  let atlasPromise: Promise<FrameAtlas | null> | null = null

  function loadAtlas(): Promise<FrameAtlas | null> {
    atlasPromise ??= (async () => {
      try {
        const response = await fetchImpl(indexUrl)
        if (!response.ok) {
          return null
        }
        return normalizeFrameAtlas((await response.json()) as FrameAtlas)
      } catch {
        return null
      }
    })()
    return atlasPromise
  }

  return {
    id: 'plus-atlas',
    kind: 'plus-atlas',
    resolve: async ({ probe }) => {
      const atlas = await loadAtlas()
      if (!atlas) {
        return null
      }

      const selection = selectNearestReviewedFrame(atlas, probe)
      if (!selection) {
        return null
      }

      return {
        kind: 'plus-atlas',
        quality: 'reviewed',
        sourceLabel: atlasSourceLabel(selection.entry),
        imageUrl: resolveImageUrl(selection.entry.imageUrl, indexUrl),
        entry: selection.entry,
        metrics: selection.entry.metrics,
        educationalUse: selection.entry.educationalUse,
      }
    },
  }
}
