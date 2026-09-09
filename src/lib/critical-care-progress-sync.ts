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
    /*
     * `timestamptz` comes back from PostgREST as ISO 8601 with a numeric offset
     * (`2026-09-08T17:36:00.123456+00:00`), never with `Z`, and zod's plain `datetime()` accepts
     * only `Z`. Without the offset option every authenticated read of a real row failed this parse
     * and the route answered 500 on every page load for a signed-in learner with any saved
     * critical-care progress. The notebook schema in this feature already reads with the offset.
     */
    completedAt: z.string().datetime({ offset: true }).nullable(),
    lastVisitedAt: z.string().datetime({ offset: true }),
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
