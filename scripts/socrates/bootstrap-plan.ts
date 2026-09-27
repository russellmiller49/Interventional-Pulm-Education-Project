import { z } from 'zod'
import {
  emptyAuthorContent,
  emptyCaseContent,
} from '../../src/features/socrates-builder/case-content'
import { curriculumSourceSchema } from '../../src/features/socrates-builder/curriculum-source'
import { parseDziDescriptorXml } from '../../src/features/socrates-builder/descriptor'
import {
  getInvenioPair,
  INVENIO_DEMO_ORIGIN,
} from '../../src/features/socrates-builder/invenio-source'
import {
  narrativeIssues,
  narrativeTeaching,
} from '../../src/features/socrates-builder/learner-narrative'
import {
  parseSocratesSlideDocument,
  validateSocratesSlideDocument,
} from '../../src/features/socrates-builder/schema'
import type { SocratesCaseDocument } from '../../src/features/socrates-builder/types'
import {
  createImportPlan,
  imageSourceKey,
  sourceKey,
  sourceRecordSchema,
  type Inspection,
  type Snapshot,
  type SourceRecord,
  type PlanRow,
} from './import-plan'

export const WORKBOOK_SHA = 'f4a06fb8ccb06f7993fcfca156c4138df0bc4368e100a0444366c68e7ff2f279'
export const BATCH_IDENTITIES = [
  ['272', '2'],
  ['443', '1'],
  ['171', '1'],
  ['088', '4'],
  ['327', '2'],
  ['041', '4'],
  ['440', '2'],
  ['281', '2'],
  ['233', '2'],
  ['006', '4'],
] as const
const moduleIds = [
  'core-srh-orientation',
  'non-diagnostic-adequacy',
  'normal-lung-airway',
  'cancer',
  'inflammation-infection-granuloma',
  'advanced-cases',
]

/** The existing reader validates both sheets and all module counts before this bounded selection. */
export function batchRecords(inspection: Inspection): SourceRecord[] {
  if (
    inspection.format !== 'socrates-workbook-inspection-v1' ||
    inspection.sha256 !== WORKBOOK_SHA ||
    inspection.records.length !== 59 ||
    inspection.modules.length !== 6 ||
    inspection.modules.some(
      (m, i) => m.id !== moduleIds[i] || m.plannedCount !== [20, 5, 8, 14, 6, 6][i],
    )
  )
    throw new Error('Workbook hash or structure mismatch.')
  return inspection.records.slice(0, 10).map((input, i) => {
    const record = sourceRecordSchema.parse(input)
    const [number, series] = BATCH_IDENTITIES[i]
    if (
      record.workbookSha256 !== WORKBOOK_SHA ||
      record.sourceRow !== i + 2 ||
      record.sourceValues['Overall Order'] !== i + 1 ||
      record.sourceValues['Order in Module'] !== i + 1 ||
      record.moduleId !== moduleIds[0] ||
      record.sourceValues.Module !== 'MODULE 1 — CORE SRH ORIENTATION' ||
      record.identity.key !== sourceKey(number, series) ||
      sourceKey(record.identity.caseNumberAsWritten, record.identity.seriesNumberAsWritten) !==
        record.identity.key ||
      !record.sourceValues['Full Case Name'].startsWith(`Case ${number} · Series ${series} · `)
    )
      throw new Error('Batch 01 source identity or order mismatch.')
    return record
  })
}

const digits = z.string().regex(/^\d+$/)
export const bootstrapCatalogSchema = z.object({
  cases: z.array(
    z.object({
      slides: z.array(
        z.object({
          id: z.string(),
          caseNumber: digits,
          series: digits,
          barcode: z.string(),
          originalDzi: z.string(),
          analysisDzi: z.string(),
        }),
      ),
    }),
  ),
})
export type Catalog = z.infer<typeof bootstrapCatalogSchema>
export type DescriptorReader = (url: string) => Promise<string>
export type Classification =
  | 'existing-exact'
  | 'new-candidate'
  | 'ambiguous'
  | 'missing-image'
  | 'conflict'
export interface BootstrapRow {
  sourceOrder: number
  sourceRow: number
  sourceKey: string
  module: string
  modulePosition: number
  neutralTitle: string
  providerSlideId: string | null
  originalDziUrl: string | null
  analysisDziUrl: string | null
  dimensions: { width: number; height: number } | null
  existingCases: { recordId: string; revision: number; title: string; slug: string }[]
  classification: Classification
  action: 'create' | 'reconcile' | 'hold'
  conflicts: string[]
  creationHolds: string[]
  differences: PlanRow['differences']
}

/** No demo document is used: only empty author defaults and the verified provider pair. */
export function generateDraft(record: SourceRecord, row: BootstrapRow): SocratesCaseDocument {
  const pair = row.originalDziUrl && getInvenioPair(row.originalDziUrl)
  if (
    row.classification !== 'new-candidate' ||
    row.conflicts.length ||
    !row.dimensions ||
    !pair ||
    pair.id !== row.providerSlideId ||
    pair.annotatedUrl !== row.analysisDziUrl ||
    imageSourceKey(pair.tissueUrl) !== record.identity.key ||
    row.sourceKey !== record.identity.key
  )
    throw new Error('Only a verified new candidate can be packaged.')
  const narrative = record.sourceValues['Full Learner-Facing Text']
  if (narrativeIssues(narrative).length) throw new Error('Canonical narrative needs review.')
  const order = String(record.sourceValues['Overall Order']).padStart(2, '0')
  const document: SocratesCaseDocument = {
    schemaVersion: 2,
    slug: `socrates-core-${order}`,
    title: `Core case ${order}`,
    workflowStatus: 'draft',
    revision: 0,
    slide: {
      id: pair.id,
      descriptorUrl: pair.tissueUrl,
      expectedDimensions: { ...row.dimensions },
      initialImageRect: { x: 0, y: 0, ...row.dimensions },
      attribution: { label: 'Invenio Imaging · UCSD Slide Viewer', href: pair.viewerUrl },
      contentStatus: 'Teaching content awaiting author review.',
    },
    annotations: [],
    caseContent: {
      ...emptyCaseContent(),
      learnerNarrative: narrative,
      ...narrativeTeaching(narrative),
    },
    authorContent: {
      ...emptyAuthorContent(),
      curriculumSource: curriculumSourceSchema.parse({
        workbookSha256: record.workbookSha256,
        sourceSheet: record.sourceSheet,
        sourceRow: record.sourceRow,
        sourceValues: record.sourceValues,
      }),
    },
  }
  return validated(document)
}
function validated(document: SocratesCaseDocument): SocratesCaseDocument {
  const result = validateSocratesSlideDocument(document)
  if (!result.success) throw new Error('Generated draft failed validation.')
  return result.data as SocratesCaseDocument
}

function catalogUrl(value: string): string | null {
  try {
    return new URL(value, INVENIO_DEMO_ORIGIN).href
  } catch {
    return null
  }
}

export async function createBootstrapPlan(
  inspection: Inspection,
  catalogInput: unknown,
  readDescriptor: DescriptorReader,
  snapshot?: Snapshot,
) {
  const records = batchRecords(inspection)
  const catalog = bootstrapCatalogSchema.parse(catalogInput)
  const cases = snapshot?.cases.map(parseSocratesSlideDocument) ?? []
  if (
    snapshot &&
    (snapshot.cases.length >= 1000 ||
      cases.some((c) => !c.recordId || c.revision < 1) ||
      new Set(cases.map((c) => c.recordId)).size !== cases.length)
  )
    throw new Error('Snapshot must contain complete saved author cases with unique UUIDs.')
  const rows: BootstrapRow[] = []
  for (const record of records) {
    const key = record.identity.key
    const row: BootstrapRow = {
      sourceOrder: record.sourceValues['Overall Order'],
      sourceRow: record.sourceRow,
      sourceKey: key,
      module: record.sourceValues.Module,
      modulePosition: record.sourceValues['Order in Module'],
      neutralTitle: `Core case ${String(record.sourceValues['Overall Order']).padStart(2, '0')}`,
      providerSlideId: null,
      originalDziUrl: null,
      analysisDziUrl: null,
      dimensions: null,
      existingCases: [],
      classification: 'new-candidate',
      action: 'hold',
      conflicts: [],
      differences: [],
      creationHolds: snapshot
        ? []
        : ['Current authenticated author-case snapshot unavailable; absence is not established.'],
    }
    rows.push(row)
    const matches = catalog.cases
      .flatMap((c) => c.slides)
      .filter((s) => sourceKey(s.caseNumber, s.series) === key)
    if (matches.length !== 1) {
      row.classification = matches.length ? 'ambiguous' : 'missing-image'
      row.conflicts.push(`Expected one provider case AND series match; found ${matches.length}.`)
      continue
    }
    const match = matches[0]
    const pair = getInvenioPair(`${INVENIO_DEMO_ORIGIN}/slides/${match.id}`)
    if (
      !pair ||
      imageSourceKey(pair.tissueUrl) !== key ||
      match.id.split('-barcode-')[1] !== match.barcode.toLowerCase() ||
      catalogUrl(match.originalDzi) !== pair.tissueUrl ||
      catalogUrl(match.analysisDzi) !== pair.annotatedUrl
    ) {
      row.classification = 'conflict'
      row.conflicts.push('Catalog ID, barcode or descriptor URLs disagree; never infer a barcode.')
      continue
    }
    Object.assign(row, {
      providerSlideId: pair.id,
      originalDziUrl: pair.tissueUrl,
      analysisDziUrl: pair.annotatedUrl,
    })
    try {
      const descriptors = await Promise.all([
        readDescriptor(pair.tissueUrl),
        readDescriptor(pair.annotatedUrl),
      ])
      const [tissue, color] = descriptors.map(parseDziDescriptorXml)
      if (tissue.width !== color.width || tissue.height !== color.height) {
        row.classification = 'conflict'
        row.conflicts.push('Tissue and analysis descriptor dimensions differ.')
        continue
      }
      row.dimensions = { width: tissue.width, height: tissue.height }
    } catch {
      row.classification = 'missing-image'
      row.conflicts.push('Could not read both valid JPEG DZI descriptors.')
      continue
    }
    const candidates = cases.filter(
      (c) =>
        getInvenioPair(c.slide.descriptorUrl)?.id === pair.id ||
        c.slide.id === pair.id ||
        imageSourceKey(c.slide.descriptorUrl) === key ||
        (c.authorContent?.curriculumSource?.sourceValues['Full Case Name'] ?? '').startsWith(
          `Case ${record.identity.caseNumberAsWritten} · Series ${record.identity.seriesNumberAsWritten} · `,
        ),
    )
    row.existingCases = candidates.map((c) => ({
      recordId: c.recordId!,
      revision: c.revision,
      title: c.title,
      slug: c.slug,
    }))
    row.conflicts.push(...narrativeIssues(record.sourceValues['Full Learner-Facing Text']))
    if (candidates.length > 1) {
      row.classification = 'ambiguous'
      row.conflicts.push('More than one saved case maps to this source image or source identity.')
    } else if (candidates.length === 1) {
      const existing = candidates[0]
      if (
        existing.schemaVersion !== 2 ||
        existing.slide.descriptorUrl !== pair.tissueUrl ||
        existing.slide.id !== pair.id ||
        existing.slide.expectedDimensions.width !== row.dimensions.width ||
        existing.slide.expectedDimensions.height !== row.dimensions.height
      ) {
        row.classification = 'conflict'
        row.conflicts.push(
          'Saved source candidate is legacy or conflicts with the verified image identity/dimensions.',
        )
      } else {
        row.classification = 'existing-exact'
        row.action = 'reconcile'
        // Hypothetical comparison ONLY. Discard every payload, approval digest and ready status.
        // These flags allow the existing planner to enumerate protected field differences;
        // they are not saved as owner verification and cannot authorize an import.
        const comparison = createImportPlan({ ...inspection, records: [record] }, snapshot!, [
          {
            sourceKey: key,
            targetCaseUuid: existing.recordId,
            expectedRevision: existing.revision,
            expectedImageUrl: pair.tissueUrl,
            identityVerified: true,
            reviewedCurrentDraft: true,
            approvedFields: [],
          },
        ]).rows[0]
        row.differences = comparison.differences
        row.conflicts.push(...comparison.conflicts)
        row.creationHolds.push(
          'Existing exact draft: owner must review field differences and independently verify identity; never create a duplicate.',
        )
      }
    } else if (!snapshot && key === 'case-41-series-4') {
      row.classification = 'conflict'
      row.conflicts.push(
        'Known prior Case 041 author work: snapshot required before packaging a new case.',
      )
    } else if (
      cases.some((c) => c.slug === `socrates-core-${String(row.sourceOrder).padStart(2, '0')}`)
    ) {
      row.classification = 'conflict'
      row.conflicts.push('Neutral slug already belongs to another saved image.')
    }
    if (row.classification === 'new-candidate' && row.conflicts.length)
      row.classification = 'conflict'
    if (row.classification === 'new-candidate' && !row.creationHolds.length) row.action = 'create'
  }
  return {
    format: 'socrates-bootstrap-plan-v1' as const,
    sourceSha256: inspection.sha256,
    snapshotProvided: Boolean(snapshot),
    canApply: false as const,
    rows,
  }
}
