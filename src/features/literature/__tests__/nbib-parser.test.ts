import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { parseNbibFile, parseNbibText } from '@/features/literature/domain/nbib-parser'
import type { ParsedNbibRecord } from '@/features/literature/types'

const fixtureRoot = join(process.cwd(), 'tests/fixtures/literature')

async function collectRecords(generator: AsyncGenerator<ParsedNbibRecord>) {
  const records: ParsedNbibRecord[] = []
  for await (const record of generator) {
    records.push(record)
  }
  return records
}

describe('NBIB parser', () => {
  it('parses a simple record and appends indented continuations', async () => {
    const records = await collectRecords(parseNbibFile(join(fixtureRoot, 'simple.nbib')))

    expect(records).toHaveLength(1)
    expect(records[0].record.tags.PMID).toEqual(['12345678'])
    expect(records[0].record.tags.AB?.[0]).toContain(
      '\nMETHODS: It has an indented continuation line.',
    )
    expect(records[0].issues).toEqual([])
  })

  it('preserves repeated and unknown fields while recognizing PMID boundaries', async () => {
    const records = await collectRecords(parseNbibFile(join(fixtureRoot, 'complex.nbib')))

    expect(records).toHaveLength(2)
    expect(records[0].record.tags.FAU).toEqual(['Chen, Jordan', "O'Neil, Sam"])
    expect(records[0].record.tags.AB).toHaveLength(2)
    expect(records[0].record.tags.MH).toEqual([
      'Bronchoscopy',
      'Bronchoscopy',
      'Solitary Pulmonary Nodule',
    ])
    expect(records[0].record.tags.XYZ).toEqual(['Unknown tags must survive.'])
    expect(records[1].record.tags.PMID).toEqual(['34567890'])
  })

  it('quarantines missing and invalid PMID records without inventing identifiers', async () => {
    const text = await readFile(join(fixtureRoot, 'malformed.nbib'), 'utf8')
    const records = await parseNbibText(text)

    expect(records).toHaveLength(3)
    expect(records[0].issues.map((issue) => issue.code)).toContain('MISSING_PMID')
    expect(records[1].record.tags.PMID).toEqual(['not-a-number'])
    expect(records[2].issues.map((issue) => issue.code)).toContain('MALFORMED_LINE')
    expect(records[2].record.tags.ZZZ).toEqual(['Preserved unknown field.'])
  })

  it('does not depend on blank lines to split records at a new PMID', async () => {
    const records = await parseNbibText(
      ['PMID- 100', 'TI  - First', 'PMID- 101', 'TI  - Second'].join('\n'),
    )

    expect(records.map((entry) => entry.record.tags.PMID?.[0])).toEqual(['100', '101'])
  })

  it('reports bounded-input violations instead of accepting unbounded fields', async () => {
    const records = await parseNbibText(`PMID- 123\nTI  - ${'x'.repeat(40)}`, {
      maxLineLength: 30,
      maxFieldLength: 20,
      maxFieldsPerRecord: 10,
      maxRecordLength: 100,
    })

    expect(records[0].issues.map((issue) => issue.code)).toContain('LINE_TOO_LONG')
  })
})
