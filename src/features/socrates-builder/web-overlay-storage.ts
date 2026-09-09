import { z } from 'zod'

import { createInvenioDemoDocument } from './content/invenio-demo-document'
import { socratesSlideDocumentSchema } from './schema'
import type { SocratesSlideDocument } from './types'

export const WEB_OVERLAY_STORAGE_KEY = 'socrates-invenio-web-overlays:v1'

export interface WebOverlayWorkspace {
  version: 1
  activeDocument: SocratesSlideDocument
  documents: SocratesSlideDocument[]
}

const workspaceSchema = z.object({
  version: z.literal(1),
  activeDocument: socratesSlideDocumentSchema,
  documents: z.array(socratesSlideDocumentSchema),
})

export function createWebOverlayWorkspace(): WebOverlayWorkspace {
  const document = createInvenioDemoDocument()
  return { version: 1, activeDocument: document, documents: [document] }
}

export function readWebOverlayWorkspace(): {
  workspace: WebOverlayWorkspace
  warning: string | null
} {
  try {
    const stored = window.localStorage.getItem(WEB_OVERLAY_STORAGE_KEY)
    return {
      workspace: stored
        ? (workspaceSchema.parse(JSON.parse(stored)) as WebOverlayWorkspace)
        : createWebOverlayWorkspace(),
      warning: null,
    }
  } catch {
    // Keep unreadable stored data intact. An untouched starter must not replace it.
    return {
      workspace: createWebOverlayWorkspace(),
      warning:
        'Your browser draft could not be restored. The example is open. Export any work you want to keep before closing this page.',
    }
  }
}

/** Returns an actionable error instead of claiming a failed write was saved. */
export function saveWebOverlayWorkspace(workspace: WebOverlayWorkspace): string | null {
  const parsed = workspaceSchema.safeParse(workspace)
  if (!parsed.success) {
    return `Auto-save paused: ${parsed.error.issues[0]?.message ?? 'complete the required fields'}. Your last saved version is preserved.`
  }
  try {
    window.localStorage.setItem(WEB_OVERLAY_STORAGE_KEY, JSON.stringify(parsed.data))
    return null
  } catch {
    return 'Browser storage is unavailable or full. Export JSON to keep these changes before closing this page.'
  }
}
