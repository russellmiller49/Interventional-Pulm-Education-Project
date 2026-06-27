'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Headphones, Loader2, Pause, Play } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import { cn } from '@/lib/cn'
import type { BoardReviewChapterMeta } from '@/data/board-review'
import { HandoffContent } from '@/i18n/handoff'

interface AudioCompanionActionsProps {
  chapter: BoardReviewChapterMeta
}

const playbackRates = [1, 1.25, 1.5, 1.75, 2] as const
const SIGNED_URL_TTL_SECONDS = 60 * 30
// Bucket name - must match your Supabase bucket name exactly (case-sensitive)
const AUDIO_BUCKET = 'Audio_companion'
const AUDIO_BUCKET_IS_PUBLIC = true // Set to false if bucket is private

function encodeSupabasePath(path: string): string {
  return path
    .split('/')
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join('/')
}

function getSupabaseBaseUrl(): string | null {
  // NEXT_PUBLIC_* env vars are available in client components
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (envUrl && envUrl.length > 0) {
    return envUrl.replace(/\/$/, '')
  }
  const ref = process.env.NEXT_PUBLIC_SUPABASE_PROJECT_REF || ''
  if (!ref) {
    return null
  }
  return `https://${ref}.supabase.co`
}

function formatTime(totalSeconds: number) {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return '0:00'
  }
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.floor(totalSeconds % 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function AudioCompanionActions({ chapter }: AudioCompanionActionsProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [urlExpiresAt, setUrlExpiresAt] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [playbackRate, setPlaybackRate] = useState(1)

  const audioObjectPath = useMemo(() => {
    const fromMeta = chapter.audioFile?.trim()
    const normalized = fromMeta && fromMeta.length > 0 ? fromMeta : `${chapter.slug}.mp3`
    return normalized.replace(/^\/+/, '')
  }, [chapter.audioFile, chapter.slug])

  const fetchSignedUrl = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // If bucket is public, construct public URL directly
      if (AUDIO_BUCKET_IS_PUBLIC) {
        const baseUrl = getSupabaseBaseUrl()
        if (!baseUrl) {
          throw new Error(
            'NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PROJECT_REF must be configured.',
          )
        }
        const normalizedPath = encodeSupabasePath(audioObjectPath)
        const publicUrl = `${baseUrl}/storage/v1/object/public/${AUDIO_BUCKET}/${normalizedPath}`

        // Log the URL for debugging
        console.log('Constructed audio URL:', publicUrl)
        console.log('Audio file path:', audioObjectPath)
        console.log('Bucket:', AUDIO_BUCKET)
        console.log('Base URL:', baseUrl)

        // Note: Supabase storage may not support HEAD requests, so we skip verification
        // The audio element will handle errors if the file doesn't exist
        setSignedUrl(publicUrl)
        // Public URLs don't expire, but we'll set a far future date
        setUrlExpiresAt(Date.now() + 365 * 24 * 60 * 60 * 1000)
        return
      }

      // For private buckets, use signed URLs
      const params = new URLSearchParams({
        bucket: AUDIO_BUCKET,
        path: audioObjectPath,
        expiresIn: String(SIGNED_URL_TTL_SECONDS),
      })
      const response = await fetch(`/api/storage/signed-url?${params.toString()}`, {
        cache: 'no-store',
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.error ?? 'Unable to load audio companion.')
      }
      const payload = (await response.json()) as { url?: string }
      if (!payload?.url) {
        throw new Error('Audio companion URL was not provided.')
      }
      setSignedUrl(payload.url)
      setUrlExpiresAt(Date.now() + SIGNED_URL_TTL_SECONDS * 1000)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Something went wrong fetching the audio companion.'
      setError(message)
      setSignedUrl(null)
      setUrlExpiresAt(null)
    } finally {
      setLoading(false)
    }
  }, [audioObjectPath])

  useEffect(() => {
    if (!panelOpen) {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
      }
      setIsPlaying(false)
      setCurrentTime(0)
      return
    }

    if (error) {
      return
    }

    const isUrlValid = signedUrl && urlExpiresAt && urlExpiresAt - Date.now() > 5_000
    if (!isUrlValid && !loading) {
      void fetchSignedUrl()
    }
  }, [error, fetchSignedUrl, loading, panelOpen, signedUrl, urlExpiresAt])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) {
      return
    }

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime || 0)
    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 0)
      setError(null) // Clear any previous errors when metadata loads
    }
    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)
    const handleEnded = () => {
      setIsPlaying(false)
      setCurrentTime(audio.duration || 0)
    }
    const handleError = (e: Event) => {
      const audioError = (e.target as HTMLAudioElement)?.error
      const audioElement = e.target as HTMLAudioElement
      let errorMessage = 'Failed to load audio file.'

      console.error('Audio element error:', {
        error: audioError,
        code: audioError?.code,
        message: audioError?.message,
        src: audioElement?.src,
        networkState: audioElement?.networkState,
        readyState: audioElement?.readyState,
        expectedPath: audioObjectPath,
        bucket: AUDIO_BUCKET,
      })

      if (audioError) {
        switch (audioError.code) {
          case MediaError.MEDIA_ERR_ABORTED:
            errorMessage = 'Audio loading was aborted.'
            break
          case MediaError.MEDIA_ERR_NETWORK:
            errorMessage = `Network error (400 Bad Request). This usually means:
1. Bucket name "${AUDIO_BUCKET}" doesn't match your Supabase bucket (check case/spelling)
2. File "${audioObjectPath}" doesn't exist in the bucket
3. Bucket is not public
Check URL: ${audioElement?.src?.substring(0, 120)}...`
            break
          case MediaError.MEDIA_ERR_DECODE:
            errorMessage =
              'Audio file could not be decoded. File may be corrupted or format not supported.'
            break
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMessage = `File not found (400 error). Please verify:
1. Bucket name "${AUDIO_BUCKET}" matches exactly (case-sensitive)
2. File "${audioObjectPath}" exists in bucket
3. Bucket is public
URL: ${audioElement?.src?.substring(0, 120)}...`
            break
        }
      } else {
        // Additional check for network state
        if (audioElement?.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) {
          errorMessage = `No audio source found. Verify file exists: ${audioElement?.src?.substring(0, 100)}...`
        }
      }
      setError(errorMessage)
      setIsPlaying(false)
    }
    const handleCanPlay = () => {
      setError(null)
    }

    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)
    audio.addEventListener('canplay', handleCanPlay)

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
      audio.removeEventListener('canplay', handleCanPlay)
    }
  }, [signedUrl, audioObjectPath])

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate
    }
  }, [playbackRate])

  const togglePlayback = async () => {
    const audio = audioRef.current
    if (!audio) {
      setError('Audio element not available.')
      return
    }
    if (audio.paused) {
      try {
        // Ensure audio is loaded before playing
        if (audio.readyState < 2) {
          // HAVE_CURRENT_DATA or higher needed
          await audio.load()
        }
        await audio.play()
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Unable to play audio. Please check your browser settings.'
        setError(message)
        console.error('Audio play error:', err)
      }
    } else {
      audio.pause()
    }
  }

  const handleSliderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current
    if (!audio) {
      return
    }
    const nextTime = Number(event.target.value)
    audio.currentTime = nextTime
    setCurrentTime(nextTime)
  }

  const handleTogglePanel = () => {
    setPanelOpen((prev) => !prev)
  }

  const renderStatus = () => {
    if (loading) {
      return (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Securing stream from Supabase…
        </div>
      )
    }

    if (error) {
      return (
        <div className="flex flex-col gap-2 text-xs text-red-500">
          <p>{error}</p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-3 text-xs"
              onClick={() => void fetchSignedUrl()}
            >
              Try again
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-3 text-xs"
              onClick={() => setPanelOpen(false)}
            >
              Close
            </Button>
          </div>
        </div>
      )
    }

    if (!signedUrl) {
      return (
        <p className="text-xs text-muted-foreground">
          Audio companion will appear here once the secure link is ready.
        </p>
      )
    }

    return (
      <div className="space-y-3">
        <audio
          ref={audioRef}
          src={signedUrl}
          preload="metadata"
          controls={false}
          controlsList="nodownload noplaybackrate noremoteplayback"
          className="hidden"
          playsInline
          crossOrigin="anonymous"
        />
        <div className="flex items-center gap-3">
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={togglePlayback}
            aria-label={isPlaying ? 'Pause audio companion' : 'Play audio companion'}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <div className="flex flex-1 flex-col gap-1">
            <input
              type="range"
              min={0}
              max={duration || 0}
              step="0.5"
              value={Math.min(currentTime, duration || 0)}
              onChange={handleSliderChange}
              className="h-1 w-full cursor-pointer appearance-none rounded-full bg-border accent-primary"
              aria-label="Audio timeline"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground/80">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground/80">
          <span className="uppercase tracking-[0.2em]">Speed</span>
          <div className="flex flex-wrap gap-1">
            {playbackRates.map((rate) => (
              <button
                key={rate}
                type="button"
                onClick={() => setPlaybackRate(rate)}
                className={cn(
                  'rounded-full border px-2 py-1 font-semibold transition',
                  playbackRate === rate
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-foreground/70 hover:border-foreground/40',
                )}
              >
                {rate.toFixed(rate % 1 === 0 ? 0 : 2).replace(/\.00$/, '')}x
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <HandoffContent>
      {
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:max-w-sm">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]"
              onClick={handleTogglePanel}
            >
              <Headphones className="h-4 w-4" aria-hidden="true" />
              {panelOpen ? 'Hide audio companion' : 'Listen to audio companion'}
            </Button>
            <Link
              href={`/board-prep/${chapter.slug}`}
              className="text-sm font-semibold text-primary transition hover:text-primary/80"
            >
              Enter module →
            </Link>
          </div>
          {panelOpen && (
            <div className="w-full rounded-2xl border border-border/60 bg-background/80 p-3 text-left shadow-sm">
              {renderStatus()}
              {signedUrl && (
                <p className="mt-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
                  Streaming only · downloads disabled
                </p>
              )}
            </div>
          )}
        </div>
      }
    </HandoffContent>
  )
}
