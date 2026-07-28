import { writeFile, mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { mergeOpenFdaCandidates } from '../classify-match'
import { escapeCsvValue, openFdaProposalsToCsv } from '../csv'
import { generateOpenFdaReports } from '../generate-report'
import { buildOpenFdaEnrichmentProposal } from '../proposals'
import { openFdaEnrichmentProposalSchema } from '../schemas'
import type { OpenFdaQuery } from '../types'
import { acmeAliasGroup, catalogProduct, openFdaRecord } from './fixtures'

const query: OpenFdaQuery = {
  kind: 'catalog_number',
  phase: 2,
  search: 'catalog_number:"CAT-001"',
  limit: 100,
  sourceValue: 'CAT-001',
  reviewOnly: false,
}

function proposalForRecords(records: ReturnType<typeof openFdaRecord>[]) {
  const candidates = mergeOpenFdaCandidates(
    [],
    records,
    query,
    '2026-07-27T00:00:00.000Z',
    'openfda-cache:test.json',
  )
  return buildOpenFdaEnrichmentProposal({
    product: catalogProduct(),
    aliasGroup: acmeAliasGroup,
    candidates,
    queryAttempts: [],
  })
}

describe('openFDA proposal generation', () => {
  it('is deterministic when API result order changes', () => {
    const records = [
      openFdaRecord({ public_device_record_key: 'record-b' }),
      openFdaRecord({ public_device_record_key: 'record-a' }),
    ]
    expect(proposalForRecords(records)).toEqual(proposalForRecords([...records].reverse()))
  })

  it('never mutates the canonical product input', () => {
    const product = catalogProduct()
    const before = JSON.stringify(product)
    buildOpenFdaEnrichmentProposal({
      product,
      aliasGroup: acmeAliasGroup,
      candidates: mergeOpenFdaCandidates(
        [],
        [openFdaRecord()],
        query,
        '2026-07-27T00:00:00.000Z',
        'openfda-cache:test.json',
      ),
      queryAttempts: [],
    })
    expect(JSON.stringify(product)).toBe(before)
  })

  it('validates the complete generated proposal shape', () => {
    expect(() =>
      openFdaEnrichmentProposalSchema.parse(proposalForRecords([openFdaRecord()])),
    ).not.toThrow()
  })

  it('escapes commas, quotes, newlines, and Unicode in CSV reports', () => {
    expect(escapeCsvValue('α, "quoted"\nline')).toBe('"α, ""quoted""\nline"')
    const proposal = proposalForRecords([
      openFdaRecord({ company_name: 'Acme, "International"\nMedical' }),
    ])
    const csv = openFdaProposalsToCsv([proposal])
    expect(csv).toContain('"Acme, ""International""\nMedical"')
  })

  it('does not change a catalog file while writing a separate proposal fixture', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'openfda-proposal-'))
    try {
      const catalogPath = path.join(directory, 'catalog-products.json')
      await writeFile(catalogPath, `${JSON.stringify([catalogProduct()])}\n`, 'utf8')
      const before = await readFile(catalogPath, 'utf8')
      proposalForRecords([openFdaRecord()])
      expect(await readFile(catalogPath, 'utf8')).toBe(before)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('regenerates every CSV report from validated proposal JSON', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'openfda-report-'))
    try {
      const proposal = proposalForRecords([openFdaRecord()])
      await writeFile(
        path.join(directory, 'enrichment-proposals.json'),
        `${JSON.stringify([proposal])}\n`,
        'utf8',
      )
      await expect(generateOpenFdaReports(directory)).resolves.toBe(1)
      expect(await readFile(path.join(directory, 'review-required.csv'), 'utf8')).toContain(
        'product_id',
      )
      expect(
        await readFile(path.join(directory, 'high-confidence-candidates.csv'), 'utf8'),
      ).toContain('PRD-TEST-001')
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
