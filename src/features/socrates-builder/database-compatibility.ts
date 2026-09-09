import { getInvenioPair } from './invenio-source'
import type { SocratesSlideDocument } from './types'

export function databaseCompatibilityError(document: SocratesSlideDocument): string | null {
  if (
    getInvenioPair(document.slide.descriptorUrl) ||
    document.annotations.some((annotation) => annotation.explanation)
  ) {
    return 'Use the web demo’s browser storage or Export JSON for paired slides and detailed explanations. The existing database format does not store this overlay.'
  }
  return null
}
