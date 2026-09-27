'use server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { validateSocratesSlideDocument } from '@/features/socrates-builder/schema'
import {
  sharedLibrarySession,
  listSharedSlides,
} from '@/features/socrates-learning/server/shared-library'
import {
  sharedSlideSchema,
  type SharedDraft,
  type SharedResult,
} from '@/features/socrates-learning/shared-library'

const failure = (error: unknown) => ({
  ok: false as const,
  error:
    error instanceof Error
      ? error.message
      : 'The shared library could not be reached. Your edits are retained.',
})
export async function refreshSharedLibrary() {
  try {
    return { ok: true as const, slides: await listSharedSlides() }
  } catch (error) {
    return failure(error)
  }
}
export async function saveSharedSlide(
  draft: SharedDraft,
  expectedVersion: number,
  expectedRevision: number,
): Promise<SharedResult> {
  try {
    const { supabase } = await sharedLibrarySession()
    if (
      !z.string().uuid().safeParse(draft.id).success ||
      !Number.isInteger(expectedVersion) ||
      expectedVersion < 0 ||
      !['unassigned', 'teaching', 'testing'].includes(draft.assignment)
    )
      return { ok: false, error: 'Invalid shared draft.' }
    const input = {
      ...draft.document,
      revision: expectedRevision,
      workflowStatus: 'draft' as const,
      publishedAt: null,
    }
    const parsed = validateSocratesSlideDocument(input)
    if (!parsed.success)
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? 'Complete the required slide fields.',
      }
    if (JSON.stringify(input).length > 1024 * 1024)
      return { ok: false, error: 'The slide exceeds the 1 MB authoring limit.' }
    const { data, error } = await supabase.rpc('save_socrates_library_slide', {
      library_id: draft.id,
      expected_version: expectedVersion,
      assignment: draft.assignment,
      payload: parsed.data,
    })
    if (error)
      return { ok: false, error: error.message, conflict: ['40001', '23505'].includes(error.code) }
    return { ok: true, slide: sharedSlideSchema.parse(data) }
  } catch (error) {
    return failure(error)
  }
}
export async function publishSharedSlide(
  id: string,
  version: number,
  revision: number,
  release: boolean,
): Promise<SharedResult> {
  try {
    const { supabase, canPublish } = await sharedLibrarySession()
    if (!canPublish)
      return { ok: false, error: 'Site administrator access is required to publish.' }
    if (!z.string().uuid().safeParse(id).success) return { ok: false, error: 'Invalid slide.' }
    const { data, error } = await supabase.rpc('publish_socrates_library_slide', {
      library_id: id,
      expected_version: version,
      expected_revision: revision,
      release,
    })
    if (error) return { ok: false, error: error.message, conflict: error.code === '40001' }
    revalidatePath('/[locale]/socrates/learn', 'page')
    return { ok: true, slide: sharedSlideSchema.parse(data) }
  } catch (error) {
    return failure(error)
  }
}
