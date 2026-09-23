import { createImportPlan, type Inspection, type Snapshot, type SourceRecord } from './import-plan'
import { caseFixture } from '../../src/features/socrates-study/testing/fixtures'
import { emptyCaseContent } from '../../src/features/socrates-builder/case-content'
import { narrativeTeaching } from '../../src/features/socrates-builder/learner-narrative'

const narrative =
  'What to notice\nA general synthetic observation.\n\nKey learning point\nA synthetic point.\n\nExpected study classification\nAdequacy: Synthetic adequate. Synthetic adequacy reasoning.\nCancer vs non-cancer: Synthetic category. Synthetic category reasoning.\n\nCommon pitfall\nA synthetic pitfall.'
function source(number = '090', series = '3', position = 1): SourceRecord {
  return {
    workbookSha256: 'a'.repeat(64),
    sourceSheet: 'Curriculum Sequence',
    sourceRow: position + 1,
    sourceValues: {
      'Overall Order': position,
      Module: 'MODULE 1 — CORE SRH ORIENTATION',
      'Order in Module': position,
      'Full Case Name': `Case ${number} · Series ${series} · Synthetic`,
      'Curriculum Role': 'PRIVATE_ROLE',
      'Teaching Objective / Why Here': 'PRIVATE_OBJECTIVE',
      'Full Learner-Facing Text': narrative,
      'Internal Note · Not Learner-Facing': null,
    },
    identity: {
      caseNumberAsWritten: number,
      seriesNumberAsWritten: series,
      key: `case-${Number(number)}-series-${Number(series)}`,
    },
    moduleId: 'core-srh-orientation',
    membershipHold: null,
  }
}
function setup(records = [source()]) {
  const inspection: Inspection = {
    format: 'socrates-workbook-inspection-v1',
    sha256: 'a'.repeat(64),
    modules: [{ id: 'core-srh-orientation', plannedCount: 20 }],
    records,
  }
  const cases = records.map((r, index) => {
    const doc = caseFixture()
    doc.recordId = `10000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`
    doc.caseContent = emptyCaseContent()
    doc.slide.descriptorUrl = `https://ucsd-slide-viewer-1080580899927.us-central1.run.app/generated/tiles/nio-${r.identity.caseNumberAsWritten}-series-${r.identity.seriesNumberAsWritten}-barcode-synthetic${index}/original.dzi`
    return doc
  })
  const snapshot: Snapshot = {
    cases,
    modules: [{ id: 'core-srh-orientation', revision: 0 }],
    memberships: [],
  }
  const mappings = records.map((r, index) => ({
    sourceKey: r.identity.key,
    targetCaseUuid: cases[index].recordId!,
    expectedRevision: cases[index].revision,
    expectedImageUrl: cases[index].slide.descriptorUrl,
    identityVerified: true,
    reviewedCurrentDraft: true,
    approvedFields: [] as string[],
  }))
  return { inspection, snapshot, mappings, cases }
}
test('matching needs explicit UUID/revision plus case AND series/image verification and draft comparison', () => {
  const { inspection, snapshot, mappings } = setup([source(), source('090', '1', 2)])
  expect(createImportPlan(inspection, snapshot, []).counts.unmapped).toBe(2)
  const plan = createImportPlan(inspection, snapshot, mappings)
  expect(plan.canApply).toBe(true)
  expect(plan.payload.updates.map((u) => u.sourceKey)).toEqual([
    'case-90-series-3',
    'case-90-series-1',
  ])
  expect(plan.payload.updates[0].document.recordId).not.toBe(
    plan.payload.updates[1].document.recordId,
  )
  for (const patch of [
    { identityVerified: false },
    { reviewedCurrentDraft: false },
    { expectedImageUrl: mappings[1].expectedImageUrl },
  ])
    expect(
      createImportPlan(inspection, snapshot, [{ ...mappings[0], ...patch }, mappings[1]]).canApply,
    ).toBe(false)
})
test('zero and multiple candidates remain unresolved without explicit mapping', () => {
  const { inspection, snapshot, cases } = setup()
  expect(createImportPlan(inspection, { ...snapshot, cases: [] }, []).rows[0].candidateCount).toBe(
    0,
  )
  const duplicate = { ...cases[0], recordId: '20000000-0000-4000-8000-000000000001' }
  expect(
    createImportPlan(inspection, { ...snapshot, cases: [...cases, duplicate] }, []).rows[0].status,
  ).toBe('ambiguous')
})
test('dry run rejects legacy targets and invalid reviewed keys before apply', () => {
  const { inspection, snapshot, mappings, cases } = setup()
  const legacy: Record<string, unknown> = { ...cases[0], schemaVersion: 1 }
  delete legacy.caseContent
  delete legacy.authorContent
  snapshot.cases = [legacy]
  expect(createImportPlan(inspection, snapshot, mappings).rows[0].conflicts).toContain(
    'Target must be an existing saved v2 case; review and explicitly upgrade legacy drafts first.',
  )
  snapshot.cases = cases
  cases[0].caseContent.annotationLegend = {
    reviewed: true,
    entries: [{ label: 'Pending label', color: '#808080', explanation: '' }],
  }
  const plan = createImportPlan(inspection, snapshot, mappings)
  expect(plan.canApply).toBe(false)
  expect(plan.payload.updates).toHaveLength(0)
  expect(plan.rows[0].conflicts).toContain(
    'Target draft fails save validation; review its existing annotation key and case fields before importing.',
  )
})
test('import preserves geometry, sources, private notes, flags, blank cells, and exact narrative', () => {
  const { inspection, snapshot, mappings, cases } = setup()
  const plan = createImportPlan(inspection, snapshot, mappings)
  const after = plan.payload.updates[0].document
  expect(after.caseContent.learnerNarrative).toBe(narrative)
  expect(
    after.authorContent.curriculumSource?.sourceValues['Internal Note · Not Learner-Facing'],
  ).toBeNull()
  expect(after.authorContent.internalHighlightNotes).toBe(
    cases[0].authorContent.internalHighlightNotes,
  )
  expect(after.slide).toEqual(cases[0].slide)
  expect(after.annotations).toEqual(cases[0].annotations)
  expect(after.caseContent.testingEligible).toBe(cases[0].caseContent.testingEligible)
  expect(after.authorContent.readiness).toEqual({
    ...cases[0].authorContent.readiness,
    contentReview: 'incomplete',
  })
  expect(plan.payload.modules[0].memberships[0].state).toBe('pending')
})
test('current author edits and stale revisions are held; per-field approval is explicit', () => {
  const { inspection, snapshot, mappings, cases } = setup()
  cases[0].caseContent.lowMagnificationObservations = ['An existing author paragraph']
  let plan = createImportPlan(inspection, snapshot, mappings)
  expect(plan.rows[0].conflicts).toContain(
    'Approve existing author-content replacement: caseContent.lowMagnificationObservations',
  )
  expect(plan.payload.updates).toHaveLength(0)
  mappings[0].approvedFields = ['caseContent.lowMagnificationObservations']
  expect(createImportPlan(inspection, snapshot, mappings).canApply).toBe(true)
  cases[0].revision = 2
  plan = createImportPlan(inspection, snapshot, mappings)
  expect(plan.rows[0].status).toBe('stale')
})
test('repeat import is a no-op after saved revision, without losing original labels', () => {
  const { inspection, snapshot, mappings } = setup()
  const plan = createImportPlan(inspection, snapshot, mappings)
  const saved = { ...plan.payload.updates[0].document, revision: 2 }
  snapshot.cases = [saved]
  snapshot.memberships = [
    {
      module_id: 'core-srh-orientation',
      case_id: saved.recordId!,
      position: 1,
      source_order: 1,
      source_key: 'case-90-series-3',
      release_state: 'pending',
      decision_note: '',
    },
  ]
  const repeated = createImportPlan(inspection, snapshot, mappings)
  expect(repeated.canApply).toBe(true)
  expect(repeated.rows[0].status).toBe('no-op')
  expect(repeated.payload.updates).toHaveLength(0)
  expect(saved.authorContent.curriculumSource?.sourceValues['Full Case Name']).toContain('Case 090')
})
test.each([
  ['430', '2'],
  ['357', '2'],
  ['436', '1'],
])('source decision %s/%s cannot be implicitly released', (number, series) => {
  const { inspection, snapshot, mappings } = setup([source(number, series)])
  const plan = createImportPlan(inspection, snapshot, mappings)
  expect(plan.rows[0].membershipHold).toBeTruthy()
  expect(plan.payload.modules[0].memberships[0].state).toBe('held')
})
test.each([
  ['430', '2'],
  ['090', '3'],
])(
  'administrator-approved membership %s/%s is never re-held or demoted by import',
  (number, series) => {
    const { inspection, snapshot, mappings } = setup([source(number, series)])
    const saved = {
      ...createImportPlan(inspection, snapshot, mappings).payload.updates[0].document,
      revision: 2,
    }
    snapshot.cases = [saved]
    mappings[0].expectedRevision = 2
    const approved = {
      module_id: 'core-srh-orientation',
      case_id: saved.recordId!,
      position: 1,
      source_order: 1,
      source_key: `case-${Number(number)}-series-${Number(series)}`,
      release_state: 'approved',
      decision_note: 'Synthetic administrator decision',
    }
    snapshot.memberships = [approved]
    const repeated = createImportPlan(inspection, snapshot, mappings)
    expect(repeated.rows[0].status).toBe('no-op')
    expect(repeated.payload.modules).toHaveLength(0)
    snapshot.memberships = [{ ...approved, source_order: 5 }]
    const changed = createImportPlan(inspection, snapshot, mappings)
    expect(changed.canApply).toBe(false)
    expect(changed.payload.modules).toHaveLength(0)
    expect(changed.rows[0].conflicts).toContain(
      'Approved curriculum membership differs from the source; an administrator must decide the change.',
    )
  },
)
test('common pitfall, alternate headings and general observations remain verbatim, ambiguous classification held', () => {
  const { inspection, snapshot, mappings } = setup()
  for (const phrase of [
    'At medium to high magnification:',
    'At intermediate and high magnification:',
    'General observations:',
  ]) {
    const text = narrative.replace(
      'A general synthetic observation.',
      phrase + ' Exact synthetic text.',
    )
    inspection.records[0].sourceValues['Full Learner-Facing Text'] = text
    const plan = createImportPlan(inspection, snapshot, mappings)
    expect(plan.payload.updates[0].document.caseContent.learnerNarrative).toBe(text)
    expect(plan.payload.updates[0].document.caseContent).toMatchObject(narrativeTeaching(text))
  }
  inspection.records[0].sourceValues['Full Learner-Facing Text'] = narrative.replace(
    'Adequacy:',
    'Possible adequacy:',
  )
  expect(createImportPlan(inspection, snapshot, mappings).canApply).toBe(false)
})
test('duplicate source mappings, guessed targets and duplicate target assignments are rejected', () => {
  const { inspection, snapshot, mappings } = setup()
  expect(() => createImportPlan(inspection, snapshot, [mappings[0], mappings[0]])).toThrow()
  expect(
    createImportPlan(inspection, snapshot, [
      { ...mappings[0], targetCaseUuid: '20000000-0000-4000-8000-000000000001' },
    ]).canApply,
  ).toBe(false)
})
