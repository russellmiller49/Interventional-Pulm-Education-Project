import { z } from 'zod'

export const criticalCareAccountSyncModuleIds = [
  'icu-hemodynamics',
  'mechanical-ventilation',
  'mechanical-circulatory-support',
  'cardiohelp-ecmo',
  'baxter-crrt',
  'icu-simulation',
] as const

export const criticalCareAccountSyncSections = ['learn', 'practice', 'assess'] as const

export const criticalCareCoarseModuleProgressSchema = z
  .object({
    moduleId: z.enum(criticalCareAccountSyncModuleIds),
    percentComplete: z.number().int().min(0).max(100),
    completedSections: z.array(z.enum(criticalCareAccountSyncSections)).max(3),
    completed: z.boolean(),
  })
  .strict()
  .superRefine((progress, context) => {
    if (new Set(progress.completedSections).size !== progress.completedSections.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['completedSections'],
        message: 'Completed sections must be unique.',
      })
    }
    if (progress.completed !== (progress.percentComplete === 100)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['completed'],
        message: 'Completed must match 100 percent progress.',
      })
    }
  })

export const criticalCareCoarseProgressBatchSchema = z
  .object({
    schemaVersion: z.literal(1),
    modules: z.array(criticalCareCoarseModuleProgressSchema).min(1).max(6),
  })
  .strict()
  .superRefine((batch, context) => {
    const moduleIds = batch.modules.map((module) => module.moduleId)
    if (new Set(moduleIds).size !== moduleIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['modules'],
        message: 'Synced module IDs must be unique.',
      })
    }
  })

export const criticalCareCoarseAccountModuleProgressSchema = z
  .object({
    moduleId: z.enum(criticalCareAccountSyncModuleIds),
    percentComplete: z.number().int().min(0).max(100),
    completedSections: z.array(z.enum(criticalCareAccountSyncSections)).max(3),
    completedAt: z.string().datetime().nullable(),
    lastVisitedAt: z.string().datetime(),
  })
  .strict()
  .superRefine((progress, context) => {
    if (new Set(progress.completedSections).size !== progress.completedSections.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['completedSections'],
        message: 'Completed sections must be unique.',
      })
    }
  })

export const criticalCareCoarseAccountProgressSchema = z
  .object({
    schemaVersion: z.literal(1),
    accountId: z.string().min(1).max(128),
    modules: z.array(criticalCareCoarseAccountModuleProgressSchema).max(6),
  })
  .strict()
  .superRefine((batch, context) => {
    const moduleIds = batch.modules.map((module) => module.moduleId)
    if (new Set(moduleIds).size !== moduleIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['modules'],
        message: 'Synced module IDs must be unique.',
      })
    }
  })

export type CriticalCareAccountSyncModuleId = (typeof criticalCareAccountSyncModuleIds)[number]
export type CriticalCareAccountSyncSection = (typeof criticalCareAccountSyncSections)[number]
export type CriticalCareCoarseModuleProgress = z.infer<
  typeof criticalCareCoarseModuleProgressSchema
>
export type CriticalCareCoarseProgressBatch = z.infer<typeof criticalCareCoarseProgressBatchSchema>
export type CriticalCareCoarseAccountProgress = z.infer<
  typeof criticalCareCoarseAccountProgressSchema
>
