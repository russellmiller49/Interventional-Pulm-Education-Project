const permanentRedirectMock = jest.fn()

jest.mock('next/navigation', () => ({
  permanentRedirect: (destination: string) => permanentRedirectMock(destination),
}))

import LegacyHamiltonC6VentilationPage from './page'

describe('legacy HAMILTON-C6 ventilation route', () => {
  beforeEach(() => permanentRedirectMock.mockClear())

  it.each(['en', 'es', 'zh-CN'])(
    'permanently redirects %s to the locale-aware canonical route',
    async (locale) => {
      await LegacyHamiltonC6VentilationPage({ params: Promise.resolve({ locale }) })
      expect(permanentRedirectMock).toHaveBeenCalledWith(`/${locale}/mechanical-ventilation`)
    },
  )
})
