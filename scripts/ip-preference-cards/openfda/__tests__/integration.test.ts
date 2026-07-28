import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { OpenFdaClient } from '../client'

const liveEnabled =
  process.env.RUN_OPENFDA_INTEGRATION === '1' && Boolean(process.env.OPENFDA_API_KEY)

;(liveEnabled ? describe : describe.skip)('live openFDA integration', () => {
  it('validates one current UDI response only when explicitly enabled', async () => {
    const cacheDir = await mkdtemp(path.join(os.tmpdir(), 'openfda-live-'))
    try {
      const client = new OpenFdaClient({
        apiKey: process.env.OPENFDA_API_KEY!,
        cacheDir,
        requestsPerSecond: 1,
      })
      const result = await client.request({
        search: '_exists_:public_device_record_key',
        limit: 1,
        refresh: true,
      })
      expect(result.records).toHaveLength(1)
    } finally {
      await rm(cacheDir, { recursive: true, force: true })
    }
  })
})
