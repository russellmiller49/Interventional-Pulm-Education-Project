'use server'

import { revalidatePath } from 'next/cache'

import { saveCardRequestSchema } from '@/features/preference-cards/schemas/saved-card'
import { saveUserCard } from '@/features/preference-cards/server/user-cards'

export interface SaveCardActionResult {
  ok: boolean
  cardId?: string
  error?: string
}

/**
 * Save a preference card for the signed-in user.
 *
 * The client sends its selections, never its resolution: the card is re-resolved here from
 * the catalog and the recipe, and that server-built snapshot is what gets stored. Failures
 * are returned verbatim so the wizard can show what actually went wrong.
 */
export async function saveUserCardAction(request: unknown): Promise<SaveCardActionResult> {
  const parsed = saveCardRequestSchema.safeParse(request)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'The preference-card request is invalid.',
    }
  }

  const result = await saveUserCard(parsed.data)
  if (!result.ok || !result.data) {
    return { ok: false, error: result.error ?? 'The preference card could not be saved.' }
  }
  return { ok: true, cardId: result.data }
}

export async function revalidatePreferenceCards(locale: string): Promise<void> {
  revalidatePath(`/${locale}/preference-cards`)
}
