'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import {
  deleteUserCard,
  duplicateUserCard,
  renameUserCard,
  setShareEnabled,
} from '@/features/preference-cards/server/user-cards'

/**
 * Row actions for a saved card.
 *
 * Ownership is not re-checked here: every statement runs as the signed-in user under
 * row-level security, so a card id that is not theirs simply matches no row and the action
 * reports that it no longer exists.
 */

const localeSchema = z.string().trim().min(2).max(16)
const idSchema = z.string().uuid()

function field(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === 'string' ? value : ''
}

function parse<T extends z.ZodTypeAny>(schema: T, value: unknown, label: string): z.infer<T> {
  const parsed = schema.safeParse(value)
  if (!parsed.success) throw new Error(`Invalid ${label}.`)
  return parsed.data
}

export async function renameCardAction(formData: FormData): Promise<void> {
  const locale = parse(localeSchema, field(formData, 'locale'), 'locale')
  const cardId = parse(idSchema, field(formData, 'cardId'), 'card')
  const title = parse(z.string().trim().min(1).max(160), field(formData, 'title'), 'title')
  const rawPhysician = field(formData, 'physicianName').trim()
  const physicianName = parse(z.string().max(160), rawPhysician, 'physician name')
  // The content version the form was rendered against. A rename is revision-bearing — the title
  // and the physician are printed and hashed — so it takes the same conditional update a save
  // does, and a rename typed against a state somebody has since replaced is refused.
  const expectedUpdatedAt = parse(
    z.string().datetime({ offset: true }),
    field(formData, 'expectedUpdatedAt'),
    'card version',
  )

  const result = await renameUserCard(cardId, title, expectedUpdatedAt, physicianName || null)
  if (!result.ok) throw new Error(result.error ?? 'The preference card could not be renamed.')

  revalidatePath(`/${locale}/preference-cards`)
  revalidatePath(`/${locale}/preference-cards/${cardId}`)
}

export async function deleteCardAction(formData: FormData): Promise<void> {
  const locale = parse(localeSchema, field(formData, 'locale'), 'locale')
  const cardId = parse(idSchema, field(formData, 'cardId'), 'card')

  const result = await deleteUserCard(cardId)
  if (!result.ok) throw new Error(result.error ?? 'The preference card could not be deleted.')

  revalidatePath(`/${locale}/preference-cards`)
  if (field(formData, 'returnToDashboard') === '1') {
    redirect(`/${locale}/preference-cards`)
  }
}

export async function duplicateCardAction(formData: FormData): Promise<void> {
  const locale = parse(localeSchema, field(formData, 'locale'), 'locale')
  const cardId = parse(idSchema, field(formData, 'cardId'), 'card')
  const title = parse(z.string().trim().min(1).max(160), field(formData, 'title'), 'title')

  const result = await duplicateUserCard(cardId, title)
  if (!result.ok || !result.data) {
    throw new Error(result.error ?? 'The preference card could not be duplicated.')
  }

  revalidatePath(`/${locale}/preference-cards`)
  redirect(`/${locale}/preference-cards/${result.data}`)
}

export async function setCardShareAction(formData: FormData): Promise<void> {
  const locale = parse(localeSchema, field(formData, 'locale'), 'locale')
  const cardId = parse(idSchema, field(formData, 'cardId'), 'card')
  const enabled = field(formData, 'enabled') === '1'

  const result = await setShareEnabled(cardId, enabled)
  if (!result.ok) throw new Error(result.error ?? 'The share setting could not be changed.')

  revalidatePath(`/${locale}/preference-cards`)
  revalidatePath(`/${locale}/preference-cards/${cardId}`)
}
