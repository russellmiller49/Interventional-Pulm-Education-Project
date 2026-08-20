import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { scanStaticOutput } from './check-brochure-intake-static-exposure'

describe('brochure intake client static-output scan', () => {
  let fixtureRoot: string

  beforeEach(() => {
    fixtureRoot = mkdtempSync(path.join(tmpdir(), 'brochure-static-scan-'))
    mkdirSync(path.join(fixtureRoot, 'chunks'))
  })

  afterEach(() => {
    rmSync(fixtureRoot, { recursive: true, force: true })
  })

  it('passes ordinary client assets without treating governed product names as intake dumps', () => {
    writeFileSync(
      path.join(fixtureRoot, 'chunks', 'app.js'),
      'self.__catalog={product_name:"FUJIFILM EB-530XT Video Bronchoscope"}',
    )

    expect(scanStaticOutput(fixtureRoot)).toEqual({ filesScanned: 1, matches: [] })
  })

  it('finds raw intake markers in direct, JSON-escaped, and URL-encoded forms', () => {
    writeFileSync(
      path.join(fixtureRoot, 'chunks', 'direct.js'),
      'Product ID,Product Name,Manufacturer,Source File',
    )
    writeFileSync(
      path.join(fixtureRoot, 'chunks', 'encoded.js'),
      encodeURIComponent('row-reconciliation.csv'),
    )

    expect(scanStaticOutput(fixtureRoot).matches).toEqual([
      { file: path.join('chunks', 'direct.js'), sentinel: 'raw CSV header' },
      {
        file: path.join('chunks', 'encoded.js'),
        sentinel: 'row-level review artifact filename',
      },
    ])
  })

  it('fails closed when the production static directory is absent', () => {
    expect(() => scanStaticOutput(path.join(fixtureRoot, 'missing'))).toThrow(
      /Static output directory does not exist/u,
    )
  })

  it('runs through the tsx CLI entry point on Node 20', () => {
    writeFileSync(path.join(fixtureRoot, 'chunks', 'app.js'), 'self.__catalog={safe:true}')

    const result = spawnSync(
      path.resolve('node_modules/.bin/tsx'),
      [
        path.resolve('scripts/ip-preference-cards/check-brochure-intake-static-exposure.ts'),
        fixtureRoot,
      ],
      { encoding: 'utf8' },
    )

    expect(result.status).toBe(0)
    expect(result.stderr).toBe('')
    expect(result.stdout).toContain('0 matches across 1 client file(s)')
  })
})
