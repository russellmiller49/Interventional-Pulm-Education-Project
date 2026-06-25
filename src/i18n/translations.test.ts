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

  it('keeps curated homepage and chrome copy localized for Spanish and Mandarin', () => {
    expect(esMessages.home.heroTitle).toBe('Educación e innovación en neumología intervencionista')
    expect(esMessages.home.launchCatalog).toBe('Catálogo de lanzamiento')
    expect(esMessages.home.participantCourse).toBe('CURSO PARA PARTICIPANTES')
    expect(esMessages.home.viewComingSoon).toBe('Ver Próximamente')
    expect(esMessages.home.cards.adminPreview.title).toBe('Simulador EBUS + Broncoscopia Virtual')
    expect(esMessages.footer.introPleuralDisease).toBe('Introducción a la Enfermedad Pleural')
    expect(esMessages.common.darkMode).toBe('Modo oscuro')

    expect(zhCnMessages.home.heroTitle).toBe('介入呼吸病学的教育与创新')
    expect(zhCnMessages.home.launchCatalog).toBe('启动目录')
    expect(zhCnMessages.home.participantCourse).toBe('学员课程')
    expect(zhCnMessages.home.viewComingSoon).toBe('查看即将推出')
    expect(zhCnMessages.home.cards.adminPreview.title).toBe('EBUS 模拟器 + 虚拟支气管镜')
    expect(zhCnMessages.footer.introPleuralDisease).toBe('胸膜疾病入门')
    expect(zhCnMessages.common.darkMode).toBe('深色模式')
  })

  it('keeps Bronch Navigation wrapper copy localized for Spanish and Mandarin', () => {
    expect(esMessages.handoff.h_eac83dc024d3).toBe('Qué incluye')
    expect(esMessages.handoff.h_c4989ed26b59).toBe(
      'Conduzca un broncoscopio virtual desde puntos anatómicos centrales de la vía aérea hacia objetivos periféricos.',
    )

    expect(zhCnMessages.handoff.h_eac83dc024d3).toBe('包含内容')
    expect(zhCnMessages.handoff.h_c4989ed26b59).toBe('从中央气道标志点向外周目标推进虚拟支气管镜。')
  })
})
