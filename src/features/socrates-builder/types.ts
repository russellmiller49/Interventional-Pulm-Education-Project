import type { DeepZoomSlide, DemoAnnotation } from '@/features/socrates-demo/types'

export type SocratesWorkflowStatus = 'draft' | 'review' | 'published'

export interface SocratesSlideDocument {
  recordId?: string
  slug: string
  title: string
  workflowStatus: SocratesWorkflowStatus
  revision: number
  publishedAt?: string | null
  slide: DeepZoomSlide
  annotations: DemoAnnotation[]
}

export interface SocratesBuilderAccess {
  canPersist: boolean
  canPublish: boolean
  userEmail: string | null
}

export interface SocratesBuilderBootstrap {
  access: SocratesBuilderAccess
  documents: SocratesSlideDocument[]
  sandboxDocuments: SocratesSlideDocument[]
}

export type SocratesBuilderActionResult =
  | { ok: true; document: SocratesSlideDocument }
  | { ok: false; error: string }

export type SocratesSandboxDeleteResult =
  | { ok: true; recordId: string }
  | { ok: false; error: string }

export type SocratesBuilderMode = 'protected' | 'sandbox'

export type SocratesDrawMode = 'navigate' | 'parent' | 'detail'
