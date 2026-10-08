import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { caseFixture } from '@/features/socrates-study/testing/fixtures'
import { SocratesLearningWorkspace } from '../components/SocratesLearningWorkspace'
import { collectionSchema, currentProgress, PROGRESS_KEY, teachingSections } from '../model'
import { narrativeTeaching } from '@/features/socrates-builder/learner-narrative'

const mockViewer = jest.fn()
jest.mock('@/features/socrates-study/components/StudyViewer', () => ({
  StudyViewer: (props: unknown) => {
    mockViewer(props)
    return <div data-testid="viewer" />
  },
}))
function previewFixture() {
  const doc = caseFixture()
  delete doc.recordId
  doc.revision = 0
  doc.workflowStatus = 'draft'
  doc.caseContent.trainingEligible = false
  doc.caseContent.testingEligible = false
  return doc
}
beforeEach(() => {
  localStorage.clear()
  jest.clearAllMocks()
})

test('testing is a separate tissue-only module with no teaching or answer reveal before or after commitment', async () => {
  const user = userEvent.setup()
  const doc = previewFixture()
  const view = render(<SocratesLearningWorkspace documents={[doc]} />)
  await user.click(screen.getByRole('button', { name: 'Open testing module' }))
  expect(screen.queryByText(doc.title)).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Start testing' }))
  expect(mockViewer.mock.lastCall[0]).toMatchObject({ tissueOnly: true, annotations: [] })
  const hidden = [
    doc.title,
    'LOW_OBSERVATION',
    'CANCER_KEY',
    'CANCER_REASON',
    'PRIVATE_HIGHLIGHT',
    'PRIVATE_PROVENANCE',
    'REGION_EXPLANATION',
    doc.caseContent.annotationLegend.entries[0].label,
  ]
  for (const text of hidden) expect(screen.queryByText(text)).not.toBeInTheDocument()
  await user.click(screen.getByRole('radio', { name: 'Adequate' }))
  await user.click(screen.getByRole('radio', { name: 'Non-cancer' }))
  await user.click(screen.getByRole('radio', { name: 'High' }))
  await user.type(screen.getByRole('textbox', { name: /Reasoning/ }), 'My observations')
  await user.click(screen.getByRole('button', { name: 'Submit interpretation' }))
  expect(screen.getByRole('heading', { name: 'Interpretation submitted' })).toBeVisible()
  expect(screen.getByText('My observations')).toBeVisible()
  expect(screen.queryByRole('radio')).not.toBeInTheDocument()
  for (const text of hidden) expect(screen.queryByText(text)).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /reveal|teach|answer/i })).not.toBeInTheDocument()
  expect(screen.queryByRole('region', { name: 'Annotation color key' })).not.toBeInTheDocument()
  expect(mockViewer.mock.lastCall[0]).toMatchObject({ tissueOnly: true, annotations: [] })
  view.unmount()
  render(<SocratesLearningWorkspace documents={[doc]} />)
  await user.click(screen.getByRole('button', { name: 'Open testing module' }))
  await user.click(screen.getByRole('button', { name: /Slide 01 Submitted/ }))
  expect(screen.getByText('My observations')).toBeVisible()
  for (const text of hidden) expect(screen.queryByText(text)).not.toBeInTheDocument()
})

test('teaching works without bounding boxes, resumes its step, and never submits a test', async () => {
  const user = userEvent.setup()
  const doc = previewFixture()
  doc.annotations = []
  const view = render(<SocratesLearningWorkspace documents={[doc]} />)
  await user.click(screen.getByRole('button', { name: 'Open teaching module' }))
  await user.click(screen.getByRole('button', { name: 'Start teaching' }))
  expect(screen.getByText('Synthetic case context')).toBeVisible()
  expect(screen.getByRole('region', { name: 'Annotation color key' })).toHaveTextContent(
    doc.caseContent.annotationLegend.entries[0].label,
  )
  await user.click(screen.getByRole('button', { name: 'Continue' }))
  expect(screen.getByText('LOW_OBSERVATION')).toBeVisible()
  expect(screen.queryByText('HIGH_OBSERVATION')).not.toBeInTheDocument()
  expect(mockViewer.mock.lastCall[0]).toMatchObject({ tissueOnly: false, annotations: [] })
  await user.click(screen.getByRole('button', { name: 'Continue' }))
  expect(screen.getByText('HIGH_OBSERVATION')).toBeVisible()
  view.unmount()
  render(<SocratesLearningWorkspace documents={[doc]} />)
  await user.click(screen.getByRole('button', { name: 'Open teaching module' }))
  await user.click(screen.getByRole('button', { name: /ANSWER_IN_TITLE In progress/ }))
  expect(screen.getByText('HIGH_OBSERVATION')).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Teaching interpretation' }))
  await user.click(screen.getByRole('button', { name: 'Complete teaching' }))
  expect(screen.getByRole('status')).toHaveTextContent('Teaching reviewed')
  const progress = JSON.parse(localStorage.getItem(PROGRESS_KEY)!)
  expect(currentProgress(doc, progress)).toMatchObject({
    teachingComplete: true,
    teachingViewed: true,
  })
  expect(currentProgress(doc, progress).submission).toBeUndefined()
})

test('unreviewed annotation keys remain pending in teaching rather than displaying unapproved labels', async () => {
  const user = userEvent.setup()
  const doc = previewFixture()
  doc.caseContent.annotationLegend.reviewed = false
  render(<SocratesLearningWorkspace documents={[doc]} />)
  await user.click(screen.getByRole('button', { name: 'Open teaching module' }))
  await user.click(screen.getByRole('button', { name: 'Start teaching' }))
  expect(screen.getByRole('region', { name: 'Annotation color key' })).toHaveTextContent(
    'Annotation key pending review',
  )
  expect(
    screen.queryByText(doc.caseContent.annotationLegend.entries[0].label),
  ).not.toBeInTheDocument()
})

test('rejects incomplete answers and keeps saved answers tied to the actual case content', async () => {
  const user = userEvent.setup()
  const doc = previewFixture()
  render(<SocratesLearningWorkspace documents={[doc]} />)
  await user.click(screen.getByRole('button', { name: 'Open testing module' }))
  await user.click(screen.getByRole('button', { name: 'Start testing' }))
  fireEvent.submit(
    within(screen.getByRole('region', { name: 'Testing response' }))
      .getByRole('button', { name: 'Submit interpretation' })
      .closest('form')!,
  )
  expect(screen.getByRole('alert')).toHaveTextContent('Choose an answer')
  expect(screen.queryByText('Interpretation submitted')).not.toBeInTheDocument()
  await user.click(screen.getByRole('radio', { name: 'High' }))
  const progress = JSON.parse(localStorage.getItem(PROGRESS_KEY)!)
  expect(currentProgress(doc, progress).draft.confidence).toBe('High')
  doc.caseContent.lowMagnificationObservations = ['UPDATED_OBSERVATION']
  expect(currentProgress(doc, progress).draft).toEqual({})
})

test('progress storage failures are visible and author previews do not record module progress', async () => {
  const user = userEvent.setup()
  const doc = previewFixture()
  const view = render(<SocratesLearningWorkspace documents={[doc]} />)
  const storage = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('quota')
  })
  await user.click(screen.getByRole('button', { name: 'Open teaching module' }))
  await user.click(screen.getByRole('button', { name: 'Start teaching' }))
  expect(screen.getByRole('alert')).toHaveTextContent('storage is unavailable or full')
  storage.mockRestore()
  view.unmount()
  render(
    <SocratesLearningWorkspace
      documents={[doc]}
      assignments={{}}
      preview={{ id: doc.slug, mode: 'testing' }}
    />,
  )
  await user.click(screen.getByRole('radio', { name: 'High' }))
  expect(localStorage.getItem(PROGRESS_KEY)).toBeNull()
})

test('only assigned cases enter each module and testing titles remain neutral', async () => {
  const user = userEvent.setup()
  const teach = previewFixture()
  const test = { ...previewFixture(), slug: 'testing-case', title: 'HIDDEN_TEST_DIAGNOSIS' }
  const unassigned = { ...previewFixture(), slug: 'unassigned', title: 'UNASSIGNED_DIAGNOSIS' }
  render(
    <SocratesLearningWorkspace
      documents={[teach, test, unassigned]}
      assignments={{ [teach.slug]: 'teaching', [test.slug]: 'testing' }}
    />,
  )
  expect(screen.getByText('0 / 1 reviewed')).toBeVisible()
  expect(screen.getByText('0 / 1 submitted')).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Open teaching module' }))
  expect(screen.getByRole('button', { name: /ANSWER_IN_TITLE/ })).toBeVisible()
  expect(screen.queryByText(test.title)).not.toBeInTheDocument()
  expect(screen.queryByText(unassigned.title)).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'All modules' }))
  await user.click(screen.getByRole('button', { name: 'Open testing module' }))
  expect(screen.getByRole('button', { name: /Slide 01/ })).toBeVisible()
  expect(screen.queryByText(teach.title)).not.toBeInTheDocument()
  expect(screen.queryByText(test.title)).not.toBeInTheDocument()
})

test('local curriculum validation rejects saved case identities, duplicate slides, and release eligibility', () => {
  const doc = previewFixture()
  const pkg = { format: 'socrates-local-curriculum-v1', title: 'Synthetic', documents: [doc] }
  expect(collectionSchema.safeParse(pkg).success).toBe(true)
  expect(collectionSchema.safeParse({ ...pkg, documents: [doc, doc] }).success).toBe(false)
  expect(
    collectionSchema.safeParse({
      ...pkg,
      documents: [{ ...doc, recordId: '10000000-0000-4000-8000-000000000001' }],
    }).success,
  ).toBe(false)
  doc.caseContent.testingEligible = true
  expect(collectionSchema.safeParse(pkg).success).toBe(false)
})

test('teaching partitions only explicit source headings, preserving qualification and paragraph text', () => {
  const doc = previewFixture()
  doc.caseContent.vignette = ''
  const text =
    'What to notice\nAt low magnification: Architecture remains organized.\nAt high magnification: Cells vary. Do not infer a subtype.\n\nKey learning point\nPreserve this qualification.\n\nExpected study classification\nAdequacy: Adequate. Authored reason.\nCancer vs non-cancer: Non-cancer. Authored reason.\n\nCommon pitfall\nDo not omit this paragraph.'
  Object.assign(doc.caseContent, { learnerNarrative: text, ...narrativeTeaching(text) })
  const sections = teachingSections(doc)
  expect(sections.map((s) => s.title)).toEqual([
    'Low magnification',
    'High magnification',
    'Key learning point',
    'Expected study classification',
    'Common pitfall',
  ])
  expect(sections[1].text).toBe('Cells vary. Do not infer a subtype.')
  expect(sections[4].text).toBe('Do not omit this paragraph.')
  doc.caseContent.learnerNarrative = 'Unexpected preamble\n' + text
  expect(teachingSections(doc)[0].text).toBe(doc.caseContent.learnerNarrative)
})
