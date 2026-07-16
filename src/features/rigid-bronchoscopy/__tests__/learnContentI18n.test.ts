import {
  getRigidCoreBlocks,
  getRigidGoDeeperBlocks,
  getRigidObjectives,
} from '../content/learnContent'

describe('rigid bronchoscopy localized learn content', () => {
  it('preserves objective and block structure across locales', () => {
    const enCore = getRigidCoreBlocks('en')
    const esCore = getRigidCoreBlocks('es')
    const zhCore = getRigidCoreBlocks('zh-CN')

    expect(getRigidObjectives('es')).toHaveLength(getRigidObjectives('en').length)
    expect(getRigidObjectives('zh-CN')).toHaveLength(getRigidObjectives('en').length)
    expect(esCore.map((block) => block.id)).toEqual(enCore.map((block) => block.id))
    expect(zhCore.map((block) => block.id)).toEqual(enCore.map((block) => block.id))

    for (const localized of [esCore, zhCore]) {
      localized.forEach((block, index) => {
        expect(block.paragraphs ?? []).toHaveLength(enCore[index].paragraphs?.length ?? 0)
        expect(block.bullets ?? []).toHaveLength(enCore[index].bullets?.length ?? 0)
      })
    }
  })

  it('preserves advanced ids and levels', () => {
    const en = getRigidGoDeeperBlocks('en')
    for (const locale of ['es', 'zh-CN']) {
      const localized = getRigidGoDeeperBlocks(locale)
      expect(localized.map((block) => block.id)).toEqual(en.map((block) => block.id))
      expect(localized.every((block) => block.level === 'advanced')).toBe(true)
    }
  })

  it('keeps the corrected ventilation concepts in both translations', () => {
    const es = getRigidCoreBlocks('es').find((block) => block.id === 'anesthesia-ventilation')
    const zh = getRigidCoreBlocks('zh-CN').find((block) => block.id === 'anesthesia-ventilation')
    const esCopy = es?.bullets?.join(' ') ?? ''
    const zhCopy = zh?.bullets?.join(' ') ?? ''

    expect(esCopy).toContain('mismo puerto del circuito de anestesia')
    expect(esCopy).toContain('válvula de bola')
    expect(esCopy).toContain('profundidad y la rotación')
    expect(zhCopy).toContain('同一个麻醉呼吸回路口')
    expect(zhCopy).toContain('球阀样病变')
    expect(zhCopy).toContain('插入深度和旋转方向')
  })

  it('falls back to English for unsupported locales', () => {
    expect(getRigidObjectives('fr')).toEqual(getRigidObjectives('en'))
    expect(getRigidCoreBlocks('fr')).toEqual(getRigidCoreBlocks('en'))
    expect(getRigidGoDeeperBlocks('fr')).toEqual(getRigidGoDeeperBlocks('en'))
  })
})
