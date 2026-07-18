import { render, screen } from '@testing-library/react'
import { setRequestLocale } from 'next-intl/server'

jest.mock('@/features/cardiohelp-ecmo/components/CardiohelpHub', () => ({
  __esModule: true,
  CardiohelpHub: ({ locale }: { locale: string }) => (
    <div data-testid="cardiohelp-hub">{locale}</div>
  ),
}))

jest.mock('@/features/cardiohelp-ecmo/components/CardiohelpWorkbench', () => ({
  __esModule: true,
  CardiohelpWorkbench: ({ section, locale }: { section: string; locale: string }) => (
    <div data-testid="cardiohelp-workbench" data-section={section}>
      {locale}
    </div>
  ),
}))

jest.mock('@/i18n/handoff-server', () => ({
  localizeHandoffServerValue: async (_locale: string, value: unknown) => value,
}))

import CardiohelpEcmoPage, { generateMetadata as hubMetadata } from './page'
import CardiohelpEcmoLearnPage, { generateMetadata as learnMetadata } from './learn/page'
import CardiohelpEcmoPracticePage, { generateMetadata as practiceMetadata } from './practice/page'
import CardiohelpEcmoAssessPage, { generateMetadata as assessMetadata } from './assess/page'

describe('CARDIOHELP ECMO routes', () => {
  const setRequestLocaleMock = jest.mocked(setRequestLocale)

  beforeEach(() => setRequestLocaleMock.mockClear())

  it('keeps every section noindexed while the module is unlisted', async () => {
    const params = Promise.resolve({ locale: 'en' })
    for (const generateMetadata of [hubMetadata, learnMetadata, practiceMetadata, assessMetadata]) {
      const metadata = await generateMetadata({ params })
      expect(metadata.robots).toEqual({ index: false, follow: false, noarchive: true })
    }
    expect((await hubMetadata({ params })).title).toMatch(/CARDIOHELP-i/i)
    expect((await learnMetadata({ params })).title).toMatch(/^Learn ·/)
    expect((await practiceMetadata({ params })).title).toMatch(/^Practice ·/)
    expect((await assessMetadata({ params })).title).toMatch(/^Assess ·/)
  })

  it.each(['en', 'es', 'zh-CN'])('renders the hub with the %s locale', async (locale) => {
    render(await CardiohelpEcmoPage({ params: Promise.resolve({ locale }) }))
    expect(setRequestLocaleMock).toHaveBeenCalledWith(locale)
    expect(screen.getByTestId('cardiohelp-hub')).toHaveTextContent(locale)
  })

  it.each([
    ['learn', CardiohelpEcmoLearnPage],
    ['practice', CardiohelpEcmoPracticePage],
    ['assess', CardiohelpEcmoAssessPage],
  ] as const)('mounts the %s workbench section', async (section, Page) => {
    render(await Page({ params: Promise.resolve({ locale: 'en' }) }))
    expect(setRequestLocaleMock).toHaveBeenCalledWith('en')
    const workbench = screen.getByTestId('cardiohelp-workbench')
    expect(workbench).toHaveAttribute('data-section', section)
    expect(workbench).toHaveTextContent('en')
  })
})
