/**
 * @jest-environment node
 */

import { createSupabaseAdmin } from '@/lib/supabase/admin'
import { supabaseServer } from '@/lib/supabase/server'

import { GET } from './route'

jest.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdmin: jest.fn(),
}))

jest.mock('@/lib/supabase/server', () => ({
  supabaseServer: jest.fn(),
}))

describe('journal club podcast audio URL API', () => {
  const createSupabaseAdminMock = createSupabaseAdmin as jest.Mock
  const supabaseServerMock = supabaseServer as jest.Mock

  beforeEach(() => {
    createSupabaseAdminMock.mockReset()
    supabaseServerMock.mockReset()
    supabaseServerMock.mockResolvedValue(authenticatedSupabase())
  })

  it('requires authentication before minting signed audio URLs', async () => {
    supabaseServerMock.mockResolvedValue(unauthenticatedSupabase())

    const response = await GET(validAudioRequest())

    expect(response.status).toBe(401)
    expect(createSupabaseAdminMock).not.toHaveBeenCalled()
  })

  it('rejects unknown podcast audio requests after authentication', async () => {
    const response = await GET(
      new Request(
        'http://localhost/api/journal-club-podcasts/audio-url?episodeId=not-real&language=english',
      ),
    )

    expect(response.status).toBe(404)
    expect(createSupabaseAdminMock).not.toHaveBeenCalled()
  })

  it('mints a signed audio URL for authenticated listeners', async () => {
    const createSignedUrl = jest.fn().mockResolvedValue({
      data: { signedUrl: 'https://storage.example/audio.mp3?token=signed' },
      error: null,
    })
    createSupabaseAdminMock.mockReturnValue({
      storage: {
        from: jest.fn().mockReturnValue({ createSignedUrl }),
      },
    })

    const response = await GET(validAudioRequest())
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({
      expiresIn: 1800,
      url: 'https://storage.example/audio.mp3?token=signed',
    })
    expect(createSignedUrl).toHaveBeenCalledWith('v1/navigation-vs-ttnb/korean.mp3', 1800, {
      download: false,
    })
  })
})

function authenticatedSupabase() {
  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'user-1' } },
        error: null,
      }),
    },
  }
}

function unauthenticatedSupabase() {
  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: null },
        error: null,
      }),
    },
  }
}

function validAudioRequest() {
  return new Request(
    'http://localhost/api/journal-club-podcasts/audio-url?episodeId=navigation-vs-ttnb&language=korean',
  )
}
