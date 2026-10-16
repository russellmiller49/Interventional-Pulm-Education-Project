import { render, screen } from '@testing-library/react'
import { setRequestLocale } from 'next-intl/server'

const mockLoadBootstrap = jest.fn()
const mockBuilder = jest.fn()

jest.mock('@/features/socrates-builder/server/data', () => ({
  loadSocratesBuilderBootstrap: () => mockLoadBootstrap(),
}))

jest.mock('@/features/socrates-builder/components/SocratesBuilder', () => ({
  SocratesBuilder: (props: {
    access: { canPersist: boolean }
    protectUnsavedChanges?: boolean
  }) => {
    mockBuilder(props)
    const { access } = props
    return (
      <div data-testid="socrates-builder-route">
        {access.canPersist ? 'Persistent builder' : 'Local preview'}
      </div>
    )
  },
}))

import SocratesBuilderPage, { metadata } from './page'

describe('SOCRATES earlier saved slides route', () => {
  beforeEach(() => {
    mockLoadBootstrap.mockResolvedValue({
      access: { canPersist: true, canPublish: false, userEmail: 'editor@example.com' },
      documents: [],
      sandboxDocuments: [],
    })
  })

  it('is explicitly excluded from search indexing', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false, noarchive: true })
  })

  it('sets the locale and forwards server-derived editor access', async () => {
    render(await SocratesBuilderPage({ params: Promise.resolve({ locale: 'en' }) }))

    expect(jest.mocked(setRequestLocale)).toHaveBeenCalledWith('en')
    expect(mockLoadBootstrap).toHaveBeenCalledTimes(1)
    expect(mockBuilder.mock.lastCall[0].protectUnsavedChanges).toBe(true)
    expect(screen.getByRole('link', { name: 'Return to SOCRATES Library' })).toHaveAttribute(
      'href',
      '/en/socrates-library',
    )
    expect(screen.getByTestId('socrates-builder-route')).toHaveTextContent('Persistent builder')
  })
})
