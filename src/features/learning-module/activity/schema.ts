import { z } from 'zod'

import {
  criticalCareActivityKinds,
  criticalCareActivityModes,
  criticalCareActivityPhases,
  criticalCareActivityStatuses,
  criticalCareDifficulties,
  criticalCareReviewStatuses,
  type CriticalCareActivityDefinition,
  type CriticalCareActivityProgress,
  type CriticalCareProgressEnvelope,
  type CriticalCareResumePointer,
} from './types'

const stableIdSchema = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/)

const boundedTextSchema = z.string().trim().min(1).max(500)
const isoDateSchema = z.string().datetime({ offset: true })
const pathnameSchema = z
  .string()
  .min(1)
  .max(300)
  .regex(
    /^\/(?!\/)[^?#\\\s\u0000-\u001F\u007F]*$/,
    'Pathname must be a local route without a query or fragment.',
  )

const querySchema = z
  .record(z.string().min(1).max(80), z.string().max(240))
  .refine((query) => Object.keys(query).length <= 20, 'Query contains too many fields.')

export const criticalCareActivityDefinitionSchema = z
  .object({
    id: stableIdSchema,
    moduleId: stableIdSchema,
    title: boundedTextSchema,
    description: boundedTextSchema,
    kind: z.enum(criticalCareActivityKinds),
    supportedModes: z.array(z.enum(criticalCareActivityModes)).min(1).max(3),
    pathname: pathnameSchema,
    query: querySchema.optional(),
    pathwayIds: z.array(stableIdSchema).max(20),
    competencyIds: z.array(stableIdSchema).min(1).max(30),
    prerequisiteActivityIds: z.array(stableIdSchema).max(30),
    estimatedMinutes: z.number().int().min(1).max(480),
    difficulty: z.enum(criticalCareDifficulties),
    completionRuleId: stableIdSchema,
    masteryRuleId: stableIdSchema.optional(),
    assetIds: z.array(stableIdSchema).max(30),
    reviewStatus: z.enum(criticalCareReviewStatuses),
    evidenceIds: z.array(stableIdSchema).max(50),
  })
  .strict()
  .superRefine((activity, context) => {
    if (activity.kind === 'assessment' && !activity.masteryRuleId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['masteryRuleId'],
        message: 'Assessment activities require a mastery rule.',
      })
    }
    if (activity.reviewStatus === 'released' && activity.evidenceIds.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['evidenceIds'],
        message: 'Released activities require evidence.',
      })
    }
  })

export const criticalCareActivityProgressSchema = z
  .object({
    activityId: stableIdSchema,
    status: z.enum(criticalCareActivityStatuses),
    currentPhase: z.enum(criticalCareActivityPhases).optional(),
    mode: z.enum(criticalCareActivityModes).optional(),
    bestScore: z.number().int().min(0).max(100).optional(),
    attempts: z.number().int().min(0).max(10_000),
    hintCount: z.number().int().min(0).max(10_000).optional(),
    competencyEvidenceIds: z.array(stableIdSchema).max(100),
    updatedAt: isoDateSchema,
  })
  .strict()

export const criticalCareResumePointerSchema = z
  .object({
    activityId: stableIdSchema,
    pathname: pathnameSchema,
    query: querySchema.optional(),
    mode: z.enum(criticalCareActivityModes),
    phase: z.enum(criticalCareActivityPhases),
    scenarioId: stableIdSchema.optional(),
    deviceId: stableIdSchema.optional(),
    checkpointId: stableIdSchema.optional(),
    payloadVersion: stableIdSchema,
    updatedAt: isoDateSchema,
  })
  .strict()

export const criticalCareProgressEnvelopeSchema = z
  .object({
    version: z.literal(1),
    activities: z.array(criticalCareActivityProgressSchema).max(512),
    resume: criticalCareResumePointerSchema.optional(),
    updatedAt: isoDateSchema,
  })
  .strict()
  .superRefine((envelope, context) => {
    const ids = envelope.activities.map((activity) => activity.activityId)
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['activities'],
        message: 'Activity progress identifiers must be unique.',
      })
    }
  })

export function parseActivityDefinition(value: unknown): CriticalCareActivityDefinition | null {
  const parsed = criticalCareActivityDefinitionSchema.safeParse(value)
  return parsed.success ? (parsed.data as CriticalCareActivityDefinition) : null
}

export function parseActivityProgress(value: unknown): CriticalCareActivityProgress | null {
  const parsed = criticalCareActivityProgressSchema.safeParse(value)
  return parsed.success ? (parsed.data as CriticalCareActivityProgress) : null
}

export function parseResumePointer(value: unknown): CriticalCareResumePointer | null {
  const parsed = criticalCareResumePointerSchema.safeParse(value)
  return parsed.success ? (parsed.data as CriticalCareResumePointer) : null
}

export function parseProgressEnvelope(value: unknown): CriticalCareProgressEnvelope | null {
  const parsed = criticalCareProgressEnvelopeSchema.safeParse(value)
  return parsed.success ? (parsed.data as CriticalCareProgressEnvelope) : null
}
