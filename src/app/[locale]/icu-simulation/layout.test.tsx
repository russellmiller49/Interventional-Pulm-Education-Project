const assertDraftModulesEnabledMock = jest.fn()

jest.mock('@/features/icu-simulation/content', () => ({
  ICU_SIMULATION_RELEASE_STAGE: 'private-development',
}))
jest.mock('@/lib/draft-module-guard', () => ({
  assertDraftModulesEnabled: () => assertDraftModulesEnabledMock(),
}))
jest.mock('@/i18n/handoff-server', () => ({
  localizeHandoffServerValue: async (_locale: string, value: unknown) => value,
}))

import IcuSimulationLayout, { generateMetadata } from './layout'

describe('ICU Simulator private-development layout', () => {
  beforeEach(() => assertDraftModulesEnabledMock.mockClear())

  it('fails closed through the shared draft-module guard', async () => {
    const child = <div>Private simulator</div>
    const result = await IcuSimulationLayout({
      children: child,
      params: Promise.resolve({ locale: 'en' }),
    })

    expect(assertDraftModulesEnabledMock).toHaveBeenCalledTimes(1)
    expect(result).toBe(child)
  })

  it.each(['en', 'es', 'zh-CN'])(
    'keeps the %s route family out of search results',
    async (locale) => {
      const metadata = await generateMetadata({ params: Promise.resolve({ locale }) })

      expect(metadata.title).toBe('ICU Simulator')
      expect(metadata.robots).toEqual({ index: false, follow: false, noarchive: true })
    },
  )
})
