/**
 * @jest-environment node
 */

import { createSupabaseAdmin } from '@/lib/supabase/admin'

import { POST } from './route'

jest.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdmin: jest.fn(),
}))

describe('journal club podcast feedback API', () => {
  const createSupabaseAdminMock = createSupabaseAdmin as jest.Mock

  beforeEach(() => {
    createSupabaseAdminMock.mockReset()
  })

  it('rejects invalid feedback payloads before writing to Supabase', async () => {
    const response = await POST(
      new Request('http://localhost/api/journal-club-podcasts/feedback', {
        body: JSON.stringify({
          audioDialogRating: 5,
          contentQualityRating: 5,
          episodeId: 'navigation-vs-ttnb',
          language: 'french',
        }),
        method: 'POST',
      }),
    )

    expect(response.status).toBe(400)
    expect(createSupabaseAdminMock).not.toHaveBeenCalled()
  })

  it('reports missing server credentials without exposing table writes', async () => {
    createSupabaseAdminMock.mockReturnValue(null)

    const response = await POST(validFeedbackRequest())

    expect(response.status).toBe(501)
  })

  it('saves validated feedback through the service-role route', async () => {
    const insert = jest.fn().mockResolvedValue({ error: null })
    const from = jest.fn().mockReturnValue({ insert })
    createSupabaseAdminMock.mockReturnValue({ from })

    const response = await POST(validFeedbackRequest())

    expect(response.status).toBe(201)
    expect(from).toHaveBeenCalledWith('journal_club_podcast_feedback')
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        audio_dialog_rating: 4,
        content_quality_rating: 5,
        episode_id: 'navigation-vs-ttnb',
        language: 'korean',
        primary_hub: 'Lung Nodules, Early Lung Cancer & Staging',
        route_path: '/journal-club-podcasts',
        user_agent: 'jest',
      }),
    )
  })
})

function validFeedbackRequest() {
  return new Request('http://localhost/api/journal-club-podcasts/feedback', {
    body: JSON.stringify({
      audioDialogRating: 4,
      contentQualityRating: 5,
      episodeId: 'navigation-vs-ttnb',
      language: 'korean',
    }),
    headers: {
      'content-type': 'application/json',
      'user-agent': 'jest',
    },
    method: 'POST',
  })
}
