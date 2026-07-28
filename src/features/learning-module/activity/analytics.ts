'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'

import { recordCriticalCareEvent } from '@/features/critical-care/analytics'
import type { CriticalCareAccountSyncModuleId } from '@/lib/critical-care-progress-sync'

import { criticalCareActivityPhases } from './types'
import type { CriticalCareActivityMode, CriticalCareActivityPhase } from './types'

const DEFAULT_QUALIFICATION_DELAY_MS = 30_000

export interface CriticalCareActivityLifecycleAnalyticsInput {
  readonly moduleId: CriticalCareAccountSyncModuleId
  readonly activityId: string
  readonly mode: CriticalCareActivityMode
  readonly phase: CriticalCareActivityPhase
  readonly enabled?: boolean
  /** Test seam; production callers use the 30-visible-second default. */
  readonly qualificationDelayMs?: number
}

export interface CriticalCareActivityLifecycleAnalytics {
  readonly markMeaningfulStart: () => void
  readonly recordPredictionSubmitted: () => void
  readonly recordHintUsed: () => void
  readonly recordSafetyEvent: () => void
  readonly recordGoalMet: () => void
  readonly recordDebriefViewed: () => void
  readonly recordTransferCompleted: () => void
  readonly recordActivityCompleted: (mastered?: boolean) => void
}

/**
 * Emits only the unified, bounded critical-care lifecycle contract. The hook deliberately accepts
 * no clinical values, labels, free text, waveform data, or simulator commands.
 */
export function useCriticalCareActivityAnalytics({
  moduleId,
  activityId,
  mode,
  phase,
  enabled = true,
  qualificationDelayMs = DEFAULT_QUALIFICATION_DELAY_MS,
}: CriticalCareActivityLifecycleAnalyticsInput): CriticalCareActivityLifecycleAnalytics {
  const identity = `${moduleId}:${activityId}:${mode}`
  const identityRef = useRef('')
  const enabledRef = useRef(false)
  const emittedRef = useRef(new Set<string>())
  const previousPhaseRef = useRef<CriticalCareActivityPhase>(phase)

  const emit = useCallback(
    (
      interaction:
        | 'critical_care_activity_opened'
        | 'critical_care_qualified_start'
        | 'critical_care_phase_completed'
        | 'critical_care_prediction_submitted'
        | 'critical_care_hint_used'
        | 'critical_care_safety_event'
        | 'critical_care_goal_met'
        | 'critical_care_debrief_viewed'
        | 'critical_care_transfer_completed'
        | 'critical_care_activity_completed'
        | 'critical_care_activity_mastered',
      key: string = interaction,
      completedPhase?: CriticalCareActivityPhase,
      qualification?: '30-visible-seconds' | 'meaningful-interaction',
      dedupe = true,
    ) => {
      if (!enabled || (dedupe && emittedRef.current.has(key))) return
      if (dedupe) emittedRef.current.add(key)
      recordCriticalCareEvent({
        interaction,
        moduleId,
        activityId,
        mode,
        ...(completedPhase ? { phase: completedPhase } : {}),
        ...(qualification ? { qualification } : {}),
      })
    },
    [activityId, enabled, mode, moduleId],
  )

  const markMeaningfulStart = useCallback(() => {
    emit(
      'critical_care_qualified_start',
      'critical_care_qualified_start',
      undefined,
      'meaningful-interaction',
    )
  }, [emit])

  const meaningfulEvent = useCallback(
    (
      interaction:
        | 'critical_care_prediction_submitted'
        | 'critical_care_hint_used'
        | 'critical_care_safety_event'
        | 'critical_care_goal_met'
        | 'critical_care_debrief_viewed'
        | 'critical_care_transfer_completed'
        | 'critical_care_activity_completed'
        | 'critical_care_activity_mastered',
    ) => {
      markMeaningfulStart()
      emit(
        interaction,
        interaction,
        undefined,
        undefined,
        interaction !== 'critical_care_hint_used' && interaction !== 'critical_care_safety_event',
      )
    },
    [emit, markMeaningfulStart],
  )

  useEffect(() => {
    if (identityRef.current === identity && enabledRef.current === enabled) return
    identityRef.current = identity
    enabledRef.current = enabled
    emittedRef.current = new Set()
    previousPhaseRef.current = phase
    if (!enabled) return
    emittedRef.current.add('critical_care_activity_opened')
    recordCriticalCareEvent({
      interaction: 'critical_care_activity_opened',
      moduleId,
      activityId,
      mode,
    })
  }, [activityId, enabled, identity, mode, moduleId, phase])

  useEffect(() => {
    if (!enabled) return undefined

    let remainingMs = Math.max(0, qualificationDelayMs)
    let visibleStartedAt: number | null = null
    let timer: number | null = null

    const stopVisibleTimer = () => {
      if (timer !== null) window.clearTimeout(timer)
      timer = null
      if (visibleStartedAt !== null) {
        remainingMs = Math.max(0, remainingMs - (Date.now() - visibleStartedAt))
        visibleStartedAt = null
      }
    }

    const qualify = () => {
      stopVisibleTimer()
      emit(
        'critical_care_qualified_start',
        'critical_care_qualified_start',
        undefined,
        '30-visible-seconds',
      )
    }

    const startVisibleTimer = () => {
      if (document.visibilityState === 'hidden' || timer !== null) return
      if (remainingMs <= 0) {
        qualify()
        return
      }
      visibleStartedAt = Date.now()
      timer = window.setTimeout(qualify, remainingMs)
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') stopVisibleTimer()
      else startVisibleTimer()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    startVisibleTimer()
    return () => {
      stopVisibleTimer()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [emit, enabled, identity, qualificationDelayMs])

  useEffect(() => {
    if (identityRef.current !== identity) {
      previousPhaseRef.current = phase
      return
    }
    const previousPhase = previousPhaseRef.current
    if (previousPhase === phase) return
    previousPhaseRef.current = phase
    const previousIndex = criticalCareActivityPhases.indexOf(previousPhase)
    const currentIndex = criticalCareActivityPhases.indexOf(phase)
    if (currentIndex <= previousIndex) return
    markMeaningfulStart()
    emit(
      'critical_care_phase_completed',
      `critical_care_phase_completed:${previousPhase}`,
      previousPhase,
    )
  }, [emit, identity, markMeaningfulStart, phase])

  const recordPredictionSubmitted = useCallback(
    () => meaningfulEvent('critical_care_prediction_submitted'),
    [meaningfulEvent],
  )
  const recordHintUsed = useCallback(
    () => meaningfulEvent('critical_care_hint_used'),
    [meaningfulEvent],
  )
  const recordSafetyEvent = useCallback(
    () => meaningfulEvent('critical_care_safety_event'),
    [meaningfulEvent],
  )
  const recordGoalMet = useCallback(
    () => meaningfulEvent('critical_care_goal_met'),
    [meaningfulEvent],
  )
  const recordDebriefViewed = useCallback(
    () => meaningfulEvent('critical_care_debrief_viewed'),
    [meaningfulEvent],
  )
  const recordTransferCompleted = useCallback(
    () => meaningfulEvent('critical_care_transfer_completed'),
    [meaningfulEvent],
  )
  const recordActivityCompleted = useCallback(
    (mastered = false) =>
      meaningfulEvent(
        mastered ? 'critical_care_activity_mastered' : 'critical_care_activity_completed',
      ),
    [meaningfulEvent],
  )

  return useMemo(
    () => ({
      markMeaningfulStart,
      recordPredictionSubmitted,
      recordHintUsed,
      recordSafetyEvent,
      recordGoalMet,
      recordDebriefViewed,
      recordTransferCompleted,
      recordActivityCompleted,
    }),
    [
      markMeaningfulStart,
      recordActivityCompleted,
      recordDebriefViewed,
      recordGoalMet,
      recordHintUsed,
      recordPredictionSubmitted,
      recordSafetyEvent,
      recordTransferCompleted,
    ],
  )
}
