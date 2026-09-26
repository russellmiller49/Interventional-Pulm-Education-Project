import {
  batchRecords,
  BATCH_IDENTITIES,
  createBootstrapPlan,
  generateDraft,
  WORKBOOK_SHA,
} from './bootstrap-plan'
import { bootstrapFixture, syntheticDzi, syntheticNarrative } from './bootstrap-fixtures'
import { sourceKey } from './import-plan'
import {
  catalogProjection,
  trainingProjection,
  revealProjection,
  testProjection,
} from '../../src/features/socrates-study/projections'
import { attemptFixture } from '../../src/features/socrates-study/testing/fixtures'
const read = async () => syntheticDzi
async function setup() {
  const f = bootstrapFixture()
  const plan = await createBootstrapPlan(f.inspection, f.catalog, read, f.snapshot)
  const packages = plan.rows.map((row, i) => generateDraft(f.records[i], row))
  return { ...f, plan, packages }
}
test('fixed hash, ten source rows and exact order; source changes fail closed', () => {
  const { inspection } = bootstrapFixture()
  expect(batchRecords(inspection)).toHaveLength(10)
  expect(batchRecords(inspection).map((r) => r.identity.key)).toEqual(
    BATCH_IDENTITIES.map(([n, s]) => sourceKey(n, s)),
  )
  expect(inspection.sha256).toBe(WORKBOOK_SHA)
  expect(() => batchRecords({ ...inspection, sha256: '0'.repeat(64) })).toThrow()
  expect(() => batchRecords({ ...inspection, records: inspection.records.slice(1) })).toThrow()
  const swapped = JSON.parse(JSON.stringify(inspection))
  ;[swapped.records[0], swapped.records[1]] = [swapped.records[1], swapped.records[0]]
  expect(() => batchRecords(swapped)).toThrow()
})
test('all eight source values and narrative bytes survive JSON packaging with conservative defaults', async () => {
  const { records, packages, plan } = await setup()
  expect(plan.canApply).toBe(false)
  expect(plan.rows.every((r) => r.action === 'create')).toBe(true)
  for (const [i, original] of packages.entries()) {
    const doc = JSON.parse(JSON.stringify(original))
    expect(doc.schemaVersion).toBe(2)
    expect(doc.recordId).toBeUndefined()
    expect(doc.revision).toBe(0)
    expect(doc.workflowStatus).toBe('draft')
    expect(doc.title).toBe(`Core case ${String(i + 1).padStart(2, '0')}`)
    expect(doc.authorContent.curriculumSource.sourceValues).toEqual(records[i].sourceValues)
    expect(
      Buffer.from(doc.caseContent.learnerNarrative).equals(
        Buffer.from(records[i].sourceValues['Full Learner-Facing Text']),
      ),
    ).toBe(true)
    expect(doc.caseContent).toMatchObject({
      trainingEligible: false,
      testingEligible: false,
      diagnosticCategory: '',
      subcategory: '',
      sortOrder: 0,
      vignette: '',
      preliminaryDiagnosis: null,
      annotationLegend: { reviewed: false, entries: [] },
      lowMagnificationObservations: [],
      highMagnificationObservations: [],
      keyLearningPoints: [],
    })
    expect(doc.authorContent.readiness).toEqual({
      contentReview: 'incomplete',
      identifiersVerified: false,
      deidentificationVerified: false,
      imaging: 'incomplete',
      secondaryRose: 'incomplete',
      technicalHold: false,
      holdReason: '',
    })
    expect(doc.annotations).toEqual([])
  }
  expect(JSON.stringify(packages[9])).not.toMatch(
    /b00c0060|tissue-color-correlation|Illustrative teaching regions/,
  )
})
test('case number without matching series is missing; duplicate matches are ambiguous', async () => {
  const f = bootstrapFixture()
  f.catalog.cases[0].slides[0].series = '3'
  const missing = await createBootstrapPlan(f.inspection, f.catalog, read, f.snapshot)
  expect(missing.rows[0].classification).toBe('missing-image')
  expect(() => generateDraft(f.records[0], missing.rows[0])).toThrow()
  f.catalog.cases[0].slides[0].series = '2'
  f.catalog.cases[0].slides.push({ ...f.catalog.cases[0].slides[0] })
  expect((await createBootstrapPlan(f.inspection, f.catalog, read)).rows[0].classification).toBe(
    'ambiguous',
  )
})
test.each(['id', 'barcode', 'originalDzi', 'analysisDzi'] as const)(
  'never guesses a missing/conflicting catalog %s',
  async (field) => {
    const f = bootstrapFixture()
    f.catalog.cases[0].slides[0][field] = 'wrong'
    const spy = jest.fn(read)
    const plan = await createBootstrapPlan(f.inspection, f.catalog, spy, f.snapshot)
    expect(plan.rows[0].classification).toBe('conflict')
    expect(spy).toHaveBeenCalledTimes(18)
  },
)
test('both descriptors must load and dimensions must match; other rows can proceed', async () => {
  const f = bootstrapFixture()
  const plan = await createBootstrapPlan(
    f.inspection,
    f.catalog,
    async (url) =>
      url.includes('nio-272') && url.endsWith('analysis.dzi')
        ? syntheticDzi.replace('9000', '9001')
        : syntheticDzi,
    f.snapshot,
  )
  expect(plan.rows[0].classification).toBe('conflict')
  expect(plan.rows[1].classification).toBe('new-candidate')
  const missing = await createBootstrapPlan(
    f.inspection,
    f.catalog,
    async () => {
      throw new Error('offline')
    },
    f.snapshot,
  )
  expect(missing.rows.every((r) => r.classification === 'missing-image')).toBe(true)
})
test('saved exact cases are reconciled on second run, never duplicated or rewritten (including 041)', async () => {
  const f = await setup()
  const saved = f.packages.map((p, i) => ({
    ...p,
    recordId: `10000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
    revision: 3,
  }))
  saved[5].title = 'Existing author title'
  saved[5].slug = 'existing-author-slug'
  saved[5].caseContent.learnerNarrative = syntheticNarrative.replace(
    'Synthetic observation',
    'Existing author observation',
  )
  const before = JSON.stringify(saved)
  const plan = await createBootstrapPlan(f.inspection, f.catalog, read, {
    ...f.snapshot,
    cases: saved,
  })
  expect(
    plan.rows.every((r) => r.classification === 'existing-exact' && r.action === 'reconcile'),
  ).toBe(true)
  expect(plan.rows[5].differences).toEqual(
    expect.arrayContaining([expect.objectContaining({ field: 'caseContent.learnerNarrative' })]),
  )
  expect(plan.rows[5].conflicts.join(' ')).toContain('Approve existing author-content replacement')
  expect(plan.rows[5].existingCases[0]).toMatchObject({
    title: 'Existing author title',
    slug: 'existing-author-slug',
  })
  expect(JSON.stringify(saved)).toBe(before)
  expect(() => generateDraft(f.records[5], plan.rows[5])).toThrow()
  expect(plan).not.toHaveProperty('payload')
  expect(plan).not.toHaveProperty('approvalDigest')
})
test('missing snapshot is not absence; known 041 work is held without a package', async () => {
  const f = bootstrapFixture()
  const plan = await createBootstrapPlan(f.inspection, f.catalog, read)
  expect(plan.rows.every((r) => r.action === 'hold' && r.creationHolds.length)).toBe(true)
  expect(plan.rows[5].classification).toBe('conflict')
  expect(() => generateDraft(f.records[5], plan.rows[5])).toThrow()
  expect(plan.rows.filter((r) => r.classification === 'new-candidate')).toHaveLength(9)
})
test('multiple saved matches, alternate barcode, legacy source and slug collisions are held', async () => {
  const f = await setup()
  const saved = { ...f.packages[0], recordId: '10000000-0000-4000-8000-000000000001', revision: 1 }
  const plan = (cases: unknown[]) =>
    createBootstrapPlan(f.inspection, f.catalog, read, { ...f.snapshot, cases })
  expect(
    (await plan([saved, { ...saved, recordId: '10000000-0000-4000-8000-000000000002' }])).rows[0]
      .classification,
  ).toBe('ambiguous')
  expect(
    (
      await plan([
        {
          ...saved,
          slide: {
            ...saved.slide,
            descriptorUrl: saved.slide.descriptorUrl.replace('barcode-synthetic', 'barcode-other'),
          },
        },
      ])
    ).rows[0].classification,
  ).toBe('conflict')
  const legacy: Record<string, unknown> = { ...saved }
  delete legacy.caseContent
  delete legacy.authorContent
  expect((await plan([{ ...legacy, schemaVersion: 1 }])).rows[0].classification).toBe('conflict')
  expect((await plan([{ ...saved, slug: 'socrates-core-02' }])).rows[1].classification).toBe(
    'conflict',
  )
  await expect(plan([saved, saved])).rejects.toThrow()
  await expect(plan([f.packages[0]])).rejects.toThrow()
})
test('canonical parse failure holds only that source', async () => {
  const f = bootstrapFixture()
  f.records[2].sourceValues['Full Learner-Facing Text'] = 'unparseable'
  const p = await createBootstrapPlan(f.inspection, f.catalog, read, f.snapshot)
  expect(p.rows[2].classification).toBe('conflict')
  expect(p.rows[1].classification).toBe('new-candidate')
})
test('pre-reveal and presubmission projections exclude private cells, identifiers and teaching', async () => {
  const { packages } = await setup()
  for (const doc of packages) {
    doc.recordId = '10000000-0000-4000-8000-000000000001'
    const before = JSON.stringify([catalogProjection(doc), trainingProjection(doc, true, null)])
    expect(before).not.toMatch(/PRIVATE_|learnerNarrative|Synthetic observation|barcode/)
    expect(revealProjection(doc).teaching.learnerNarrative).toBe(syntheticNarrative)
    const attempt = attemptFixture()
    const projection = testProjection(
      doc,
      attempt,
      { showLegend: false, showColorImage: true, feedbackAfterSubmission: false, survey: [] },
      true,
    )
    expect(JSON.stringify(projection)).not.toMatch(
      /PRIVATE_|learnerNarrative|barcode|Core case|nio-|sourceValues|case-272/,
    )
    expect(projection.feedback).toBeNull()
  }
})
