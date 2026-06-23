/**
 * @jest-environment node
 */

import { LOCAL_DEV_AUTH_COOKIE_NAME } from '@/lib/site-auth/local-dev-auth'
import { supabaseServer } from '@/lib/supabase/server'

import { requireJournalClubPodcastApiAuth } from './auth'

jest.mock('@/lib/supabase/server', () => ({
  supabaseServer: jest.fn(),
}))

describe('journal club podcast API auth', () => {
  const supabaseServerMock = supabaseServer as jest.Mock
  const originalEnabled = process.env.LOCAL_DEV_AUTH_ENABLED
  const originalToken = process.env.LOCAL_DEV_AUTH_TOKEN

  beforeEach(() => {
    supabaseServerMock.mockReset()
    process.env.LOCAL_DEV_AUTH_ENABLED = '1'
    process.env.LOCAL_DEV_AUTH_TOKEN = 'local-secret-token'
  })

  afterAll(() => {
    process.env.LOCAL_DEV_AUTH_ENABLED = originalEnabled
    process.env.LOCAL_DEV_AUTH_TOKEN = originalToken
  })

  it('accepts the localhost-only development unlock cookie without calling Supabase auth', async () => {
    const auth = await requireJournalClubPodcastApiAuth(
      new Request('http://localhost:3001/api/journal-club-podcasts/audio-url', {
        headers: {
          cookie: `${LOCAL_DEV_AUTH_COOKIE_NAME}=local-secret-token`,
        },
      }),
    )

    expect(auth).toEqual({
      ok: true,
      userId: null,
      localDevAuth: true,
    })
    expect(supabaseServerMock).not.toHaveBeenCalled()
  })

  it('requires a Supabase user when the local development cookie is absent', async () => {
    supabaseServerMock.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
          error: null,
        }),
      },
    })

    const auth = await requireJournalClubPodcastApiAuth(
      new Request('https://interventionalpulm.org/api/journal-club-podcasts/audio-url'),
    )

    expect(auth).toEqual({
      ok: true,
      userId: 'user-1',
      localDevAuth: false,
    })
  })
})
