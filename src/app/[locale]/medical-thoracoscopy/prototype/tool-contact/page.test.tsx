import { render, screen } from '@testing-library/react'
import { setRequestLocale } from 'next-intl/server'

jest.mock('@/i18n/handoff-server', () => ({
  localizeHandoffServerValue: async (_locale: string, value: unknown) => value,
}))
jest.mock('@/features/medical-thoracoscopy/components/prototype/ToolContactPrototype', () => ({
  ToolContactPrototype: () => <h1 data-testid="tool-contact-prototype">Prototype</h1>,
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

import ToolContactPrototypePage, { generateMetadata } from './page'

describe('the tool-contact prototype page', () => {
  it('sits in the module frame, outside the curriculum, and is never indexed', async () => {
    render(await ToolContactPrototypePage({ params: Promise.resolve({ locale: 'en' }) }))
    expect(jest.mocked(setRequestLocale)).toHaveBeenCalledWith('en')
    expect(screen.getByTestId('thoracoscopy-frame')).toHaveAttribute(
      'data-active',
      '/medical-thoracoscopy',
    )
    expect(screen.getByTestId('tool-contact-prototype')).toBeInTheDocument()
    const metadata = await generateMetadata({ params: Promise.resolve({ locale: 'en' }) })
    expect(metadata.robots).toEqual({ index: false, follow: false, noarchive: true })
    expect(String(metadata.description)).toMatch(
      /Not a biopsy lesson, not recorded and not clinically reviewed/,
    )
  })
})
