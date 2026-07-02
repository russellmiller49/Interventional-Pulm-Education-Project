import type { ThoracicFrameProvider } from './types'

/**
 * Terminal fallback: a neutral "no reviewed frame at this pose" panel. Always
 * resolves, so the provider stack can never leave the learner without an
 * explanation of why no image is shown.
 */
export function createPlaceholderProvider(): ThoracicFrameProvider {
  const resolve = () => ({
    kind: 'placeholder' as const,
    quality: 'placeholder' as const,
    sourceLabel: 'No image at this pose',
    educationalUse:
      'Geometry scoring stays active, but no frame could be produced for this pose on this device.',
  })

  return {
    id: 'placeholder',
    kind: 'placeholder',
    resolve,
    resolveSync: resolve,
  }
}
