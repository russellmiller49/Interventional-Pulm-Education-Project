/**
 * @jest-environment node
 */

import { createSupabaseAdmin } from '@/lib/supabase/admin'

import { POST } from './route'

jest.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdmin: jest.fn(),
}))

const playbackSessionId = '550e8400-e29b-41d4-a716-446655440000'

describe('journal club podcast playback API', () => {
  const createSupabaseAdminMock = createSupabaseAdmin as jest.Mock

  beforeEach(() => {
    createSupabaseAdminMock.mockReset()
  })

  it('rejects invalid playback payloads before writing to Supabase', async () => {
    const response = await POST(
      new Request('http://localhost/api/journal-club-podcasts/playback', {
        body: JSON.stringify({
          eventType: 'play_started',
          episodeId: 'navigation-vs-ttnb',
          language: 'french',
          playbackSessionId,
        }),
        method: 'POST',
      }),
    )

    expect(response.status).toBe(400)
    expect(createSupabaseAdminMock).not.toHaveBeenCalled()
  })

  it('reports missing server credentials without exposing table writes', async () => {
    createSupabaseAdminMock.mockReturnValue(null)

    const response = await POST(validPlaybackRequest())

    expect(response.status).toBe(501)
  })

  it('upserts validated playback progress through the service-role route', async () => {
    const maybeSingle = jest.fn().mockResolvedValue({
      data: {
        completed_at: null,
        duration_seconds: 600,
        listened_seconds: 60,
        max_percent_complete: 10,
        max_position_seconds: 60,
        play_count: 1,
        progress_event_count: 2,
        started_at: '2026-06-22T19:00:00.000Z',
      },
      error: null,
    })
    const eq = jest.fn().mockReturnValue({ maybeSingle })
    const select = jest.fn().mockReturnValue({ eq })
    const upsert = jest.fn().mockResolvedValue({ error: null })
    const from = jest.fn().mockReturnValue({ select, upsert })
    createSupabaseAdminMock.mockReturnValue({ from })

    const response = await POST(validPlaybackRequest())

    expect(response.status).toBe(201)
    expect(from).toHaveBeenCalledWith('journal_club_podcast_listens')
    expect(eq).toHaveBeenCalledWith('playback_session_id', playbackSessionId)
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        duration_seconds: 600,
        episode_id: 'navigation-vs-ttnb',
        language: 'korean',
        last_event_type: 'play_progress',
        listened_seconds: 120,
        max_percent_complete: 20,
        max_position_seconds: 120,
        playback_rate: 1.25,
        playback_session_id: playbackSessionId,
        play_count: 1,
        primary_hub: 'Lung Nodules, Early Lung Cancer & Staging',
        progress_event_count: 3,
        route_path: '/journal-club-podcasts',
        started_at: '2026-06-22T19:00:00.000Z',
        user_agent: 'jest',
      }),
      { onConflict: 'playback_session_id' },
    )
  })
})

function validPlaybackRequest() {
  return new Request('http://localhost/api/journal-club-podcasts/playback', {
    body: JSON.stringify({
      currentTimeSeconds: 120,
      durationSeconds: 600,
      eventType: 'play_progress',
      episodeId: 'navigation-vs-ttnb',
      language: 'korean',
      listenedSeconds: 120,
      playbackRate: 1.25,
      playbackSessionId,
    }),
    headers: {
      'content-type': 'application/json',
      'user-agent': 'jest',
    },
    method: 'POST',
  })
}
