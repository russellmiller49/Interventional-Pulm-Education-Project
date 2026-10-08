import { z } from 'zod'
import {
  socratesSlideDocumentSchema,
  upgradeSocratesDocument,
} from '@/features/socrates-builder/schema'
import type { SocratesSlideDocument } from '@/features/socrates-builder/types'
import { emptyAuthorContent, emptyCaseContent } from '@/features/socrates-builder/case-content'
import { getInvenioPair } from '@/features/socrates-builder/invenio-source'
import { revealProjection } from '@/features/socrates-study/projections'
import { coreTeachingSequence } from './core-teaching'

export const sharedSlideSchema = z.object({
  id: z.string().uuid(),
  importKey: z.string(),
  version: z.number().int().positive(),
  assignment: z.enum(['unassigned', 'teaching', 'testing']),
  publishedRevision: z.number().int().positive().nullable(),
  publishedAssignment: z.enum(['teaching', 'testing']).nullable(),
  publishedAt: z.string().nullable(),
  updatedAt: z.string(),
  document: socratesSlideDocumentSchema,
})
export type SharedSlide = Omit<z.infer<typeof sharedSlideSchema>, 'document'> & {
  document: SocratesSlideDocument
}
export type SharedDraft = Pick<SharedSlide, 'id' | 'importKey' | 'assignment' | 'document'>
export type SharedResult =
  | { ok: true; slide: SharedSlide }
  | { ok: false; error: string; conflict?: boolean }
export const sharedKey = (doc: SocratesSlideDocument, id: string) => {
  const source = doc.authorContent?.curriculumSource
  return source ? `workbook:${source.workbookSha256}:${source.sourceRow}` : `local:${id}`
}
export function draftSignature(draft: SharedDraft) {
  // Revision metadata is server-owned and must not make an acknowledged edit dirty again.
  return JSON.stringify([
    draft.assignment,
    {
      ...draft.document,
      revision: 0,
      recordId: undefined,
      publishedAt: null,
      workflowStatus: 'draft',
    },
  ])
}
export function sharedDraft(
  doc: SocratesSlideDocument,
  assignment: SharedDraft['assignment'] = 'unassigned',
): SharedDraft {
  const id = doc.recordId ?? crypto.randomUUID()
  return {
    id,
    importKey: sharedKey(doc, id),
    assignment,
    document: upgradeSocratesDocument({ ...doc, workflowStatus: 'draft', publishedAt: null }),
  }
}
export function publishedLibraryDocument(
  raw: SocratesSlideDocument,
  assignment: 'teaching' | 'testing',
  id: string,
) {
  const doc = upgradeSocratesDocument(raw)
  const testing = assignment === 'testing'
  const path = `/api/socrates/images/library/${id}/${doc.revision}`
  const teaching = testing ? null : revealProjection(doc)
  const core = testing ? null : coreTeachingSequence(doc)
  return {
    schemaVersion: 2 as const,
    recordId: id,
    slug: id,
    title: testing ? 'Slide' : doc.title,
    revision: doc.revision,
    workflowStatus: 'published' as const,
    publishedAt: null,
    slide: {
      id,
      descriptorUrl: `${path}/tissue/slide.dzi`,
      ...(!testing && getInvenioPair(doc.slide.descriptorUrl)
        ? { comparisonDescriptorUrl: `${path}/color/slide.dzi` }
        : {}),
      expectedDimensions: { ...doc.slide.expectedDimensions },
      initialImageRect: { ...doc.slide.initialImageRect },
      attribution: { label: 'Invenio Imaging', href: 'https://www.invenioimaging.com/' },
      contentStatus: 'Educational slide',
    },
    annotations: teaching?.annotations ?? [],
    caseContent: testing
      ? emptyCaseContent()
      : {
          ...emptyCaseContent(),
          ...teaching!.teaching,
          diagnosticCategory: doc.caseContent.diagnosticCategory,
          subcategory: doc.caseContent.subcategory,
          sortOrder: doc.caseContent.sortOrder,
          vignette: doc.caseContent.vignette,
          annotationLegend: teaching!.legend,
          ...(core ? { coreTeachingSequence: core } : {}),
        },
    authorContent: emptyAuthorContent(),
  }
}
