'use server'

import { revalidatePath } from 'next/cache'

import {
  parseSocratesSlideDocument,
  validateSocratesSlideDocument,
} from '@/features/socrates-builder/schema'
import type {
  SocratesBuilderActionResult,
  SocratesSandboxDeleteResult,
  SocratesSlideDocument,
} from '@/features/socrates-builder/types'
import { supabaseServer } from '@/lib/supabase/server'

const SANDBOX_ANNOTATION_LIMIT = 200
const SANDBOX_PAYLOAD_LIMIT = 256 * 1024

function actionError(error: unknown) {
  return error instanceof Error ? error.message : 'The SOCRATES sandbox action failed.'
}

function validEditKey(editKey: string) {
  return /^[a-f0-9]{64}$/.test(editKey)
}

export async function saveSocratesSandboxDocument(
  input: SocratesSlideDocument,
  editKey: string,
  targetRecordId?: string,
): Promise<SocratesBuilderActionResult> {
  const draftInput = {
    ...input,
    ...(targetRecordId ? { recordId: targetRecordId } : { recordId: undefined }),
    workflowStatus: 'draft' as const,
    publishedAt: null,
  }
  const parsed = validateSocratesSlideDocument(draftInput)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'The slide data is invalid.' }
  }

  if (!validEditKey(editKey)) {
    return { ok: false, error: 'A secure browser edit key could not be created.' }
  }

  if (parsed.data.annotations.length > SANDBOX_ANNOTATION_LIMIT) {
    return {
      ok: false,
      error: `Sandbox drafts are limited to ${SANDBOX_ANNOTATION_LIMIT} annotations.`,
    }
  }

  const payload = {
    ...parsed.data,
    annotations: parsed.data.annotations.map((annotation, index) => ({
      ...annotation,
      sortOrder: annotation.sortOrder ?? index,
    })),
  }
  if (Buffer.byteLength(JSON.stringify(payload), 'utf8') > SANDBOX_PAYLOAD_LIMIT) {
    return { ok: false, error: 'Sandbox drafts are limited to 256 KB.' }
  }

  try {
    const supabase = await supabaseServer()
    const { data, error } = await supabase.rpc('save_socrates_sandbox_document', {
      payload,
      edit_token: editKey,
      target_document_id: targetRecordId ?? null,
    })
    if (error) return { ok: false, error: error.message }

    revalidatePath('/[locale]/socrates-demo', 'page')
    return { ok: true, document: parseSocratesSlideDocument(data) }
  } catch (error) {
    return { ok: false, error: actionError(error) }
  }
}

export async function deleteSocratesSandboxDocument(
  recordId: string,
  editKey: string,
): Promise<SocratesSandboxDeleteResult> {
  if (!validEditKey(editKey)) {
    return { ok: false, error: 'This browser does not hold the draft edit key.' }
  }

  try {
    const supabase = await supabaseServer()
    const { data, error } = await supabase.rpc('delete_socrates_sandbox_document', {
      target_document_id: recordId,
      edit_token: editKey,
    })
    if (error) return { ok: false, error: error.message }
    if (!data) return { ok: false, error: 'The sandbox draft was not found or is not yours.' }

    revalidatePath('/[locale]/socrates-demo', 'page')
    return { ok: true, recordId }
  } catch (error) {
    return { ok: false, error: actionError(error) }
  }
}
