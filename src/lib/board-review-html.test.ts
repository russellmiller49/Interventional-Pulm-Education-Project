import {
  getTranslatedBoardReviewTitle,
  loadBoardReviewHtmlForSourceFile,
} from './board-review-html'

const airwayStentsSourceFile = 'airway-stents.mdx'

describe('board review localized HTML loading', () => {
  it('loads Spanish formatted HTML and title for Spanish board review pages', () => {
    const chapter = loadBoardReviewHtmlForSourceFile(airwayStentsSourceFile, 'es')

    expect(chapter?.locale).toBe('es')
    expect(getTranslatedBoardReviewTitle(airwayStentsSourceFile, 'es')).toBe(
      'Prótesis de la vía aérea',
    )
    expect(chapter?.html).toContain('<html lang="es">')
    expect(chapter?.html).toContain('Clasifique la OCVA')
  })

  it('loads Mandarin formatted HTML and title for Mandarin board review pages', () => {
    const chapter = loadBoardReviewHtmlForSourceFile(airwayStentsSourceFile, 'zh-CN')

    expect(chapter?.locale).toBe('zh-CN')
    expect(getTranslatedBoardReviewTitle(airwayStentsSourceFile, 'zh-CN')).toBe('气道支架')
    expect(chapter?.html).toContain('<html lang="zh-CN">')
    expect(chapter?.html).toContain('考试内容映射与范围')
  })

  it('falls back to the English chapter for unsupported locales', () => {
    const chapter = loadBoardReviewHtmlForSourceFile(airwayStentsSourceFile, 'fr')

    expect(chapter?.locale).toBe('en')
    expect(getTranslatedBoardReviewTitle(airwayStentsSourceFile, 'fr')).toBeNull()
    expect(chapter?.html).toContain('<html')
    expect(chapter?.html).toContain('Airway Stents')
  })
})
