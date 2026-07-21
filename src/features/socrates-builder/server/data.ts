import { parseSocratesSlideDocument } from '../schema'
import type { SocratesBuilderBootstrap, SocratesSlideDocument } from '../types'
import { supabaseServer } from '@/lib/supabase/server'
import { getSocratesEditorSession } from './access'

interface AnnotationRow {
  id: string
  parent_id: string | null
  label: string
  polygon: unknown
  style: 'parent' | 'detail'
  enter_zoom_ratio: number
  exit_zoom_ratio: number
  summary: string
  placeholder_note: string
  sort_order: number
}

interface SlideRow {
  id: string
  slug: string
  title: string
  slide_key: string
  descriptor_url: string
  source_width: number
  source_height: number
  initial_x: number
  initial_y: number
  initial_width: number
  initial_height: number
  attribution_label: string
  attribution_url: string
  content_status: string
  workflow_status: 'draft' | 'review' | 'published'
  revision: number
  published_at: string | null
  socrates_annotations: AnnotationRow[] | null
}

function rowToDocument(row: SlideRow): SocratesSlideDocument {
  const annotations = [...(row.socrates_annotations ?? [])]
    .sort(
      (first, second) => first.sort_order - second.sort_order || first.id.localeCompare(second.id),
    )
    .map((annotation) => ({
      id: annotation.id,
      ...(annotation.parent_id ? { parentId: annotation.parent_id } : {}),
      label: annotation.label,
      polygon: annotation.polygon,
      style: annotation.style,
      enterZoomRatio: annotation.enter_zoom_ratio,
      exitZoomRatio: annotation.exit_zoom_ratio,
      summary: annotation.summary,
      placeholderNote: annotation.placeholder_note,
      sortOrder: annotation.sort_order,
    }))

  return parseSocratesSlideDocument({
    recordId: row.id,
    slug: row.slug,
    title: row.title,
    workflowStatus: row.workflow_status,
    revision: row.revision,
    publishedAt: row.published_at,
    slide: {
      id: row.slide_key,
      descriptorUrl: row.descriptor_url,
      expectedDimensions: {
        width: row.source_width,
        height: row.source_height,
      },
      initialImageRect: {
        x: row.initial_x,
        y: row.initial_y,
        width: row.initial_width,
        height: row.initial_height,
      },
      attribution: {
        label: row.attribution_label,
        href: row.attribution_url,
      },
      contentStatus: row.content_status,
    },
    annotations,
  })
}

export async function loadSocratesBuilderBootstrap(): Promise<SocratesBuilderBootstrap> {
  const { supabase, user, canEdit, canPublish } = await getSocratesEditorSession()
  const access = {
    canPersist: Boolean(user && canEdit),
    canPublish,
    userEmail: user?.email ?? null,
  }

  if (!user || !canEdit) {
    return { access, documents: [], sandboxDocuments: [] }
  }

  const sandboxDocumentsPromise = loadSocratesSandboxDocuments()

  const { data, error } = await supabase
    .from('socrates_slides')
    .select(
      `
        id,
        slug,
        title,
        slide_key,
        descriptor_url,
        source_width,
        source_height,
        initial_x,
        initial_y,
        initial_width,
        initial_height,
        attribution_label,
        attribution_url,
        content_status,
        workflow_status,
        revision,
        published_at,
        socrates_annotations (
          id,
          parent_id,
          label,
          polygon,
          style,
          enter_zoom_ratio,
          exit_zoom_ratio,
          summary,
          placeholder_note,
          sort_order
        )
      `,
    )
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('Unable to load SOCRATES builder documents', error.message)
    return { access, documents: [], sandboxDocuments: await sandboxDocumentsPromise }
  }

  const documents: SocratesSlideDocument[] = []
  for (const row of (data ?? []) as unknown as SlideRow[]) {
    try {
      documents.push(rowToDocument(row))
    } catch (error) {
      console.error('Skipping invalid SOCRATES builder document', row.id, error)
    }
  }

  return { access, documents, sandboxDocuments: await sandboxDocumentsPromise }
}

export async function loadSocratesSandboxDocuments(): Promise<SocratesSlideDocument[]> {
  const supabase = await supabaseServer()
  const { data, error } = await supabase.rpc('list_socrates_sandbox_documents')

  if (error) {
    console.error('Unable to load SOCRATES sandbox documents', error.message)
    return []
  }

  if (!Array.isArray(data)) return []

  const documents: SocratesSlideDocument[] = []
  for (const value of data) {
    try {
      documents.push(parseSocratesSlideDocument(value))
    } catch (parseError) {
      console.error('Skipping invalid SOCRATES sandbox document', parseError)
    }
  }
  return documents
}

export async function loadPublishedSocratesDocument(slug?: string) {
  const { supabase } = await getSocratesEditorSession()
  const { data, error } = await supabase.rpc('get_published_socrates_slide', {
    requested_slug: slug ?? null,
  })

  if (error || !data) {
    if (error) console.error('Unable to load a published SOCRATES slide', error.message)
    return null
  }

  try {
    return parseSocratesSlideDocument(data)
  } catch (parseError) {
    console.error('Published SOCRATES slide failed validation', parseError)
    return null
  }
}
