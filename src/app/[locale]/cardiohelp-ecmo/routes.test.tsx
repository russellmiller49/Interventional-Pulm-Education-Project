import type React from 'react'
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

jest.mock('@/features/cardiohelp-ecmo/components/CardiohelpLearnLanding', () => ({
  __esModule: true,
  CardiohelpLearnLanding: ({ supportMode }: { supportMode: string }) => (
    <div data-testid="cardiohelp-learn-landing" data-track={supportMode} />
  ),
}))

jest.mock('@/features/cardiohelp-ecmo/components/EcmoFoundationSectionView', () => ({
  __esModule: true,
  EcmoFoundationSectionView: ({
    sectionId,
    supportMode,
  }: {
    sectionId: string
    supportMode: string
  }) => (
    <div
      data-testid="ecmo-foundation-section"
      data-section-id={sectionId}
      data-track={supportMode}
    />
  ),
}))

jest.mock('@/features/cardiohelp-ecmo/components/CardiohelpModuleFrame', () => ({
  __esModule: true,
  CardiohelpModuleFrame: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="cardiohelp-module-frame">{children}</div>
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
    expect((await hubMetadata({ params })).title).toMatch(
      /ECMO Management · CARDIOHELP console lab/i,
    )
    expect((await learnMetadata({ params })).title).toMatch(/^Learn ·/)
    expect((await practiceMetadata({ params })).title).toMatch(/^Practice ·/)
    expect((await assessMetadata({ params })).title).toMatch(/^Challenge ·/)
  })

  it.each(['en', 'es', 'zh-CN'])('renders the hub with the %s locale', async (locale) => {
    render(await CardiohelpEcmoPage({ params: Promise.resolve({ locale }) }))
    expect(setRequestLocaleMock).toHaveBeenCalledWith(locale)
    expect(screen.getByTestId('cardiohelp-hub')).toHaveTextContent(locale)
  })

  it.each([
    ['practice', CardiohelpEcmoPracticePage],
    ['assess', CardiohelpEcmoAssessPage],
  ] as const)('mounts the %s workbench section', async (section, Page) => {
    render(await Page({ params: Promise.resolve({ locale: 'en' }) }))
    expect(setRequestLocaleMock).toHaveBeenCalledWith('en')
    const workbench = screen.getByTestId('cardiohelp-workbench')
    expect(workbench).toHaveAttribute('data-section', section)
    expect(workbench).toHaveTextContent('en')
  })

  it.each(['vv', 'va'] as const)('opens the %s Learn pathway landing by default', async (track) => {
    render(
      await CardiohelpEcmoLearnPage({
        params: Promise.resolve({ locale: 'en' }),
        searchParams: Promise.resolve({ track }),
      }),
    )
    expect(screen.getByTestId('cardiohelp-learn-landing')).toHaveAttribute('data-track', track)
  })

  it('renders an authored physiology section as prose rather than the console', async () => {
    render(
      await CardiohelpEcmoLearnPage({
        params: Promise.resolve({ locale: 'en' }),
        searchParams: Promise.resolve({ lesson: 'circuit-flow-path', track: 'va' }),
      }),
    )
    const section = screen.getByTestId('ecmo-foundation-section')
    expect(section).toHaveAttribute('data-section-id', 'circuit-flow-path')
    expect(section).toHaveAttribute('data-track', 'va')
    expect(screen.queryByTestId('cardiohelp-workbench')).not.toBeInTheDocument()
  })

  it('opens the guided workbench for a drill section', async () => {
    render(
      await CardiohelpEcmoLearnPage({
        params: Promise.resolve({ locale: 'en' }),
        searchParams: Promise.resolve({ lesson: 'vv-recirculation', track: 'vv' }),
      }),
    )
    expect(screen.getByTestId('cardiohelp-workbench')).toHaveAttribute('data-section', 'learn')
  })
})
