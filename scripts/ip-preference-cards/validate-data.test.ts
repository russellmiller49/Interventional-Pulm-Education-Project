import { appendFile, copyFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { validateGeneratedCatalog } from './validate-data'

const GENERATED_DIRECTORY = path.resolve('data/ip-preference-cards/generated')
const REQUIRED_FILES = [
  'catalog-products.json',
  'gudid-confirmations.json',
  'import-report.json',
  'procedure-slots.json',
  'procedures.json',
  'product-roles.json',
  'roles.json',
  'slot-product-option-proposals.json',
  'slot-product-options.json',
] as const

describe('generated catalog integrity validation', () => {
  it('accepts the committed proposal artifact as a fresh deterministic regeneration', async () => {
    await expect(validateGeneratedCatalog()).resolves.toMatchObject({
      authoredSlotOptions: 2035,
      unreviewedSlotOptionProposals: 1595,
      excludedSlotOptionProposals: 0,
      staleSlotOptionExceptions: 0,
    })
  })

  it('fails when proposal output differs byte-for-byte from regeneration', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'ip-slot-option-validation-'))
    try {
      await Promise.all(
        REQUIRED_FILES.map((filename) =>
          copyFile(path.join(GENERATED_DIRECTORY, filename), path.join(directory, filename)),
        ),
      )
      await appendFile(path.join(directory, 'slot-product-option-proposals.json'), '\n')

      await expect(validateGeneratedCatalog({ generatedDirectory: directory })).rejects.toThrow(
        /differs from a fresh deterministic regeneration/,
      )
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
