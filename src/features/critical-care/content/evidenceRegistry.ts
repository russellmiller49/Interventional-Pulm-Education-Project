import {
  baxterCrrtEngineSourceRecords,
  baxterCrrtPilotSourceReferences,
  baxterCrrtSourceDocuments,
  baxterCrrtSourceRecords,
} from '@/features/baxter-crrt/content/provenance'
import { baxterCrrtSupplementalSourceReferences } from '@/features/baxter-crrt/content/phase7ReviewSources'
import { cardiohelpEvidence } from '@/features/cardiohelp-ecmo/content/evidence'
import { hemodynamicsSources } from '@/features/icu-hemodynamics/content/sources'
import { ICU_EVIDENCE_SOURCES } from '@/features/icu-simulation/content/evidence'
import { mcsSources } from '@/features/mechanical-circulatory-support/content/sources'
import { ventilationEvidence } from '@/features/mechanical-ventilation/content/evidence'

export type CriticalCareClaimType = 'clinical' | 'device-workflow' | 'model-behavior'

export interface CriticalCareEvidenceRecord {
  readonly id: string
  readonly title: string
  readonly citation: string
  readonly sourceUrl?: string
  readonly limitation: string
  readonly claimType: CriticalCareClaimType
  readonly sourceRegistry:
    | 'hemodynamics'
    | 'ventilation'
    | 'mcs'
    | 'ecmo'
    | 'crrt'
    | 'icu-simulation'
}

function modelClaim(sourceClass: string): CriticalCareClaimType {
  return /model|synthetic|curriculum/i.test(sourceClass) ? 'model-behavior' : 'clinical'
}

const hemodynamicsEvidenceRecords: readonly CriticalCareEvidenceRecord[] = hemodynamicsSources.map(
  (source) => ({
    id: source.id,
    title: source.title,
    citation: source.citation,
    ...(source.url ? { sourceUrl: source.url } : {}),
    limitation: source.limitation ?? 'Review the cited source and current local practice.',
    claimType:
      source.sourceType === 'educational-model'
        ? ('model-behavior' as const)
        : source.sourceType === 'manufacturer-labeling' || source.sourceType === 'workflow-manual'
          ? ('device-workflow' as const)
          : ('clinical' as const),
    sourceRegistry: 'hemodynamics' as const,
  }),
)

const ventilationEvidenceRecords: readonly CriticalCareEvidenceRecord[] = ventilationEvidence.map(
  (source) => ({
    id: source.id,
    title: source.title,
    citation: source.citation,
    ...(source.sourceUrl ? { sourceUrl: source.sourceUrl } : {}),
    limitation: source.limitations,
    claimType:
      source.sourceClass === 'manufacturer'
        ? ('device-workflow' as const)
        : modelClaim(source.sourceClass),
    sourceRegistry: 'ventilation' as const,
  }),
)

const mcsEvidenceRecords: readonly CriticalCareEvidenceRecord[] = mcsSources.map((source) => ({
  id: source.id,
  title: source.title,
  citation: source.citation,
  ...(source.url ? { sourceUrl: source.url } : {}),
  limitation: source.limitation ?? 'Review current device labeling and local policy.',
  claimType:
    source.sourceType === 'educational-model'
      ? ('model-behavior' as const)
      : /manufacturer|fda/i.test(source.sourceType)
        ? ('device-workflow' as const)
        : ('clinical' as const),
  sourceRegistry: 'mcs' as const,
}))

const ecmoEvidenceRecords: readonly CriticalCareEvidenceRecord[] = cardiohelpEvidence.map(
  (source) => ({
    id: source.id,
    title: source.title,
    citation: source.citation,
    ...(source.url ? { sourceUrl: source.url } : {}),
    limitation: source.limitations,
    claimType:
      source.sourceClass === 'manufacturer'
        ? ('device-workflow' as const)
        : modelClaim(source.sourceClass),
    sourceRegistry: 'ecmo' as const,
  }),
)

const crrtDocumentRecords: readonly CriticalCareEvidenceRecord[] = baxterCrrtSourceDocuments.map(
  (source) => ({
    id: source.id,
    title: source.title,
    citation: source.documentIdentity,
    limitation: source.limitation,
    claimType: 'device-workflow' as const,
    sourceRegistry: 'crrt' as const,
  }),
)

const crrtDeviceRecords: readonly CriticalCareEvidenceRecord[] = baxterCrrtSourceRecords.map(
  (source) => ({
    id: source.id,
    title: source.sourceTitle,
    citation: `${source.documentIdentity} · ${source.pageOrSection}`,
    limitation: source.limitation,
    claimType: 'device-workflow' as const,
    sourceRegistry: 'crrt' as const,
  }),
)

const crrtReferenceRecords: readonly CriticalCareEvidenceRecord[] = [
  ...baxterCrrtEngineSourceRecords,
  ...baxterCrrtPilotSourceReferences,
  ...baxterCrrtSupplementalSourceReferences,
].map((source) => ({
  id: source.id,
  title: source.sourceTitle,
  citation: `${source.documentVersion} · ${source.pageOrSection}`,
  limitation: String(source.value ?? 'Use only within the stated source boundary.'),
  claimType: modelClaim(source.sourceType),
  sourceRegistry: 'crrt' as const,
}))

const integratedEvidenceRecords: readonly CriticalCareEvidenceRecord[] = ICU_EVIDENCE_SOURCES.map(
  (source) => ({
    id: source.id,
    title: source.title,
    citation: `${source.organization} (${source.year})`,
    sourceUrl: source.url,
    limitation: source.limitation,
    claimType:
      source.sourceType === 'educational-model'
        ? ('model-behavior' as const)
        : source.sourceType === 'device-source'
          ? ('device-workflow' as const)
          : ('clinical' as const),
    sourceRegistry: 'icu-simulation' as const,
  }),
)

const aggregateBoundaryRecords: readonly CriticalCareEvidenceRecord[] = [
  {
    id: 'mechanical-ventilation-source-boundary',
    title: 'Mechanical ventilation reviewed source boundary',
    citation:
      'Mapped to the module-authoritative manufacturer, clinical-reference, and educational-model registry.',
    limitation:
      'Device workflow remains revision-specific; modeled responses are educational approximations.',
    claimType: 'model-behavior',
    sourceRegistry: 'ventilation',
  },
  {
    id: 'mcs-device-source-registry',
    title: 'Mechanical circulatory support source registry',
    citation:
      'Mapped to the module-authoritative guideline, FDA labeling, manufacturer, safety-notice, and model records.',
    limitation:
      'Current device instructions, local policy, imaging, and specialist judgment remain authoritative.',
    claimType: 'device-workflow',
    sourceRegistry: 'mcs',
  },
  {
    id: 'cardiohelp-i-us-2025',
    title: 'CARDIOHELP-i U.S. 2025 device profile',
    citation:
      'Getinge CARDIOHELP-i Instructions for Use, revision 2.3; software 03.04.10.00 or higher; January 2025.',
    sourceUrl: 'https://www.getinge.com/us/products/cardiohelp-system/',
    limitation:
      'The profile identifies the modeled console boundary and does not extend labeled indications.',
    claimType: 'device-workflow',
    sourceRegistry: 'ecmo',
  },
]

const registryRecords = [
  ...hemodynamicsEvidenceRecords,
  ...ventilationEvidenceRecords,
  ...mcsEvidenceRecords,
  ...ecmoEvidenceRecords,
  ...crrtDocumentRecords,
  ...crrtDeviceRecords,
  ...crrtReferenceRecords,
  ...integratedEvidenceRecords,
  ...aggregateBoundaryRecords,
] as const

const evidenceById = new Map<string, CriticalCareEvidenceRecord>()
for (const record of registryRecords) {
  // Some stable mechanism references intentionally appear in more than one module registry.
  if (!evidenceById.has(record.id)) evidenceById.set(record.id, record)
}

export const criticalCareEvidenceById: ReadonlyMap<string, CriticalCareEvidenceRecord> =
  evidenceById

export function resolveCriticalCareEvidence(
  evidenceIds: readonly string[],
): readonly CriticalCareEvidenceRecord[] {
  return evidenceIds.flatMap((id) => {
    const record = criticalCareEvidenceById.get(id)
    return record ? [record] : []
  })
}
