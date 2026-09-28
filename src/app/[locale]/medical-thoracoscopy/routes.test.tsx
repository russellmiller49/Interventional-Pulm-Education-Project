import { render, screen } from '@testing-library/react'
import { setRequestLocale } from 'next-intl/server'

jest.mock('@/i18n/handoff-server', () => ({
  localizeHandoffServerValue: async (_locale: string, value: unknown) => value,
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

import MedicalThoracoscopyCasesPage, { generateMetadata as casesMetadata } from './assess/page'
import MedicalThoracoscopyLearnPage, { generateMetadata as learnMetadata } from './learn/page'
import MedicalThoracoscopyPage, { generateMetadata as overviewMetadata } from './page'
import MedicalThoracoscopyPracticePage, {
  generateMetadata as practiceMetadata,
} from './practice/page'
import MedicalThoracoscopyReferencePage, {
  generateMetadata as referenceMetadata,
} from './reference/page'

const params = (locale: string) => Promise.resolve({ locale })

const pages = [
  ['Overview', MedicalThoracoscopyPage, '/medical-thoracoscopy'],
  ['Learn', MedicalThoracoscopyLearnPage, '/medical-thoracoscopy/learn'],
  ['Practice', MedicalThoracoscopyPracticePage, '/medical-thoracoscopy/practice'],
  ['Cases', MedicalThoracoscopyCasesPage, '/medical-thoracoscopy/assess'],
  ['Reference', MedicalThoracoscopyReferencePage, '/medical-thoracoscopy/reference'],
] as const

describe('medical thoracoscopy route family', () => {
  const localeMock = jest.mocked(setRequestLocale)

  beforeEach(() => localeMock.mockClear())

  it('keeps every page noindex, nofollow and noarchive', async () => {
    for (const generate of [
      overviewMetadata,
      learnMetadata,
      practiceMetadata,
      casesMetadata,
      referenceMetadata,
    ]) {
      const metadata = await generate({ params: params('en') })
      expect(metadata.robots).toEqual({ index: false, follow: false, noarchive: true })
      expect(metadata.title).toMatch(/Medical Thoracoscopy/)
    }
  })

  it.each(pages)('renders %s inside the frame, under its own tab', async (_name, Page, href) => {
    render(await Page({ params: params('en') }))

    expect(screen.getByTestId('thoracoscopy-frame')).toHaveAttribute('data-active', href)
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  })

  it.each(['en', 'es', 'zh-CN'])('passes the locale %s to the frame', async (locale) => {
    render(await MedicalThoracoscopyPage({ params: params(locale) }))

    expect(localeMock).toHaveBeenCalledWith(locale)
    expect(screen.getByTestId('thoracoscopy-frame')).toHaveAttribute('data-locale', locale)
  })

  it('says what is not written yet, and offers no control that does nothing', async () => {
    for (const [, Page] of pages) {
      const { unmount } = render(await Page({ params: params('en') }))

      expect(screen.queryAllByRole('button')).toEqual([])
      expect(screen.queryAllByRole('link')).toEqual([])
      unmount()
    }
    render(await MedicalThoracoscopyPage({ params: params('en') }))
    expect(
      screen.getByText(/Nothing in the course has been clinically reviewed yet/),
    ).toBeInTheDocument()
  })
})
