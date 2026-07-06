'use client'

import { useRef, useState } from 'react'
import { CheckCircle2, Gauge, Lock, Play, RefreshCw, RotateCcw } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { PccmCourseVideo } from '@/features/pccm-intro-course/content/videos'
import type { PccmVideoProgressRow } from '@/features/pccm-intro-course/types'
import { cn } from '@/lib/cn'

interface PccmCourseVideoCardProps {
  locked: boolean
  progress?: PccmVideoProgressRow
  video: Pick<PccmCourseVideo, 'courseSection' | 'id' | 'title'>
}

const pccmPlaybackRates = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const

export function PccmCourseVideoCard({ locked, progress, video }: PccmCourseVideoCardProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const lastProgressSentAt = useRef(0)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [signedUrl, setSignedUrl] = useState<string | null>(null)

  const percent = progress?.max_percent_complete ?? 0
  const completed = Boolean(progress?.completed_at) || percent >= 95

  async function loadVideo() {
    if (locked) {
      return
    }

    setError(null)
    setIsLoading(true)
    try {
      const response = await fetch(
        `/api/pccm-intro-course/video-url?videoId=${encodeURIComponent(video.id)}`,
        { cache: 'no-store' },
      )
      const payload = (await response.json().catch(() => null)) as {
        error?: string
        url?: string
      } | null

      if (!response.ok || !payload?.url) {
        setError(payload?.error ?? 'Unable to load this course video.')
        return
      }

      setSignedUrl(payload.url)
    } finally {
      setIsLoading(false)
    }
  }

  async function recordProgress(force = false) {
    const element = videoRef.current
    if (!element || !Number.isFinite(element.duration) || element.duration <= 0) {
      return
    }

    const now = Date.now()
    if (!force && now - lastProgressSentAt.current < 15_000) {
      return
    }

    lastProgressSentAt.current = now
    const maxPercentComplete = Math.min(100, (element.currentTime / element.duration) * 100)

    await fetch('/api/pccm-intro-course/video-progress', {
      body: JSON.stringify({
        durationSeconds: element.duration,
        lastPositionSeconds: element.currentTime,
        maxPercentComplete,
        videoId: video.id,
        watchedSeconds: element.currentTime,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    }).catch(() => null)
  }

  function seekBy(deltaSeconds: number) {
    const element = videoRef.current
    if (!element) {
      return
    }

    const boundedDuration =
      Number.isFinite(element.duration) && element.duration > 0 ? element.duration : null
    const nextTime = Math.max(element.currentTime + deltaSeconds, 0)
    element.currentTime = boundedDuration === null ? nextTime : Math.min(nextTime, boundedDuration)

    void recordProgress(true)
  }

  function setVideoPlaybackRate(nextRate: number) {
    setPlaybackRate(nextRate)
    if (videoRef.current) {
      videoRef.current.playbackRate = nextRate
    }
  }

  return (
    <article className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h4 className="text-sm font-semibold leading-6">{video.title}</h4>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {video.courseSection === 'bronchoscopy' ? 'Bronchoscopy' : 'Pleural disease'}
          </p>
        </div>
        {locked ? (
          <Badge variant="outline" className="shrink-0">
            <Lock className="mr-1 h-3 w-3" aria-hidden />
            Locked
          </Badge>
        ) : completed ? (
          <Badge variant="success" className="shrink-0">
            <CheckCircle2 className="mr-1 h-3 w-3" aria-hidden />
            Done
          </Badge>
        ) : (
          <Badge variant="outline" className="shrink-0">
            {Math.round(percent)}%
          </Badge>
        )}
      </div>

      {signedUrl ? (
        <div className="mt-4 space-y-3">
          <video
            aria-label={`${video.title} course video`}
            className="aspect-video w-full rounded-md bg-black"
            controls
            controlsList="nodownload noplaybackrate noremoteplayback"
            onEnded={() => recordProgress(true)}
            onError={() => {
              setError(
                'This course video could not play in the browser. Please refresh and try again.',
              )
            }}
            onLoadedMetadata={() => {
              setError(null)
              if (videoRef.current) {
                videoRef.current.playbackRate = playbackRate
              }
            }}
            onPause={() => recordProgress(true)}
            onTimeUpdate={() => recordProgress(false)}
            ref={videoRef}
            src={signedUrl}
          />
          <div className="flex flex-col gap-3 rounded-md border border-border/70 bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div
              className="flex flex-wrap items-center gap-1.5"
              aria-label={`Backtrack controls for ${video.title}`}
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Back
              </span>
              <PccmSeekButton seconds={-10} title={video.title} onSeek={seekBy} />
              <PccmSeekButton seconds={-30} title={video.title} onSeek={seekBy} />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Gauge className="h-3.5 w-3.5" aria-hidden />
                Speed
              </span>
              {pccmPlaybackRates.map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => setVideoPlaybackRate(rate)}
                  className={cn(
                    'min-h-8 rounded-full border px-2.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    playbackRate === rate
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                  aria-pressed={playbackRate === rate}
                  aria-label={`Set ${video.title} playback speed to ${formatRate(rate)}`}
                >
                  {formatRate(rate)}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex aspect-video items-center justify-center rounded-md border bg-muted/40">
          <Button
            disabled={locked || isLoading}
            onClick={loadVideo}
            type="button"
            variant="outline"
          >
            {isLoading ? (
              <RefreshCw className="h-4 w-4 animate-spin" aria-hidden />
            ) : locked ? (
              <Lock className="h-4 w-4" aria-hidden />
            ) : (
              <Play className="h-4 w-4" aria-hidden />
            )}
            {locked ? 'Complete pretests first' : isLoading ? 'Loading' : 'Load video'}
          </Button>
        </div>
      )}

      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
    </article>
  )
}

function PccmSeekButton({
  onSeek,
  seconds,
  title,
}: {
  onSeek: (seconds: number) => void
  seconds: number
  title: string
}) {
  const amount = Math.abs(seconds)

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      onClick={() => onSeek(seconds)}
      aria-label={`Rewind ${amount} seconds for ${title}`}
      className="h-8 min-w-[4rem] border border-border/70 px-2.5 text-xs text-muted-foreground hover:text-foreground"
    >
      <RotateCcw className="h-3.5 w-3.5" aria-hidden />
      <span>{`-${amount}s`}</span>
    </Button>
  )
}

function formatRate(rate: number) {
  return `${rate}x`
}
