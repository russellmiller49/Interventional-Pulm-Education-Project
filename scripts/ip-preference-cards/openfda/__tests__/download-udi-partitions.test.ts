import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import {
  bulkDownloadRequested,
  parseOpenFdaDownloadArgs,
  runOpenFdaPartitionDownloader,
} from '../download-udi-partitions'
import { openFdaDownloadManifestSchema } from '../schemas'
import { downloadManifest, jsonResponse } from './fixtures'

jest.mock('../../format-json', () => ({
  formatJson: async (value: unknown) => `${JSON.stringify(value, null, 2)}\n`,
}))

describe('openFDA bulk downloader safety boundary', () => {
  const directories: string[] = []

  afterEach(async () => {
    await Promise.all(
      directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
    )
  })

  it('performs manifest-only behavior by default', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'openfda-download-'))
    directories.push(directory)
    const fetchImpl = jest.fn(async () => jsonResponse(downloadManifest()))
    const result = await runOpenFdaPartitionDownloader(parseOpenFdaDownloadArgs([]), {
      fetchImpl: fetchImpl as typeof fetch,
      outputDirectory: path.join(directory, 'reports'),
      bulkDirectory: path.join(directory, 'bulk'),
      now: () => new Date('2026-07-27T00:00:00.000Z'),
      log: () => undefined,
    })
    expect(result.downloaded).toBe(0)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const snapshot = await readFile(
      path.join(directory, 'reports', 'manifest-snapshot.json'),
      'utf8',
    )
    expect(snapshot).toContain('"partition_count": 1')
  })

  it('requires an explicit partition selection before transfer', () => {
    expect(bulkDownloadRequested(parseOpenFdaDownloadArgs([]))).toBe(false)
    expect(bulkDownloadRequested(parseOpenFdaDownloadArgs(['--all']))).toBe(true)
    expect(() => parseOpenFdaDownloadArgs(['--from', '1'])).toThrow('--from and --to')
    expect(() => parseOpenFdaDownloadArgs(['--partition', '1abc'])).toThrow('positive integer')
  })

  it('downloads one explicitly selected partition through a .part file and rename', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'openfda-download-'))
    directories.push(directory)
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(downloadManifest()))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-length': '3' }),
        arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer,
      } as Response)
    const result = await runOpenFdaPartitionDownloader(
      parseOpenFdaDownloadArgs(['--partition', '1']),
      {
        fetchImpl: fetchImpl as typeof fetch,
        outputDirectory: path.join(directory, 'reports'),
        bulkDirectory: path.join(directory, 'bulk'),
        log: () => undefined,
      },
    )
    expect(result.downloaded).toBe(1)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('allows additional future fields in the manifest schema', () => {
    expect(() => openFdaDownloadManifestSchema.parse(downloadManifest())).not.toThrow()
  })
})
