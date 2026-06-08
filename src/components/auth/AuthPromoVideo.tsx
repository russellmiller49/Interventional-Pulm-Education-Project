'use client'

import { Play } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

interface AuthPromoVideoProps {
  posterSrc: string
  videoSrc: string
}

export function AuthPromoVideo({ posterSrc, videoSrc }: AuthPromoVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [needsGesture, setNeedsGesture] = useState(false)

  const attemptMutedPlayback = useCallback(async () => {
    const video = videoRef.current

    if (!video) {
      return false
    }

    video.muted = true
    video.playsInline = true

    try {
      await video.play()
      return true
    } catch {
      return false
    }
  }, [])

  const startMutedPreview = useCallback(() => {
    void attemptMutedPlayback().then((started) => setNeedsGesture(!started))
  }, [attemptMutedPlayback])

  useEffect(() => {
    const video = videoRef.current

    if (!video) {
      return
    }

    void attemptMutedPlayback().then((started) => setNeedsGesture(!started))

    const verifyPlayback = window.setTimeout(() => {
      if (video.paused && !video.ended) {
        setNeedsGesture(true)
      }
    }, 1200)

    return () => window.clearTimeout(verifyPlayback)
  }, [attemptMutedPlayback])

  const startWithSound = async () => {
    const video = videoRef.current

    if (!video) {
      return
    }

    video.muted = false

    try {
      await video.play()
      setNeedsGesture(false)
    } catch {
      video.muted = true
      setNeedsGesture(true)
    }
  }

  return (
    <div className="relative w-full">
      <video
        ref={videoRef}
        aria-label="Preview of interventionalpulm.com interactive learning modules"
        autoPlay
        className="aspect-square w-full max-w-full bg-slate-950 object-cover"
        controls
        loop
        muted
        playsInline
        poster={posterSrc}
        preload="auto"
        src={videoSrc}
        onLoadedData={startMutedPreview}
        onPause={() => setNeedsGesture(true)}
        onPlay={() => setNeedsGesture(false)}
      >
        <p>Preview video for interventionalpulm.com interactive learning modules.</p>
      </video>

      {needsGesture ? (
        <button
          type="button"
          onClick={startWithSound}
          className="absolute inset-0 flex items-center justify-center bg-slate-950/35 text-white transition hover:bg-slate-950/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          aria-label="Play preview video with sound"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/95 text-slate-950 shadow-lg">
            <Play className="h-7 w-7 fill-current" aria-hidden="true" />
          </span>
        </button>
      ) : null}
    </div>
  )
}
