import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { caseFixture } from '@/features/socrates-study/testing/fixtures'
import { INVENIO_DEMO_ORIGIN } from '@/features/socrates-builder/invenio-source'
import { coreTeachingCases, coreTeachingSections, coreTeachingSequence } from '../core-teaching'
import { learningDocuments, moduleName, signature } from '../model'
import { publishedLibraryDocument } from '../shared-library'
import { SocratesLearningWorkspace } from '../components/SocratesLearningWorkspace'

jest.mock('@/features/socrates-study/components/StudyViewer', () => ({
  StudyViewer: () => <div />,
}))
const expected = [
  '272/2',
  '142/3',
  '443/1',
  '055/2',
  '440/2',
  '006/4',
  '435/2',
  '171/1',
  '088/4',
  '422/2',
  '229/1',
  '327/2',
  '023/3',
  '026/1',
  '041/4',
  '216/4',
  '320/2',
  '281/2',
  '233/2',
  '341/1',
  '240/4',
  '393/1',
  '258/3',
  '192/2',
  '430/2',
]
function fixture(identity: string, previous: number) {
  const doc = caseFixture()
  delete doc.recordId
  const [number, series] = identity.split('/')
  doc.slug = `fixture-${number}-${series}`
  doc.title = `Fixture ${identity}`
  doc.slide.descriptorUrl = `${INVENIO_DEMO_ORIGIN}/generated/tiles/nio-${number}-series-${series}-barcode-test/original.dzi`
  doc.caseContent.sortOrder = previous
  return doc
}
beforeEach(() => localStorage.clear())

test('the 25 core case-series identities follow the workbook and its exact 7/4/3/11 groups', () => {
  const documents = expected.map((identity, index) => fixture(identity, 100 - index)).reverse()
  expect(coreTeachingCases).toHaveLength(25)
  expect(new Set(coreTeachingCases.map((c) => c.key)).size).toBe(25)
  const ordered = learningDocuments(documents)
  expect(ordered.map((doc) => doc.title)).toEqual(expected.map((identity) => `Fixture ${identity}`))
  expect(
    coreTeachingSections.map((s) => ordered.filter((doc) => moduleName(doc) === s.title).length),
  ).toEqual([7, 4, 3, 11])
  expect(learningDocuments(documents, 'testing').map((doc) => doc.title)).toEqual(
    [...ordered].reverse().map((doc) => doc.title),
  )
  const other = fixture('272/3', 0)
  expect(coreTeachingSequence(other)).toBeNull()
  expect(learningDocuments([other, ...documents]).at(-1)).toBe(other)
})

test('only public teaching positions and sections cross the relay; ordering never resets content progress', () => {
  const doc = fixture('142/3', 27)
  const before = JSON.stringify(doc)
  const originalSignature = signature(doc)
  const teaching = publishedLibraryDocument(doc, 'teaching', '70000000-0000-4000-8000-000000000001')
  expect(teaching.caseContent.coreTeachingSequence).toEqual({
    position: 2,
    section: 'normal-benign',
  })
  expect(coreTeachingSequence(teaching)).toEqual(teaching.caseContent.coreTeachingSequence)
  doc.caseContent.coreTeachingSequence = teaching.caseContent.coreTeachingSequence
  expect(signature(doc)).toBe(originalSignature)
  delete doc.caseContent.coreTeachingSequence
  expect(JSON.stringify(doc)).toBe(before)
  const testing = publishedLibraryDocument(doc, 'testing', '70000000-0000-4000-8000-000000000001')
  expect(testing.caseContent.coreTeachingSequence).toBeUndefined()
  expect(JSON.stringify(testing)).not.toMatch(/normal-benign|coreTeachingSequence|nio-142|Fixture/)
})

test('the teaching directory shows four ordered sections and uses the same order for Start and Next', async () => {
  const user = userEvent.setup()
  const documents = expected.map((identity, index) => fixture(identity, 100 - index)).reverse()
  render(<SocratesLearningWorkspace documents={documents} />)
  await user.click(screen.getByRole('button', { name: 'Open teaching module' }))
  const sections = within(screen.getByRole('group', { name: 'Curriculum sections' })).getAllByRole(
    'button',
  )
  expect(sections.map((button) => button.textContent)).toEqual([
    'All slides',
    ...coreTeachingSections.map(
      (s, i) => `${i + 1}. ${s.title} (${s.cases.length}/${s.cases.length})`,
    ),
  ])
  expect(screen.getByText(/Core training: 25 of 25 cases available/)).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Start teaching' }))
  expect(screen.getByRole('heading', { name: 'Fixture 272/2' })).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Teaching interpretation' }))
  await user.click(screen.getByRole('button', { name: 'Complete teaching' }))
  await user.click(screen.getByRole('button', { name: 'Continue to next slide' }))
  expect(screen.getByRole('heading', { name: 'Fixture 142/3' })).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Teaching set' }))
  await user.click(screen.getByRole('button', { name: /^2\. Non-diagnostic specimens/ }))
  await user.click(screen.getByRole('button', { name: 'Continue teaching' }))
  expect(screen.getByRole('heading', { name: 'Fixture 171/1' })).toBeVisible()
})
