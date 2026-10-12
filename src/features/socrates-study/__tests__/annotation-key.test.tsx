import { render, screen } from '@testing-library/react'
import { AnnotationKey } from '../components/shared'
import { emptyCaseContent } from '@/features/socrates-builder/case-content'
import { createInvenioDemoDocument } from '@/features/socrates-builder/content/invenio-demo-document'

const descriptorUrl = createInvenioDemoDocument().slide.descriptorUrl

test('empty UCSD slide keys show the sourced provider mapping without changing the saved key', () => {
  const legend = emptyCaseContent().annotationLegend
  render(<AnnotationKey legend={legend} descriptorUrl={descriptorUrl} authorPreview />)
  expect(screen.getByText('Tissue annotation key')).toBeVisible()
  expect(screen.getByText('Non-tumor / normal lung tissue')).toBeVisible()
  expect(screen.getByText('Tumor / malignant').previousElementSibling).toHaveStyle({
    backgroundColor: '#FF0000',
  })
  expect(screen.getByRole('link', { name: /Provider’s full-size key/ })).toHaveAttribute(
    'href',
    expect.stringContaining('/assets/annotation-key-'),
  )
  expect(screen.queryByText('Annotation key pending review')).not.toBeInTheDocument()
  expect(legend).toEqual({ reviewed: false, entries: [] })
})

test('a custom key keeps precedence and its review boundary', () => {
  const legend = {
    reviewed: false,
    entries: [{ label: 'Custom category', color: '#112233', explanation: 'Custom meaning' }],
  }
  const view = render(<AnnotationKey legend={legend} descriptorUrl={descriptorUrl} />)
  expect(screen.getByText('Annotation key pending review')).toBeVisible()
  expect(screen.queryByText('Custom category')).not.toBeInTheDocument()
  expect(screen.queryByText('Tumor / malignant')).not.toBeInTheDocument()
  view.rerender(
    <AnnotationKey legend={{ ...legend, reviewed: true }} descriptorUrl={descriptorUrl} />,
  )
  expect(screen.getByText('Custom category')).toBeVisible()
  expect(screen.queryByText('Tumor / malignant')).not.toBeInTheDocument()
})

test('unknown image providers are never assigned the UCSD tissue color mapping', () => {
  render(
    <AnnotationKey
      legend={emptyCaseContent().annotationLegend}
      descriptorUrl="https://www.invenio-cloud.com/api/thinslides/other.dzi"
      authorPreview
    />,
  )
  expect(screen.getByText(/No color key has been added/)).toBeVisible()
  expect(screen.queryByText('Tumor / malignant')).not.toBeInTheDocument()
})
