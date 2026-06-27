'use client'

import { useCallback } from 'react'
import { useTranslations } from 'next-intl'

import { translateHandoffText, type HandoffRawTranslator } from './handoff-core'

/** Stable client-side translator for filtering, dialogs, and composed strings. */
export function useHandoffTranslator() {
  const t = useTranslations('handoff') as unknown as HandoffRawTranslator
  return useCallback((value: string) => translateHandoffText(t, value), [t])
}
