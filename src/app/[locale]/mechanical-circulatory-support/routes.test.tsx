import { render, screen } from '@testing-library/react'
import { setRequestLocale } from 'next-intl/server'

jest.mock('@/features/mechanical-circulatory-support/components/McsHub', () => ({
  McsHub: ({ locale }: { locale: string }) => <div data-testid="mcs-hub">{locale}</div>,
}))
jest.mock('@/features/mechanical-circulatory-support/components/McsWorkbench', () => ({
  McsWorkbench: ({
    section,
    locale,
    initialDevice,
  }: {
    section: string
    locale: string
    initialDevice?: string
  }) => (
    <div data-testid="mcs-workbench" data-section={section} data-device={initialDevice}>
      {locale}
    </div>
  ),
}))
jest.mock('@/i18n/handoff-server', () => ({
  localizeHandoffServerValue: async (_locale: string, value: unknown) => value,
}))

import HubPage, { generateMetadata as hubMetadata } from './page'
import LearnPage, { generateMetadata as learnMetadata } from './learn/page'
import PracticePage, { generateMetadata as practiceMetadata } from './practice/page'
import AssessPage, { generateMetadata as assessMetadata } from './assess/page'

describe('mechanical circulatory support route family', () => {
  const localeMock = jest.mocked(setRequestLocale)
  beforeEach(() => localeMock.mockClear())

  it('keeps every localized page noindexed during unlisted preview', async () => {
    const params = Promise.resolve({ locale: 'en' })
    for (const metadata of [hubMetadata, learnMetadata, practiceMetadata, assessMetadata]) {
      expect((await metadata({ params })).robots).toEqual({
        index: false,
        follow: false,
        noarchive: true,
      })
    }
    expect((await hubMetadata({ params })).title).toMatch(/Mechanical Circulatory Support/i)
    expect((await learnMetadata({ params })).title).toMatch(/^Learn ·/)
    expect((await practiceMetadata({ params })).title).toMatch(/^Practice ·/)
    expect((await assessMetadata({ params })).title).toMatch(/^Assess ·/)
  })

  it.each(['en', 'es', 'zh-CN'])('mounts the localized hub for %s', async (locale) => {
    render(await HubPage({ params: Promise.resolve({ locale }) }))
    expect(localeMock).toHaveBeenCalledWith(locale)
    expect(screen.getByTestId('mcs-hub')).toHaveTextContent(locale)
  })

  it.each([
    ['learn', LearnPage],
    ['practice', PracticePage],
    ['assess', AssessPage],
  ] as const)('mounts the %s workbench', async (section, Page) => {
    render(await Page({ params: Promise.resolve({ locale: 'en' }) }))
    expect(screen.getByTestId('mcs-workbench')).toHaveAttribute('data-section', section)
  })

  it.each(['iabp', 'impella', 'lvad'] as const)(
    'opens the requested %s learning track',
    async (device) => {
      render(
        await LearnPage({
          params: Promise.resolve({ locale: 'en' }),
          searchParams: Promise.resolve({ device }),
        }),
      )
      expect(screen.getByTestId('mcs-workbench')).toHaveAttribute('data-device', device)
    },
  )

  it('falls back to the shared learning overview for an invalid track query', async () => {
    render(
      await LearnPage({
        params: Promise.resolve({ locale: 'en' }),
        searchParams: Promise.resolve({ device: 'unknown' }),
      }),
    )
    expect(screen.getByTestId('mcs-workbench')).not.toHaveAttribute('data-device')
  })
})
