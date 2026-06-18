import {
  journalClubPodcastEpisodes,
  podcastLanguages,
  type PodcastLanguage,
} from '@/data/journal-club-podcasts'

export const JOURNAL_CLUB_PODCAST_BUCKET =
  process.env.JOURNAL_CLUB_PODCAST_BUCKET || 'journal-club-podcasts'

export const DEFAULT_JOURNAL_CLUB_AUDIO_TTL_SECONDS = 60 * 30

const podcastLanguageSet = new Set<string>(podcastLanguages)

export interface PodcastAudioResolution {
  episodeId: string
  language: PodcastLanguage
  objectPath: string
}

export function isPodcastLanguage(value: string | null | undefined): value is PodcastLanguage {
  return typeof value === 'string' && podcastLanguageSet.has(value)
}

export function resolveJournalClubAudioPath(
  episodeId: string | null | undefined,
  language: string | null | undefined,
): PodcastAudioResolution | null {
  const normalizedEpisodeId = episodeId?.trim()
  const normalizedLanguage = language?.trim().toLowerCase()

  if (!normalizedEpisodeId || !isPodcastLanguage(normalizedLanguage)) {
    return null
  }

  const episode = journalClubPodcastEpisodes.find((item) => item.id === normalizedEpisodeId)
  const objectPath = episode?.audio[normalizedLanguage]

  if (!episode || !objectPath || !isValidManifestAudioPath(objectPath, normalizedEpisodeId)) {
    return null
  }

  return {
    episodeId: normalizedEpisodeId,
    language: normalizedLanguage,
    objectPath,
  }
}

export function resolveJournalClubAudioTtl(rawValue?: string | null) {
  const parsed = Number(rawValue ?? process.env.JOURNAL_CLUB_PODCAST_SIGNED_URL_TTL_SECONDS)

  if (!Number.isFinite(parsed)) {
    return DEFAULT_JOURNAL_CLUB_AUDIO_TTL_SECONDS
  }

  return Math.min(Math.max(Math.floor(parsed), 60), 60 * 60)
}

function isValidManifestAudioPath(path: string, episodeId: string) {
  return (
    path === path.trim() &&
    path.startsWith(`v1/${episodeId}/`) &&
    path.endsWith('.mp3') &&
    !path.includes('..') &&
    !path.includes('.pdf') &&
    !path.includes('.txt')
  )
}
