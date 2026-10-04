// The identity of one feedback submission: exactly what a saved report holds. A Save attempt
// records it before the report is written, and it is computed again from the stored report, so
// which attempt produced a report is read from the report itself, never from write order.
export type SubmissionContent = {
  moduleId: unknown
  pagePath: unknown
  comment: unknown
  selectedText: unknown
}

const hex = (bytes: ArrayBuffer) =>
  Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('')

export async function submissionFingerprint(content: SubmissionContent, image?: Blob | null) {
  const picture = image
    ? hex(await crypto.subtle.digest('SHA-256', await image.arrayBuffer()))
    : null
  const text = JSON.stringify([
    content.moduleId,
    content.pagePath,
    content.comment,
    content.selectedText ?? '',
    picture,
  ])
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))
}
