import { annotationLegendIssues } from './case-content'
import { z } from 'zod'

import {
  polygonBounds,
  rectContainsRect,
  validateDemoData,
} from '@/features/socrates-demo/engine/geometry'

import {
  caseContentSchema,
  authorContentSchema,
  emptyCaseContent,
  emptyAuthorContent,
} from './case-content'
import type { SocratesCaseDocument, SocratesSlideDocument } from './types'
import { isApprovedSocratesDziUrl } from './invenio-source'

const finiteNumber = z.number().finite()

const pointSchema = z
  .object({
    x: finiteNumber,
    y: finiteNumber,
  })
  .strict()

const imageRectSchema = z
  .object({
    x: finiteNumber.nonnegative(),
    y: finiteNumber.nonnegative(),
    width: finiteNumber.positive(),
    height: finiteNumber.positive(),
  })
  .strict()

const annotationSchema = z
  .object({
    id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/),
    parentId: z
      .string()
      .regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/)
      .nullish()
      .transform((value) => value ?? undefined),
    label: z.string().trim().min(1).max(120),
    polygon: z.tuple([pointSchema, pointSchema, pointSchema, pointSchema]),
    style: z.enum(['parent', 'detail']),
    enterZoomRatio: finiteNumber.nonnegative(),
    exitZoomRatio: finiteNumber.nonnegative(),
    summary: z.string().max(2000),
    explanation: z.string().max(8000).optional(),
    placeholderNote: z.string().max(2000),
    sortOrder: z.number().int().nonnegative().optional(),
  })
  .strict()

const deepZoomSlideSchema = z
  .object({
    id: z.string().trim().min(1).max(200),
    descriptorUrl: z
      .string()
      .url()
      .refine(isApprovedSocratesDziUrl, 'Use an approved Invenio slide descriptor URL.')
      .transform((value) => new URL(value).toString()),
    expectedDimensions: z
      .object({
        width: z.number().int().positive(),
        height: z.number().int().positive(),
      })
      .strict(),
    initialImageRect: imageRectSchema,
    attribution: z
      .object({
        label: z.string().trim().min(1).max(300),
        href: z
          .string()
          .url()
          .refine((value) => value.startsWith('https://'), 'Use an HTTPS URL.'),
      })
      .strict(),
    contentStatus: z.string().trim().min(1).max(500),
  })
  .strict()

export const socratesSlideDocumentSchema = z
  .object({
    schemaVersion: z.union([z.literal(1), z.literal(2)]).optional(),
    caseContent: caseContentSchema.optional(),
    authorContent: authorContentSchema.optional(),
    recordId: z.string().uuid().optional(),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    title: z.string().trim().min(1).max(160),
    workflowStatus: z.enum(['draft', 'review', 'published']),
    revision: z.number().int().nonnegative(),
    publishedAt: z.string().datetime({ offset: true }).nullable().optional(),
    slide: deepZoomSlideSchema,
    annotations: z.array(annotationSchema).max(2000),
  })
  .strict()
  .superRefine((document, context) => {
    if (document.schemaVersion === 2 && (!document.caseContent || !document.authorContent)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Version 2 requires case content and protected author content.',
      })
    }
    if (document.schemaVersion !== 2 && (document.caseContent || document.authorContent)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Case packages require schemaVersion 2.',
      })
    }
    for (const error of validateDemoData(document.slide, document.annotations)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: error })
    }

    const byId = new Map(document.annotations.map((annotation) => [annotation.id, annotation]))
    for (const annotation of document.annotations) {
      if (annotation.style === 'parent' && annotation.parentId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Parent annotation "${annotation.label}" cannot have a parent.`,
          path: ['annotations'],
        })
      }

      if (annotation.style === 'detail') {
        const parent = annotation.parentId ? byId.get(annotation.parentId) : undefined
        if (!parent || parent.style !== 'parent') {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Detail annotation "${annotation.label}" requires a parent annotation.`,
            path: ['annotations'],
          })
        } else if (
          !rectContainsRect(polygonBounds(parent.polygon), polygonBounds(annotation.polygon))
        ) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Detail annotation "${annotation.label}" must be inside its parent annotation.`,
            path: ['annotations'],
          })
        }
      }
    }
  })

export function isApprovedInvenioDziUrl(value: string) {
  try {
    const url = new URL(value)
    return (
      url.origin === 'https://www.invenio-cloud.com' &&
      url.username === '' &&
      url.password === '' &&
      url.search === '' &&
      url.hash === '' &&
      /^\/api\/thinslides\/[A-Za-z0-9._-]+\.dzi$/.test(url.pathname)
    )
  } catch {
    return false
  }
}

export function parseSocratesSlideDocument(value: unknown): SocratesSlideDocument {
  return socratesSlideDocumentSchema.parse(value) as SocratesSlideDocument
}

export function validateSocratesSlideDocument(value: unknown) {
  return socratesSlideDocumentSchema
    .refine(
      (document) =>
        !document.caseContent?.annotationLegend.reviewed ||
        !annotationLegendIssues(document.caseContent.annotationLegend).length,
      {
        message:
          'A reviewed annotation key needs actual labels, six-digit colors and reviewed meanings.',
      },
    )
    .safeParse(value)
}

/** Legacy parsing stays lossless. Upgrade only on an explicit case edit/save/export. */
export function upgradeSocratesDocument(value: unknown): SocratesCaseDocument {
  const document = parseSocratesSlideDocument(value)
  return {
    ...document,
    schemaVersion: 2,
    caseContent: document.caseContent ?? emptyCaseContent(),
    authorContent: document.authorContent ?? emptyAuthorContent(),
  }
}
