import { mkdtemp, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  assertLiteratureGoldPmidExclusionManifestUnchanged,
  loadLiteratureGoldPmidExclusionManifest,
  parseLiteratureGoldPmidExclusionManifest,
} from '@/features/literature/gold-set/exclusion-manifest'

describe('gold-set PMID exclusion manifests', () => {
  it('accepts only nonempty, numeric, unique PMID strings', () => {
    expect(parseLiteratureGoldPmidExclusionManifest('123\n456,789', 'pmids.txt')).toEqual([
      '123',
      '456',
      '789',
    ])
    expect(parseLiteratureGoldPmidExclusionManifest('["123","456"]', 'pmids.json')).toEqual([
      '123',
      '456',
    ])

    expect(() => parseLiteratureGoldPmidExclusionManifest('', 'pmids.txt')).toThrow(
      'at least one PMID string',
    )
    expect(() => parseLiteratureGoldPmidExclusionManifest('123\nnot-a-pmid', 'pmids.txt')).toThrow(
      'numeric PMID string',
    )
    expect(() => parseLiteratureGoldPmidExclusionManifest('123\n123', 'pmids.txt')).toThrow(
      'duplicate PMID 123',
    )
    expect(() => parseLiteratureGoldPmidExclusionManifest('[123]', 'pmids.json')).toThrow(
      'numeric PMID string',
    )
  })

  it('records the absolute path and exact file SHA-256', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'gold-exclusion-manifest-'))
    const path = join(directory, 'pmids.txt')
    try {
      await writeFile(path, '123\n456\n', 'utf8')
      const manifest = await loadLiteratureGoldPmidExclusionManifest(path)

      expect(manifest).toEqual({
        path,
        sha256: '3b1250f7f2b7851fe4853ae48424d0923848bd973a053b8dff44da2c8f348878',
        pmids: ['123', '456'],
      })
      await expect(
        assertLiteratureGoldPmidExclusionManifestUnchanged(manifest),
      ).resolves.toBeUndefined()
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('fails closed if the manifest pathname is replaced during sampling', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'gold-exclusion-manifest-'))
    const path = join(directory, 'pmids.txt')
    const replacementPath = join(directory, 'replacement.txt')
    try {
      await writeFile(path, '123\n456\n', 'utf8')
      const manifest = await loadLiteratureGoldPmidExclusionManifest(path)
      await writeFile(replacementPath, '123\n789\n', 'utf8')
      await rename(replacementPath, path)

      await expect(assertLiteratureGoldPmidExclusionManifestUnchanged(manifest)).rejects.toThrow(
        'checksum changed during sampling',
      )
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
