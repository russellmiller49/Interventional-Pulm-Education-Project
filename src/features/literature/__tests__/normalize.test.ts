import { join } from 'node:path'

import { literatureQueryRegistry } from '@/features/literature/config'
import { normalizeNbibRecord, parsePublicationDate } from '@/features/literature/domain/normalize'
import { parseNbibFile } from '@/features/literature/domain/nbib-parser'
import type { ParsedNbibRecord } from '@/features/literature/types'

const fixtureRoot = join(process.cwd(), 'tests/fixtures/literature')

async function parseFixture(name: string) {
  const records: ParsedNbibRecord[] = []
  for await (const record of parseNbibFile(join(fixtureRoot, name))) {
    records.push(record)
  }
  return records
}

describe('NBIB normalization', () => {
  it('normalizes the simple fixture deterministically', async () => {
    const [parsed] = await parseFixture('simple.nbib')
    const first = normalizeNbibRecord(parsed.record, literatureQueryRegistry, parsed.issues)
    const second = normalizeNbibRecord(parsed.record, literatureQueryRegistry, parsed.issues)

    expect(first.article).toMatchObject({
      pmid: '12345678',
      pmcid: 'PMC1234567',
      doi: '10.1000/example.doi',
      journalId: 'chest',
      publicationYear: 2024,
      publicationMonth: 1,
      publicationDay: 15,
      publicationDatePrecision: 'day',
      abstractDisplayPolicy: 'snippet_only',
    })
    expect(first.article?.abstract).toContain('\nMETHODS:')
    expect(first.article?.metadataHash).toBe(second.article?.metadataHash)
    expect(first.article?.normalizedTitleHash).toBe(second.article?.normalizedTitleHash)
  })

  it('reports conflicting DOI candidates and preserves complex metadata', async () => {
    const [parsed] = await parseFixture('complex.nbib')
    const result = normalizeNbibRecord(parsed.record, literatureQueryRegistry, parsed.issues)

    expect(result.issues.map((issue) => issue.code)).toContain('CONFLICTING_DOI')
    expect(result.article?.doiCandidates).toEqual(['10.2000/first', '10.2000/second'])
    expect(result.article).toMatchObject({
      journalId: 'jbip',
      publicationDatePrecision: 'season',
      isConferenceAbstract: true,
      articleNumber: 'S1234-5678(25)00001-2',
      collectiveAuthors: ['The Fixture Research Group'],
    })
    expect(result.article?.authors).toEqual([
      { fullName: 'Chen, Jordan', abbreviatedName: 'Chen J' },
      { fullName: "O'Neil, Sam", abbreviatedName: "O'Neil S" },
    ])
    expect(result.article?.meshTerms).toEqual(['Bronchoscopy', 'Solitary Pulmonary Nodule'])
    expect(result.article?.rawNbibTags.XYZ).toEqual(['Unknown tags must survive.'])
    expect(result.article?.abstract).toContain('\n\nRESULTS:')
  })

  it('keeps no-abstract records and derives explicit correction/retraction flags', async () => {
    const records = await parseFixture('complex.nbib')
    const result = normalizeNbibRecord(
      records[1].record,
      literatureQueryRegistry,
      records[1].issues,
    )

    expect(result.article).toMatchObject({
      pmid: '34567890',
      abstract: null,
      publicationDatePrecision: 'year',
      isRetracted: true,
      isCorrection: true,
    })
    expect(result.issues.map((issue) => issue.code)).toContain('UNMATCHED_JOURNAL')
  })

  it('quarantines missing, invalid, and title-less records', async () => {
    const records = await parseFixture('malformed.nbib')
    const missing = normalizeNbibRecord(
      records[0].record,
      literatureQueryRegistry,
      records[0].issues,
    )
    const invalid = normalizeNbibRecord(records[1].record, literatureQueryRegistry)
    const titleless = normalizeNbibRecord(
      { recordNumber: 99, tags: { PMID: ['999'] } },
      literatureQueryRegistry,
    )

    expect(missing.article).toBeNull()
    expect(missing.issues.filter((issue) => issue.code === 'MISSING_PMID')).toHaveLength(1)
    expect(invalid.article).toBeNull()
    expect(titleless.article).toBeNull()
    expect(titleless.issues.map((issue) => issue.code)).toContain('MISSING_TITLE')
  })

  it.each([
    ['2024', 'year', 2024, null, null],
    ['2024 Feb', 'month', 2024, 2, null],
    ['2024 Feb 29', 'day', 2024, 2, 29],
    ['2024 Winter', 'season', 2024, null, null],
    ['2024 Jan-Feb', 'unknown', 2024, null, null],
    ['2024 Jan 1-15', 'month', 2024, 1, null],
    ['2023-2024', 'unknown', null, null, null],
    ['forthcoming', 'unknown', null, null, null],
  ] as const)(
    'parses %s without inventing missing date precision',
    (raw, precision, year, month, day) => {
      expect(parsePublicationDate(raw)).toMatchObject({
        raw,
        precision,
        year,
        month,
        day,
      })
    },
  )
})
