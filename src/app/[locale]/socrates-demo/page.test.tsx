import { render, screen } from '@testing-library/react'
import { setRequestLocale } from 'next-intl/server'

jest.mock('@/features/socrates-demo/components/SocratesDemoWorkspace', () => ({
  SocratesDemoWorkspace: ({
    publishedDocument,
    sandboxDocuments,
  }: {
    publishedDocument: { slide: { id: string } } | null
    sandboxDocuments: unknown[]
  }) => (
    <div data-testid="socrates-demo-workspace">
      {publishedDocument?.slide.id ?? 'Functional demo'} · {sandboxDocuments.length} drafts
    </div>
  ),
}))

const mockLoadPublishedDocument = jest.fn()
const mockLoadSandboxDocuments = jest.fn()

jest.mock('@/features/socrates-builder/server/data', () => ({
  loadPublishedSocratesDocument: (...args: unknown[]) => mockLoadPublishedDocument(...args),
  loadSocratesSandboxDocuments: (...args: unknown[]) => mockLoadSandboxDocuments(...args),
}))

import SocratesDemoPage, { metadata } from './page'

describe('SOCRATES localized unlisted route', () => {
  beforeEach(() => {
    mockLoadPublishedDocument.mockResolvedValue(null)
    mockLoadSandboxDocuments.mockResolvedValue([])
  })

  it('is explicitly noindex, nofollow, and noarchive', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false, noarchive: true })
    expect(metadata.description).toMatch(/Unlisted functional demonstration/i)
  })

  it.each(['en', 'es', 'zh-CN'])('sets the %s locale and renders the demo', async (locale) => {
    render(await SocratesDemoPage({ params: Promise.resolve({ locale }) }))

    expect(jest.mocked(setRequestLocale)).toHaveBeenCalledWith(locale)
    expect(screen.getByTestId('socrates-demo-workspace')).toBeVisible()
  })

  it('loads an explicitly requested published builder snapshot', async () => {
    mockLoadPublishedDocument.mockResolvedValue({
      slide: { id: 'published-invenio-slide' },
      annotations: [],
    })

    render(
      await SocratesDemoPage({
        params: Promise.resolve({ locale: 'en' }),
        searchParams: Promise.resolve({ slide: 'published-slide' }),
      }),
    )

    expect(mockLoadPublishedDocument).toHaveBeenCalledWith('published-slide')
    expect(screen.getByTestId('socrates-demo-workspace')).toHaveTextContent(
      'published-invenio-slide',
    )
  })

  it('loads anonymous sandbox drafts into the same unlisted workspace', async () => {
    mockLoadSandboxDocuments.mockResolvedValue([{ recordId: 'sandbox-1' }])

    render(await SocratesDemoPage({ params: Promise.resolve({ locale: 'en' }) }))

    expect(mockLoadSandboxDocuments).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('socrates-demo-workspace')).toHaveTextContent('1 drafts')
  })
})
