import { normalizeManufacturerName } from './normalize'
import type { ManufacturerAliasGroup } from './types'

/**
 * Conservative, source-controlled company identities used only for openFDA comparison.
 *
 * Legal suffixes are normalized by `normalizeManufacturerName`, so they do not need to be
 * enumerated here. Corporate successions, distributors, subsidiaries, and acquisitions are
 * deliberately not inferred. Add those relationships only after catalog-owner review.
 */
const aliasDefinitions: Array<
  readonly [manufacturerId: string, canonicalName: string, additionalAliases?: readonly string[]]
> = [
  ['MFR-122B7208FA', 'VisionAir Solutions'],
  ['MFR-12BAB1E48C', 'Karl Storz'],
  ['MFR-233A56DF24', 'Pulmonx'],
  ['MFR-2760A3270C', 'Cook Medical'],
  ['MFR-27E7CF849C', 'Richard Wolf'],
  ['MFR-31D4851787', 'Teleflex'],
  ['MFR-32A7012B17', 'EFER'],
  ['MFR-42F5245630', 'Boston Scientific'],
  ['MFR-52C1D02F96', 'Micro-Tech Endoscopy'],
  ['MFR-5ED32955F4', 'ERBE', ['Erbe Elektromedizin GmbH']],
  ['MFR-6208838930', 'Novatech'],
  ['MFR-64E3FE0D95', 'Scivita Medical Technology'],
  ['MFR-662CB7215B', 'Verathon'],
  ['MFR-66B998A25F', 'Atrium Medical (Getinge)', ['Atrium Medical Corporation']],
  ['MFR-68565E2FD2', 'Medtronic'],
  ['MFR-6A25149997', 'ICU Medical'],
  ['MFR-6C37CDDB39', 'TRACOE'],
  ['MFR-711B8B255D', 'Auris Health (Johnson & Johnson)', ['Auris Health, Inc.']],
  ['MFR-760E4EA0D7', 'Butterfly Network'],
  ['MFR-797F07B3AC', 'Micro-Tech / Thoracent'],
  ['MFR-80D24820DF', 'Merit Medical', ['Merit Medical Systems, Inc.']],
  ['MFR-90D85DB52E', 'Cardinal Health'],
  ['MFR-954E57FBB9', 'Olympus', ['Olympus Medical Systems Corp.']],
  ['MFR-9D5C8BA4C5', 'Intuitive Surgical'],
  ['MFR-9E9F24E6A8', 'FUJIFILM SonoSite'],
  ['MFR-B91AF4A147', 'Noah Medical'],
  ['MFR-BC7F6D9790', 'Ethicon'],
  ['MFR-C37FF1F1D1', 'Rocket Medical'],
  ['MFR-C84E13E4FD', 'Ambu'],
  ['MFR-CC1ABBE64F', 'Thoracent / M.I.Tech'],
  ['MFR-DF7E28B2EB', 'FUJIFILM'],
  ['MFR-E3F284CAE2', 'BD', ['Becton Dickinson', 'Becton, Dickinson and Company']],
  ['MFR-FEE2053E6E', 'Thoracent'],
]

export const openFdaManufacturerAliasGroups: ManufacturerAliasGroup[] = aliasDefinitions.map(
  ([canonicalManufacturerId, canonicalName, additionalAliases = []]) => ({
    canonicalManufacturerId,
    canonicalName,
    aliases: [canonicalName, ...additionalAliases],
  }),
)

const byManufacturerId = new Map(
  openFdaManufacturerAliasGroups.map((group) => [group.canonicalManufacturerId, group]),
)

export function getOpenFdaManufacturerAliasGroup(
  manufacturerId: string,
  manufacturerName: string | null,
): ManufacturerAliasGroup {
  return (
    byManufacturerId.get(manufacturerId) ?? {
      canonicalManufacturerId: manufacturerId,
      canonicalName: manufacturerName ?? 'Unknown manufacturer',
      aliases: manufacturerName ? [manufacturerName] : [],
    }
  )
}

export function manufacturerMatchesAlias(
  candidateCompany: string | null | undefined,
  aliasGroup: ManufacturerAliasGroup,
): boolean {
  const normalizedCandidate = normalizeManufacturerName(candidateCompany)
  if (!normalizedCandidate) return false
  return [aliasGroup.canonicalName, ...aliasGroup.aliases].some(
    (alias) => normalizeManufacturerName(alias) === normalizedCandidate,
  )
}
