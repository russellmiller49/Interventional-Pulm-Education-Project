import {
  JOURNAL_CLUB_PODCAST_LISTENS_TABLE,
  podcastPlaybackEventTypes,
  resolveJournalClubPodcastPlayback,
  resolveJournalClubPodcastPlaybackContext,
} from '@/lib/journal-club-podcasts/usage'

const playbackSessionId = '550e8400-e29b-41d4-a716-446655440000'

describe('journal club podcast usage resolver', () => {
  it('resolves a validated playback event for a manifest episode and language', () => {
    expect(
      resolveJournalClubPodcastPlayback({
        currentTimeSeconds: 120.3,
        durationSeconds: 600,
        eventType: 'play_progress',
        episodeId: 'navigation-vs-ttnb',
        language: 'Spanish',
        listenedSeconds: 118.8,
        playbackRate: 1.25,
        playbackSessionId,
      }),
    ).toMatchObject({
      currentTimeSeconds: 120,
      durationSeconds: 600,
      episodeId: 'navigation-vs-ttnb',
      eventType: 'play_progress',
      language: 'spanish',
      listenedSeconds: 119,
      percentComplete: 20,
      playbackRate: 1.25,
      playbackSessionId,
      primaryHub: 'Lung Nodules, Early Lung Cancer & Staging',
    })
  })

  it('keeps playback events and table names stable for migrations and API routes', () => {
    expect(JOURNAL_CLUB_PODCAST_LISTENS_TABLE).toBe('journal_club_podcast_listens')
    expect(podcastPlaybackEventTypes).toEqual([
      'play_started',
      'play_progress',
      'play_paused',
      'play_completed',
      'play_seeked',
    ])
  })

  it('supports optional playback context for feedback payloads', () => {
    expect(
      resolveJournalClubPodcastPlaybackContext({
        currentTimeSeconds: '91',
        durationSeconds: '200',
        listenedSeconds: '45',
        playbackSessionId,
      }),
    ).toEqual({
      currentTimeSeconds: 91,
      durationSeconds: 200,
      listenedSeconds: 45,
      percentComplete: 46,
      playbackSessionId,
    })
  })

  it('rejects invalid sessions, unknown episodes, unsupported languages, and out-of-range values', () => {
    expect(
      resolveJournalClubPodcastPlayback({
        eventType: 'play_started',
        episodeId: 'navigation-vs-ttnb',
        language: 'english',
        playbackSessionId: 'not-a-uuid',
      }),
    ).toBeNull()
    expect(
      resolveJournalClubPodcastPlayback({
        eventType: 'play_started',
        episodeId: 'not-real',
        language: 'english',
        playbackSessionId,
      }),
    ).toBeNull()
    expect(
      resolveJournalClubPodcastPlayback({
        eventType: 'play_started',
        episodeId: 'navigation-vs-ttnb',
        language: 'french',
        playbackSessionId,
      }),
    ).toBeNull()
    expect(
      resolveJournalClubPodcastPlayback({
        currentTimeSeconds: -1,
        eventType: 'play_started',
        episodeId: 'navigation-vs-ttnb',
        language: 'english',
        playbackSessionId,
      }),
    ).toBeNull()
  })
})
