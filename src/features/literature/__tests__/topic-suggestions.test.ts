import { join } from 'node:path'

import { literatureQueryRegistry, literatureTopicRules } from '@/features/literature/config'
import { normalizeNbibRecord } from '@/features/literature/domain/normalize'
import { parseNbibFile } from '@/features/literature/domain/nbib-parser'
import { suggestLiteratureTopics } from '@/features/literature/domain/topic-suggestions'
import type { NormalizedLiteratureArticle } from '@/features/literature/types'

const fixturePath = join(process.cwd(), 'tests/fixtures/literature/complex.nbib')

async function fixtureArticle() {
  for await (const parsed of parseNbibFile(fixturePath)) {
    const normalized = normalizeNbibRecord(parsed.record, literatureQueryRegistry, parsed.issues)
    if (normalized.article) {
      return normalized.article
    }
  }
  throw new Error('Expected a normalized fixture article.')
}

function withText(article: NormalizedLiteratureArticle, title: string, abstract: string) {
  return {
    ...article,
    title,
    abstract,
    meshTerms: [],
    authorKeywords: [],
  }
}

describe('Phase 1 topic suggestions', () => {
  it('creates versioned query and high-precision rule suggestions', async () => {
    const article = await fixtureArticle()
    const suggestions = suggestLiteratureTopics(
      article,
      ['peripheral_navigation'],
      literatureTopicRules,
      literatureQueryRegistry.registry_version,
    )

    expect(
      suggestions.map((suggestion) => [suggestion.assignmentSource, suggestion.topicId]),
    ).toEqual(
      expect.arrayContaining([
        ['query', 'peripheral-navigation'],
        ['rule', 'peripheral-navigation.robotic-bronchoscopy'],
        ['rule', 'peripheral-navigation.cone-beam-ct'],
      ]),
    )
    expect(suggestions.every((suggestion) => suggestion.assignmentState === 'suggested')).toBe(true)
  })

  it('does not classify an endobronchial valve without clinical context', async () => {
    const base = await fixtureArticle()
    const ambiguous = suggestLiteratureTopics(
      withText(base, 'Endobronchial valve placement', 'A technical report.'),
      [],
      literatureTopicRules,
      literatureQueryRegistry.registry_version,
    )
    const blvr = suggestLiteratureTopics(
      withText(
        base,
        'Endobronchial valves for emphysema',
        'Bronchoscopic lung volume reduction in hyperinflation.',
      ),
      [],
      literatureTopicRules,
      literatureQueryRegistry.registry_version,
    )
    const airLeak = suggestLiteratureTopics(
      withText(
        base,
        'Endobronchial valves for persistent air leak',
        'Treatment of a bronchopleural fistula.',
      ),
      [],
      literatureTopicRules,
      literatureQueryRegistry.registry_version,
    )

    expect(ambiguous.some((suggestion) => suggestion.topicId.includes('valves'))).toBe(false)
    expect(blvr.map((suggestion) => suggestion.topicId)).toContain(
      'bronchoscopic-lung-volume-reduction.valves',
    )
    expect(airLeak.map((suggestion) => suggestion.topicId)).toContain(
      'persistent-air-leak-fistula.valves',
    )
  })

  it('requires context before assigning a cryobiopsy subtype', async () => {
    const base = await fixtureArticle()
    const generic = suggestLiteratureTopics(
      withText(base, 'Transbronchial cryobiopsy', 'A procedural report.'),
      [],
      literatureTopicRules,
      literatureQueryRegistry.registry_version,
    )
    const ild = suggestLiteratureTopics(
      withText(
        base,
        'Transbronchial cryobiopsy in ILD',
        'Patients with interstitial lung disease were studied.',
      ),
      [],
      literatureTopicRules,
      literatureQueryRegistry.registry_version,
    )

    expect(
      generic.some((suggestion) => suggestion.topicId.startsWith('transbronchial-cryobiopsy.')),
    ).toBe(false)
    expect(ild.map((suggestion) => suggestion.topicId)).toContain('transbronchial-cryobiopsy.ild')
  })
})
