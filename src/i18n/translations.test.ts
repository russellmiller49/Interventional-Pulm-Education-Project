import enMessages from '../../messages/en.json'
import esMessages from '../../messages/es.json'
import zhCnMessages from '../../messages/zh-CN.json'
import { searchSite } from '@/lib/site-search'

function flattenKeys(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return prefix ? [prefix] : []
  }

  return Object.entries(value).flatMap(([key, child]) =>
    flattenKeys(child, prefix ? `${prefix}.${key}` : key),
  )
}

describe('static translation bundles', () => {
  it('keeps active locale message files complete against English', () => {
    const englishKeys = flattenKeys(enMessages)

    for (const [locale, messages] of [
      ['es', esMessages],
      ['zh-CN', zhCnMessages],
    ] as const) {
      const localeKeys = new Set(flattenKeys(messages))
      const missingKeys = englishKeys.filter((key) => !localeKeys.has(key))

      expect({ locale, missingKeys }).toEqual({ locale, missingKeys: [] })
    }
  })

  it('searches localized Spanish and Simplified Chinese learner-facing entries', () => {
    expect(searchSite('pleura', 10, { locale: 'es' }).map((item) => item.href)).toContain(
      '/pleural-procedures',
    )
    expect(searchSite('胸膜', 10, { locale: 'zh-CN' }).map((item) => item.href)).toContain(
      '/pleural-procedures',
    )
  })
})
