import { render, screen } from '@testing-library/react'
import { setRequestLocale } from 'next-intl/server'

jest.mock('@/i18n/handoff-server', () => ({
  localizeHandoffServerValue: async (_locale: string, value: unknown) => value,
}))
jest.mock('@/features/medical-thoracoscopy/components/prototype/SpacePrototype', () => ({
  SpacePrototype: () => <h1 data-testid="space-prototype">Prototype</h1>,
}))
jest.mock('@/features/medical-thoracoscopy/components/MedicalThoracoscopyModuleFrame', () => ({
  MedicalThoracoscopyModuleFrame: ({
    activeHref,
    locale,
    children,
  }: {
    activeHref: string
    locale?: string
    children: React.ReactNode
  }) => (
    <div data-testid="thoracoscopy-frame" data-active={activeHref} data-locale={locale}>
      {children}
    </div>
  ),
}))

import SpacePrototypePage, { generateMetadata } from './page'

describe('the space prototype page', () => {
  it('sits in the module frame, outside the curriculum, and is never indexed', async () => {
    render(await SpacePrototypePage({ params: Promise.resolve({ locale: 'en' }) }))
    expect(jest.mocked(setRequestLocale)).toHaveBeenCalledWith('en')
    expect(screen.getByTestId('thoracoscopy-frame')).toHaveAttribute(
      'data-active',
      '/medical-thoracoscopy',
    )
    expect(screen.getByTestId('space-prototype')).toBeInTheDocument()
    const metadata = await generateMetadata({ params: Promise.resolve({ locale: 'en' }) })
    expect(metadata.robots).toEqual({ index: false, follow: false, noarchive: true })
    expect(String(metadata.description)).toMatch(
      /Not a lesson, not recorded and not clinically reviewed/,
    )
  })
})
