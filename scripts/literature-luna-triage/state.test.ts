/** @jest-environment node */
import { mkdtemp, lstat, mkdir, readFile, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  StatePathError,
  appendJournalLine,
  createJournal,
  ensureStateDirectory,
  exclusiveWriteFile,
  openExclusiveJournalWriter,
  readJournalLines,
  resolveInsideRoot,
  resolveStateRoot,
} from './state'

let root: string

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'luna-state-'))
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('state root and directories', () => {
  it('creates the root and nested directories with mode 0700', async () => {
    const state = await resolveStateRoot(join(root, 'lane'))
    const nested = await ensureStateDirectory(state, 'ops', 'op-1', 'responses')
    for (const path of [state.root, nested]) {
      const stat = await lstat(path)
      expect(stat.mode & 0o777).toBe(0o700)
    }
  })

  it('refuses paths that resolve outside the root', async () => {
    const state = await resolveStateRoot(join(root, 'lane'))
    expect(() => resolveInsideRoot(state, '..', 'escape')).toThrow(StatePathError)
    expect(() => resolveInsideRoot(state, 'ops/../../escape')).toThrow(StatePathError)
  })

  it('refuses symbolic-link directory components', async () => {
    const state = await resolveStateRoot(join(root, 'lane'))
    const target = join(root, 'elsewhere')
    await mkdir(target, { recursive: true })
    await symlink(target, join(state.root, 'linked'))
    await expect(ensureStateDirectory(state, 'linked', 'child')).rejects.toThrow(StatePathError)
  })
})

describe('create-once files', () => {
  it('writes mode-0600 files exactly once', async () => {
    const state = await resolveStateRoot(join(root, 'lane'))
    const path = resolveInsideRoot(state, 'artifact.json')
    await exclusiveWriteFile(path, '{"a":1}\n')
    const stat = await lstat(path)
    expect(stat.mode & 0o777).toBe(0o600)
    await expect(exclusiveWriteFile(path, '{"a":2}\n')).rejects.toThrow(/not overwritten/u)
    expect(await readFile(path, 'utf8')).toBe('{"a":1}\n')
  })

  it('never follows a symlinked destination', async () => {
    const state = await resolveStateRoot(join(root, 'lane'))
    const outside = join(root, 'outside.json')
    const path = resolveInsideRoot(state, 'link.json')
    await symlink(outside, path)
    await expect(exclusiveWriteFile(path, 'x')).rejects.toThrow()
    await expect(lstat(outside)).rejects.toThrow()
  })
})

describe('journals', () => {
  it('creates once, appends lines, and reads them back', async () => {
    const state = await resolveStateRoot(join(root, 'lane'))
    const path = resolveInsideRoot(state, 'journal.jsonl')
    await createJournal(path)
    await appendJournalLine(path, '{"row":1}')
    await appendJournalLine(path, '{"row":2}')
    expect(await readJournalLines(path)).toEqual([{ row: 1 }, { row: 2 }])
    const stat = await lstat(path)
    expect(stat.mode & 0o777).toBe(0o600)
    await expect(createJournal(path)).rejects.toThrow(/not overwritten/u)
  })

  it('streams large journals through the exclusive writer', async () => {
    const state = await resolveStateRoot(join(root, 'lane'))
    const path = resolveInsideRoot(state, 'stream.jsonl')
    const writer = await openExclusiveJournalWriter(path)
    await writer.writeLine('{"n":1}')
    await writer.writeLine('{"n":2}')
    await writer.close()
    expect(await readJournalLines(path)).toEqual([{ n: 1 }, { n: 2 }])
    await expect(openExclusiveJournalWriter(path)).rejects.toThrow(/not overwritten/u)
  })
})
