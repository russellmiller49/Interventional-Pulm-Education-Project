'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ExternalLink,
  Languages,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Search,
  Star,
  Volume2,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/callout'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/cn'
import type {
  JournalClubPodcastEpisode,
  JournalClubPodcastHub,
  PodcastLanguage,
} from '@/data/journal-club-podcasts'
import type { PodcastPlaybackEventType } from '@/lib/journal-club-podcasts/usage'

interface JournalClubPodcastBrowserProps {
  episodes: JournalClubPodcastEpisode[]
  hubs: readonly JournalClubPodcastHub[]
  tags: string[]
}

const languageLabels: Record<PodcastLanguage, string> = {
  english: 'English',
  spanish: 'Spanish',
  mandarin: 'Mandarin',
  arabic: 'Arabic',
  korean: 'Korean',
}
const languageHighlightLabels = Object.values(languageLabels)

const playbackRates = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const
const ratingValues = [1, 2, 3, 4, 5] as const
const allHubFilter = 'all' as const
const playbackProgressIntervalMs = 30_000
const podcastPlaybackEndpoint = '/api/journal-club-podcasts/playback'
type HubFilter = JournalClubPodcastHub | typeof allHubFilter

export function JournalClubPodcastBrowser({
  episodes,
  hubs,
  tags,
}: JournalClubPodcastBrowserProps) {
  const [activeHub, setActiveHub] = useState<HubFilter>(allHubFilter)
  const [activeTag, setActiveTag] = useState<string>('all')
  const [query, setQuery] = useState('')
  const [activeEpisodeId, setActiveEpisodeId] = useState<string | null>(null)

  const hubCounts = useMemo(
    () =>
      hubs.reduce<Record<string, number>>((acc, hub) => {
        acc[hub] = episodes.filter((episode) => episode.primaryHub === hub).length
        return acc
      }, {}),
    [episodes, hubs],
  )

  const filteredEpisodes = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return episodes
      .filter((episode) => {
        if (activeHub !== allHubFilter && episode.primaryHub !== activeHub) {
          return false
        }

        if (activeTag !== 'all' && !episode.tags.includes(activeTag)) {
          return false
        }

        if (!normalizedQuery) {
          return true
        }

        const haystack = [episode.title, episode.citation, episode.synopsis, episode.tags.join(' ')]
          .join(' ')
          .toLowerCase()

        return haystack.includes(normalizedQuery)
      })
      .sort(comparePodcastTitles)
  }, [activeHub, activeTag, episodes, query])

  const visibleTags = useMemo(
    () =>
      activeHub === allHubFilter
        ? tags
        : tags.filter((tag) =>
            episodes.some(
              (episode) => episode.primaryHub === activeHub && episode.tags.includes(tag),
            ),
          ),
    [activeHub, episodes, tags],
  )

  return (
    <div className="container space-y-6 py-8 md:py-10">
      <section aria-labelledby="journal-club-podcasts" className="space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <Badge variant="info" className="w-fit">
              Beta audio library
            </Badge>
            <div className="space-y-2">
              <h1
                id="journal-club-podcasts"
                className="text-3xl font-semibold tracking-tight md:text-4xl"
              >
                Journal Club Podcasts
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
                Listen to article-focused interventional pulmonology discussions in English,
                Spanish, Mandarin, Arabic, or Korean.
              </p>
            </div>
          </div>
          <div className="w-full lg:max-w-md">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search articles, tags, or citations"
              aria-label="Search journal club podcasts"
              leadingIcon={<Search className="h-4 w-4" aria-hidden />}
            />
          </div>
        </div>

        <Callout
          variant="info"
          title="Beta listening note"
          className="rounded-lg border-sky-500/30 bg-sky-500/5 shadow-none"
        >
          These journal club podcasts are for entertainment, education, and general discussion only.
          They may contain errors, omissions, or outdated interpretations. Please verify details in
          the linked publication and current guidelines; this is not patient-specific medical
          advice.
        </Callout>

        <div className="rounded-lg border border-border/80 bg-muted/35 p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Languages className="h-5 w-5" aria-hidden />
              </span>
              <div className="space-y-1">
                <h2 className="text-sm font-semibold text-foreground">
                  Available in {languageHighlightLabels.length} languages
                </h2>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                  Every episode includes the same journal club discussion in each language. Choose
                  the language from the selector on any podcast player.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2" aria-label="Available podcast languages">
              {languageHighlightLabels.map((label) => (
                <span
                  key={label}
                  className="rounded-full border border-border bg-background px-3 py-1 text-sm font-medium text-foreground"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Podcast filters">
          <button
            type="button"
            onClick={() => {
              setActiveHub(allHubFilter)
              setActiveTag('all')
            }}
            className={cn(
              'min-h-10 shrink-0 rounded-full border px-4 py-2 text-left text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              activeHub === allHubFilter
                ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                : 'border-border bg-background text-foreground hover:bg-muted',
            )}
            aria-pressed={activeHub === allHubFilter}
          >
            <span>All podcasts</span>
            <span className="ml-2 text-xs opacity-75">{episodes.length}</span>
          </button>
          {hubs.map((hub) => {
            const isActive = activeHub === hub

            return (
              <button
                key={hub}
                type="button"
                onClick={() => {
                  setActiveHub(hub)
                  setActiveTag('all')
                }}
                className={cn(
                  'min-h-10 shrink-0 rounded-full border px-4 py-2 text-left text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  isActive
                    ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                    : 'border-border bg-background text-foreground hover:bg-muted',
                )}
                aria-pressed={isActive}
              >
                <span>{hub}</span>
                <span className="ml-2 text-xs opacity-75">{hubCounts[hub] ?? 0}</span>
              </button>
            )
          })}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Cross-tags">
          <TagButton label="All" active={activeTag === 'all'} onClick={() => setActiveTag('all')} />
          {visibleTags.map((tag) => (
            <TagButton
              key={tag}
              label={tag}
              active={activeTag === tag}
              onClick={() => setActiveTag(tag)}
            />
          ))}
        </div>
      </section>

      <section aria-live="polite" className="space-y-4">
        <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
          <p>
            {filteredEpisodes.length} episode{filteredEpisodes.length === 1 ? '' : 's'}
          </p>
          <p className="hidden sm:block">Streaming only. Direct downloads are not exposed.</p>
        </div>

        <div className="grid gap-4">
          {filteredEpisodes.map((episode) => (
            <article
              key={episode.id}
              className="rounded-lg border border-border/80 bg-card p-4 shadow-sm md:p-5"
            >
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
                <div className="min-w-0 space-y-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{episode.year}</Badge>
                      {episode.tags.slice(0, 6).map((tag) => (
                        <Badge key={tag} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    <h2 className="text-xl font-semibold tracking-tight text-foreground">
                      {episode.title}
                    </h2>
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">{episode.synopsis}</p>
                  <p className="text-xs leading-5 text-muted-foreground">{episode.citation}</p>
                  <a
                    href={episode.publicationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open publication for ${episode.title} in a new tab`}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-primary transition hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    Open publication
                    <ExternalLink className="h-4 w-4" aria-hidden />
                  </a>
                </div>
                <PodcastAudioPlayer
                  episode={episode}
                  isActive={activeEpisodeId === episode.id}
                  onActivate={() => setActiveEpisodeId(episode.id)}
                />
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

function comparePodcastTitles(a: JournalClubPodcastEpisode, b: JournalClubPodcastEpisode) {
  return a.title.localeCompare(b.title, undefined, {
    sensitivity: 'base',
  })
}

function TagButton({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'min-h-9 shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        active
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
      aria-pressed={active}
    >
      {label}
    </button>
  )
}

function PodcastAudioPlayer({
  episode,
  isActive,
  onActivate,
}: {
  episode: JournalClubPodcastEpisode
  isActive: boolean
  onActivate: () => void
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const activeListenStartedAtRef = useRef<number | null>(null)
  const currentTimeRef = useRef(0)
  const durationRef = useRef(0)
  const episodeIdRef = useRef(episode.id)
  const hasReportedPlaybackRef = useRef(false)
  const languageRef = useRef<PodcastLanguage>('english')
  const lastProgressSentAtRef = useRef(0)
  const listenedMsRef = useRef(0)
  const playbackRateRef = useRef(1)
  const playbackSessionIdRef = useRef(makePlaybackSessionId())
  const [language, setLanguage] = useState<PodcastLanguage>('english')
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [urlExpiresAt, setUrlExpiresAt] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [feedbackLanguage, setFeedbackLanguage] = useState<PodcastLanguage>('english')
  const [contentQualityRating, setContentQualityRating] = useState<number | null>(null)
  const [audioDialogRating, setAudioDialogRating] = useState<number | null>(null)
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [feedbackError, setFeedbackError] = useState<string | null>(null)
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)

  currentTimeRef.current = currentTime
  durationRef.current = duration
  episodeIdRef.current = episode.id
  languageRef.current = language
  playbackRateRef.current = playbackRate

  const resetPlaybackTelemetry = useCallback(() => {
    activeListenStartedAtRef.current = null
    hasReportedPlaybackRef.current = false
    lastProgressSentAtRef.current = 0
    listenedMsRef.current = 0
    playbackSessionIdRef.current = makePlaybackSessionId()
  }, [])

  const currentListenedSeconds = useCallback((now = Date.now()) => {
    const activeMs =
      activeListenStartedAtRef.current === null
        ? 0
        : Math.max(0, now - activeListenStartedAtRef.current)

    return Math.max(0, Math.round((listenedMsRef.current + activeMs) / 1000))
  }, [])

  const captureActiveListening = useCallback((now = Date.now()) => {
    if (activeListenStartedAtRef.current === null) {
      return
    }

    listenedMsRef.current += Math.max(0, now - activeListenStartedAtRef.current)
    activeListenStartedAtRef.current = null
  }, [])

  const getPlaybackSnapshot = useCallback(() => {
    const audio = audioRef.current
    const rawDuration = audio?.duration
    const boundedDuration =
      typeof rawDuration === 'number' && Number.isFinite(rawDuration) && rawDuration > 0
        ? rawDuration
        : durationRef.current > 0
          ? durationRef.current
          : null
    const rawCurrentTime = audio?.currentTime ?? currentTimeRef.current
    const currentTimeSeconds = Math.max(0, Math.round(rawCurrentTime || 0))
    const durationSeconds =
      boundedDuration === null ? null : Math.max(0, Math.round(boundedDuration))
    const percentComplete =
      durationSeconds && durationSeconds > 0
        ? Math.max(0, Math.min(100, Math.round((currentTimeSeconds / durationSeconds) * 100)))
        : 0

    return {
      currentTimeSeconds,
      durationSeconds,
      listenedSeconds: currentListenedSeconds(),
      percentComplete,
      playbackSessionId: playbackSessionIdRef.current,
    }
  }, [currentListenedSeconds])

  const reportPlaybackEvent = useCallback(
    (eventType: PodcastPlaybackEventType, options?: { beacon?: boolean }) => {
      if (eventType !== 'play_started' && !hasReportedPlaybackRef.current) {
        return
      }

      hasReportedPlaybackRef.current = true

      postPodcastPlaybackEvent(
        {
          ...getPlaybackSnapshot(),
          episodeId: episodeIdRef.current,
          eventType,
          language: languageRef.current,
          playbackRate: playbackRateRef.current,
        },
        options,
      )
    },
    [getPlaybackSnapshot],
  )

  useEffect(() => {
    if (!isActive && audioRef.current) {
      audioRef.current.pause()
    }
  }, [isActive])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) {
      return
    }

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime || 0)

      const now = Date.now()
      if (
        !audio.paused &&
        hasReportedPlaybackRef.current &&
        now - lastProgressSentAtRef.current >= playbackProgressIntervalMs
      ) {
        lastProgressSentAtRef.current = now
        reportPlaybackEvent('play_progress')
      }
    }
    const handleLoadedMetadata = () => setDuration(audio.duration || 0)
    const handlePlay = () => {
      setIsPlaying(true)
      if (activeListenStartedAtRef.current === null) {
        activeListenStartedAtRef.current = Date.now()
      }
      lastProgressSentAtRef.current = Date.now()
      reportPlaybackEvent('play_started')
    }
    const handlePause = () => {
      setIsPlaying(false)
      if (!audio.ended) {
        captureActiveListening()
        reportPlaybackEvent('play_paused')
      }
    }
    const handleEnded = () => {
      captureActiveListening()
      setIsPlaying(false)
      setCurrentTime(audio.duration || 0)
      reportPlaybackEvent('play_completed')
    }
    const handleError = () => {
      setError('Audio could not be loaded. Try again in a moment.')
      setIsPlaying(false)
    }

    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
    }
  }, [captureActiveListening, reportPlaybackEvent, signedUrl])

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate
    }
  }, [playbackRate])

  useEffect(() => {
    function handlePageHide() {
      captureActiveListening()
      reportPlaybackEvent('play_paused', { beacon: true })
    }

    window.addEventListener('pagehide', handlePageHide)

    return () => {
      window.removeEventListener('pagehide', handlePageHide)
    }
  }, [captureActiveListening, reportPlaybackEvent])

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    setSignedUrl(null)
    setUrlExpiresAt(null)
    setCurrentTime(0)
    setDuration(0)
    setError(null)
    setIsPlaying(false)
    resetPlaybackTelemetry()
  }, [episode.id, language, resetPlaybackTelemetry])

  useEffect(() => {
    setFeedbackLanguage(language)
  }, [language])

  useEffect(() => {
    setContentQualityRating(null)
    setAudioDialogRating(null)
    setFeedbackError(null)
    setFeedbackMessage(null)
  }, [episode.id])

  async function ensureSignedUrl() {
    const isUrlFresh = signedUrl && urlExpiresAt && urlExpiresAt - Date.now() > 5000
    if (isUrlFresh) {
      return signedUrl
    }

    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        episodeId: episode.id,
        language,
      })
      const response = await fetch(`/api/journal-club-podcasts/audio-url?${params.toString()}`, {
        cache: 'no-store',
      })
      const payload = (await response.json().catch(() => ({}))) as {
        url?: string
        expiresIn?: number
        error?: string
      }

      if (!response.ok || !payload.url) {
        throw new Error(payload.error ?? 'Unable to load this podcast audio stream.')
      }

      const expiresIn = Number.isFinite(payload.expiresIn) ? Number(payload.expiresIn) : 60 * 30
      setSignedUrl(payload.url)
      setUrlExpiresAt(Date.now() + expiresIn * 1000)
      return payload.url
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to load this podcast audio stream.'
      setError(message)
      setSignedUrl(null)
      setUrlExpiresAt(null)
      return null
    } finally {
      setLoading(false)
    }
  }

  async function togglePlayback() {
    const audio = audioRef.current
    if (!audio) {
      return
    }

    if (!audio.paused) {
      audio.pause()
      return
    }

    onActivate()
    const url = await ensureSignedUrl()
    if (!url) {
      return
    }

    try {
      if (audio.src !== url) {
        audio.src = url
        audio.load()
      }
      audio.playbackRate = playbackRate
      await audio.play()
    } catch {
      setError('Unable to start playback. Check browser audio permissions and try again.')
      setIsPlaying(false)
    }
  }

  function handleTimelineChange(event: React.ChangeEvent<HTMLInputElement>) {
    const audio = audioRef.current
    const nextTime = Number(event.target.value)
    if (audio) {
      audio.currentTime = nextTime
    }
    setCurrentTime(nextTime)
  }

  function seekBy(deltaSeconds: number) {
    const audio = audioRef.current
    const audioDuration = audio?.duration
    const boundedDuration =
      typeof audioDuration === 'number' && Number.isFinite(audioDuration) && audioDuration > 0
        ? audioDuration
        : duration
    let nextTime = Math.max((audio?.currentTime ?? currentTime) + deltaSeconds, 0)

    if (boundedDuration > 0) {
      nextTime = Math.min(nextTime, boundedDuration)
    }

    if (audio) {
      audio.currentTime = nextTime
    }
    setCurrentTime(nextTime)
  }

  async function submitFeedback(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!contentQualityRating || !audioDialogRating) {
      setFeedbackError('Choose a rating for content and audio/dialog quality.')
      setFeedbackMessage(null)
      return
    }

    setFeedbackLoading(true)
    setFeedbackError(null)
    setFeedbackMessage(null)

    try {
      const playbackSnapshot = getPlaybackSnapshot()
      const response = await fetch('/api/journal-club-podcasts/feedback', {
        body: JSON.stringify({
          audioDialogRating,
          contentQualityRating,
          episodeId: episode.id,
          language: feedbackLanguage,
          ...playbackSnapshot,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      })
      const payload = (await response.json().catch(() => ({}))) as { error?: string }

      if (!response.ok) {
        throw new Error(payload.error ?? 'Unable to save this rating.')
      }

      setFeedbackMessage('Thanks. Your rating was saved.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to save this rating.'
      setFeedbackError(message)
    } finally {
      setFeedbackLoading(false)
    }
  }

  return (
    <div className="rounded-lg border border-border/70 bg-background p-4">
      <audio
        ref={audioRef}
        preload="metadata"
        controls={false}
        controlsList="nodownload noplaybackrate noremoteplayback"
        playsInline
        className="hidden"
      />

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Volume2 className="h-4 w-4 text-primary" aria-hidden />
            Listen
          </div>
          <label className="sr-only" htmlFor={`${episode.id}-language`}>
            Language
          </label>
          <select
            id={`${episode.id}-language`}
            value={language}
            onChange={(event) => setLanguage(event.target.value as PodcastLanguage)}
            className="h-9 rounded-full border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {Object.entries(languageLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={() => void togglePlayback()}
            aria-label={isPlaying ? `Pause ${episode.title}` : `Play ${episode.title}`}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : isPlaying ? (
              <Pause className="h-4 w-4" aria-hidden />
            ) : (
              <Play className="h-4 w-4" aria-hidden />
            )}
          </Button>
          <div className="min-w-0 flex-1 space-y-1">
            <input
              type="range"
              min={0}
              max={duration || 0}
              step="0.5"
              value={Math.min(currentTime, duration || 0)}
              onChange={handleTimelineChange}
              className="h-1 w-full cursor-pointer appearance-none rounded-full bg-border accent-primary"
              aria-label={`Playback position for ${episode.title}`}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5" aria-label={`Seek controls for ${episode.title}`}>
          <SeekButton seconds={-30} title={episode.title} onSeek={seekBy} />
          <SeekButton seconds={-10} title={episode.title} onSeek={seekBy} />
          <SeekButton seconds={10} title={episode.title} onSeek={seekBy} />
          <SeekButton seconds={30} title={episode.title} onSeek={seekBy} />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Speed
          </p>
          <div className="flex flex-wrap gap-1.5">
            {playbackRates.map((rate) => (
              <button
                key={rate}
                type="button"
                onClick={() => setPlaybackRate(rate)}
                className={cn(
                  'min-h-8 rounded-full border px-2.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  playbackRate === rate
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
                aria-pressed={playbackRate === rate}
              >
                {formatRate(rate)}
              </button>
            ))}
          </div>
        </div>

        {error ? <p className="text-sm leading-5 text-destructive">{error}</p> : null}
        <p className="text-xs leading-5 text-muted-foreground">
          Streaming only. Browser download controls are disabled.
        </p>

        <form
          onSubmit={(event) => void submitFeedback(event)}
          className="space-y-3 border-t border-border/70 pt-4"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Rate this podcast</p>
              <p className="text-xs leading-5 text-muted-foreground">
                Two quick ratings help improve the beta audio library.
              </p>
            </div>
            <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
              Language used
              <select
                value={feedbackLanguage}
                onChange={(event) => setFeedbackLanguage(event.target.value as PodcastLanguage)}
                className="h-9 rounded-md border border-border bg-background px-2 text-sm font-normal text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {Object.entries(languageLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <RatingStars
            label="Content quality"
            value={contentQualityRating}
            onChange={(value) => setContentQualityRating(value)}
          />
          <RatingStars
            label="Audio/dialog quality"
            value={audioDialogRating}
            onChange={(value) => setAudioDialogRating(value)}
          />

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="submit"
              size="sm"
              variant="outline"
              disabled={feedbackLoading || !contentQualityRating || !audioDialogRating}
            >
              {feedbackLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Saving
                </>
              ) : (
                'Submit rating'
              )}
            </Button>
            {feedbackMessage ? (
              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                {feedbackMessage}
              </p>
            ) : null}
          </div>

          {feedbackError ? (
            <p className="text-xs leading-5 text-destructive">{feedbackError}</p>
          ) : null}
        </form>
      </div>
    </div>
  )
}

function RatingStars({
  label,
  onChange,
  value,
}: {
  label: string
  onChange: (value: number) => void
  value: number | null
}) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </legend>
      <div className="flex gap-1" aria-label={label}>
        {ratingValues.map((rating) => {
          const selected = value === rating
          const filled = value !== null && rating <= value

          return (
            <button
              key={rating}
              type="button"
              onClick={() => onChange(rating)}
              aria-label={`${label}: ${rating} out of 5 stars`}
              aria-pressed={selected}
              className={cn(
                'inline-flex h-8 w-8 items-center justify-center rounded-full border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                selected
                  ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-300'
                  : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Star
                className={cn('h-4 w-4', filled ? 'fill-current' : 'fill-transparent')}
                aria-hidden
              />
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

function SeekButton({
  onSeek,
  seconds,
  title,
}: {
  onSeek: (seconds: number) => void
  seconds: number
  title: string
}) {
  const Icon = seconds < 0 ? RotateCcw : RotateCw
  const direction = seconds < 0 ? 'Rewind' : 'Advance'
  const amount = Math.abs(seconds)

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      onClick={() => onSeek(seconds)}
      aria-label={`${direction} ${amount} seconds for ${title}`}
      className="h-8 min-w-[4rem] border border-border/70 px-2.5 text-xs text-muted-foreground hover:text-foreground"
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      <span>{seconds > 0 ? `+${amount}s` : `-${amount}s`}</span>
    </Button>
  )
}

interface PodcastPlaybackPayload {
  currentTimeSeconds: number
  durationSeconds: number | null
  episodeId: string
  eventType: PodcastPlaybackEventType
  language: PodcastLanguage
  listenedSeconds: number
  playbackRate: number
  playbackSessionId: string
  percentComplete: number
}

function makePlaybackSessionId() {
  const browserCrypto = typeof globalThis.crypto === 'undefined' ? null : globalThis.crypto

  if (browserCrypto?.randomUUID) {
    return browserCrypto.randomUUID()
  }

  const bytes = new Uint8Array(16)
  if (browserCrypto?.getRandomValues) {
    browserCrypto.getRandomValues(bytes)
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256)
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(
    16,
    20,
  )}-${hex.slice(20)}`
}

function postPodcastPlaybackEvent(payload: PodcastPlaybackPayload, options?: { beacon?: boolean }) {
  const body = JSON.stringify(payload)

  if (options?.beacon && typeof navigator !== 'undefined' && navigator.sendBeacon) {
    const blob = new Blob([body], { type: 'application/json' })
    navigator.sendBeacon(podcastPlaybackEndpoint, blob)
    return
  }

  void fetch(podcastPlaybackEndpoint, {
    body,
    cache: 'no-store',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
    },
    keepalive: options?.beacon,
    method: 'POST',
  }).catch(() => {
    // Podcast telemetry should never interrupt playback.
  })
}

function formatTime(totalSeconds: number) {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return '0:00'
  }

  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.floor(totalSeconds % 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function formatRate(rate: number) {
  return `${rate
    .toFixed(rate % 1 === 0 ? 0 : 2)
    .replace(/0$/, '')
    .replace(/\\.$/, '')}x`
}
