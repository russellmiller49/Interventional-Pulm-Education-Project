import { readFile } from 'node:fs/promises'
import path from 'node:path'

const ledgerPath = path.join(
  process.cwd(),
  'data/ip-preference-cards/reviewed/external-review-remediation.json',
)

const dispositions = new Set([
  'accept_now',
  'accept_with_modification',
  'needs_clinician_review',
  'needs_source_enrichment',
  'superseded_by_current_architecture',
  'defer',
  'reject',
])

const statuses = new Set(['planned', 'implemented', 'deferred'])

interface LedgerEntry {
  reviewSource: string
  findingId: string
  sourceSheet: string
  sourceReference: string
  summary: string
  disposition: string
  rationale: string
  affectedProductIds: string[]
  affectedRoleCodes: string[]
  affectedSlotIds: string[]
  implementationMilestone: string
  evidenceNeeded: string[]
  status: string
}

interface RemediationLedger {
  sourceEvidence: { reviewSource: string; filename: string; sha256: string }[]
  entries: LedgerEntry[]
}

async function readLedger(): Promise<RemediationLedger> {
  return JSON.parse(await readFile(ledgerPath, 'utf8')) as RemediationLedger
}

function expectedFindingIds(): string[] {
  return [
    ...Array.from({ length: 23 }, (_, index) => `F-${String(index + 1).padStart(2, '0')}`),
    ...Array.from({ length: 10 }, (_, index) => `S-${String(index + 1).padStart(2, '0')}`),
    ...Array.from({ length: 6 }, (_, index) => `R-${String(index + 1).padStart(2, '0')}`),
  ].sort()
}

describe('external review remediation ledger', () => {
  it('accounts for every required finding exactly once with the governed interface', async () => {
    const ledger = await readLedger()

    expect(ledger.entries.map((entry) => entry.findingId).sort()).toEqual(expectedFindingIds())
    expect(new Set(ledger.entries.map((entry) => entry.findingId)).size).toBe(39)

    for (const entry of ledger.entries) {
      expect(entry.reviewSource).toBe('review_2')
      expect(entry.sourceSheet).not.toHaveLength(0)
      expect(entry.sourceReference).toMatch(/^A\d+:/)
      expect(entry.summary).not.toHaveLength(0)
      expect(dispositions).toContain(entry.disposition)
      expect(entry.rationale).not.toHaveLength(0)
      expect(Array.isArray(entry.affectedProductIds)).toBe(true)
      expect(Array.isArray(entry.affectedRoleCodes)).toBe(true)
      expect(Array.isArray(entry.affectedSlotIds)).toBe(true)
      expect(entry.implementationMilestone).not.toHaveLength(0)
      expect(Array.isArray(entry.evidenceNeeded)).toBe(true)
      expect(statuses).toContain(entry.status)
    }
  })

  it('records the required minimum dispositions', async () => {
    const ledger = await readLedger()
    const byId = new Map(ledger.entries.map((entry) => [entry.findingId, entry.disposition]))

    for (const id of [
      'F-01',
      'S-01',
      'F-09',
      'S-04',
      'R-01',
      'F-10',
      'S-02',
      'R-02',
      'F-20',
      'F-23',
      'S-09',
      'S-10',
      'F-22',
      'F-12',
      'S-06',
    ]) {
      expect(byId.get(id)).toBe('accept_now')
    }
    for (const id of [
      'F-06',
      'S-05',
      'F-08',
      'F-13',
      'F-14',
      'F-15',
      'F-16',
      'F-17',
      'F-18',
      'S-07',
      'F-19',
      'S-03',
    ]) {
      expect(byId.get(id)).toBe('accept_with_modification')
    }
    for (const id of ['F-02', 'F-03', 'F-04', 'F-05']) {
      expect(byId.get(id)).toBe('needs_source_enrichment')
    }
  })

  it('pins both external evidence hashes without recording local paths', async () => {
    const ledger = await readLedger()

    expect(ledger.sourceEvidence).toEqual([
      expect.objectContaining({
        filename: 'IP_Full_Catalog_Clinical_Use_Review_1.xlsx',
        sha256: 'a6ca5702e4fd173490760239e8ebe5ae39bc5a78b0151641d0b783ec7ea21388',
      }),
      expect.objectContaining({
        filename: 'IP_Full_Catalog_Clinical_Use_Review_2.xlsx',
        sha256: 'ec21731456d34011c8434ebb7252d26584fd620eef48d63f958c41402a3a9180',
      }),
    ])
    expect(JSON.stringify(ledger)).not.toContain('/Users/')
  })
})
