/**
 * Addresses of the private manufacturer preview: a hub page and the three things it opens (the
 * device explorer and two presentation demonstrations). Safe for pages: no storage location, no
 * credential and no reviewer name is here.
 */
export const WOLF_PREVIEW_PATH = '/medical-thoracoscopy/wolf-preview'
export const WOLF_PREVIEW_API = '/api/medical-thoracoscopy/wolf-preview'
export const WOLF_PREVIEW_SESSION_ENDPOINT = `${WOLF_PREVIEW_API}/session`
export const WOLF_PREVIEW_END_ENDPOINT = `${WOLF_PREVIEW_API}/session/end`

/** Models are asked for by id; the server maps an id to its private object. */
export function wolfPreviewModelUrl(id: string): string {
  return `${WOLF_PREVIEW_API}/models/${id}.glb`
}

/** What the hub opens, each on its own page under the preview's address. */
export const WOLF_PREVIEW_ITEMS = [
  'device-explorer',
  'pleural-model-progress',
  'portable-trainer-concept',
] as const
export type WolfPreviewItem = (typeof WOLF_PREVIEW_ITEMS)[number]

export function wolfPreviewItem(value: unknown): WolfPreviewItem | null {
  return WOLF_PREVIEW_ITEMS.includes(value as WolfPreviewItem) ? (value as WolfPreviewItem) : null
}

/** The page of the hub (no item) or of one item, without a locale. */
export function wolfPreviewPagePath(item?: WolfPreviewItem | null): string {
  return item ? `${WOLF_PREVIEW_PATH}/${item}` : WOLF_PREVIEW_PATH
}

/**
 * A file of the hub (`hub`) or of a demonstration, by its published path; the server maps it to
 * its private object.
 */
export function wolfPreviewFileUrl(group: string, file: string): string {
  return `${WOLF_PREVIEW_API}/files/${group}/${file}`
}

export const REVIEW_STATES = ['denied', 'limited', 'ended'] as const
export type ReviewState = (typeof REVIEW_STATES)[number]

export function reviewState(value: unknown): ReviewState | null {
  return REVIEW_STATES.includes(value as ReviewState) ? (value as ReviewState) : null
}

export const WOLF_PREVIEW_WORDS = {
  course: 'Medical Thoracoscopy',
  title: 'Development Preview — Manufacturer Review',
  intro: 'This private development preview is provided for Richard Wolf review.',
  codeLabel: 'Review code',
  open: 'Open preview',
  help: 'If your code is not accepted, contact the person who sent you this link.',
  messages: {
    denied: 'Review code not recognized.',
    limited: 'Too many attempts. Please wait a few minutes and try again.',
    ended: 'The preview has ended on this browser.',
  } satisfies Record<ReviewState, string>,
  unavailable: 'The private preview is temporarily unavailable. Please try again later.',
  signedIn: 'Private manufacturer preview',
  end: 'End preview',
  allPreviews: 'All previews',
  hubLead:
    'Three parts of the Medical Thoracoscopy work, for your review. Each opens on its own page; All previews brings you back here.',
  hubDisclosure:
    'Development preview for manufacturer review: work in progress, not published, and not reviewed clinically or by the manufacturer. Device models are parametric educational renderings from published dimensions, not manufacturer CAD; device details remain subject to manufacturer fact-check.',
  disclosure:
    'Development preview for manufacturer review. Parametric educational models; not manufacturer CAD. Device details remain subject to manufacturer fact-check.',
} as const
