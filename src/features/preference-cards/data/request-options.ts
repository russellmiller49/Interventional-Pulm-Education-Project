import { z } from 'zod'

import type { BuildCardInput } from '../domain/types'

type SearchValue = string | string[] | undefined

export interface PreferenceCardSearchParams {
  modifiers?: SearchValue
  generatedAt?: SearchValue
  conditions?: SearchValue
  items?: SearchValue
  waivers?: SearchValue
  mode?: SearchValue
}

const conditionalStatesSchema = z.record(
  z.string().min(1).max(160),
  z.enum(['include', 'exclude', 'undecided']),
)
const selectedHospitalItemIdsSchema = z.record(
  z.string().min(1).max(160),
  z.string().min(1).max(160).nullable(),
)
const waiversSchema = z.record(z.string().min(1).max(160), z.string().trim().min(10).max(500))

function first(value: SearchValue): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export function parsePreferenceCardSearch(params: PreferenceCardSearchParams): {
  modifierCodes?: string[]
  generatedAt?: string
  conditionalStates?: BuildCardInput['conditionalStates']
  selectedHospitalItemIds?: BuildCardInput['selectedHospitalItemIds']
  waivers?: BuildCardInput['waivers']
  mode: 'spatial' | 'chronological'
  serialized: string
} {
  const rawModifiers = first(params.modifiers)
  const modifierCodes =
    rawModifiers !== undefined
      ? rawModifiers
          .split(',')
          .map((code) => code.trim())
          .filter((code) => /^[A-Z0-9_]{1,64}$/.test(code))
          .slice(0, 30)
      : undefined

  const rawGeneratedAt = first(params.generatedAt)
  const generatedAt =
    rawGeneratedAt && rawGeneratedAt.length <= 40 && Number.isFinite(Date.parse(rawGeneratedAt))
      ? new Date(rawGeneratedAt).toISOString()
      : undefined

  let conditionalStates: BuildCardInput['conditionalStates']
  const rawConditions = first(params.conditions)
  if (rawConditions && rawConditions.length <= 20_000) {
    try {
      const parsed = conditionalStatesSchema.safeParse(JSON.parse(rawConditions))
      if (parsed.success) conditionalStates = parsed.data
    } catch {
      conditionalStates = undefined
    }
  }

  let selectedHospitalItemIds: BuildCardInput['selectedHospitalItemIds']
  const rawItems = first(params.items)
  if (rawItems && rawItems.length <= 40_000) {
    try {
      const parsed = selectedHospitalItemIdsSchema.safeParse(JSON.parse(rawItems))
      if (parsed.success && Object.keys(parsed.data).length <= 250) {
        selectedHospitalItemIds = parsed.data
      }
    } catch {
      selectedHospitalItemIds = undefined
    }
  }

  let waivers: BuildCardInput['waivers']
  const rawWaivers = first(params.waivers)
  if (rawWaivers && rawWaivers.length <= 60_000) {
    try {
      const parsed = waiversSchema.safeParse(JSON.parse(rawWaivers))
      if (parsed.success && Object.keys(parsed.data).length <= 100) {
        waivers = parsed.data
      }
    } catch {
      waivers = undefined
    }
  }

  const mode = first(params.mode) === 'chronological' ? 'chronological' : 'spatial'
  const serialized = new URLSearchParams(
    [
      rawModifiers !== undefined ? ['modifiers', rawModifiers] : null,
      generatedAt ? ['generatedAt', generatedAt] : null,
      rawConditions ? ['conditions', rawConditions] : null,
      rawItems ? ['items', rawItems] : null,
      rawWaivers ? ['waivers', rawWaivers] : null,
    ].filter((entry): entry is [string, string] => entry !== null),
  ).toString()

  return {
    modifierCodes,
    generatedAt,
    conditionalStates,
    selectedHospitalItemIds,
    waivers,
    mode,
    serialized,
  }
}
