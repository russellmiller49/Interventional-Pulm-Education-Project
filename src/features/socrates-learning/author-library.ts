import { z } from 'zod'
import {
  workspaceSchema,
  type WebOverlayWorkspace,
} from '@/features/socrates-builder/web-overlay-storage'
import type { SocratesSlideDocument } from '@/features/socrates-builder/types'
import { socratesSlideDocumentSchema } from '@/features/socrates-builder/schema'
import { collectionSchema, teachingTitle, type LearningCollection } from './model'

export const documentKey = (doc: SocratesSlideDocument) => doc.recordId ?? doc.slug
export const emptyCurriculum = () => ({
  title: 'SOCRATES slide library',
  importedIds: [] as string[],
  imports: {} as Record<string, string>,
  assignments: {},
})

/** Stable local identities let titles, slugs, annotations and assignments change independently. */
export function normalizeWorkspace(workspace: WebOverlayWorkspace): WebOverlayWorkspace {
  const documents = workspace.documents.map((doc) => ({
    ...doc,
    recordId: doc.recordId ?? crypto.randomUUID(),
  }))
  const active = documents.find((doc) =>
    workspace.activeDocument.recordId
      ? doc.recordId === workspace.activeDocument.recordId
      : doc.slug === workspace.activeDocument.slug,
  )
  const activeDocument = {
    ...workspace.activeDocument,
    recordId: active?.recordId ?? crypto.randomUUID(),
  }
  return {
    ...workspace,
    activeDocument,
    documents: active
      ? documents.map((doc) => (doc.recordId === activeDocument.recordId ? activeDocument : doc))
      : [...documents, activeDocument],
  }
}

/** Append missing prepared slides; repeated imports never replace the team's edits. */
export function mergeCurriculum(
  workspace: WebOverlayWorkspace,
  collection: LearningCollection,
): WebOverlayWorkspace {
  const base = normalizeWorkspace(workspace)
  const curriculum = {
    ...(base.curriculum ?? emptyCurriculum()),
    imports: { ...base.curriculum?.imports },
  }
  const added: SocratesSlideDocument[] = []
  for (const input of collection.documents) {
    if (curriculum.imports[input.slug]) continue
    const recordId = crypto.randomUUID()
    const title =
      input.schemaVersion === 2 && input.caseContent && input.authorContent
        ? teachingTitle(
            input as import('@/features/socrates-builder/types').SocratesCaseDocument,
          ).slice(0, 160)
        : input.title
    added.push({ ...input, title, recordId })
    curriculum.imports[input.slug] = recordId
  }
  return {
    ...base,
    documents: [...added, ...base.documents],
    curriculum: {
      ...curriculum,
      title: collection.title,
      importedIds: [...curriculum.importedIds, ...added.map(documentKey)],
    },
  }
}

export const authorLibrarySchema = z
  .object({
    format: z.literal('socrates-author-library-v1'),
    workspace: workspaceSchema,
  })
  .strict()
  .superRefine(({ workspace }, ctx) => {
    const keys = workspace.documents.map(documentKey)
    if (
      new Set(keys).size !== keys.length ||
      !keys.includes(documentKey(workspace.activeDocument)) ||
      workspace.documents.length > 500 ||
      !workspace.documents.length ||
      workspace.documents.some(
        (doc) =>
          !doc.recordId ||
          doc.workflowStatus !== 'draft' ||
          doc.publishedAt ||
          doc.caseContent?.trainingEligible ||
          doc.caseContent?.testingEligible,
      ) ||
      Object.keys(workspace.curriculum?.assignments ?? {}).some((key) => !keys.includes(key)) ||
      workspace.curriculum?.importedIds.some((key) => !keys.includes(key)) ||
      Object.values(workspace.curriculum?.imports ?? {}).some((key) => !keys.includes(key))
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Use a local draft library with valid slide assignments; released cases are not supported.',
      })
    }
  })

export function exportAuthorLibrary(workspace: WebOverlayWorkspace) {
  // The catalog is authoritative. Never export a stale active-document snapshot.
  const normalized = normalizeWorkspace(workspace)
  return authorLibrarySchema.parse({ format: 'socrates-author-library-v1', workspace: normalized })
}

export function importAuthorLibrary(
  workspace: WebOverlayWorkspace,
  raw: unknown,
): WebOverlayWorkspace {
  const curriculum = collectionSchema.safeParse(raw)
  if (curriculum.success) return mergeCurriculum(workspace, curriculum.data)
  const incoming = authorLibrarySchema.parse(raw).workspace as WebOverlayWorkspace
  const base = normalizeWorkspace(workspace)
  const metadata = base.curriculum ?? emptyCurriculum()
  const assignments = { ...metadata.assignments }
  const importedIds = new Set(metadata.importedIds)
  const imports = { ...metadata.imports }
  const documents = [...base.documents]
  for (const doc of incoming.documents) {
    const oldId = documentKey(doc)
    const existing = documents.find((item) => documentKey(item) === oldId)
    const canonicalExisting = socratesSlideDocumentSchema.safeParse(existing)
    const incomingAssignment = incoming.curriculum?.assignments[oldId] ?? 'unassigned'
    if (
      existing &&
      canonicalExisting.success &&
      JSON.stringify(canonicalExisting.data) === JSON.stringify(doc) &&
      (assignments[oldId] ?? 'unassigned') === incomingAssignment
    )
      continue
    // Preserve both authors' versions on conflict; importing is never an overwrite.
    const id = existing ? crypto.randomUUID() : oldId
    documents.push({
      ...doc,
      recordId: id,
      title: existing ? `${doc.title.slice(0, 144)} (imported copy)` : doc.title,
    })
    assignments[id] = incomingAssignment
    if (incoming.curriculum?.importedIds.includes(oldId)) importedIds.add(id)
    for (const [slug, sourceId] of Object.entries(incoming.curriculum?.imports ?? {})) {
      if (sourceId === oldId && !imports[slug]) imports[slug] = id
    }
  }
  return {
    ...base,
    documents,
    curriculum: { ...metadata, assignments, imports, importedIds: [...importedIds] },
  }
}
