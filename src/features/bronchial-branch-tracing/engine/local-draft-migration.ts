// Exact signatures from merged baseline 2b10cb6a. Source geometry and response
// locations are unchanged for these lessons; parseLocalSession still validates
// every response. Orientation introduces a different task and is not migrated.
export const LOCAL_DRAFT_ALIASES: Record<string, string[]> = {
  'follow-one-airway': ['c6-local-teaching-r1.a430a129'],
  continuity: ['c6-local-teaching-r1.84664545'],
  vertical: ['c6-local-teaching-r1.b6f6bc9d'],
  'horizontal-horizontal': ['c6-local-teaching-r1.1bb371da'],
  'horizontal-vertical': ['c6-local-teaching-r1.8409616'],
  'horizontal-oblique': ['c6-local-teaching-r1.a8ca7460'],
  'orientation-changes': ['c6-local-teaching-r1.ef94a5f1'],
}

// Route drafts sign the whole lesson, including step metadata. BBT-01 opened every step gate and
// reworded two step instructions; source geometry and the response model are unchanged, and
// parseRouteDraft still validates every response. Signature recorded before that change.
export const ROUTE_DRAFT_ALIASES: Record<string, string[]> = {
  'variants-limits': ['c6-local-teaching-r1.e2c2c01a'],
}
