'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ExternalLink,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Search,
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

const playbackRates = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const
const allHubFilter = 'all' as const
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
  const [language, setLanguage] = useState<PodcastLanguage>('english')
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [urlExpiresAt, setUrlExpiresAt] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [playbackRate, setPlaybackRate] = useState(1)

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

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime || 0)
    const handleLoadedMetadata = () => setDuration(audio.duration || 0)
    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)
    const handleEnded = () => {
      setIsPlaying(false)
      setCurrentTime(audio.duration || 0)
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
  }, [signedUrl])

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate
    }
  }, [playbackRate])

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
  }, [episode.id, language])

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
      </div>
    </div>
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
