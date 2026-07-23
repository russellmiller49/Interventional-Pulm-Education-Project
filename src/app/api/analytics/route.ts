import { NextResponse } from 'next/server'
import { z } from 'zod'

import {
  BAXTER_CRRT_ANALYTICS_MODULE_ID,
  expectedBaxterCrrtAnalyticsEventType,
  validateBaxterCrrtAnalyticsEventPayload,
} from '@/lib/baxter-crrt-analytics'
import {
  expectedIcuSimulationAnalyticsEventType,
  ICU_SIMULATION_ANALYTICS_MODULE_ID,
  validateIcuSimulationAnalyticsEventPayload,
} from '@/lib/icu-simulation-analytics'
import {
  CRITICAL_CARE_ANALYTICS_MODULE_ID,
  expectedCriticalCareAnalyticsEventType,
  validateCriticalCareAnalyticsEventPayload,
} from '@/lib/critical-care-analytics'
import { resolveSiteModuleId } from '@/lib/site-auth/access'
import { supabaseServer } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const analyticsPayloadSchema = z.object({
  durationSeconds: z.number().int().min(0).max(86_400).optional(),
  eventPayload: z.record(z.unknown()).optional(),
  eventType: z.enum([
    'module_completed',
    'module_interaction',
    'module_opened',
    'quiz_submitted',
    'section_completed',
    'session_end',
    'session_heartbeat',
    'session_start',
  ]),
  moduleId: z.string().trim().min(1).max(160),
  percentComplete: z.number().int().min(0).max(100).optional(),
  routePath: z.string().trim().startsWith('/').max(500),
  section: z.string().trim().min(1).max(120).optional(),
  sessionId: z.string().uuid().optional(),
})

type AnalyticsEvent = z.infer<typeof analyticsPayloadSchema>

const focusedCriticalCareModuleIds = [
  'icu-hemodynamics',
  'mechanical-ventilation',
  'mechanical-circulatory-support',
  'cardiohelp-ecmo',
] as const
type FocusedCriticalCareModuleId = (typeof focusedCriticalCareModuleIds)[number]

const lifecycleEventTypes = new Set(['session_start', 'session_heartbeat', 'session_end'])
const boundedScoreSchema = z.number().min(0).max(100)
const boundedCountSchema = z.number().int().min(0).max(128)
const boundedIdentifierSchema = z
  .string()
  .min(1)
  .max(96)
  .regex(/^[A-Za-z0-9]+(?:[-:][A-Za-z0-9]+)*$/)

const hemodynamicsEventPayloadSchema = z
  .object({
    caseId: z.string().regex(/^HD-0[1-8]$/),
    pathway: z.enum(['learn', 'practice']),
    workspace: z.enum(['pac-skills', 'cases']),
    completion: z.boolean(),
    score: boundedScoreSchema.nullable(),
    criticalErrorCount: boundedCountSchema,
    contentVersion: z.literal('1.0.0-preview.1'),
  })
  .strict()

const ventilationDeviceSchema = z.enum([
  'hamilton-c6',
  'drager-evita-v800-v600',
  'puritan-bennett-980',
  'carefusion-avea',
])
const ventilationStationSchema = z.enum([
  'lung-protection-demand',
  'effort-triggering',
  'obstructive-mechanics',
  'pressure-support-timing',
  'deterioration-whole-patient',
])
const ventilationCaseIdSchema = z.string().regex(/^MV-(?:0[1-9]|1[0-5])$/)
const ventilationDeviceChangedPayloadSchema = z
  .object({
    interaction: z.literal('device_changed'),
    fromDeviceId: ventilationDeviceSchema,
    deviceId: ventilationDeviceSchema,
    caseId: ventilationCaseIdSchema,
    pathway: z.enum(['learn', 'practice']),
  })
  .strict()
const ventilationCaseStatePayloadSchema = z
  .object({
    caseId: ventilationCaseIdSchema,
    deviceId: ventilationDeviceSchema,
    station: ventilationStationSchema,
    pathway: z.enum(['learn', 'practice']),
    completion: z.boolean(),
    score: boundedScoreSchema.nullable(),
    errorCount: boundedCountSchema,
  })
  .strict()
const ventilationEventPayloadSchema = z.union([
  ventilationDeviceChangedPayloadSchema,
  ventilationCaseStatePayloadSchema,
])

const mcsEventPayloadSchema = z
  .object({
    deviceTrack: z.enum(['iabp', 'impella', 'lvad']),
    station: boundedIdentifierSchema,
    completion: z.enum(['complete', 'in-progress']),
    scoreBand: z.enum(['not-scored', 'below-60', '60-79', '80-100']),
  })
  .strict()

const cardiohelpSupportModeSchema = z.enum(['vv', 'va'])
const cardiohelpExperienceSchema = z.enum(['learn', 'practice', 'assess'])
const cardiohelpStationSchema = z.enum([
  'orientation',
  'flow-pressure',
  'sweep',
  'troubleshooting',
  'assessment',
])
const cardiohelpScenarioIdSchema = boundedIdentifierSchema
const cardiohelpInteractionPayloadSchema = z.discriminatedUnion('interaction', [
  z
    .object({
      interaction: z.literal('guided_lesson_loaded'),
      scenarioId: cardiohelpScenarioIdSchema,
      supportMode: cardiohelpSupportModeSchema,
      experience: z.literal('learn'),
    })
    .strict(),
  z
    .object({
      interaction: z.literal('practice_scenario_loaded'),
      scenarioId: cardiohelpScenarioIdSchema,
      supportMode: cardiohelpSupportModeSchema,
      experience: z.literal('practice'),
      simulationMode: z.enum(['guided', 'challenge']),
    })
    .strict(),
  z
    .object({
      interaction: z.literal('guided_walkthrough_completed'),
      scenarioId: cardiohelpScenarioIdSchema,
      supportMode: cardiohelpSupportModeSchema,
      experience: z.literal('learn'),
    })
    .strict(),
  z
    .object({
      interaction: z.literal('support_mode_selected'),
      supportMode: cardiohelpSupportModeSchema,
      experience: cardiohelpExperienceSchema,
    })
    .strict(),
])
const cardiohelpRoundPayloadSchema = z
  .object({
    scenarioId: cardiohelpScenarioIdSchema,
    supportMode: cardiohelpSupportModeSchema,
    experience: z.literal('practice'),
    score: boundedScoreSchema,
    criticalErrorCount: boundedCountSchema,
    roundMastery: z.boolean(),
    modeMastery: z.boolean(),
    modePercentComplete: z.number().int().min(0).max(100),
    aggregatePercentComplete: z.number().int().min(0).max(100),
  })
  .strict()
const cardiohelpCompletionPayloadSchema = z
  .object({
    completionId: boundedIdentifierSchema,
    supportMode: cardiohelpSupportModeSchema,
    experience: z.enum(['learn', 'practice']),
    modePercentComplete: z.literal(100).optional(),
    masteredSupportModes: z.tuple([z.literal('vv'), z.literal('va')]).optional(),
  })
  .strict()
const cardiohelpEventPayloadSchema = z.union([
  cardiohelpInteractionPayloadSchema,
  cardiohelpRoundPayloadSchema,
  cardiohelpCompletionPayloadSchema,
])

const analyticsTopLevelKeys = new Set([
  'durationSeconds',
  'eventPayload',
  'eventType',
  'moduleId',
  'percentComplete',
  'routePath',
  'section',
  'sessionId',
])

function hasUnknownTopLevelField(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).some((key) => !analyticsTopLevelKeys.has(key))
  )
}

function isFocusedCriticalCareModuleId(value: string): value is FocusedCriticalCareModuleId {
  return (focusedCriticalCareModuleIds as readonly string[]).includes(value)
}

function validFocusedLifecycleEvent(event: AnalyticsEvent): boolean {
  return (
    lifecycleEventTypes.has(event.eventType) &&
    event.eventPayload === undefined &&
    event.durationSeconds !== undefined &&
    event.sessionId !== undefined &&
    event.percentComplete === undefined &&
    event.section === undefined
  )
}

function validHemodynamicsEvent(event: AnalyticsEvent): boolean {
  const result = hemodynamicsEventPayloadSchema.safeParse(event.eventPayload)
  return (
    result.success &&
    event.eventType === 'module_interaction' &&
    event.section === result.data.workspace &&
    event.percentComplete !== undefined &&
    event.durationSeconds === undefined &&
    event.sessionId === undefined
  )
}

function validVentilationEvent(event: AnalyticsEvent): boolean {
  const result = ventilationEventPayloadSchema.safeParse(event.eventPayload)
  if (!result.success || event.durationSeconds !== undefined || event.sessionId !== undefined) {
    return false
  }
  const data = result.data
  if ('interaction' in data) {
    return (
      event.eventType === 'module_interaction' &&
      event.section !== undefined &&
      ventilationStationSchema.safeParse(event.section).success &&
      event.percentComplete === undefined
    )
  }
  if (data.completion) {
    return (
      event.eventType === 'module_completed' &&
      event.section === data.station &&
      event.percentComplete !== undefined &&
      data.pathway === 'practice' &&
      data.score !== null
    )
  }
  return (
    event.eventType === 'module_interaction' &&
    event.section === data.pathway &&
    event.percentComplete === undefined &&
    data.score === null &&
    data.errorCount === 0
  )
}

function validMcsEvent(event: AnalyticsEvent): boolean {
  const result = mcsEventPayloadSchema.safeParse(event.eventPayload)
  if (!result.success || event.durationSeconds !== undefined || event.sessionId !== undefined) {
    return false
  }
  const completed = result.data.completion === 'complete'
  return (
    event.section !== undefined &&
    ['learn', 'practice', 'assess'].includes(event.section) &&
    event.percentComplete !== undefined &&
    event.eventType === (completed ? 'section_completed' : 'module_interaction')
  )
}

function validCardiohelpEvent(event: AnalyticsEvent): boolean {
  const result = cardiohelpEventPayloadSchema.safeParse(event.eventPayload)
  if (!result.success || event.durationSeconds !== undefined || event.sessionId !== undefined) {
    return false
  }
  const data = result.data
  if ('interaction' in data) {
    if (event.eventType !== 'module_interaction' || event.percentComplete !== undefined)
      return false
    if (
      data.interaction === 'guided_lesson_loaded' ||
      data.interaction === 'guided_walkthrough_completed'
    ) {
      return event.section === 'learn'
    }
    if (data.interaction === 'support_mode_selected') {
      return event.section === `${data.supportMode}:${data.experience}`
    }
    return event.section !== undefined && cardiohelpStationSchema.safeParse(event.section).success
  }
  if ('scenarioId' in data) {
    const station = cardiohelpStationFromSection(event.section, data.supportMode)
    return (
      event.eventType === 'quiz_submitted' &&
      station !== null &&
      event.percentComplete === data.aggregatePercentComplete
    )
  }
  if (data.masteredSupportModes) {
    return (
      event.eventType === 'module_completed' &&
      event.section === undefined &&
      event.percentComplete === 100 &&
      data.completionId === 'cardiohelp-ecmo-vv-va-mastery-v1'
    )
  }
  if (data.modePercentComplete !== undefined) {
    return (
      event.eventType === 'section_completed' &&
      event.section === `${data.supportMode}:mastery` &&
      event.percentComplete === undefined &&
      data.experience === 'practice' &&
      data.completionId === `cardiohelp-ecmo-${data.supportMode}-mastery-v1`
    )
  }
  if (event.section === `${data.supportMode}:capstone-unlocked`) {
    return (
      event.eventType === 'section_completed' &&
      event.percentComplete === undefined &&
      data.experience === 'learn' &&
      data.completionId === `cardiohelp-ecmo-${data.supportMode}-capstone-unlocked-v1`
    )
  }
  const station = cardiohelpStationFromSection(event.section, data.supportMode)
  return (
    event.eventType === 'section_completed' &&
    event.percentComplete === undefined &&
    data.experience === 'practice' &&
    station !== null &&
    data.completionId === `${data.supportMode}-${station}-complete`
  )
}

function cardiohelpStationFromSection(
  section: string | undefined,
  supportMode: 'vv' | 'va',
): z.infer<typeof cardiohelpStationSchema> | null {
  const prefix = `${supportMode}:`
  if (!section?.startsWith(prefix)) return null
  const parsed = cardiohelpStationSchema.safeParse(section.slice(prefix.length))
  return parsed.success ? parsed.data : null
}

function validateFocusedCriticalCareEvent(
  moduleId: FocusedCriticalCareModuleId,
  event: AnalyticsEvent,
  rawPayload: unknown,
): boolean {
  if (hasUnknownTopLevelField(rawPayload) || resolveSiteModuleId(event.routePath) !== moduleId) {
    return false
  }
  if (lifecycleEventTypes.has(event.eventType)) return validFocusedLifecycleEvent(event)
  if (event.eventPayload === undefined) return false

  if (moduleId === 'icu-hemodynamics') return validHemodynamicsEvent(event)
  if (moduleId === 'mechanical-ventilation') return validVentilationEvent(event)
  if (moduleId === 'mechanical-circulatory-support') return validMcsEvent(event)
  return validCardiohelpEvent(event)
}

export async function POST(request: Request) {
  const rawPayload = await request.json().catch(() => null)
  const payload = analyticsPayloadSchema.safeParse(rawPayload)

  if (!payload.success) {
    return NextResponse.json({ error: 'Invalid analytics payload.' }, { status: 400 })
  }

  const event = payload.data
  let validatedEventPayload = event.eventPayload
  const isBaxterCrrtEvent = event.moduleId === BAXTER_CRRT_ANALYTICS_MODULE_ID
  const isIcuSimulationEvent = event.moduleId === ICU_SIMULATION_ANALYTICS_MODULE_ID
  const isCriticalCareEvent = event.moduleId === CRITICAL_CARE_ANALYTICS_MODULE_ID
  const focusedCriticalCareModuleId = isFocusedCriticalCareModuleId(event.moduleId)
    ? event.moduleId
    : null
  if (
    focusedCriticalCareModuleId &&
    !validateFocusedCriticalCareEvent(focusedCriticalCareModuleId, event, rawPayload)
  ) {
    return NextResponse.json(
      { error: 'Invalid focused critical-care analytics payload.' },
      { status: 400 },
    )
  }
  if (isBaxterCrrtEvent) {
    if (event.eventPayload === undefined) {
      return NextResponse.json({ error: 'Invalid Baxter CRRT analytics payload.' }, { status: 400 })
    }

    const crrtPayload = validateBaxterCrrtAnalyticsEventPayload(event.eventPayload)
    const hasGenericProgressOrSessionFields =
      event.durationSeconds !== undefined ||
      event.percentComplete !== undefined ||
      event.section !== undefined ||
      event.sessionId !== undefined
    if (
      !crrtPayload.success ||
      hasGenericProgressOrSessionFields ||
      resolveSiteModuleId(event.routePath) !== BAXTER_CRRT_ANALYTICS_MODULE_ID ||
      (crrtPayload.success &&
        event.eventType !== expectedBaxterCrrtAnalyticsEventType(crrtPayload.data.interaction))
    ) {
      return NextResponse.json({ error: 'Invalid Baxter CRRT analytics payload.' }, { status: 400 })
    }

    validatedEventPayload = crrtPayload.data
  }

  if (isIcuSimulationEvent) {
    if (event.eventPayload === undefined) {
      return NextResponse.json(
        { error: 'Invalid ICU Simulator analytics payload.' },
        { status: 400 },
      )
    }

    const icuPayload = validateIcuSimulationAnalyticsEventPayload(event.eventPayload)
    const hasGenericProgressOrSessionFields =
      event.durationSeconds !== undefined ||
      event.percentComplete !== undefined ||
      event.section !== undefined ||
      event.sessionId !== undefined
    if (
      !icuPayload.success ||
      hasUnknownTopLevelField(rawPayload) ||
      hasGenericProgressOrSessionFields ||
      resolveSiteModuleId(event.routePath) !== ICU_SIMULATION_ANALYTICS_MODULE_ID ||
      (icuPayload.success &&
        event.eventType !== expectedIcuSimulationAnalyticsEventType(icuPayload.data.interaction))
    ) {
      return NextResponse.json(
        { error: 'Invalid ICU Simulator analytics payload.' },
        { status: 400 },
      )
    }

    validatedEventPayload = icuPayload.data
  }

  if (isCriticalCareEvent) {
    if (event.eventPayload === undefined) {
      return NextResponse.json(
        { error: 'Invalid critical-care analytics payload.' },
        { status: 400 },
      )
    }

    const criticalCarePayload = validateCriticalCareAnalyticsEventPayload(event.eventPayload)
    const resolvedRouteModuleId = resolveSiteModuleId(event.routePath)
    const routeMatchesPayload =
      criticalCarePayload.success &&
      (resolvedRouteModuleId === CRITICAL_CARE_ANALYTICS_MODULE_ID ||
        resolvedRouteModuleId === criticalCarePayload.data.moduleId)
    const hasGenericProgressOrSessionFields =
      event.durationSeconds !== undefined ||
      event.percentComplete !== undefined ||
      event.section !== undefined ||
      event.sessionId !== undefined
    if (
      !criticalCarePayload.success ||
      hasUnknownTopLevelField(rawPayload) ||
      hasGenericProgressOrSessionFields ||
      !routeMatchesPayload ||
      (criticalCarePayload.success &&
        event.eventType !==
          expectedCriticalCareAnalyticsEventType(criticalCarePayload.data.interaction))
    ) {
      return NextResponse.json(
        { error: 'Invalid critical-care analytics payload.' },
        { status: 400 },
      )
    }

    validatedEventPayload = criticalCarePayload.data
  }

  const supabase = await supabaseServer()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  const userId = user.id
  const now = new Date().toISOString()
  const durationSeconds = event.durationSeconds ?? 0
  const eventPayload = validatedEventPayload ?? {}

  // CRRT maintains its protected learner progress locally. During the Phase 7 review boundary,
  // the server records only allowlisted learner interaction summaries and never derives generic
  // session time, section completion, module percentage, or completion from them.
  if (isBaxterCrrtEvent || isIcuSimulationEvent || isCriticalCareEvent) {
    await recordModuleEvent(event.eventType)
    return NextResponse.json({ status: 'ok' })
  }

  if (event.eventType === 'session_start') {
    if (!event.sessionId) {
      return NextResponse.json({ error: 'sessionId is required.' }, { status: 400 })
    }

    const { error: sessionError } = await supabase.from('site_module_sessions').upsert(
      {
        id: event.sessionId,
        duration_seconds: durationSeconds,
        last_heartbeat_at: now,
        module_id: event.moduleId,
        route_path: event.routePath,
        started_at: now,
        user_id: userId,
      },
      { onConflict: 'id' },
    )

    if (sessionError) {
      return NextResponse.json({ error: sessionError.message }, { status: 500 })
    }

    await recordModuleEvent('module_opened')
    await updateModuleProgress({ totalTimeDeltaSeconds: 0 })

    return NextResponse.json({ status: 'ok' })
  }

  if (event.eventType === 'session_heartbeat' || event.eventType === 'session_end') {
    if (!event.sessionId) {
      return NextResponse.json({ error: 'sessionId is required.' }, { status: 400 })
    }

    if (event.eventType === 'session_end') {
      const { data: closedSessions, error: sessionError } = await supabase
        .from('site_module_sessions')
        .update({
          duration_seconds: durationSeconds,
          ended_at: now,
          last_heartbeat_at: now,
        })
        .eq('id', event.sessionId)
        .eq('user_id', userId)
        .is('ended_at', null)
        .select('id')

      if (sessionError) {
        return NextResponse.json({ error: sessionError.message }, { status: 500 })
      }

      if ((closedSessions ?? []).length > 0) {
        await recordModuleEvent('session_ended')
        await updateModuleProgress({ totalTimeDeltaSeconds: durationSeconds })
      }

      return NextResponse.json({ status: 'ok' })
    }

    const { error: sessionError } = await supabase
      .from('site_module_sessions')
      .update({
        duration_seconds: durationSeconds,
        last_heartbeat_at: now,
      })
      .eq('id', event.sessionId)
      .eq('user_id', userId)
      .is('ended_at', null)

    if (sessionError) {
      return NextResponse.json({ error: sessionError.message }, { status: 500 })
    }

    await updateModuleProgress({ totalTimeDeltaSeconds: 0 })

    return NextResponse.json({ status: 'ok' })
  }

  if (event.eventType === 'module_interaction') {
    await recordModuleEvent(event.eventType)
    return NextResponse.json({ status: 'ok' })
  }

  await recordModuleEvent(event.eventType)
  await updateModuleProgress({
    completedSection: event.eventType === 'section_completed' ? event.section : undefined,
    completedModule: event.eventType === 'module_completed',
    percentComplete: event.percentComplete,
    totalTimeDeltaSeconds: 0,
  })

  return NextResponse.json({ status: 'ok' })

  async function recordModuleEvent(eventType: string) {
    const { error } = await supabase.from('site_module_events').insert({
      event_payload: {
        ...eventPayload,
        ...(typeof event.percentComplete === 'number'
          ? { percentComplete: event.percentComplete }
          : {}),
        ...(event.section ? { section: event.section } : {}),
      },
      event_type: eventType,
      module_id: event.moduleId,
      route_path: event.routePath,
      session_id: event.sessionId ?? null,
      user_id: userId,
    })

    if (error) {
      console.warn('Unable to record module event', error)
    }
  }

  async function updateModuleProgress({
    completedModule = false,
    completedSection,
    percentComplete,
    totalTimeDeltaSeconds,
  }: {
    completedModule?: boolean
    completedSection?: string
    percentComplete?: number
    totalTimeDeltaSeconds: number
  }) {
    const { data: current, error: readError } = await supabase
      .from('site_module_progress')
      .select(
        'completed_at, completed_sections, first_started_at, percent_complete, total_time_seconds',
      )
      .eq('user_id', userId)
      .eq('module_id', event.moduleId)
      .maybeSingle()

    if (readError) {
      console.warn('Unable to read module progress', readError)
      return
    }

    const completedSections = new Set<string>(current?.completed_sections ?? [])
    if (completedSection) {
      completedSections.add(completedSection)
    }

    const nextPercent = Math.max(
      current?.percent_complete ?? 0,
      completedModule ? 100 : 0,
      percentComplete ?? 0,
    )
    const nextCompletedAt =
      current?.completed_at ?? (completedModule || nextPercent >= 100 ? now : null)

    const { error: writeError } = await supabase.from('site_module_progress').upsert(
      {
        completed_at: nextCompletedAt,
        completed_sections: Array.from(completedSections),
        first_started_at: current?.first_started_at ?? now,
        last_visited_at: now,
        module_id: event.moduleId,
        percent_complete: nextPercent,
        total_time_seconds: (current?.total_time_seconds ?? 0) + totalTimeDeltaSeconds,
        updated_at: now,
        user_id: userId,
      },
      { onConflict: 'user_id,module_id' },
    )

    if (writeError) {
      console.warn('Unable to write module progress', writeError)
    }
  }
}
