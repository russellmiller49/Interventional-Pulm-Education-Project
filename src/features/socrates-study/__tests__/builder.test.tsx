import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { CaseContentEditor } from '@/features/socrates-builder/components/CaseContentEditor'
import { parseSocratesSlideDocument } from '@/features/socrates-builder/schema'
import { caseFixture } from '../testing/fixtures'
function Harness() {
  const [doc, setDoc] = useState(caseFixture())
  return (
    <>
      <CaseContentEditor
        document={doc}
        onChange={(value) => setDoc(value as typeof doc)}
        privateEnabled
      />
      <pre data-testid="document">{JSON.stringify(doc)}</pre>
    </>
  )
}
test('separate case editor authors vignette, observations, learning points, reasoning, private notes and legend', () => {
  render(<Harness />)
  for (const [label, value] of [
    ['Case vignette', 'Changed vignette'],
    ['Low-magnification observations (one per line)', 'Low one\nLow two'],
    ['High-magnification observations (one per line)', 'High one'],
    ['Key learning points (one per line)', 'Point one'],
    ['Adequacy reasoning', 'Adequacy explanation'],
    ['Cancer reasoning', 'Cancer explanation'],
    ['Internal highlight notes', 'Private new note'],
    ['Key 1 label', 'Reviewed synthetic entry'],
    ['Key 1 color', '#123456'],
  ])
    fireEvent.change(screen.getByLabelText(label), { target: { value } })
  const doc = parseSocratesSlideDocument(JSON.parse(screen.getByTestId('document').textContent!))
  expect(doc.caseContent?.vignette).toBe('Changed vignette')
  expect(doc.caseContent?.lowMagnificationObservations).toEqual(['Low one', 'Low two'])
  expect(doc.caseContent?.highMagnificationObservations).toEqual(['High one'])
  expect(doc.caseContent?.keyLearningPoints).toEqual(['Point one'])
  expect(doc.caseContent?.adequacy.reasoning).toBe('Adequacy explanation')
  expect(doc.caseContent?.cancer.reasoning).toBe('Cancer explanation')
  expect(doc.authorContent?.internalHighlightNotes).toBe('Private new note')
  expect(doc.annotations).toEqual(caseFixture().annotations)
  expect(doc.caseContent?.annotationLegend.entries[0].color).toBe('#123456')
  expect(doc.caseContent?.annotationLegend.reviewed).toBe(false)
  expect(parseSocratesSlideDocument(JSON.parse(JSON.stringify(doc)))).toEqual(doc)
})
test('readiness indicator changes immediately and private controls are absent in public sandbox', () => {
  const { unmount } = render(<Harness />)
  expect(screen.getByRole('status')).toHaveTextContent('Ready for study activation')
  fireEvent.click(screen.getByLabelText('De-identification verified (text and images)'))
  expect(screen.getByRole('status')).toHaveTextContent('Testing blocked')
  unmount()
  render(<CaseContentEditor document={caseFixture()} onChange={() => {}} privateEnabled={false} />)
  expect(screen.queryByLabelText('Internal highlight notes')).not.toBeInTheDocument()
})

test('placeholder, invalid and edited keys cannot appear reviewed; exact hex remains editable', () => {
  render(<Harness />)
  fireEvent.click(screen.getByRole('button', { name: 'Add key entry' }))
  expect(screen.getByLabelText('Annotation key reviewed')).toBeDisabled()
  expect(screen.getByText('Annotation key pending review')).toBeVisible()
  fireEvent.change(screen.getByLabelText('Key 2 label'), {
    target: { value: 'Synthetic provider label' },
  })
  fireEvent.change(screen.getByLabelText('Key 2 explanation'), {
    target: { value: 'Synthetic reviewed meaning' },
  })
  fireEvent.change(screen.getByLabelText('Key 2 color'), { target: { value: '#123' } })
  expect(screen.getByLabelText('Annotation key reviewed')).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Key 2 color'), { target: { value: '#1A2b3C' } })
  fireEvent.click(screen.getByLabelText('Annotation key reviewed'))
  expect(screen.getByLabelText('Annotation key reviewed')).toBeChecked()
  expect(screen.getByLabelText('Key 2 color')).toHaveValue('#1A2b3C')
  fireEvent.change(screen.getByLabelText('Key 2 color picker'), { target: { value: '#123456' } })
  expect(screen.getByLabelText('Annotation key reviewed')).not.toBeChecked()
})
