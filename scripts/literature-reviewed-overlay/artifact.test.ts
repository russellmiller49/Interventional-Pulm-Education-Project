/** @jest-environment node */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { loadArtifactTruth } from './artifact'
import { OVERLAY_ARTIFACT_SHA256 } from './constants'

describe('loadArtifactTruth boundary', () => {
  let directory: string
  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'overlay-artifact-test-'))
  })
  afterEach(() => {
    rmSync(directory, { recursive: true, force: true })
  })

  it('refuses a relative path before touching the filesystem', () => {
    expect(() => loadArtifactTruth('relative/path.csv')).toThrow(/must be absolute/u)
  })

  it('refuses a foreign owner pin before reading the file', () => {
    const path = join(directory, 'never-read.csv')
    // Deliberately not created: a pin mismatch must refuse before any read.
    expect(() => loadArtifactTruth(path, ['0'.repeat(64)])).toThrow(
      /does not match the reviewed artifact identity/u,
    )
  })

  it('refuses bytes that do not hash to the pinned identity', () => {
    const path = join(directory, 'synthetic.csv')
    writeFileSync(path, 'pmid\n100000001\n', 'utf8')
    expect(() => loadArtifactTruth(path, [OVERLAY_ARTIFACT_SHA256])).toThrow(
      /SHA-256 does not match/u,
    )
  })
})
