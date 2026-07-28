/**
 * Display-level manufacturer grouping.
 *
 * The workbook lists some vendors under more than one name. Grouping happens here at
 * runtime rather than in the import pipeline because `npm run ip-cards:import` rewrites
 * the generated JSON from the workbook on every run — the generated files stay a
 * faithful mirror of the source, and presentation decisions live in code where they can
 * change without a re-import.
 *
 * Stable aliases should eventually graduate upstream into the workbook itself.
 */

export interface ManufacturerAliasGroup {
  /** Stable id used in URLs and filters. */
  canonicalId: string
  displayName: string
  memberManufacturerIds: string[]
  note: string
}

export const manufacturerAliasGroups: ManufacturerAliasGroup[] = [
  {
    canonicalId: 'MFR-CC1ABBE64F',
    displayName: 'Thoracent / M.I.Tech',
    memberManufacturerIds: ['MFR-CC1ABBE64F', 'MFR-FEE2053E6E'],
    note: 'Thoracent distributes M.I.Tech airway and pleural devices; the workbook lists both the bare and combined names.',
  },
  // Deliberately NOT merged: MFR-52C1D02F96 "Micro-Tech Endoscopy" and MFR-797F07B3AC
  // "Micro-Tech / Thoracent". Micro-Tech Endoscopy (Nanjing) and the Thoracent-distributed
  // line are plausibly distinct businesses with distinct catalogs.
  // TODO: confirm with the catalog owner before merging.
]

const memberToGroup = new Map<string, ManufacturerAliasGroup>()
for (const group of manufacturerAliasGroups) {
  for (const memberId of group.memberManufacturerIds) {
    memberToGroup.set(memberId, group)
  }
}

export interface ManufacturerIdentity {
  manufacturerGroupId: string
  manufacturerDisplay: string
}

/**
 * Resolve a product's raw manufacturer id/name to its canonical display identity.
 * Unmapped manufacturers pass through as their own single-member group.
 */
export function canonicalManufacturer(
  manufacturerId: string | null,
  manufacturerName: string | null,
): ManufacturerIdentity {
  const group = manufacturerId ? memberToGroup.get(manufacturerId) : undefined
  if (group) {
    return { manufacturerGroupId: group.canonicalId, manufacturerDisplay: group.displayName }
  }
  return {
    manufacturerGroupId: manufacturerId ?? 'MFR-UNKNOWN',
    manufacturerDisplay: manufacturerName ?? 'Unattributed',
  }
}
