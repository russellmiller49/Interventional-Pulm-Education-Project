/** @jest-environment node */
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { inspectWorkbook, privateOutput, readProvider, verifyWorkbookHash } from './bootstrap-io'
import { batchRecords, createBootstrapPlan, generateDraft } from './bootstrap-plan'
import { bootstrapFixture, syntheticDzi } from './bootstrap-fixtures'

let workspace: string
beforeEach(() => {
  workspace = mkdtempSync(path.join(tmpdir(), 'bootstrap-test-'))
})
afterEach(() => {
  rmSync(workspace, { recursive: true, force: true })
})
test('private files are exclusive and 0600; checkout/public/symlink destinations fail closed', () => {
  const output = path.join(workspace, 'private.json')
  privateOutput(output, { marker: true })
  expect(statSync(output).mode & 0o777).toBe(0o600)
  expect(() => privateOutput(output, {})).toThrow()
  for (const directory of ['repo', 'public']) {
    const parent = path.join(workspace, directory)
    mkdirSync(parent)
    if (directory === 'repo') writeFileSync(path.join(parent, '.git'), 'gitdir: synthetic')
    const link = path.join(workspace, directory + '-link')
    symlinkSync(parent, link)
    for (const p of [parent, link]) {
      expect(() => privateOutput(path.join(p, 'source.json'), {})).toThrow()
      expect(existsSync(path.join(p, 'source.json'))).toBe(false)
    }
  }
})
test('changed hash is rejected before workbook parsing', () => {
  expect(() => verifyWorkbookHash(Buffer.from('changed workbook'))).toThrow(
    'Workbook SHA-256 mismatch',
  )
})
test('provider fetch refuses arbitrary origins and redirects, uses no credentials and bounded content', async () => {
  const fetchMock = jest
    .spyOn(global, 'fetch')
    .mockResolvedValue(new Response('{}', { headers: { 'content-type': 'application/json' } }))
  try {
    await expect(readProvider('https://example.com/generated/catalog.json')).rejects.toThrow()
    expect(fetchMock).not.toHaveBeenCalled()
    const url = 'https://ucsd-slide-viewer-1080580899927.us-central1.run.app/generated/catalog.json'
    await readProvider(url)
    expect(fetchMock).toHaveBeenCalledWith(
      url,
      expect.objectContaining({ credentials: 'omit', redirect: 'error' }),
    )
    fetchMock.mockResolvedValue(
      new Response('<html/>', { headers: { 'content-type': 'text/html' } }),
    )
    await expect(readProvider(url)).rejects.toThrow()
    fetchMock.mockResolvedValue(
      new Response('x'.repeat(2_000_001), { headers: { 'content-type': 'application/json' } }),
    )
    await expect(readProvider(url)).rejects.toThrow('exceeds bound')
  } finally {
    fetchMock.mockRestore()
  }
})
// Opt-in local source verification: normal CI needs no private workbook. Assertions report
// booleans only so a failing equality cannot dump proprietary paragraphs into test logs.
const workbook = process.env.SOCRATES_BOOTSTRAP_TEST_WORKBOOK
;(workbook ? test : test.skip)(
  'real expected hash and all ten source rows survive packaging byte-for-byte',
  async () => {
    const bytes = readFileSync(workbook!)
    expect(() => verifyWorkbookHash(bytes)).not.toThrow()
    const changed = Buffer.from(bytes)
    changed[changed.length - 1] ^= 1
    expect(() => verifyWorkbookHash(changed)).toThrow()
    const inspection = inspectWorkbook(workbook!, process.cwd())
    const f = bootstrapFixture()
    const plan = await createBootstrapPlan(
      inspection,
      f.catalog,
      async () => syntheticDzi,
      f.snapshot,
    )
    const records = batchRecords(inspection)
    expect(records.length).toBe(10)
    for (const [index, row] of plan.rows.entries()) {
      const doc = generateDraft(records[index], row)
      const filename = path.join(workspace, `${index}.json`)
      privateOutput(filename, doc)
      const saved = JSON.parse(readFileSync(filename, 'utf8'))
      expect(
        JSON.stringify(saved.authorContent.curriculumSource.sourceValues) ===
          JSON.stringify(records[index].sourceValues),
      ).toBe(true)
      expect(
        Buffer.from(saved.caseContent.learnerNarrative).equals(
          Buffer.from(records[index].sourceValues['Full Learner-Facing Text']),
        ),
      ).toBe(true)
    }
  },
)
