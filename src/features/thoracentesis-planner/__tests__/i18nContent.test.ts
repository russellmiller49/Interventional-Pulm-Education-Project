import {
  getThoracentesisCoreBlocks,
  getThoracentesisGoDeeperBlocks,
  getThoracentesisObjectives,
} from '../content/learnContent'
import { getThoracentesisQuizQuestions } from '../content/quizItems'

describe('thoracentesis localized content selectors', () => {
  it('returns es/zh-CN learn blocks with the same ids but translated titles', () => {
    const en = getThoracentesisCoreBlocks('en')
    const es = getThoracentesisCoreBlocks('es')
    const zh = getThoracentesisCoreBlocks('zh-CN')

    expect(es.map((block) => block.id)).toEqual(en.map((block) => block.id))
    expect(zh.map((block) => block.id)).toEqual(en.map((block) => block.id))
    expect(es[0].title).not.toEqual(en[0].title)
    expect(zh[0].title).not.toEqual(en[0].title)
  })

  it('falls back to English for unknown locales', () => {
    expect(getThoracentesisCoreBlocks('fr')).toEqual(getThoracentesisCoreBlocks('en'))
    expect(getThoracentesisObjectives('fr')).toEqual(getThoracentesisObjectives('en'))
    expect(getThoracentesisQuizQuestions('fr')).toEqual(getThoracentesisQuizQuestions('en'))
  })

  it('keeps quiz answerIndex and length identical across locales', () => {
    const en = getThoracentesisQuizQuestions('en')
    const es = getThoracentesisQuizQuestions('es')
    const zh = getThoracentesisQuizQuestions('zh-CN')

    expect(es).toHaveLength(en.length)
    expect(zh).toHaveLength(en.length)
    expect(es.map((q) => q.answerIndex)).toEqual(en.map((q) => q.answerIndex))
    expect(zh.map((q) => q.answerIndex)).toEqual(en.map((q) => q.answerIndex))
    // Each translated question must keep exactly 4 options.
    for (const question of [...es, ...zh]) {
      expect(question.options).toHaveLength(4)
    }
  })

  it('preserves advanced level + ids on go-deeper blocks across locales', () => {
    const en = getThoracentesisGoDeeperBlocks('en')
    const es = getThoracentesisGoDeeperBlocks('es')
    const zh = getThoracentesisGoDeeperBlocks('zh-CN')

    expect(es.map((block) => block.id)).toEqual(en.map((block) => block.id))
    expect(zh.map((block) => block.id)).toEqual(en.map((block) => block.id))
    expect(es.every((block) => block.level === 'advanced')).toBe(true)
    expect(zh.every((block) => block.level === 'advanced')).toBe(true)
  })
})
