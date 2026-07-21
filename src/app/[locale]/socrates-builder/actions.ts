'use server'

import { revalidatePath } from 'next/cache'

import {
  parseSocratesSlideDocument,
  validateSocratesSlideDocument,
} from '@/features/socrates-builder/schema'
import { getSocratesEditorSession } from '@/features/socrates-builder/server/access'
import type {
  SocratesBuilderActionResult,
  SocratesSandboxDeleteResult,
  SocratesSlideDocument,
} from '@/features/socrates-builder/types'

function actionError(error: unknown) {
  return error instanceof Error ? error.message : 'The SOCRATES builder action failed.'
}

export async function saveSocratesSlideDocument(
  input: SocratesSlideDocument,
): Promise<SocratesBuilderActionResult> {
  const parsed = validateSocratesSlideDocument(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'The slide data is invalid.' }
  }

  if (parsed.data.workflowStatus === 'published') {
    return { ok: false, error: 'Save published slides as a draft or review submission first.' }
  }

  try {
    const { supabase, user, canEdit } = await getSocratesEditorSession()
    if (!user || !canEdit) {
      return { ok: false, error: 'SOCRATES editor access is required.' }
    }

    const payload = {
      ...parsed.data,
      annotations: parsed.data.annotations.map((annotation, index) => ({
        ...annotation,
        sortOrder: annotation.sortOrder ?? index,
      })),
    }
    const { data, error } = await supabase.rpc('save_socrates_slide_document', { payload })
    if (error) return { ok: false, error: error.message }

    revalidatePath('/[locale]/socrates-builder', 'page')
    return { ok: true, document: parseSocratesSlideDocument(data) }
  } catch (error) {
    return { ok: false, error: actionError(error) }
  }
}

export async function publishSocratesSlideDocument(
  recordId: string,
): Promise<SocratesBuilderActionResult> {
  try {
    const { supabase, user, canPublish } = await getSocratesEditorSession()
    if (!user || !canPublish) {
      return { ok: false, error: 'Site administrator access is required to publish.' }
    }

    const { data, error } = await supabase.rpc('publish_socrates_slide_document', {
      target_slide_id: recordId,
    })
    if (error) return { ok: false, error: error.message }

    revalidatePath('/[locale]/socrates-builder', 'page')
    revalidatePath('/[locale]/socrates-demo', 'page')
    return { ok: true, document: parseSocratesSlideDocument(data) }
  } catch (error) {
    return { ok: false, error: actionError(error) }
  }
}

export async function deleteSocratesSandboxDocumentAsAdmin(
  recordId: string,
): Promise<SocratesSandboxDeleteResult> {
  try {
    const { supabase, user, canPublish } = await getSocratesEditorSession()
    if (!user || !canPublish) {
      return { ok: false, error: 'Site administrator access is required.' }
    }

    const { data, error } = await supabase.rpc('admin_delete_socrates_sandbox_document', {
      target_document_id: recordId,
    })
    if (error) return { ok: false, error: error.message }
    if (!data) return { ok: false, error: 'The sandbox draft no longer exists.' }

    revalidatePath('/[locale]/socrates-builder', 'page')
    revalidatePath('/[locale]/socrates-demo', 'page')
    return { ok: true, recordId }
  } catch (error) {
    return { ok: false, error: actionError(error) }
  }
}
