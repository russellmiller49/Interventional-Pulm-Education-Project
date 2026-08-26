import { z } from 'zod'

export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
export const SHA256_PATTERN = /^[0-9a-f]{64}$/
export const D2D_SOURCE_ID_PATTERN = /^D2D-SRC-[A-Z0-9-]{4,80}$/

export const D2D_SOURCE_KINDS = [
  'manufacturer_labeling',
  'manufacturer_catalog',
  'manufacturer_product_page',
  'gudid',
  'fda_premarket',
  'fda_classification',
  'fda_registration_listing',
  'governed_catalog',
] as const

export const d2dSourceProjectionSchema = z
  .object({
    source_id: z.string().regex(D2D_SOURCE_ID_PATTERN),
    governed_source_id: z
      .string()
      .regex(/^SRC\d{3}$/)
      .nullable(),
    source_kind: z.enum(D2D_SOURCE_KINDS),
    title: z.string().min(1).max(300),
    organization: z.string().min(1).max(200),
    official_url: z
      .string()
      .url()
      .refine((value) => value.startsWith('https://'), 'official URLs must use https')
      .nullable(),
    snapshot_date: z.string().regex(ISO_DATE_PATTERN),
    content_sha256: z.string().regex(SHA256_PATTERN),
  })
  .strict()

export type D2dSourceProjection = z.infer<typeof d2dSourceProjectionSchema>

export const d2dSourceReferenceSchema = z
  .object({
    source_id: z.string().regex(D2D_SOURCE_ID_PATTERN),
    locator: z.string().trim().min(1).max(500),
  })
  .strict()

export type D2dSourceReference = z.infer<typeof d2dSourceReferenceSchema>

export const pinnedArtifactSchema = z
  .object({
    path: z
      .string()
      .min(1)
      .refine((value) => !value.startsWith('/'), 'path must be repo-relative'),
    sha256: z.string().regex(SHA256_PATTERN),
  })
  .strict()
