import { mkdtemp, readFile, readdir, rm, stat, unlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import {
  exactIdentifierMatchInExtractedText,
  extractSearchableHtmlText,
  fetchManufacturerSources,
  parseManufacturerSourceArgs,
  validateManufacturerSourceOutputPath,
  type ManufacturerSourceRegistryRow,
} from '../fetch-manufacturer-sources'

const SNAPSHOT = '2026-08-14'
const RETRIEVED_AT = '2026-08-14T12:34:56.000Z'

function registryRow({
  sourceId = 'SRC-TEST',
  url = 'https://manufacturer.example/products/example',
  title = 'Example product',
  expected = ['CAT-100'],
}: {
  sourceId?: string
  url?: string
  title?: string
  expected?: string[]
} = {}): ManufacturerSourceRegistryRow {
  return {
    catalog_source_id: sourceId,
    manufacturer: 'Example Medical',
    source_url: url,
    publisher: 'Example Medical USA',
    title,
    publication_or_revision_date: '2026-08',
    us_specific: true,
    current_status_signal: 'current_catalog_or_product_page',
    exact_identifier_basis: 'The official page provides the exact catalog identifier.',
    expected_identifier_examples: expected,
    factual_summary: 'The manufacturer page identifies the product.',
    limitations: 'Page presence does not establish inventory or immediate orderability.',
  }
}

interface FixturePaths {
  root: string
  registryPath: string
  cacheDirectory: string
  outputPath: string
}

const temporaryRoots: string[] = []

async function fixturePaths(): Promise<FixturePaths> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'manufacturer-source-fetch-'))
  temporaryRoots.push(root)
  return {
    root,
    registryPath: path.join(root, 'manufacturer-source-registry.json'),
    cacheDirectory: path.join(root, 'cache'),
    outputPath: path.join(root, 'output', 'source-manifest.json'),
  }
}

async function writeRegistry(filename: string, rows: ManufacturerSourceRegistryRow[]) {
  await writeFile(filename, `${JSON.stringify(rows, null, 2)}\n`, 'utf8')
}

function response(body: string, status = 200, contentType = 'text/html; charset=utf-8') {
  const bytes = Uint8Array.from(Buffer.from(body))
  return {
    status,
    url: '',
    body: { cancel: async () => undefined },
    headers: {
      get(name: string) {
        return name.toLocaleLowerCase('en-US') === 'content-type' ? contentType : null
      },
    },
    arrayBuffer: async () => bytes.buffer,
  } as unknown as Response
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  )
})

describe('manufacturer source fetching and cache', () => {
  it('requires an explicit dated snapshot and output path', () => {
    expect(() => parseManufacturerSourceArgs([])).toThrow('--snapshot is required')
    expect(() => parseManufacturerSourceArgs(['--snapshot', SNAPSHOT])).toThrow(
      '--output is required',
    )
    expect(() =>
      parseManufacturerSourceArgs(['--snapshot', '2026-02-30', '--output', 'source-manifest.json']),
    ).toThrow('valid calendar date')

    expect(
      parseManufacturerSourceArgs([
        '--snapshot',
        SNAPSHOT,
        '--output',
        `data/ip-preference-cards/research/us-status/${SNAPSHOT}/source-manifest.json`,
        '--refresh',
        '--concurrency',
        '99',
      ]),
    ).toMatchObject({ snapshot: SNAPSHOT, refresh: true, concurrency: 8 })
  })

  it('confines CLI output to the explicit snapshot source-manifest path', () => {
    const expected = `data/ip-preference-cards/research/us-status/${SNAPSHOT}/source-manifest.json`
    const dedicatedInput = `data/ip-preference-cards/research/us-status/${SNAPSHOT}/manufacturer-source-snapshot.json`
    expect(validateManufacturerSourceOutputPath(SNAPSHOT, expected)).toBe(path.resolve(expected))
    expect(validateManufacturerSourceOutputPath(SNAPSHOT, dedicatedInput)).toBe(
      path.resolve(dedicatedInput),
    )
    expect(() =>
      validateManufacturerSourceOutputPath(
        SNAPSHOT,
        `data/ip-preference-cards/research/us-status/${SNAPSHOT}/other.json`,
      ),
    ).toThrow('--output must be')
    expect(() =>
      validateManufacturerSourceOutputPath(SNAPSHOT, '/tmp/source-manifest.json'),
    ).toThrow('--output must be')
  })

  it('performs punctuation-preserving exact identifier searches with token boundaries', () => {
    expect(exactIdentifierMatchInExtractedText('BF-H190', 'Scope: bf-h190, adult')).toBe(true)
    expect(exactIdentifierMatchInExtractedText('BF-H190', 'Scope XBF-H190A')).toBe(false)
    expect(exactIdentifierMatchInExtractedText('BF-H190', 'Scope BF-H190-2')).toBe(false)
    expect(exactIdentifierMatchInExtractedText('BF-H190', 'Scope BF-H190.')).toBe(true)
    expect(exactIdentifierMatchInExtractedText('82520.1041', 'REF 82520.1041')).toBe(true)
    expect(exactIdentifierMatchInExtractedText('82520.1041', 'REF 82520-1041')).toBe(false)
    expect(exactIdentifierMatchInExtractedText('SonoSite PX', 'SonoSite\n\tPX platform')).toBe(true)
  })

  it('extracts visible searchable HTML text without scripts, styles, comments, or entities', () => {
    const text = extractSearchableHtmlText(`
      <html><style>.CAT-STYLE {}</style><script>SECRET-CAT</script>
      <!-- HIDDEN-CAT --><body><p>CAT-100 &amp; BF-H190</p></body></html>
    `)
    expect(text).toBe('CAT-100 & BF-H190')
    expect(text).not.toContain('SECRET-CAT')
    expect(text).not.toContain('HIDDEN-CAT')
  })

  it('fetches each unique URL once, retains registry rows, and writes mode-0600 cache files', async () => {
    const paths = await fixturePaths()
    const sharedUrl = 'https://manufacturer.example/catalog'
    await writeRegistry(paths.registryPath, [
      registryRow({
        sourceId: 'SRC-B',
        url: sharedUrl,
        title: 'Second use of shared catalog',
        expected: ['CAT-100', 'SECRET-CAT'],
      }),
      registryRow({
        sourceId: 'SRC-A',
        url: sharedUrl,
        title: 'First use of shared catalog',
        expected: ['CAT-10', 'CAT-100'],
      }),
    ])
    const fetchMock = jest.fn(async () =>
      response('<html><script>SECRET-CAT</script><body>Device CAT-100.</body></html>'),
    )

    const manifest = await fetchManufacturerSources({
      snapshot: SNAPSHOT,
      registryPath: paths.registryPath,
      registryReference:
        'data/ip-preference-cards/research/us-status-v1/manufacturer-source-registry.json',
      outputPath: paths.outputPath,
      cacheDirectory: paths.cacheDirectory,
      cacheReferenceDirectory: `local-data/ip-preference-cards/us-status/${SNAPSHOT}/manufacturer`,
      fetchImpl: fetchMock as unknown as typeof fetch,
      now: () => Date.parse(RETRIEVED_AT),
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(manifest).toMatchObject({
      snapshot: SNAPSHOT,
      registry_entry_count: 2,
      unique_url_count: 1,
      canonical_change_applied: false,
    })
    expect(manifest.sources.map((entry) => entry.catalog_source_id)).toEqual(['SRC-A', 'SRC-B'])
    expect(manifest.sources[0]).toMatchObject({
      retrieved_at: RETRIEVED_AT,
      http_status: 200,
      http_ok: true,
      text_extraction_status: 'html_text',
      factual_summary: 'The manufacturer page identifies the product.',
      canonical_change_applied: false,
    })
    expect(manifest.sources[0].expected_identifier_matches).toEqual([
      { identifier: 'CAT-10', exact_text_match: false },
      { identifier: 'CAT-100', exact_text_match: true },
    ])
    expect(manifest.sources[1].expected_identifier_matches).toEqual([
      { identifier: 'CAT-100', exact_text_match: true },
      { identifier: 'SECRET-CAT', exact_text_match: false },
    ])
    expect(manifest.sources[0].text_cache_reference).toMatch(
      new RegExp(
        `^local-data/ip-preference-cards/us-status/${SNAPSHOT}/manufacturer/[a-f0-9-]+\\.txt$`,
      ),
    )
    expect(manifest.sources[0].text_cache_reference).toBe(manifest.sources[1].text_cache_reference)

    const cacheFiles = await readdir(paths.cacheDirectory)
    expect(cacheFiles.some((filename) => filename.endsWith('.body'))).toBe(true)
    expect(cacheFiles.some((filename) => filename.endsWith('.txt'))).toBe(true)
    expect(cacheFiles.some((filename) => filename.endsWith('.cache.json'))).toBe(true)
    for (const filename of cacheFiles) {
      expect((await stat(path.join(paths.cacheDirectory, filename))).mode & 0o777).toBe(0o600)
    }
    const committedManifest = await readFile(paths.outputPath, 'utf8')
    expect(committedManifest).not.toContain('<html>')
    expect(committedManifest).not.toContain('Device CAT-100.')
  })

  it('reuses validated cache and regenerates byte-identical output without fetching', async () => {
    const paths = await fixturePaths()
    await writeRegistry(paths.registryPath, [registryRow()])
    const firstFetch = jest.fn(async () => response('<main>CAT-100</main>'))
    const common = {
      snapshot: SNAPSHOT,
      registryPath: paths.registryPath,
      registryReference: 'registry.json',
      outputPath: paths.outputPath,
      cacheDirectory: paths.cacheDirectory,
      cacheReferenceDirectory: `local-data/ip-preference-cards/us-status/${SNAPSHOT}/manufacturer`,
    }

    await fetchManufacturerSources({
      ...common,
      fetchImpl: firstFetch as unknown as typeof fetch,
      now: () => Date.parse(RETRIEVED_AT),
    })
    const firstBytes = await readFile(paths.outputPath)
    const forbiddenFetch = jest.fn(async () => {
      throw new Error('cache rerun attempted a network request')
    })

    await fetchManufacturerSources({
      ...common,
      fetchImpl: forbiddenFetch as unknown as typeof fetch,
      now: () => Date.parse('2030-01-01T00:00:00.000Z'),
    })
    const secondBytes = await readFile(paths.outputPath)

    expect(forbiddenFetch).not.toHaveBeenCalled()
    expect(secondBytes.equals(firstBytes)).toBe(true)
  })

  it('fails closed instead of refetching when an existing snapshot cache is incomplete', async () => {
    const paths = await fixturePaths()
    await writeRegistry(paths.registryPath, [registryRow()])
    const common = {
      snapshot: SNAPSHOT,
      registryPath: paths.registryPath,
      outputPath: paths.outputPath,
      cacheDirectory: paths.cacheDirectory,
      cacheReferenceDirectory: 'local-data/test-cache',
      now: () => Date.parse(RETRIEVED_AT),
    }
    await fetchManufacturerSources({
      ...common,
      fetchImpl: jest.fn(async () => response('CAT-100')) as unknown as typeof fetch,
    })
    const pointer = (await readdir(paths.cacheDirectory)).find((filename) =>
      filename.endsWith('.cache.json'),
    )
    expect(pointer).toBeDefined()
    await unlink(path.join(paths.cacheDirectory, pointer!))
    const fetchMock = jest.fn(async () => response('changed CAT-100'))

    await expect(
      fetchManufacturerSources({
        ...common,
        fetchImpl: fetchMock as unknown as typeof fetch,
      }),
    ).rejects.toThrow('cannot be reproduced from cache')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('retries bounded transient responses and records the successful attempt count', async () => {
    const paths = await fixturePaths()
    await writeRegistry(paths.registryPath, [registryRow()])
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(response('temporary', 503, 'text/plain'))
      .mockResolvedValueOnce(response('CAT-100', 200, 'text/plain'))
    const sleep = jest.fn(async () => undefined)

    const manifest = await fetchManufacturerSources({
      snapshot: SNAPSHOT,
      registryPath: paths.registryPath,
      outputPath: paths.outputPath,
      cacheDirectory: paths.cacheDirectory,
      cacheReferenceDirectory: 'local-data/test-cache',
      fetchImpl: fetchMock as unknown as typeof fetch,
      maxAttempts: 2,
      sleep,
      now: () => Date.parse(RETRIEVED_AT),
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenCalledWith(250)
    expect(manifest.sources[0].attempt_count).toBe(2)
    expect(manifest.sources[0].expected_identifier_matches[0].exact_text_match).toBe(true)
  })

  it('aborts and retries timed-out requests without writing a manifest', async () => {
    const paths = await fixturePaths()
    await writeRegistry(paths.registryPath, [registryRow()])
    const fetchMock = jest.fn(
      async (_url: RequestInfo | URL, init?: RequestInit): Promise<Response> =>
        new Promise((_resolve, reject) => {
          const signal = init?.signal
          signal?.addEventListener('abort', () => reject(new Error('aborted by timeout')), {
            once: true,
          })
        }),
    )

    await expect(
      fetchManufacturerSources({
        snapshot: SNAPSHOT,
        registryPath: paths.registryPath,
        outputPath: paths.outputPath,
        cacheDirectory: paths.cacheDirectory,
        cacheReferenceDirectory: 'local-data/test-cache',
        fetchImpl: fetchMock as unknown as typeof fetch,
        maxAttempts: 2,
        timeoutMs: 2,
        sleep: async () => undefined,
      }),
    ).rejects.toThrow('failed after 2 attempts')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    await expect(readFile(paths.outputPath)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('applies the timeout to response-body reads as well as response headers', async () => {
    const paths = await fixturePaths()
    await writeRegistry(paths.registryPath, [registryRow()])
    const hangingResponse = response('ignored') as Response & {
      arrayBuffer: () => Promise<ArrayBuffer>
    }
    hangingResponse.arrayBuffer = async () => new Promise<ArrayBuffer>(() => undefined)
    const fetchMock = jest.fn(async () => hangingResponse)

    await expect(
      fetchManufacturerSources({
        snapshot: SNAPSHOT,
        registryPath: paths.registryPath,
        outputPath: paths.outputPath,
        cacheDirectory: paths.cacheDirectory,
        cacheReferenceDirectory: 'local-data/test-cache',
        fetchImpl: fetchMock as unknown as typeof fetch,
        maxAttempts: 2,
        timeoutMs: 2,
        sleep: async () => undefined,
      }),
    ).rejects.toThrow('failed after 2 attempts')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('limits concurrent fetches', async () => {
    const paths = await fixturePaths()
    const rows = Array.from({ length: 5 }, (_, index) =>
      registryRow({
        sourceId: `SRC-${index}`,
        url: `https://manufacturer.example/product-${index}`,
      }),
    )
    await writeRegistry(paths.registryPath, rows)
    let active = 0
    let maximumActive = 0
    const fetchMock = jest.fn(async () => {
      active += 1
      maximumActive = Math.max(maximumActive, active)
      await new Promise((resolve) => setTimeout(resolve, 5))
      active -= 1
      return response('CAT-100')
    })

    await fetchManufacturerSources({
      snapshot: SNAPSHOT,
      registryPath: paths.registryPath,
      outputPath: paths.outputPath,
      cacheDirectory: paths.cacheDirectory,
      cacheReferenceDirectory: 'local-data/test-cache',
      fetchImpl: fetchMock as unknown as typeof fetch,
      concurrency: 2,
      now: () => Date.parse(RETRIEVED_AT),
    })

    expect(maximumActive).toBe(2)
  })

  it('refuses refresh over an existing output but permits a distinct output while preserving old content-addressed text', async () => {
    const paths = await fixturePaths()
    await writeRegistry(paths.registryPath, [registryRow()])
    const common = {
      snapshot: SNAPSHOT,
      registryPath: paths.registryPath,
      cacheDirectory: paths.cacheDirectory,
      cacheReferenceDirectory: 'local-data/test-cache',
    }
    const first = await fetchManufacturerSources({
      ...common,
      outputPath: paths.outputPath,
      fetchImpl: jest.fn(async () => response('CAT-100 first')) as unknown as typeof fetch,
      now: () => Date.parse(RETRIEVED_AT),
    })
    const oldTextFilename = path.basename(first.sources[0].text_cache_reference)
    const oldText = await readFile(path.join(paths.cacheDirectory, oldTextFilename), 'utf8')
    const blockedFetch = jest.fn(async () => response('CAT-100 changed'))

    await expect(
      fetchManufacturerSources({
        ...common,
        outputPath: paths.outputPath,
        refresh: true,
        fetchImpl: blockedFetch as unknown as typeof fetch,
      }),
    ).rejects.toThrow('Refusing to refresh existing dated source manifest')
    expect(blockedFetch).not.toHaveBeenCalled()

    const differentOutput = path.join(paths.root, 'refresh-output', 'source-manifest.json')
    const refreshed = await fetchManufacturerSources({
      ...common,
      outputPath: differentOutput,
      refresh: true,
      fetchImpl: jest.fn(async () => response('CAT-100 changed')) as unknown as typeof fetch,
      now: () => Date.parse('2026-08-14T13:00:00.000Z'),
    })
    expect(refreshed.sources[0].body_sha256).not.toBe(first.sources[0].body_sha256)
    expect(await readFile(path.join(paths.cacheDirectory, oldTextFilename), 'utf8')).toBe(oldText)
  })

  it('never rewrites an existing dated manifest when regenerated content differs', async () => {
    const paths = await fixturePaths()
    await writeRegistry(paths.registryPath, [registryRow()])
    const common = {
      snapshot: SNAPSHOT,
      registryPath: paths.registryPath,
      outputPath: paths.outputPath,
      cacheDirectory: paths.cacheDirectory,
      cacheReferenceDirectory: 'local-data/test-cache',
    }
    await fetchManufacturerSources({
      ...common,
      fetchImpl: jest.fn(async () => response('CAT-100')) as unknown as typeof fetch,
      now: () => Date.parse(RETRIEVED_AT),
    })
    const originalBytes = await readFile(paths.outputPath)
    await writeRegistry(paths.registryPath, [
      { ...registryRow(), factual_summary: 'A changed registry summary.' },
    ])
    const forbiddenFetch = jest.fn(async () => response('changed'))

    await expect(
      fetchManufacturerSources({
        ...common,
        fetchImpl: forbiddenFetch as unknown as typeof fetch,
      }),
    ).rejects.toThrow('Refusing to rewrite existing dated source manifest')
    expect(forbiddenFetch).not.toHaveBeenCalled()
    expect((await readFile(paths.outputPath)).equals(originalBytes)).toBe(true)
  })

  it('extracts PDF text through an injected pdftotext seam and fails safely on extraction error', async () => {
    const successfulPaths = await fixturePaths()
    const pdfUrl = 'https://manufacturer.example/catalog.pdf'
    await writeRegistry(successfulPaths.registryPath, [
      registryRow({ url: pdfUrl, expected: ['20402-401'] }),
    ])
    const successful = await fetchManufacturerSources({
      snapshot: SNAPSHOT,
      registryPath: successfulPaths.registryPath,
      outputPath: successfulPaths.outputPath,
      cacheDirectory: successfulPaths.cacheDirectory,
      cacheReferenceDirectory: 'local-data/test-cache',
      fetchImpl: jest.fn(async () =>
        response('%PDF-test', 200, 'application/pdf'),
      ) as unknown as typeof fetch,
      pdfTextExtractor: async () => 'Product number 20402-401',
      now: () => Date.parse(RETRIEVED_AT),
    })
    expect(successful.sources[0]).toMatchObject({
      text_extraction_status: 'pdf_pdftotext',
      all_expected_identifiers_found: true,
    })

    const failedPaths = await fixturePaths()
    await writeRegistry(failedPaths.registryPath, [
      registryRow({ url: pdfUrl, expected: ['20402-401'] }),
    ])
    const failed = await fetchManufacturerSources({
      snapshot: SNAPSHOT,
      registryPath: failedPaths.registryPath,
      outputPath: failedPaths.outputPath,
      cacheDirectory: failedPaths.cacheDirectory,
      cacheReferenceDirectory: 'local-data/test-cache',
      fetchImpl: jest.fn(async () =>
        response('%PDF-test', 200, 'application/pdf'),
      ) as unknown as typeof fetch,
      pdfTextExtractor: async () => {
        throw new Error('malformed PDF')
      },
      now: () => Date.parse(RETRIEVED_AT),
    })
    expect(failed.sources[0]).toMatchObject({
      text_extraction_status: 'pdf_extraction_failed',
      all_expected_identifiers_found: false,
    })
  })

  it('preserves a final non-success HTTP response but never reports identifier matches from it', async () => {
    const paths = await fixturePaths()
    await writeRegistry(paths.registryPath, [registryRow()])
    const manifest = await fetchManufacturerSources({
      snapshot: SNAPSHOT,
      registryPath: paths.registryPath,
      outputPath: paths.outputPath,
      cacheDirectory: paths.cacheDirectory,
      cacheReferenceDirectory: 'local-data/test-cache',
      fetchImpl: jest.fn(async () =>
        response('Error page mentions CAT-100', 404),
      ) as unknown as typeof fetch,
      now: () => Date.parse(RETRIEVED_AT),
    })

    expect(manifest.sources[0]).toMatchObject({
      http_status: 404,
      http_ok: false,
      all_expected_identifiers_found: false,
    })
    expect(manifest.sources[0].expected_identifier_matches[0].exact_text_match).toBe(false)
  })
})
