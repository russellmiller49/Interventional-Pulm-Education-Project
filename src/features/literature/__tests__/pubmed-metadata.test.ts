/** @jest-environment node */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import {
  defaultPubmedMetadataParserLimits,
  isAllowedPubmedArticleSetDoctype,
  parsePubmedMetadataXml,
  planPubmedMetadataUpdate,
  PubmedMetadataParseError,
  validateLiteratureLanguage,
  type ExistingPubmedMetadataRow,
  type PubmedMetadataRecord,
} from '@/features/literature/domain/pubmed-metadata'

const fixturePath = join(process.cwd(), 'tests/fixtures/literature/pubmed-efetch.xml')

function currentRow(overrides: Partial<ExistingPubmedMetadataRow> = {}): ExistingPubmedMetadataRow {
  return {
    pmid: '12345678',
    mesh_terms: [],
    author_keywords: [],
    publication_types: [],
    languages: [],
    updated_at: '2026-08-04T12:00:00.000Z',
    ...overrides,
  }
}

function fetchedRecord(overrides: Partial<PubmedMetadataRecord> = {}): PubmedMetadataRecord {
  return {
    pmid: '12345678',
    meshHeadings: [],
    meshTerms: ['Bronchoscopy/*methods'],
    authorKeywords: ['robotic bronchoscopy'],
    publicationTypes: ['Journal Article'],
    languages: ['eng'],
    invalidLanguages: [],
    ...overrides,
  }
}

describe('PubMed EFetch metadata parser', () => {
  it('parses metadata stably without mistaking a referenced PMID for the article PMID', async () => {
    const records = parsePubmedMetadataXml(await readFile(fixturePath, 'utf8'))

    expect(records).toHaveLength(2)
    expect(records[0]).toMatchObject({
      pmid: '12345678',
      meshTerms: ['Bronchoscopy/*methods', '*Humans'],
      authorKeywords: ['robotic bronchoscopy', 'diagnostic yield'],
      publicationTypes: ['Journal Article', 'Randomized Controlled Trial'],
      languages: ['eng'],
      invalidLanguages: [],
    })
    expect(records[0]?.meshHeadings[0]).toEqual({
      descriptor: 'Bronchoscopy',
      descriptorMajorTopic: false,
      qualifiers: [{ name: 'methods', majorTopic: true }],
    })
    expect(records[1]).toMatchObject({ pmid: '39414327', languages: ['spa'] })
  })

  it('accepts only the tightly constrained official NLM PubmedArticleSet doctype', () => {
    const official =
      ' PubmedArticleSet PUBLIC "-//NLM//DTD PubMedArticle, 1st January 2025//EN" "https://dtd.nlm.nih.gov/ncbi/pubmed/out/pubmed_250101.dtd"'
    expect(isAllowedPubmedArticleSetDoctype(official)).toBe(true)
    expect(
      isAllowedPubmedArticleSetDoctype(
        ' PubmedArticleSet SYSTEM "https://attacker.invalid/pubmed.dtd"',
      ),
    ).toBe(false)
    expect(
      isAllowedPubmedArticleSetDoctype(
        ' PubmedArticleSet PUBLIC "-//NLM//DTD PubMedArticle, 1st January 2025//EN" "https://dtd.nlm.nih.gov/ncbi/pubmed/out/pubmed_250101.dtd" [<!ENTITY xxe SYSTEM "file:///etc/passwd">]',
      ),
    ).toBe(false)
  })

  it('rejects an arbitrary or internal-subset doctype before accepting records', () => {
    const xml =
      '<!DOCTYPE PubmedArticleSet SYSTEM "https://attacker.invalid/pubmed.dtd"><PubmedArticleSet />'
    expect(() => parsePubmedMetadataXml(xml)).toThrow(PubmedMetadataParseError)
    expect(() => parsePubmedMetadataXml(xml)).toThrow('unapproved DOCTYPE')
  })

  it('rejects a successful HTTP body that is not a PubmedArticleSet response', () => {
    expect(() => parsePubmedMetadataXml('<ERROR>Invalid uid</ERROR>')).toThrow(
      'expected PubmedArticleSet',
    )
  })

  it('parses Language and PublicationType directly under BookDocument', () => {
    const records = parsePubmedMetadataXml(
      '<PubmedArticleSet><PubmedBookArticle><BookDocument><PMID>42</PMID><Language>FRE</Language><PublicationType>Book Chapter</PublicationType></BookDocument></PubmedBookArticle></PubmedArticleSet>',
    )

    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({
      pmid: '42',
      languages: ['fre'],
      publicationTypes: ['Book Chapter'],
    })
  })

  it('counts unselected article text toward the per-record text bound', () => {
    const xml = `<PubmedArticleSet><PubmedArticle><MedlineCitation><PMID>42</PMID><Article><ArticleTitle>${'x'.repeat(40)}</ArticleTitle></Article></MedlineCitation></PubmedArticle></PubmedArticleSet>`

    expect(() =>
      parsePubmedMetadataXml(xml, {
        ...defaultPubmedMetadataParserLimits,
        maxRecordTextLength: 20,
      }),
    ).toThrow('record exceeded the accepted text length')
  })

  it('enforces the record bound', async () => {
    const xml = await readFile(fixturePath, 'utf8')
    expect(() =>
      parsePubmedMetadataXml(xml, {
        maxDepth: 128,
        maxElementTextLength: 200_000,
        maxRecordTextLength: 2_000_000,
        maxRecords: 1,
        maxResponseBytes: 32 * 1024 * 1024,
        maxValuesPerField: 10_000,
      }),
    ).toThrow('1-record response limit')
  })
})

describe('PubMed metadata normalization and update planning', () => {
  it('uses a general language validator and rejects numeric artifact 4348', () => {
    expect(validateLiteratureLanguage(' ENG ')).toEqual({
      normalized: 'eng',
      reason: null,
      valid: true,
    })
    expect(validateLiteratureLanguage('zh-Hant')).toEqual({
      normalized: 'zh-hant',
      reason: null,
      valid: true,
    })
    expect(validateLiteratureLanguage('4348')).toEqual({
      normalized: '4348',
      reason: 'invalid_syntax',
      valid: false,
    })
  })

  it('fills only empty metadata fields with a sparse patch', () => {
    const plan = planPubmedMetadataUpdate(currentRow(), fetchedRecord())

    expect(plan.patch).toEqual({
      mesh_terms: ['Bronchoscopy/*methods'],
      author_keywords: ['robotic bronchoscopy'],
      publication_types: ['Journal Article'],
      languages: ['eng'],
    })
    expect(Object.values(plan.decisions).map((decision) => decision.status)).toEqual([
      'fill_empty',
      'fill_empty',
      'fill_empty',
      'fill_empty',
    ])
    expect(plan.patch).not.toHaveProperty('raw_nbib_tags')
    expect(plan.patch).not.toHaveProperty('metadata_hash')
    expect(plan.patch).not.toHaveProperty('relevance_state')
  })

  it('replaces a wholly invalid language value without a PMID-specific exception', () => {
    const plan = planPubmedMetadataUpdate(
      currentRow({ pmid: '39414327', languages: ['4348'] }),
      fetchedRecord({ pmid: '39414327', languages: ['spa'] }),
    )

    expect(plan.patch.languages).toEqual(['spa'])
    expect(plan.decisions.languages).toEqual({
      existing: [],
      invalidExisting: ['4348'],
      proposed: ['spa'],
      status: 'replace_invalid',
    })
  })

  it('reports valid nonblank differences as conflicts and never overwrites them', () => {
    const plan = planPubmedMetadataUpdate(
      currentRow({
        mesh_terms: ['Existing Heading'],
        author_keywords: ['existing keyword'],
        publication_types: ['Review'],
        languages: ['spa'],
      }),
      fetchedRecord(),
    )

    expect(plan.patch).toEqual({})
    expect(plan.conflicts).toEqual(['meshTerms', 'authorKeywords', 'publicationTypes', 'languages'])
    expect(Object.values(plan.decisions).every((decision) => decision.status === 'conflict')).toBe(
      true,
    )
  })

  it('does not clear populated metadata when PubMed has no value', () => {
    const plan = planPubmedMetadataUpdate(
      currentRow({ mesh_terms: ['Bronchoscopy'] }),
      fetchedRecord({ meshTerms: [] }),
    )

    expect(plan.patch).not.toHaveProperty('mesh_terms')
    expect(plan.decisions.meshTerms.status).toBe('source_empty')
  })

  it('treats a mixed valid/invalid language field as a conflict', () => {
    const plan = planPubmedMetadataUpdate(
      currentRow({ languages: ['eng', '4348'] }),
      fetchedRecord({ languages: ['eng'] }),
    )

    expect(plan.patch).not.toHaveProperty('languages')
    expect(plan.decisions.languages).toMatchObject({
      existing: ['eng'],
      invalidExisting: ['4348'],
      status: 'conflict',
    })
  })
})
