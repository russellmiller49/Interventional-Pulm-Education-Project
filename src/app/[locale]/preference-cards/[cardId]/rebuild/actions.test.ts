import { createRebuiltCardAction } from './actions'

/**
 * The server action's two outcomes: where a success goes, and that a refusal writes nothing.
 *
 * There was no test here at all, which is how the redirect drifted from the documented behaviour —
 * the copy said the new draft opens in the builder and the action sent the physician to the
 * read-only card page, one click short of the one place a product can be chosen.
 */

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))

class RedirectError extends Error {
  constructor(public readonly to: string) {
    super('NEXT_REDIRECT')
  }
}

jest.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new RedirectError(to)
  },
}))

jest.mock('@/features/preference-cards/server/rebuild-card', () => ({
  createRebuiltCard: jest.fn(),
}))

const { createRebuiltCard } = jest.requireMock(
  '@/features/preference-cards/server/rebuild-card',
) as { createRebuiltCard: jest.Mock }

const CARD_ID = '00000000-0000-4000-8000-000000000001'
const REVISION_ID = '00000000-0000-4000-9000-000000000001'
const NEW_ID = '00000000-0000-4000-8000-000000000002'

function form(extra: Record<string, string> = {}) {
  const data = new FormData()
  data.set('locale', 'en')
  data.set('cardId', CARD_ID)
  data.set('revisionId', REVISION_ID)
  data.set('planHash', 'a'.repeat(64))
  data.set('title', 'Fixture card (rebuilt)')
  for (const [key, value] of Object.entries(extra)) data.set(key, value)
  return data
}

async function redirectTarget(data: FormData): Promise<string> {
  try {
    await createRebuiltCardAction(data)
  } catch (error) {
    if (error instanceof RedirectError) return error.to
    throw error
  }
  throw new Error('the action did not redirect')
}

it('sends a successful rebuild straight to the canonical builder', async () => {
  createRebuiltCard.mockResolvedValue({ ok: true, cardId: NEW_ID })
  // Not the read-only card page: the rebuild deliberately has no product picker, so whatever it
  // left unresolved is finished in the builder.
  expect(await redirectTarget(form())).toBe(`/en/preference-cards/${NEW_ID}/edit`)
})

it('returns a refused review to the same plan, with a reason', async () => {
  createRebuiltCard.mockResolvedValue({
    ok: false,
    code: 'review_incomplete',
    missing: ['requirement:FIXTURE_BACKUP_SCOPE'],
  })
  const target = await redirectTarget(form())
  expect(target).toContain(`/en/preference-cards/${CARD_ID}/rebuild`)
  expect(target).toContain('error=review_incomplete')
  expect(target).toContain('unanswered=requirement%3AFIXTURE_BACKUP_SCOPE')
})

it.each(['plan_moved', 'plan_blocked', 'source_moved'])(
  'explains a %s refusal rather than discarding the review silently',
  async (code) => {
    createRebuiltCard.mockResolvedValue({ ok: false, code })
    expect(await redirectTarget(form())).toContain(`error=${code}`)
  },
)

it.each(['/x.co', '//x.co', 'en/../..', 'ko', 'not-a-locale'])(
  'refuses a tampered locale rather than redirecting to it: %s',
  async (locale) => {
    // The schema accepted any trimmed two-to-sixteen-character string, and both the refusal and
    // the success path interpolate it after a slash — so `/x.co` produced `//x.co/...`, which is a
    // protocol-relative external URL. `ko` is planned rather than active: there are no messages
    // for it, so it is refused for the same reason.
    createRebuiltCard.mockResolvedValue({ ok: true, cardId: NEW_ID })
    await expect(createRebuiltCardAction(form({ locale }))).rejects.toThrow(/Invalid locale/)
    expect(createRebuiltCard).not.toHaveBeenCalled()
  },
)

it.each(['en', 'es', 'zh-CN'])('keeps the exact builder destination for %s', async (locale) => {
  createRebuiltCard.mockResolvedValue({ ok: true, cardId: NEW_ID })
  expect(await redirectTarget(form({ locale }))).toBe(`/${locale}/preference-cards/${NEW_ID}/edit`)
})
