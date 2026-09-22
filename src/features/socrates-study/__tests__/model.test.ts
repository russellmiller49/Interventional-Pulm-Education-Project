import { createStarterSocratesDocument } from '@/features/socrates-builder/content/starter-document'
import {
  parseSocratesSlideDocument,
  upgradeSocratesDocument,
} from '@/features/socrates-builder/schema'
import { testingReadinessIssues } from '@/features/socrates-builder/case-content'
import { databaseCompatibilityError } from '@/features/socrates-builder/database-compatibility'
import {
  trainingProjection,
  revealProjection,
  testProjection,
  groupCatalog,
  catalogProjection,
} from '../projections'
import { studyConfigSchema, validateResponses } from '../model'
import { completionSummary, studyCsv, type DashboardData } from '../reporting'
import { isPublicPath, getRequiredEntitlement } from '@/lib/site-auth/access'
import { caseFixture, attemptFixture, survey } from '../testing/fixtures'

test('legacy upgrade preserves every original field, with safe ineligible defaults', () => {
  const old = createStarterSocratesDocument()
  old.annotations[0].explanation = 'Legacy detailed explanation'
  const upgraded = upgradeSocratesDocument(old)
  expect(upgraded).toMatchObject(old)
  expect(upgraded.schemaVersion).toBe(2)
  expect(upgraded.caseContent.trainingEligible).toBe(false)
  expect(upgraded.caseContent.testingEligible).toBe(false)
  expect(upgraded.authorContent.readiness.deidentificationVerified).toBe(false)
  expect(old).not.toHaveProperty('schemaVersion')
})
test('complete case package JSON round-trips without losing private fields or geometry', () => {
  const doc = caseFixture()
  expect(parseSocratesSlideDocument(JSON.parse(JSON.stringify(doc)))).toEqual(doc)
  expect(databaseCompatibilityError(doc)).toContain('browser storage') // legacy/public sandbox remains guarded
})
test.each([3, '2', null])('rejects unknown or malformed schema version %p', (schemaVersion) =>
  expect(() => parseSocratesSlideDocument({ ...caseFixture(), schemaVersion })).toThrow(),
)
test('rejects unrecognized top-level content instead of dropping it', () =>
  expect(() =>
    parseSocratesSlideDocument({ ...caseFixture(), unknownNotes: 'unmapped' }),
  ).toThrow())
test('private author fields and unreviewed key never reach training payload', () => {
  const doc = caseFixture()
  doc.caseContent.annotationLegend.reviewed = false
  const payload = JSON.stringify([trainingProjection(doc, true, null), revealProjection(doc)])
  expect(payload).not.toMatch(/PRIVATE_|authorContent|readiness|internalHighlightNotes|barcode/)
  expect(trainingProjection(doc, true, null).legend.entries).toEqual([])
  expect(payload).toContain('ADEQUACY_REASON')
})
test('initial training inspection has no teaching interpretation or regions', () => {
  const data = trainingProjection(caseFixture(), true, null)
  expect(JSON.stringify(data)).not.toMatch(
    /ADEQUACY_KEY|CANCER_KEY|REGION_EXPLANATION|LOW_OBSERVATION|LEARNING_POINT/,
  )
})
test.each([false, true])(
  'pre-submit testing excludes all teaching fields even when feedback configured: %s',
  (feedback) => {
    const data = testProjection(
      caseFixture(),
      attemptFixture(),
      { showLegend: false, showColorImage: false, feedbackAfterSubmission: feedback, survey },
      true,
    )
    expect(JSON.stringify(data)).not.toMatch(
      /PRIVATE_|ADEQUACY_KEY|CANCER_KEY|DIAGNOSIS_KEY|ANSWER_IN_TITLE|REGION_EXPLANATION|LOW_OBSERVATION|LEARNING_POINT|barcode|diagnosticCategory/,
    )
    expect(data.title).toBe('Case 1')
    expect(data.legend).toBeNull()
    expect(data.slide.comparisonDescriptorUrl).toBeUndefined()
  },
)
test('feedback is explicit, postsubmission only; legend and color image obey configuration', () => {
  const attempt = { ...attemptFixture(), submitted_at: '2026-09-22T12:01:00Z' }
  const data = testProjection(
    caseFixture(),
    attempt,
    { showLegend: true, showColorImage: true, feedbackAfterSubmission: true, survey },
    true,
  )
  expect(data.feedback?.adequacy.reasoning).toBe('ADEQUACY_REASON')
  expect(data.legend?.entries).toHaveLength(1)
  expect(data.slide.comparisonDescriptorUrl).toContain('/color/slide.dzi')
  expect(
    testProjection(
      caseFixture(),
      attempt,
      { showLegend: false, showColorImage: false, feedbackAfterSubmission: false, survey },
      true,
    ).feedback,
  ).toBeNull()
})
test.each([
  'contentReview',
  'deidentificationVerified',
  'identifiersVerified',
  'imaging',
  'secondaryRose',
  'technicalHold',
] as const)('readiness blocks unsafe condition: %s', (key) => {
  const doc = caseFixture()
  expect(testingReadinessIssues(doc.caseContent, doc.authorContent)).toEqual([])
  if (key === 'technicalHold') doc.authorContent.readiness[key] = true
  else if (key === 'deidentificationVerified' || key === 'identifiersVerified')
    doc.authorContent.readiness[key] = false
  else doc.authorContent.readiness[key] = 'hold'
  expect(testingReadinessIssues(doc.caseContent, doc.authorContent).length).toBeGreaterThan(0)
})
test('catalog groups and sorts case-level categories', () => {
  const a = catalogProjection(caseFixture())
  const b = { ...a, id: 'other', diagnosticCategory: 'A category', sortOrder: 3 }
  expect(groupCatalog([a, b]).map(([key]) => key)).toEqual(['A category', 'Synthetic category'])
})
test('survey accepts configured responses and rejects invalid, missing and extra items', () => {
  expect(
    validateResponses(survey, { adequacy: 'Option A', cancer: 'Option B', confidence: 'Option A' }),
  ).toEqual({ adequacy: 'Option A', cancer: 'Option B', confidence: 'Option A' })
  expect(() => validateResponses(survey, { adequacy: 'unknown' })).toThrow()
  expect(() => validateResponses(survey, { adequacy: 'Option A' })).toThrow()
  expect(() => validateResponses(survey, { extra: 'Option A' })).toThrow()
})
test('Round 1 and Round 2 configuration uses explicit cases, feedback and survey options', () => {
  const config = {
    slug: 'synthetic-study',
    title: 'Synthetic study',
    version: '1',
    active: false,
    rounds: [1, 2].map((n) => ({
      key: `round-${n}`,
      title: `Round ${n}`,
      showLegend: false,
      showColorImage: false,
      feedbackAfterSubmission: false,
      survey,
      cases: [{ caseId: caseFixture().recordId, revision: 1 }],
    })),
  }
  expect(studyConfigSchema.parse(config)).toEqual(config)
  expect(
    studyConfigSchema.safeParse({ ...config, rounds: [config.rounds[0], config.rounds[0]] })
      .success,
  ).toBe(false)
})
test.each([
  '/en/socrates/testing',
  '/en/socrates/training/one',
  '/en/socrates/testing/export.json',
])('participant routes are never public, even asset-like: %s', (path) => {
  expect(isPublicPath(path)).toBe(false)
  expect(getRequiredEntitlement(path, new URLSearchParams())).toBe('socrates_participant')
})
test('catalog is unlisted public and admin exports are protected', () => {
  expect(isPublicPath('/en/socrates')).toBe(true)
  expect(isPublicPath('/en/admin/socrates/export.json')).toBe(false)
  expect(getRequiredEntitlement('/en/admin/socrates', new URLSearchParams())).toBe('site_admin')
})
test('completion denominators, CSV order, missingness and formula injection protection', () => {
  const attempt = {
    ...attemptFixture(),
    submitted_at: '2026-09-22T12:01:00Z',
    elapsed_ms: 60000,
    responses: {
      adequacy: '=2+2',
      cancer: 'Option B',
      confidence: 'Option A',
      freeText: 'EXCLUDE_UNREVIEWED_FREE_TEXT',
    },
    confidence: 'Option A',
    response_complete: true,
  }
  const data: DashboardData = {
    studies: [],
    rounds: [{ study_id: attempt.study_id, round_key: 'round-1', title: 'Round 1', position: 1 }],
    cases: [{ study_id: attempt.study_id, round_key: 'round-1' }],
    participants: [{ study_id: attempt.study_id, user_id: attempt.user_id }],
    attempts: [attempt],
    training: [],
  }
  expect(completionSummary(data)[0]).toMatchObject({
    started: true,
    completed: true,
    trainingCompleted: 0,
  })
  const csv = studyCsv(data)
  expect(csv).toContain("'=2+2")
  expect(csv).not.toContain('EXCLUDE_UNREVIEWED_FREE_TEXT')
  expect(csv).toContain('60000')
  expect(studyCsv(data)).toBe(csv)
})
