// Whitespace and zero-width characters picked up by a stray selection are not referenced text.
const invisible = /[\s​-‍⁠﻿]/g

export function hasReferencedText(value: string) {
  return value.replace(invisible, '').length > 0
}

// Unsent work is content the tester would lose. An open dialog or a reserved report ID is not.
export function isMeaningfulDraft(draft: {
  comment: string
  selectedText: string
  hasImage: boolean
}) {
  return draft.comment.trim().length > 0 || hasReferencedText(draft.selectedText) || draft.hasImage
}
