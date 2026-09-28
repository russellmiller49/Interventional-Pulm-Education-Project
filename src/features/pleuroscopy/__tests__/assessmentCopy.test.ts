/** @jest-environment node */
import en from '../../../../messages/en.json'
import es from '../../../../messages/es.json'
import zhCN from '../../../../messages/zh-CN.json'

type PleuroscopyMessages = {
  pleuroscopy: {
    overview: { steps: { assessment: { description: string } } }
    assessment: { headerDescription: string }
  }
}

const locales: ReadonlyArray<readonly [string, PleuroscopyMessages, RegExp]> = [
  ['en', en as unknown as PleuroscopyMessages, /\d|\b(eight|nine|ten|eleven|twelve)\b/i],
  ['es', es as unknown as PleuroscopyMessages, /\d|\b(ocho|nueve|diez|once|doce)\b/i],
  ['zh-CN', zhCN as unknown as PleuroscopyMessages, /\d|[八九十]/],
]

/**
 * The Assessment copy once promised "ten questions" while the item list was
 * free to change. The copy now states no number, in any locale.
 */
describe('pleuroscopy assessment copy', () => {
  it.each(locales)('%s states no question count', (_locale, messages, countPattern) => {
    const strings = [
      messages.pleuroscopy.overview.steps.assessment.description,
      messages.pleuroscopy.assessment.headerDescription,
    ]

    for (const value of strings) {
      expect(value.trim().length).toBeGreaterThan(0)
      expect(value).not.toMatch(countPattern)
    }
  })
})
