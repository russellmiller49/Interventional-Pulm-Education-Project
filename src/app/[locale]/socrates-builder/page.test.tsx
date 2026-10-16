import { redirect } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import SocratesBuilderPage, { metadata } from './page'

jest.mock('next/navigation', () => ({
  redirect: jest.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`)
  }),
}))

describe('retired SOCRATES builder entry', () => {
  it('stays excluded from search indexing', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false, noarchive: true })
  })

  it.each(['en', 'es', 'zh-CN'])(
    'redirects %s bookmarks to the same locale library',
    async (locale) => {
      await expect(SocratesBuilderPage({ params: Promise.resolve({ locale }) })).rejects.toThrow(
        `REDIRECT:/${locale}/socrates-library`,
      )
      expect(setRequestLocale).toHaveBeenCalledWith(locale)
      expect(redirect).toHaveBeenCalledWith(`/${locale}/socrates-library`)
    },
  )
})
