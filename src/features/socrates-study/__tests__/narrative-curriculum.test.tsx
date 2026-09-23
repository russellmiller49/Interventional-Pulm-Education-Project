import { render, screen } from '@testing-library/react'
import {
  narrativeIssues,
  narrativeSections,
  narrativeTeaching,
} from '@/features/socrates-builder/learner-narrative'
import { parseSocratesSlideDocument } from '@/features/socrates-builder/schema'
import {
  readWebOverlayWorkspace,
  saveWebOverlayWorkspace,
} from '@/features/socrates-builder/web-overlay-storage'
import { caseFixture, attemptFixture, survey } from '../testing/fixtures'
import {
  revealProjection,
  trainingProjection,
  testProjection,
  catalogProjection,
} from '../projections'
import {
  caseProgressLabel,
  moduleNavigation,
  orderedModuleCases,
  type CurriculumModule,
} from '../curriculum'
import { CurriculumDirectory, ModuleNavigation } from '../components/CurriculumDirectory'

export const syntheticNarrative =
  'What to notice\nAt intermediate and high magnification: Synthetic observation.\n\nKey learning point\nA synthetic point, with its qualification.\n\nExpected study classification\nAdequacy: Synthetic adequate. Explicit synthetic reasoning.\nCancer vs non-cancer: Synthetic category. Explicit second reasoning.\n\nCommon pitfall\nA synthetic pitfall.\nAnother paragraph is retained exactly.'

test('canonical narrative retains every paragraph and rejects independently stale structured fields', () => {
  const doc = caseFixture()
  doc.caseContent = {
    ...doc.caseContent,
    learnerNarrative: syntheticNarrative,
    ...narrativeTeaching(syntheticNarrative),
  }
  expect(narrativeIssues(syntheticNarrative)).toEqual([])
  expect(narrativeSections(syntheticNarrative).at(-1)?.body).toContain('Another paragraph')
  expect(parseSocratesSlideDocument(JSON.parse(JSON.stringify(doc)))).toEqual(doc)
  expect(doc.caseContent.lowMagnificationObservations).toEqual([])
  doc.caseContent.cancer.designation = 'Stale contradictory version'
  expect(() => parseSocratesSlideDocument(doc)).toThrow('Narrative is canonical')
})

test.each([
  'A general observation with no magnification.',
  'At high magnification: Synthetic observation.',
])('missing magnification paragraphs stay missing: %s', (notice) => {
  const narrative = syntheticNarrative.replace(
    'At intermediate and high magnification: Synthetic observation.',
    notice,
  )
  expect(narrativeIssues(narrative)).toEqual([])
  expect(narrativeTeaching(narrative).lowMagnificationObservations).toEqual([])
  expect(narrativeTeaching(narrative).highMagnificationObservations).toEqual([])
})

test('narrative classifications require explicit labels and reasoning, never titles', () => {
  const narrative = syntheticNarrative.replace(
    'Adequacy: Synthetic adequate. Explicit synthetic reasoning.',
    'A possible category',
  )
  expect(narrativeTeaching(narrative).adequacy).toEqual({ designation: '', reasoning: '' })
  expect(narrativeIssues(narrative).length).toBeGreaterThan(0)
})

test('browser reload preserves canonical source text; projections withhold answers until reveal/submission', () => {
  const doc = caseFixture()
  doc.caseContent = {
    ...doc.caseContent,
    learnerNarrative: syntheticNarrative,
    ...narrativeTeaching(syntheticNarrative),
  }
  expect(saveWebOverlayWorkspace({ version: 1, activeDocument: doc, documents: [doc] })).toBeNull()
  expect(readWebOverlayWorkspace().workspace.activeDocument).toEqual(doc)
  for (const value of [
    trainingProjection(doc, true, null),
    testProjection(
      doc,
      attemptFixture(),
      {
        showLegend: false,
        showColorImage: true,
        feedbackAfterSubmission: true,
        survey,
      },
      true,
    ),
  ]) {
    expect(JSON.stringify(value)).not.toMatch(
      /learnerNarrative|synthetic pitfall|PRIVATE_|curriculumSource/,
    )
  }
  expect(revealProjection(doc).teaching.learnerNarrative).toBe(syntheticNarrative)
  expect(
    testProjection(
      doc,
      { ...attemptFixture(), submitted_at: '2026-09-23T00:00:00Z' },
      {
        showLegend: false,
        showColorImage: true,
        feedbackAfterSubmission: true,
        survey,
      },
      true,
    ).feedback?.learnerNarrative,
  ).toBe(syntheticNarrative)
})

function moduleFixture(): CurriculumModule {
  const entry = catalogProjection(caseFixture())
  return {
    id: 'core',
    title: 'Synthetic core',
    purpose: 'Synthetic purpose',
    displayOrder: 1,
    recommendedStart: true,
    level: 'Core',
    plannedCount: 20,
    cases: [
      { ...entry, id: '10000000-0000-4000-8000-000000000002', position: 6 },
      { ...entry, id: '10000000-0000-4000-8000-000000000001', position: 1 },
    ],
  }
}
test('module order and navigation use memberships, with no cross-module fallback or duplicated case docs', () => {
  const module = moduleFixture()
  const other = { ...module, id: 'other', cases: [{ ...module.cases[0], position: 1 }] }
  expect(orderedModuleCases(module).map((c) => c.position)).toEqual([1, 6])
  const nav = moduleNavigation([module, other], 'core', module.cases[0].id)!
  expect(nav.next).toBeNull()
  expect(nav.previous?.position).toBe(1)
  expect(moduleNavigation([module], 'unknown', module.cases[0].id)).toBeNull()
  render(<ModuleNavigation locale="en" navigation={nav} />)
  expect(screen.getByRole('link', { name: 'Previous case in module' })).toHaveAttribute(
    'href',
    expect.stringContaining('?module=core'),
  )
  expect(screen.queryByRole('link', { name: 'Next case in module' })).not.toBeInTheDocument()
})
test('directory separates planned/available counts and progress distinguishes opened from completed', () => {
  const module = moduleFixture()
  render(
    <CurriculumDirectory locale="en" modules={[module]} cases={module.cases} progress={null} />,
  )
  expect(screen.getByText('Recommended starting point')).toBeVisible()
  expect(screen.getByText('2 available / 20 planned cases')).toBeVisible()
  const entry = module.cases[0]
  const progress = {
    case_id: entry.id,
    case_revision: entry.revision,
    opened_at: '2026-09-23T00:00:00Z',
    revealed_at: null,
    completed_at: null,
  }
  expect(caseProgressLabel(entry, [progress])).toBe('Opened')
  expect(caseProgressLabel(entry, [{ ...progress, completed_at: '2026-09-23T00:01:00Z' }])).toBe(
    'Completed',
  )
  expect(caseProgressLabel(entry, [{ ...progress, case_revision: entry.revision + 1 }])).toBe(
    'Not started',
  )
})
