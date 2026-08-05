'use server'

import type { Route } from 'next'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { createRebuiltCard } from '@/features/preference-cards/server/rebuild-card'

/**
 * Creating a new card from a reviewed rebuild.
 *
 * The one action in this workflow that writes, and it writes exactly one row: a new draft card
 * belonging to the caller. Nothing here can reach the source card — `createRebuiltCard` has no
 * statement that updates it — so a rebuild that fails, is refused, or is abandoned leaves the
 * original exactly as it was.
 *
 * Ownership is not re-checked here. Every read and the insert run as the signed-in user under
 * row-level security, so a card id that is not theirs matches no row and the rebuild reports that
 * the revision does not exist — the same answer an id that never existed gets.
 *
 * A refusal redirects back to the review with a reason rather than throwing. A thrown error would
 * render the framework's error page and lose the whole review: the physician would have answered
 * thirty decisions and be shown a stack trace. The decisions themselves are deliberately *not*
 * carried back — a plan that moved must be read again, not re-submitted from memory.
 */

const localeSchema = z.string().trim().min(2).max(16)
const idSchema = z.string().uuid()

/** The failures a submitted review can cause, as opposed to reasons a rebuild is not on offer. */
const submissionErrorCodes: readonly string[] = [
  'plan_moved',
  'plan_blocked',
  'source_moved',
  'review_incomplete',
  'not_resolvable',
  'write_failed',
]

function field(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === 'string' ? value : ''
}

function fields(formData: FormData, key: string): string[] {
  return formData.getAll(key).filter((value): value is string => typeof value === 'string')
}

function parse<T extends z.ZodTypeAny>(schema: T, value: unknown, label: string): z.infer<T> {
  const parsed = schema.safeParse(value)
  if (!parsed.success) throw new Error(`Invalid ${label}.`)
  return parsed.data
}

/** One `decision:<key>` field per answered decision, which is how the form names them. */
function readAcknowledgements(formData: FormData): Record<string, string> {
  const acknowledgements: Record<string, string> = {}
  for (const [name, value] of formData.entries()) {
    if (!name.startsWith('decision:')) continue
    if (typeof value !== 'string') continue
    acknowledgements[name.slice('decision:'.length)] = value
  }
  return acknowledgements
}

export async function createRebuiltCardAction(formData: FormData): Promise<void> {
  const locale = parse(localeSchema, field(formData, 'locale'), 'locale')
  const cardId = parse(idSchema, field(formData, 'cardId'), 'card')
  const revisionId = parse(idSchema, field(formData, 'revisionId'), 'revision')

  const result = await createRebuiltCard({
    cardId,
    revisionId,
    planHash: field(formData, 'planHash'),
    selection: {
      moduleVersionIds: fields(formData, 'moduleVersionId'),
      modifierCodes: fields(formData, 'modifierCode'),
    },
    acknowledgements: readAcknowledgements(formData) as Record<
      string,
      'confirmed' | 'dropped' | 'acknowledged_unresolved'
    >,
    title: field(formData, 'title'),
    physicianName: field(formData, 'physicianName').trim() || null,
  })

  const rebuildPath = `/${locale}/preference-cards/${cardId}/rebuild`
  if (!result.ok) {
    const params = new URLSearchParams({ revision: revisionId })
    // Only the four failures the *submission* can cause carry a message back. Everything else is a
    // reason the rebuild is unavailable at all, and re-running the preparation renders the page's
    // own explanation for it — one sentence, in one place, rather than a second copy here that
    // could disagree with it.
    if (submissionErrorCodes.includes(result.code)) {
      params.set('error', result.code)
      if (result.missing?.length) params.set('unanswered', result.missing.join(','))
    }
    // `typedRoutes` cannot infer a route from a template that carries a query string, so the cast
    // is required. The path itself is built from validated ids, not from user text.
    redirect(`${rebuildPath}?${params.toString()}` as Route)
  }

  // The dashboard gains a card and the source card's page is unchanged — but it now has a rebuild
  // pointing at it, and its own revision list is what a reader follows back.
  revalidatePath(`/${locale}/preference-cards`)
  revalidatePath(`/${locale}/preference-cards/${cardId}`)
  // Straight to the builder, not the read-only card page. The rebuild deliberately has no product
  // picker, so anything it left unresolved is finished here — and the copy has always said the new
  // draft opens in the builder.
  redirect(`/${locale}/preference-cards/${result.cardId}/edit`)
}
