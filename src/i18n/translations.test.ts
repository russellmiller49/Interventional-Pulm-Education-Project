import enMessages from '../../messages/en.json'
import esMessages from '../../messages/es.json'
import zhCnMessages from '../../messages/zh-CN.json'
import {
  buildRigidBronchoscopyAssemblyCopy,
  rigidBronchoscopyAssemblyCopyKeys,
} from '@/features/rigid-bronchoscopy/components/assemblyLabCopy'
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

  it('localizes the rigid bronchoscopy 3D pathway lab', () => {
    expect(esMessages.rigidBronchoscopy.practice.assembly.pathwayMode).toBe(
      'Laboratorio de recorridos',
    )
    expect(esMessages.rigidBronchoscopy.practice.assembly.ventilationFlow).toBe(
      'Flujo de ventilación',
    )
    expect(esMessages.rigidBronchoscopy.practice.assembly.cutawayView).toBe('Vista en corte')
    expect(esMessages.rigidBronchoscopy.practice.assembly.conventionalVentilation).toBe(
      'Convencional (presión positiva controlada)',
    )
    expect(esMessages.rigidBronchoscopy.practice.assembly.lowFrequencyJetVentilation).toBe(
      'Ventilación jet de baja frecuencia',
    )
    expect(esMessages.rigidBronchoscopy.practice.assembly.highFrequencyJetVentilation).toBe(
      'Ventilación jet de alta frecuencia',
    )
    expect(esMessages.rigidBronchoscopy.practice.assembly.predictionTitle).toBe(
      'Prediga antes de mostrar',
    )
    expect(esMessages.rigidBronchoscopy.practice.assembly.revealModeledFlow).toBe(
      'Mostrar flujo modelado',
    )

    expect(zhCnMessages.rigidBronchoscopy.practice.assembly.pathwayMode).toBe('路径演示')
    expect(zhCnMessages.rigidBronchoscopy.practice.assembly.instrumentRoute).toBe('器械路径')
    expect(zhCnMessages.rigidBronchoscopy.practice.assembly.playAnimation).toBe('播放动画')
    expect(zhCnMessages.rigidBronchoscopy.practice.assembly.spontaneousAssistVentilation).toBe(
      '自主呼吸辅助通气',
    )
    expect(zhCnMessages.rigidBronchoscopy.practice.assembly.highFrequencyJetVentilation).toBe(
      '高频喷射通气',
    )
    expect(zhCnMessages.rigidBronchoscopy.practice.assembly.sidePortAvailable).toContain(
      '对侧主支气管',
    )
    expect(zhCnMessages.rigidBronchoscopy.practice.assembly.sidePortUnavailable).toContain(
      '没有经远端侧孔',
    )
  })

  it('keeps the shared rigid-bronchoscopy assembly copy builder complete', () => {
    expect([...rigidBronchoscopyAssemblyCopyKeys].sort()).toEqual(
      Object.keys(enMessages.rigidBronchoscopy.practice.assembly).sort(),
    )

    const copy = buildRigidBronchoscopyAssemblyCopy((key) => key)
    expect(copy.title).toBe('practice.assembly.title')
    expect(copy.ventilationFlow).toBe('practice.assembly.ventilationFlow')
  })

  it('localizes the rigid-bronchoscopy Learn demonstrations', () => {
    expect(esMessages.rigidBronchoscopy.learn.demonstrations.heading).toBe('Demostraciones guiadas')
    expect(esMessages.rigidBronchoscopy.learn.demonstrations.sequenceCorrectOrder).toBe(
      'Secuencia correcta',
    )
    expect(esMessages.rigidBronchoscopy.learn.demonstrations.scenarioRecommendedAction).toBe(
      'Acción recomendada',
    )
    expect(esMessages.rigidBronchoscopy.learn.demonstrations.assemblyHelp).not.toMatch(
      /arrastre|prediga|muestre/i,
    )

    expect(zhCnMessages.rigidBronchoscopy.learn.demonstrations.heading).toBe('引导式演示')
    expect(zhCnMessages.rigidBronchoscopy.learn.demonstrations.sequenceCorrectOrder).toBe(
      '正确顺序',
    )
    expect(zhCnMessages.rigidBronchoscopy.learn.demonstrations.equipmentLabels).toBe('标签')
    expect(zhCnMessages.rigidBronchoscopy.learn.demonstrations.ventilationIntro).not.toContain(
      '预测',
    )
  })
})
