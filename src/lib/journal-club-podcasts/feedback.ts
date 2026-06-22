import {
  journalClubPodcastEpisodes,
  type JournalClubPodcastHub,
  type PodcastLanguage,
} from '@/data/journal-club-podcasts'
import { isPodcastLanguage } from '@/lib/journal-club-podcasts/audio'

export const JOURNAL_CLUB_PODCAST_FEEDBACK_TABLE = 'journal_club_podcast_feedback'

export const podcastRatingValues = [1, 2, 3, 4, 5] as const

export type PodcastRating = (typeof podcastRatingValues)[number]

export interface JournalClubPodcastFeedbackResolution {
  audioDialogRating: PodcastRating
  contentQualityRating: PodcastRating
  episodeId: string
  episodeTitle: string
  language: PodcastLanguage
  primaryHub: JournalClubPodcastHub
}

export function resolveJournalClubPodcastFeedback(
  input: unknown,
): JournalClubPodcastFeedbackResolution | null {
  if (!input || typeof input !== 'object') {
    return null
  }

  const record = input as Record<string, unknown>
  const episodeId = normalizeText(record.episodeId)
  const normalizedLanguage = normalizeText(record.language).toLowerCase()
  const contentQualityRating = normalizePodcastRating(record.contentQualityRating)
  const audioDialogRating = normalizePodcastRating(record.audioDialogRating)

  if (
    !episodeId ||
    !isPodcastLanguage(normalizedLanguage) ||
    !contentQualityRating ||
    !audioDialogRating
  ) {
    return null
  }

  const episode = journalClubPodcastEpisodes.find((item) => item.id === episodeId)

  if (!episode?.audio[normalizedLanguage]) {
    return null
  }

  return {
    audioDialogRating,
    contentQualityRating,
    episodeId,
    episodeTitle: episode.title,
    language: normalizedLanguage,
    primaryHub: episode.primaryHub,
  }
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizePodcastRating(value: unknown): PodcastRating | null {
  const rating = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN

  if (!Number.isInteger(rating) || !podcastRatingValues.includes(rating as PodcastRating)) {
    return null
  }

  return rating as PodcastRating
}
