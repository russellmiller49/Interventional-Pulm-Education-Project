import { createHash } from 'node:crypto'
import { z } from 'zod'
import { curriculumSourceSchema } from '../../src/features/socrates-builder/curriculum-source'
import {
  narrativeIssues,
  narrativeTeaching,
} from '../../src/features/socrates-builder/learner-narrative'
import {
  upgradeSocratesDocument,
  parseSocratesSlideDocument,
  validateSocratesSlideDocument,
} from '../../src/features/socrates-builder/schema'
import type { SocratesCaseDocument } from '../../src/features/socrates-builder/types'

const uuid = z.string().uuid()
const keySchema = z.string().regex(/^case-[0-9]+-series-[0-9]+$/)
export const mappingSchema = z
  .array(
    z
      .object({
        sourceKey: keySchema,
        targetCaseUuid: uuid.nullable(),
        expectedRevision: z.number().int().positive().nullable(),
        expectedImageUrl: z.string().nullable(),
        identityVerified: z.boolean(),
        reviewedCurrentDraft: z.boolean(),
        approvedFields: z.array(z.string()).default([]),
      })
      .strict(),
  )
  .superRefine((rows, ctx) => {
    if (
      new Set(rows.map((r) => r.sourceKey)).size !== rows.length ||
      new Set(rows.filter((r) => r.targetCaseUuid).map((r) => r.targetCaseUuid)).size !==
        rows.filter((r) => r.targetCaseUuid).length
    )
      ctx.addIssue({ code: 'custom', message: 'Duplicate source or target mapping.' })
  })
export const sourceRecordSchema = curriculumSourceSchema
  .extend({
    identity: z
      .object({
        caseNumberAsWritten: z.string().regex(/^\d+$/),
        seriesNumberAsWritten: z.string().regex(/^\d+$/),
        key: keySchema,
      })
      .strict(),
    moduleId: z.string(),
    membershipHold: z.string().nullable(),
  })
  .strict()
export type SourceRecord = z.infer<typeof sourceRecordSchema>
export interface Inspection {
  format: 'socrates-workbook-inspection-v1'
  sha256: string
  records: SourceRecord[]
  modules: { id: string; plannedCount: number }[]
}
export interface Snapshot {
  cases: unknown[]
  modules: { id: string; revision: number }[]
  memberships: {
    module_id: string
    case_id: string
    position: number
    source_order: number
    source_key: string
    release_state: string
    decision_note: string
  }[]
}
export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(stableJson).join(',') + ']'
  if (value && typeof value === 'object')
    return (
      '{' +
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => JSON.stringify(k) + ':' + stableJson(v))
        .join(',') +
      '}'
    )
  return JSON.stringify(value) ?? 'null'
}
const equal = (a: unknown, b: unknown) => stableJson(a) === stableJson(b)
export const digest = (value: unknown) =>
  createHash('sha256').update(stableJson(value)).digest('hex')
export function sourceKey(number: string, series: string) {
  return `case-${BigInt(number)}-series-${BigInt(series)}`
}
export function imageSourceKey(url: string) {
  const match =
    /^https:\/\/ucsd-slide-viewer-1080580899927\.us-central1\.run\.app\/generated\/tiles\/nio-(\d+)-series-(\d+)-barcode-[a-z0-9]+\/original\.dzi$/.exec(
      url,
    )
  return match ? sourceKey(match[1], match[2]) : null
}
function populated(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return false
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'object') return Object.values(value).some(populated)
  return true
}
const preserved = [
  'slide',
  'annotations',
  'title',
  'slug',
  'caseContent.vignette',
  'caseContent.diagnosticCategory',
  'caseContent.subcategory',
  'caseContent.sortOrder',
  'caseContent.annotationLegend',
  'caseContent.trainingEligible',
  'caseContent.testingEligible',
  'authorContent.internalHighlightNotes',
  'authorContent.provenanceNotes',
  'authorContent.readiness (except content review)',
]
const knownHolds: Record<string, string> = {
  'case-430-series-2': 'Core membership decision required',
  'case-357-series-2': 'Retention decision required',
  'case-436-series-1': 'Retention decision required',
}
export interface PlanRow {
  sourceRow: number
  sourceKey: string
  moduleId: string
  targetUuid: string | null
  expectedRevision: number | null
  candidateCount: number
  status: 'unmapped' | 'ambiguous' | 'conflict' | 'stale' | 'ready' | 'no-op'
  changedFields: string[]
  preservedFields: string[]
  conflicts: string[]
  membershipHold: string | null
  differences: { field: string; before: unknown; after: unknown }[]
}
export interface ImportUpdate {
  sourceKey: string
  expectedRevision: number
  expectedImageUrl: string
  approvedFields: string[]
  document: SocratesCaseDocument
}
export interface MembershipChange {
  moduleId: string
  expectedRevision: number
  memberships: {
    caseId: string
    position: number
    sourceOrder: number
    sourceKey: string
    state: 'pending' | 'held'
    decision: string
  }[]
}
export interface ImportPayload {
  importId: string
  sourceSha256: string
  updates: ImportUpdate[]
  modules: MembershipChange[]
}
export function createImportPlan(
  inspection: Inspection,
  snapshot: Snapshot,
  mappingInput: unknown,
) {
  const mappings = mappingSchema.parse(mappingInput)
  const originalCases = snapshot.cases.map(parseSocratesSlideDocument)
  const cases = originalCases.map(upgradeSocratesDocument)
  if (new Set(cases.map((c) => c.recordId)).size !== cases.length)
    throw new Error('Duplicate snapshot identity.')
  const rows: PlanRow[] = []
  const updates: ImportUpdate[] = []
  const moduleChanges = new Map<string, MembershipChange>()
  const sourceKeys = new Set<string>()
  for (const input of inspection.records) {
    const record = sourceRecordSchema.parse(input)
    const key = sourceKey(
      record.identity.caseNumberAsWritten,
      record.identity.seriesNumberAsWritten,
    )
    if (
      key !== record.identity.key ||
      record.workbookSha256 !== inspection.sha256 ||
      sourceKeys.has(key)
    )
      throw new Error('Source identity, hash or uniqueness mismatch.')
    sourceKeys.add(key)
    const source = curriculumSourceSchema.parse({
      workbookSha256: record.workbookSha256,
      sourceSheet: record.sourceSheet,
      sourceRow: record.sourceRow,
      sourceValues: record.sourceValues,
    })
    const candidates = cases.filter((c) => imageSourceKey(c.slide.descriptorUrl) === key)
    const mapping = mappings.find((m) => m.sourceKey === key)
    const row: PlanRow = {
      sourceRow: record.sourceRow,
      sourceKey: key,
      moduleId: record.moduleId,
      targetUuid: mapping?.targetCaseUuid ?? null,
      expectedRevision: mapping?.expectedRevision ?? null,
      candidateCount: candidates.length,
      status: candidates.length > 1 ? 'ambiguous' : 'unmapped',
      changedFields: [],
      preservedFields: [...preserved],
      conflicts: narrativeIssues(record.sourceValues['Full Learner-Facing Text']),
      differences: [],
      membershipHold: knownHolds[key] ?? record.membershipHold,
    }
    rows.push(row)
    if (!mapping?.targetCaseUuid || !mapping.expectedRevision || !mapping.expectedImageUrl) {
      row.conflicts.push('Resolve a stable UUID, expected revision and actual image identity.')
      continue
    }
    const before = cases.find((c) => c.recordId === mapping.targetCaseUuid)
    if (originalCases.find((c) => c.recordId === mapping.targetCaseUuid)?.schemaVersion !== 2) {
      row.status = 'conflict'
      row.conflicts.push(
        'Target must be an existing saved v2 case; review and explicitly upgrade legacy drafts first.',
      )
      continue
    }
    if (
      !before ||
      imageSourceKey(before.slide.descriptorUrl) !== key ||
      before.slide.descriptorUrl !== mapping.expectedImageUrl ||
      !mapping.identityVerified ||
      !mapping.reviewedCurrentDraft
    ) {
      row.status = 'conflict'
      row.conflicts.push(
        'Verify case number AND series against the actual source image, and compare the current saved draft.',
      )
      continue
    }
    const narrative = record.sourceValues['Full Learner-Facing Text']
    const after: SocratesCaseDocument = JSON.parse(JSON.stringify(before))
    Object.assign(after.caseContent, {
      learnerNarrative: narrative,
      ...narrativeTeaching(narrative),
    })
    after.authorContent.curriculumSource = source
    const teachingChanged = !equal(before.caseContent, after.caseContent)
    if (teachingChanged) after.authorContent.readiness.contentReview = 'incomplete'
    if (
      before.workflowStatus === 'published' &&
      (!equal(before.caseContent, after.caseContent) ||
        !equal(before.authorContent, after.authorContent))
    )
      after.workflowStatus = 'draft'
    const changes: { field: string; before: unknown; after: unknown }[] = []
    for (const k of [
      'learnerNarrative',
      'lowMagnificationObservations',
      'highMagnificationObservations',
      'keyLearningPoints',
      'adequacy',
      'cancer',
      'preliminaryDiagnosis',
    ] as const) {
      if (!equal(before.caseContent[k], after.caseContent[k])) {
        const field = 'caseContent.' + k
        changes.push({
          field,
          before: before.caseContent[k] ?? null,
          after: after.caseContent[k] ?? null,
        })
        if (populated(before.caseContent[k]) && !mapping.approvedFields.includes(field))
          row.conflicts.push('Approve existing author-content replacement: ' + field)
      }
    }
    if (!equal(before.authorContent.curriculumSource, source)) {
      changes.push({
        field: 'authorContent.curriculumSource',
        before: before.authorContent.curriculumSource ?? null,
        after: source,
      })
      if (
        before.authorContent.curriculumSource &&
        !mapping.approvedFields.includes('authorContent.curriculumSource')
      )
        row.conflicts.push('Approve replacement of the existing source provenance.')
    }
    if (before.workflowStatus !== after.workflowStatus) {
      changes.push({
        field: 'workflowStatus',
        before: before.workflowStatus,
        after: after.workflowStatus,
      })
      if (!mapping.approvedFields.includes('workflowStatus'))
        row.conflicts.push('Approve saving the published case as a draft before changing teaching.')
    }
    if (
      before.authorContent.readiness.contentReview !== after.authorContent.readiness.contentReview
    )
      changes.push({
        field: 'authorContent.readiness.contentReview',
        before: before.authorContent.readiness.contentReview,
        after: after.authorContent.readiness.contentReview,
      })
    row.differences = changes
    row.changedFields = changes.map((c) => c.field)
    if (!validateSocratesSlideDocument(after).success)
      row.conflicts.push(
        'Target draft fails save validation; review its existing annotation key and case fields before importing.',
      )
    const moduleRecord = snapshot.modules.find((m) => m.id === record.moduleId)
    const member = snapshot.memberships.find(
      (m) => m.module_id === record.moduleId && m.case_id === before.recordId,
    )
    const membershipSame =
      member &&
      member.position === record.sourceValues['Order in Module'] &&
      member.source_order === record.sourceValues['Overall Order'] &&
      member.source_key === key &&
      // An administrator's recorded approval settles a source hold; import never re-holds it.
      (!row.membershipHold ||
        member.release_state === 'held' ||
        member.release_state === 'approved')
    if (!moduleRecord)
      row.conflicts.push('Curriculum module is missing from the protected snapshot.')
    if (!membershipSame && member?.release_state === 'approved')
      row.conflicts.push(
        'Approved curriculum membership differs from the source; an administrator must decide the change.',
      )
    if (!membershipSame && moduleRecord) {
      row.changedFields.push('curriculumMembership')
      const collision = snapshot.memberships.find(
        (m) =>
          m.module_id === record.moduleId &&
          m.case_id !== before.recordId &&
          (m.position === record.sourceValues['Order in Module'] || m.source_key === key),
      )
      if (collision)
        row.conflicts.push(
          'Curriculum membership position or source key already belongs to another case.',
        )
    }
    if (row.conflicts.length) {
      row.status = 'conflict'
      continue
    }
    const noChange = changes.length === 0 && membershipSame
    if (!noChange && before.revision !== mapping.expectedRevision) {
      row.status = 'stale'
      row.conflicts.push('Case revision changed; compare the current draft and rebuild the plan.')
      continue
    }
    row.expectedRevision = before.revision
    row.status = noChange ? 'no-op' : 'ready'
    parseSocratesSlideDocument(after)
    if (noChange) continue
    updates.push({
      sourceKey: key,
      expectedRevision: before.revision,
      expectedImageUrl: mapping.expectedImageUrl,
      approvedFields: mapping.approvedFields,
      document: after,
    })
    if (!membershipSame && moduleRecord) {
      const group = moduleChanges.get(record.moduleId) ?? {
        moduleId: record.moduleId,
        expectedRevision: moduleRecord.revision,
        memberships: [],
      }
      group.memberships.push({
        caseId: before.recordId!,
        position: record.sourceValues['Order in Module'],
        sourceOrder: record.sourceValues['Overall Order'],
        sourceKey: key,
        state: row.membershipHold ? 'held' : 'pending',
        decision: row.membershipHold ?? '',
      })
      moduleChanges.set(record.moduleId, group)
    }
  }
  if (mappings.some((m) => !sourceKeys.has(m.sourceKey)))
    throw new Error('Mapping contains a source key absent from this workbook.')
  const body = {
    sourceSha256: inspection.sha256,
    updates,
    modules: [...moduleChanges.values()].sort((a, b) => a.moduleId.localeCompare(b.moduleId)),
  }
  const payload: ImportPayload = { importId: digest(body), ...body }
  const counts = Object.fromEntries(
    ['unmapped', 'ambiguous', 'conflict', 'stale', 'ready', 'no-op'].map((status) => [
      status,
      rows.filter((r) => r.status === status).length,
    ]),
  )
  return {
    format: 'socrates-import-plan-v1' as const,
    rows,
    counts,
    canApply: rows.every((r) => r.status === 'ready' || r.status === 'no-op'),
    payload,
    approvalDigest: digest(payload),
  }
}
