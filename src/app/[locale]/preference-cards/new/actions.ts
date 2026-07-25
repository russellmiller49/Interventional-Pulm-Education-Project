'use server'

import { z } from 'zod'

import {
  buildDemoContext,
  getScenarioDefinition,
} from '@/features/preference-cards/data/demo-context.server'
import { resolveCard } from '@/features/preference-cards/domain/resolve-card'
import { buildCardInputSchema } from '@/features/preference-cards/domain/schemas'
import { persistResolvedCard } from '@/features/preference-cards/server/persist-card'

const requestSchema = z.object({
  scenarioId: z.string().min(1).max(100),
  input: buildCardInputSchema,
})

export async function generatePreferenceCardAction(request: unknown): Promise<{
  ok: boolean
  cardId?: string
  error?: string
}> {
  const parsed = requestSchema.safeParse(request)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'The preference-card request is invalid.',
    }
  }
  const scenario = getScenarioDefinition(parsed.data.scenarioId)
  if (!scenario || scenario.recipeVersionId !== parsed.data.input.recipeVersionId) {
    return { ok: false, error: 'The scenario and recipe do not match.' }
  }
  const context = buildDemoContext(scenario.id)
  const card = resolveCard(parsed.data.input, context)
  return persistResolvedCard(parsed.data.input, card)
}
