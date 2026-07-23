import { z } from 'zod'

import rawAssetInventory from '../../../../docs/critical-care/asset-inventory.json'
import {
  criticalCareActivityModes,
  criticalCareActivityPhases,
} from '@/features/learning-module/activity'

export const criticalCareAssetKinds = [
  'image',
  'video',
  'waveform',
  '3d',
  'console',
  'circuit',
  'chart',
] as const

export const criticalCareBandwidthClasses = ['light', 'standard', 'heavy'] as const
export const criticalCareMinimumViewports = ['mobile', 'tablet', 'desktop'] as const
export const criticalCareAssetLocaleStatuses = ['reviewed', 'fallback', 'unavailable'] as const

const assetIdSchema = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9][a-z0-9.-]+$/)
const stableIdSchema = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/)

export const criticalCareAssetDefinitionSchema = z
  .object({
    id: assetIdSchema,
    moduleId: stableIdSchema,
    kind: z.enum(criticalCareAssetKinds),
    competencyIds: z.array(stableIdSchema).min(1).max(30),
    intendedPhases: z.array(z.enum(criticalCareActivityPhases)).min(1).max(6),
    supportedModes: z.array(z.enum(criticalCareActivityModes)).min(1).max(3),
    bandwidthClass: z.enum(criticalCareBandwidthClasses),
    minimumViewport: z.enum(criticalCareMinimumViewports).optional(),
    lightweightAlternativeAssetId: assetIdSchema.optional(),
    localeStatus: z
      .record(z.enum(criticalCareAssetLocaleStatuses))
      .refine((status) => Object.keys(status).length > 0, 'Asset locale status cannot be empty.'),
    deviceVersion: z.string().trim().min(1).max(240).optional(),
    contentOwner: z.string().trim().min(1).max(160),
    clinicalReviewer: z.string().trim().min(1).max(160).optional(),
    lastReviewDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    evidenceIds: z.array(stableIdSchema).max(50),
    accessibilityAlternative: z.string().trim().min(1).max(1_000),
  })
  .strict()

export const criticalCareAssetInventorySchema = z
  .array(criticalCareAssetDefinitionSchema)
  .min(1)
  .superRefine((assets, context) => {
    const assetsById = new Map(assets.map((asset) => [asset.id, asset]))
    if (assetsById.size !== assets.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Critical-care asset IDs must be unique.',
      })
    }

    for (const [index, asset] of assets.entries()) {
      if (asset.bandwidthClass !== 'heavy') continue
      const alternative = asset.lightweightAlternativeAssetId
        ? assetsById.get(asset.lightweightAlternativeAssetId)
        : undefined
      if (!alternative) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, 'lightweightAlternativeAssetId'],
          message: 'Heavy assets require a known lightweight alternative.',
        })
      } else if (
        alternative.moduleId !== asset.moduleId ||
        alternative.bandwidthClass === 'heavy'
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, 'lightweightAlternativeAssetId'],
          message: 'A heavy asset alternative must be non-heavy and belong to the same module.',
        })
      }
    }
  })

export type CriticalCareAssetDefinition = z.infer<typeof criticalCareAssetDefinitionSchema>

export const criticalCareAssets: readonly CriticalCareAssetDefinition[] = Object.freeze(
  criticalCareAssetInventorySchema.parse(rawAssetInventory),
)

export const criticalCareAssetById: ReadonlyMap<string, CriticalCareAssetDefinition> = new Map(
  criticalCareAssets.map((asset) => [asset.id, asset]),
)
