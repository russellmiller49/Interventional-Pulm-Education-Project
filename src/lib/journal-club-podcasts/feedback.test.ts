import {
  podcastRatingValues,
  resolveJournalClubPodcastFeedback,
} from '@/lib/journal-club-podcasts/feedback'

describe('journal club podcast feedback resolver', () => {
  const playbackSessionId = '550e8400-e29b-41d4-a716-446655440000'

  it('resolves valid feedback for a manifest episode and language', () => {
    expect(
      resolveJournalClubPodcastFeedback({
        audioDialogRating: 4,
        contentQualityRating: 5,
        episodeId: 'navigation-vs-ttnb',
        language: 'Korean',
      }),
    ).toMatchObject({
      audioDialogRating: 4,
      contentQualityRating: 5,
      episodeId: 'navigation-vs-ttnb',
      language: 'korean',
      playbackSessionId: null,
      primaryHub: 'Lung Nodules, Early Lung Cancer & Staging',
    })
  })

  it('accepts numeric string ratings from form-like payloads', () => {
    expect(
      resolveJournalClubPodcastFeedback({
        audioDialogRating: '3',
        contentQualityRating: '4',
        episodeId: 'navigation-vs-ttnb',
        language: 'english',
      }),
    ).toMatchObject({
      audioDialogRating: 3,
      contentQualityRating: 4,
    })
  })

  it('preserves playback context when feedback is submitted after listening', () => {
    expect(
      resolveJournalClubPodcastFeedback({
        audioDialogRating: 4,
        contentQualityRating: 5,
        currentTimeSeconds: 120,
        durationSeconds: 600,
        episodeId: 'navigation-vs-ttnb',
        language: 'english',
        listenedSeconds: 110,
        playbackSessionId,
      }),
    ).toMatchObject({
      currentTimeSeconds: 120,
      durationSeconds: 600,
      listenedSeconds: 110,
      percentComplete: 20,
      playbackSessionId,
    })
  })

  it('keeps the supported rating scale at 1 through 5', () => {
    expect(podcastRatingValues).toEqual([1, 2, 3, 4, 5])
  })

  it('rejects unknown episodes, unsupported languages, and invalid ratings', () => {
    expect(
      resolveJournalClubPodcastFeedback({
        audioDialogRating: 4,
        contentQualityRating: 5,
        episodeId: 'not-real',
        language: 'english',
      }),
    ).toBeNull()
    expect(
      resolveJournalClubPodcastFeedback({
        audioDialogRating: 4,
        contentQualityRating: 5,
        episodeId: 'navigation-vs-ttnb',
        language: 'french',
      }),
    ).toBeNull()
    expect(
      resolveJournalClubPodcastFeedback({
        audioDialogRating: 0,
        contentQualityRating: 5,
        episodeId: 'navigation-vs-ttnb',
        language: 'english',
      }),
    ).toBeNull()
    expect(
      resolveJournalClubPodcastFeedback({
        audioDialogRating: 4,
        contentQualityRating: 6,
        episodeId: 'navigation-vs-ttnb',
        language: 'english',
      }),
    ).toBeNull()
    expect(
      resolveJournalClubPodcastFeedback({
        audioDialogRating: 4,
        contentQualityRating: 5,
        episodeId: 'navigation-vs-ttnb',
        language: 'english',
        playbackSessionId: 'not-a-uuid',
      }),
    ).toBeNull()
  })
})
