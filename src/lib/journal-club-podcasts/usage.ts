import {
  journalClubPodcastEpisodes,
  type JournalClubPodcastHub,
  type PodcastLanguage,
} from '@/data/journal-club-podcasts'
import { isPodcastLanguage } from '@/lib/journal-club-podcasts/audio'

export const JOURNAL_CLUB_PODCAST_LISTENS_TABLE = 'journal_club_podcast_listens'

export const podcastPlaybackEventTypes = [
  'play_started',
  'play_progress',
  'play_paused',
  'play_completed',
  'play_seeked',
] as const

export type PodcastPlaybackEventType = (typeof podcastPlaybackEventTypes)[number]

export interface JournalClubPodcastPlaybackContext {
  currentTimeSeconds: number | null
  durationSeconds: number | null
  listenedSeconds: number | null
  percentComplete: number | null
  playbackSessionId: string | null
}

export interface JournalClubPodcastPlaybackResolution extends JournalClubPodcastPlaybackContext {
  currentTimeSeconds: number
  eventType: PodcastPlaybackEventType
  episodeId: string
  episodeTitle: string
  language: PodcastLanguage
  listenedSeconds: number
  percentComplete: number
  playbackRate: number
  playbackSessionId: string
  primaryHub: JournalClubPodcastHub
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const maxPodcastSeconds = 86_400
const playbackEventSet = new Set<string>(podcastPlaybackEventTypes)

export function resolveJournalClubPodcastPlayback(
  input: unknown,
): JournalClubPodcastPlaybackResolution | null {
  if (!input || typeof input !== 'object') {
    return null
  }

  const record = input as Record<string, unknown>
  const episodeId = normalizeText(record.episodeId)
  const normalizedLanguage = normalizeText(record.language).toLowerCase()
  const eventType = normalizePlaybackEventType(record.eventType)
  const playbackSessionId = normalizeUuid(record.playbackSessionId)
  const context = resolveJournalClubPodcastPlaybackContext(record)
  const playbackRate = normalizePlaybackRate(record.playbackRate)

  if (
    !episodeId ||
    !isPodcastLanguage(normalizedLanguage) ||
    !eventType ||
    !playbackSessionId ||
    !context ||
    playbackRate === null
  ) {
    return null
  }

  const episode = journalClubPodcastEpisodes.find((item) => item.id === episodeId)

  if (!episode?.audio[normalizedLanguage]) {
    return null
  }

  return {
    ...context,
    currentTimeSeconds: context.currentTimeSeconds ?? 0,
    eventType,
    episodeId,
    episodeTitle: episode.title,
    language: normalizedLanguage,
    listenedSeconds: context.listenedSeconds ?? 0,
    percentComplete: context.percentComplete ?? 0,
    playbackRate,
    playbackSessionId,
    primaryHub: episode.primaryHub,
  }
}

export function resolveJournalClubPodcastPlaybackContext(
  input: Record<string, unknown>,
): JournalClubPodcastPlaybackContext | null {
  const hasPlaybackSessionId = Object.hasOwn(input, 'playbackSessionId')
  const playbackSessionId = hasPlaybackSessionId ? normalizeUuid(input.playbackSessionId) : null

  if (hasPlaybackSessionId && !playbackSessionId) {
    return null
  }

  const currentTimeSeconds = normalizeOptionalSeconds(input.currentTimeSeconds)
  const durationSeconds = normalizeOptionalSeconds(input.durationSeconds)
  const listenedSeconds = normalizeOptionalSeconds(input.listenedSeconds)
  const rawPercentComplete = normalizeOptionalPercent(input.percentComplete)

  if (
    currentTimeSeconds === false ||
    durationSeconds === false ||
    listenedSeconds === false ||
    rawPercentComplete === false
  ) {
    return null
  }

  const percentComplete =
    rawPercentComplete ??
    (currentTimeSeconds !== null && durationSeconds !== null && durationSeconds > 0
      ? clampPercent(Math.round((currentTimeSeconds / durationSeconds) * 100))
      : null)

  return {
    currentTimeSeconds,
    durationSeconds,
    listenedSeconds,
    percentComplete,
    playbackSessionId,
  }
}

function normalizePlaybackEventType(value: unknown): PodcastPlaybackEventType | null {
  const eventType = normalizeText(value)
  return playbackEventSet.has(eventType) ? (eventType as PodcastPlaybackEventType) : null
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeUuid(value: unknown) {
  const uuid = normalizeText(value)
  return uuidPattern.test(uuid) ? uuid : null
}

function normalizeOptionalSeconds(value: unknown): number | null | false {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const seconds =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN

  if (!Number.isFinite(seconds) || seconds < 0 || seconds > maxPodcastSeconds) {
    return false
  }

  return Math.round(seconds)
}

function normalizeOptionalPercent(value: unknown): number | null | false {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const percent =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN

  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    return false
  }

  return clampPercent(Math.round(percent))
}

function normalizePlaybackRate(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return 1
  }

  const rate = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN

  if (!Number.isFinite(rate) || rate < 0.25 || rate > 4) {
    return null
  }

  return Math.round(rate * 100) / 100
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value))
}
