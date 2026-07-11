import enMessages from '../../../../messages/en.json'
import esMessages from '../../../../messages/es.json'
import zhCnMessages from '../../../../messages/zh-CN.json'

import { translateHandoffText, type HandoffRawTranslator } from '@/i18n/handoff-core'
import { handoffMessageIds } from '@/i18n/handoff-message-ids'

import {
  cellPopulationSources,
  cellPopulations,
  cellReadingSteps,
} from '../content/cell-populations'

type MessageCatalog = {
  handoff: Record<string, string>
}

function catalogTranslator(messages: MessageCatalog): HandoffRawTranslator {
  const translator = ((key: string, values?: Record<string, unknown>) => {
    const template = messages.handoff[key] ?? key
    return Object.entries(values ?? {}).reduce(
      (localized, [name, value]) => localized.replace(`{${name}}`, String(value)),
      template,
    )
  }) as HandoffRawTranslator
  translator.raw = (key: string) => messages.handoff[key]
  return translator
}

describe('ROSE handoff localization', () => {
  const en = enMessages as MessageCatalog
  const es = esMessages as MessageCatalog
  const zhCn = zhCnMessages as MessageCatalog
  const scopedCopy = [
    'Adequacy, triage, and the next pass',
    'Three adequacy checks. Six moves. One clear call.',
    'Direct-smear morphology exercise 1',
    'Licensed source link appears after answer submission.',
    'Inspect quiz hotspot 1',
    'ROSE: Adequacy, Triage & Cytology',
    'Cell ID lab: know the population before naming the process',
    'Small mature lymphocyte',
    'Ciliated bronchial epithelial cells',
    'Neutrophil',
    'Alveolar macrophage',
    'Malignant epithelial population',
    'Red blood cells',
  ] as const

  it('maps high-value learner, atlas, accessibility, and metadata copy in every locale', () => {
    for (const english of scopedCopy) {
      const messageId = handoffMessageIds[english]
      expect(messageId).toBeDefined()
      expect(en.handoff[messageId]).toBe(english)
      expect(es.handoff[messageId]).toBeDefined()
      expect(es.handoff[messageId]).not.toBe(english)
      expect(zhCn.handoff[messageId]).toBeDefined()
      expect(zhCn.handoff[messageId]).not.toBe(english)
    }
  })

  it('resolves new copy through the same handoff runtime used by the route', () => {
    const english = 'Adequacy, triage, and the next pass'

    expect(translateHandoffText(catalogTranslator(es), english)).toBe(
      'Adecuación, triaje y la siguiente pasada',
    )
    expect(translateHandoffText(catalogTranslator(zhCn), english)).toBe('充分性、标本分流与下一针')
  })

  it('localizes the new interactive hotspot label and its cell component', () => {
    const english = 'Inspect Vacuoles or ingested material'

    expect(translateHandoffText(catalogTranslator(es), english)).toBe(
      'Inspeccionar Vacuolas o material fagocitado',
    )
    expect(translateHandoffText(catalogTranslator(zhCn), english)).toBe('检查空泡或吞噬物')
  })

  it('maps every data-driven cell-population teaching string in all locales', () => {
    const cellCopy = [
      ...cellReadingSteps.flatMap((step) => [step.title, step.question]),
      ...cellPopulations.flatMap((population) => [
        population.title,
        population.shortLabel,
        population.family,
        population.relativeSize,
        population.oneLook,
        population.nucleus,
        population.cytoplasm,
        population.arrangement,
        population.onsiteMeaning,
        population.pitfall,
        population.diagramAlt,
        ...population.features.flatMap((feature) => [feature.label, feature.description]),
      ]),
      ...cellPopulationSources.flatMap((source) => [source.title, source.citation]),
    ]

    for (const english of cellCopy) {
      const messageId = handoffMessageIds[english]
      expect(messageId).toBeDefined()
      expect(en.handoff[messageId]).toBeDefined()
      expect(es.handoff[messageId]).toBeDefined()
      expect(zhCn.handoff[messageId]).toBeDefined()
    }
  })
})
