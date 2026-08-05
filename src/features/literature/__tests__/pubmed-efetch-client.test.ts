/** @jest-environment node */

import { createHash } from 'node:crypto'
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import {
  buildPubmedEfetchUrl,
  PubmedEfetchClient,
  PubmedEfetchClientError,
  retryAfterMilliseconds,
} from '../../../../scripts/literature/lib/pubmed-efetch-client'

const API_KEY = 'TEST-NCBI-SECRET'

function responseXml(pmids: string[]): string {
  return `<?xml version="1.0"?><PubmedArticleSet>${pmids
    .map(
      (pmid) =>
        `<PubmedArticle><MedlineCitation><PMID>${pmid}</PMID><Article><Language>eng</Language><PublicationTypeList><PublicationType>Journal Article</PublicationType></PublicationTypeList></Article><MeshHeadingList><MeshHeading><DescriptorName MajorTopicYN="N">Bronchoscopy</DescriptorName></MeshHeading></MeshHeadingList></MedlineCitation></PubmedArticle>`,
    )
    .join('')}</PubmedArticleSet>`
}

async function temporaryCacheDirectory(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), 'pubmed-efetch-client-'))
}

function client(
  cacheDir: string,
  fetchImpl: typeof fetch,
  overrides: Partial<ConstructorParameters<typeof PubmedEfetchClient>[0]> = {},
) {
  return new PubmedEfetchClient({
    apiKey: API_KEY,
    cacheDir,
    email: 'literature-test@interventionalpulm.invalid',
    tool: 'interventional-pulm-test',
    fetchImpl,
    requestsPerSecond: 1_000_000,
    sleep: async () => undefined,
    random: () => 0,
    ...overrides,
  })
}

describe('PubMed EFetch client', () => {
  const directories: string[] = []

  afterEach(async () => {
    await Promise.all(
      directories.splice(0).map((directory) => rm(directory, { force: true, recursive: true })),
    )
  })

  it('builds a GET URL with the required NCBI identity and XML parameters', () => {
    const url = buildPubmedEfetchUrl({
      apiKey: API_KEY,
      email: 'owner@example.invalid',
      pmids: ['2', '1'],
      tool: 'ip-literature',
    })

    expect(url.searchParams.get('db')).toBe('pubmed')
    expect(url.searchParams.get('retmode')).toBe('xml')
    expect(url.searchParams.get('id')).toBe('1,2')
    expect(url.searchParams.get('tool')).toBe('ip-literature')
    expect(url.searchParams.get('email')).toBe('owner@example.invalid')
    expect(url.searchParams.get('api_key')).toBe(API_KEY)
  })

  it('writes raw XML plus hash-validated metadata and reuses a valid cache entry', async () => {
    const cacheDir = await temporaryCacheDirectory()
    directories.push(cacheDir)
    const fetchImpl = jest.fn(async () => new Response(responseXml(['123']), { status: 200 }))
    const api = client(cacheDir, fetchImpl as typeof fetch)

    const first = await api.fetchPmids(['123'])
    const second = await api.fetchPmids(['123'])
    const files = await readdir(cacheDir)

    expect(first.batches[0]).toMatchObject({ fromCache: false, sourceSha256: expect.any(String) })
    expect(second.batches[0]).toMatchObject({ fromCache: true, apiRequestsMade: 0 })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(files.filter((file) => file.endsWith('.xml'))).toHaveLength(1)
    expect(files.filter((file) => file.endsWith('.json'))).toHaveLength(1)
    await expect(
      Promise.all(files.map(async (file) => (await stat(path.join(cacheDir, file))).mode & 0o777)),
    ).resolves.toEqual([0o600, 0o600])
    const metadata = await readFile(
      path.join(cacheDir, files.find((file) => file.endsWith('.json'))!),
      'utf8',
    )
    expect(metadata).toContain(first.batches[0]!.sourceSha256)
    expect(metadata).not.toContain(API_KEY)
  })

  it('rejects a tampered raw cache entry and fetches a fresh response', async () => {
    const cacheDir = await temporaryCacheDirectory()
    directories.push(cacheDir)
    const fetchImpl = jest.fn(async () => new Response(responseXml(['123']), { status: 200 }))
    const api = client(cacheDir, fetchImpl as typeof fetch)

    await api.fetchPmids(['123'])
    const xmlFile = (await readdir(cacheDir)).find((file) => file.endsWith('.xml'))!
    await writeFile(path.join(cacheDir, xmlFile), responseXml(['999']), 'utf8')
    const result = await api.fetchPmids(['123'])

    expect(result.batches[0]?.fromCache).toBe(false)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('hashes and caches the exact UTF-8 HTTP response bytes', async () => {
    const cacheDir = await temporaryCacheDirectory()
    directories.push(cacheDir)
    const xml = responseXml(['123']).replace(
      '</Article>',
      '<KeywordList><Keyword>café—測試</Keyword></KeywordList></Article>',
    )
    const responseBytes = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(xml, 'utf8')])
    const fetchImpl = jest.fn(async () => new Response(responseBytes, { status: 200 }))

    const result = await client(cacheDir, fetchImpl as typeof fetch).fetchPmids(['123'])
    const xmlFile = (await readdir(cacheDir)).find((file) => file.endsWith('.xml'))!

    await expect(readFile(path.join(cacheDir, xmlFile))).resolves.toEqual(responseBytes)
    expect(result.batches[0]?.sourceSha256).toBe(
      createHash('sha256').update(responseBytes).digest('hex'),
    )
  })

  it('rejects invalid UTF-8 response bytes without caching lossy text', async () => {
    const cacheDir = await temporaryCacheDirectory()
    directories.push(cacheDir)
    const invalidBytes = Buffer.concat([
      Buffer.from(
        '<PubmedArticleSet><PubmedArticle><MedlineCitation><PMID>123</PMID><Article><ArticleTitle>',
      ),
      Buffer.from([0xc3, 0x28]),
      Buffer.from('</ArticleTitle></Article></MedlineCitation></PubmedArticle></PubmedArticleSet>'),
    ])
    const fetchImpl = jest.fn(async () => new Response(invalidBytes, { status: 200 }))

    await expect(client(cacheDir, fetchImpl as typeof fetch).fetchPmids(['123'])).rejects.toThrow(
      'not valid UTF-8',
    )
    await expect(readdir(cacheDir).catch(() => [])).resolves.toEqual([])
  })

  it('treats a hash-valid but invalid-UTF-8 cache entry as corrupt and refetches it', async () => {
    const cacheDir = await temporaryCacheDirectory()
    directories.push(cacheDir)
    const fetchImpl = jest.fn(async () => new Response(responseXml(['123']), { status: 200 }))
    const api = client(cacheDir, fetchImpl as typeof fetch)
    await api.fetchPmids(['123'])
    const files = await readdir(cacheDir)
    const xmlPath = path.join(cacheDir, files.find((file) => file.endsWith('.xml'))!)
    const metadataPath = path.join(cacheDir, files.find((file) => file.endsWith('.json'))!)
    const invalidBytes = Buffer.from([0xc3, 0x28])
    const metadata = JSON.parse(await readFile(metadataPath, 'utf8')) as {
      response_sha256: string
    }
    metadata.response_sha256 = createHash('sha256').update(invalidBytes).digest('hex')
    await writeFile(xmlPath, invalidBytes)
    await writeFile(metadataPath, `${JSON.stringify(metadata)}\n`, 'utf8')

    const result = await api.fetchPmids(['123'])

    expect(result.batches[0]?.fromCache).toBe(false)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('reports requested PMIDs absent from an otherwise valid EFetch response', async () => {
    const cacheDir = await temporaryCacheDirectory()
    directories.push(cacheDir)
    const fetchImpl = jest.fn(async () => new Response(responseXml(['123']), { status: 200 }))

    const result = await client(cacheDir, fetchImpl as typeof fetch).fetchPmids(['123', '456'])

    expect(result.records.map((record) => record.pmid)).toEqual(['123'])
    expect(result.unavailablePmids).toEqual(['456'])
  })

  it('chunks requests at no more than 200 PMIDs', async () => {
    const cacheDir = await temporaryCacheDirectory()
    directories.push(cacheDir)
    const pmids = Array.from({ length: 201 }, (_, index) => String(index + 1))
    const fetchImpl = jest.fn(async (input: URL | RequestInfo) => {
      const url = new URL(String(input))
      const requested = url.searchParams.get('id')!.split(',')
      return new Response(responseXml(requested), { status: 200 })
    })

    const result = await client(cacheDir, fetchImpl as typeof fetch).fetchPmids(pmids)

    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(result.batches.map((batch) => batch.requestedPmids.length)).toEqual([200, 1])
    expect(result.records).toHaveLength(201)
  })

  it('honors Retry-After before retrying a 429', async () => {
    const cacheDir = await temporaryCacheDirectory()
    directories.push(cacheDir)
    const sleep = jest.fn(async () => undefined)
    const responses = [
      new Response('', { status: 429, headers: { 'Retry-After': '7' } }),
      new Response(responseXml(['123']), { status: 200 }),
    ]
    const fetchImpl = jest.fn(async () => responses.shift()!)

    const result = await client(cacheDir, fetchImpl as typeof fetch, { sleep }).fetchPmids(['123'])

    expect(result.batches[0]?.attemptCount).toBe(2)
    expect(sleep).toHaveBeenCalledWith(7_000)
    expect(retryAfterMilliseconds('7', 0)).toBe(7_000)
  })

  it('redacts the API key from surfaced failures and never stores it in cache', async () => {
    const cacheDir = await temporaryCacheDirectory()
    directories.push(cacheDir)
    const fetchImpl = jest.fn(async () => new Response('', { status: 400 }))

    await expect(client(cacheDir, fetchImpl as typeof fetch).fetchPmids(['123'])).rejects.toThrow(
      PubmedEfetchClientError,
    )
    await expect(
      client(cacheDir, fetchImpl as typeof fetch).fetchPmids(['123']),
    ).rejects.not.toThrow(API_KEY)
    expect(await readdir(cacheDir).catch(() => [])).toEqual([])
  })
})
