'use client'

import { techniqueCopy } from '@/features/rigid-bronchoscopy-techniques/components/techniqueCopy'
import type { MediaContainer } from '@/features/rigid-bronchoscopy-techniques/types'
import { resolveModuleAssetUrl } from '@/lib/module-assets'

export interface TechniqueVideoPlayerProps {
  title: string
  /** Native video URL or iframe embed URL (module-asset-relative or absolute). */
  src: string
  /** `native` renders a <video> element; `iframe` embeds (preserves iframe videos). */
  container?: MediaContainer
  poster?: string
  /** Optional additional WebM source for the native player. */
  webmSrc?: string
  /** WebVTT captions file for the native player. */
  captionsSrc?: string
  captionsLang?: string
  captionsLabel?: string
  /** Overlay a persistent "Synthetic procedural visualization" label. */
  syntheticLabel?: boolean
  className?: string
}

/**
 * Accessible technique video player.
 *
 * - Native <video> for MP4/WebM with poster, native controls (fullscreen,
 *   playback speed, picture-in-picture where supported), and <track> captions.
 * - `preload="metadata"`, lazy iframe, and NO autoplay — audio is never
 *   required to understand a maneuver.
 * - Falls back to the existing iframe embed style when `container === 'iframe'`.
 */
export function TechniqueVideoPlayer({
  title,
  src,
  container = 'native',
  poster,
  webmSrc,
  captionsSrc,
  captionsLang = 'en',
  captionsLabel = techniqueCopy.captionsLabel,
  syntheticLabel = false,
  className,
}: TechniqueVideoPlayerProps) {
  const resolvedSrc = src ? resolveModuleAssetUrl(src) : ''
  const resolvedPoster = poster ? resolveModuleAssetUrl(poster) : undefined

  return (
    <figure className={`m-0 ${className ?? ''}`}>
      <div className="relative aspect-video overflow-hidden rounded-2xl border border-border/60 bg-black">
        {!resolvedSrc ? (
          <div className="flex h-full w-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
            {techniqueCopy.videoUnavailable}
          </div>
        ) : container === 'iframe' ? (
          <iframe
            src={resolvedSrc}
            title={title}
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
            className="absolute inset-0 h-full w-full"
          />
        ) : (
          <video
            className="absolute inset-0 h-full w-full"
            controls
            preload="metadata"
            playsInline
            poster={resolvedPoster}
            aria-label={title}
          >
            <source src={resolvedSrc} type="video/mp4" />
            {webmSrc ? <source src={resolveModuleAssetUrl(webmSrc)} type="video/webm" /> : null}
            {captionsSrc ? (
              <track
                kind="captions"
                src={resolveModuleAssetUrl(captionsSrc)}
                srcLang={captionsLang}
                label={captionsLabel}
              />
            ) : null}
            <p className="flex h-full w-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
              {techniqueCopy.videoUnavailable}
            </p>
          </video>
        )}

        {syntheticLabel && resolvedSrc ? (
          <span className="pointer-events-none absolute left-3 top-3 rounded bg-black/70 px-2 py-1 text-xs font-medium text-white">
            {techniqueCopy.syntheticLabel}
          </span>
        ) : null}
      </div>
    </figure>
  )
}
