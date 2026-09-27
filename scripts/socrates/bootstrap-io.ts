import { execFileSync } from 'node:child_process'
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { WORKBOOK_SHA } from './bootstrap-plan'
import type { Inspection } from './import-plan'
import {
  getInvenioPair,
  INVENIO_DEMO_ORIGIN,
} from '../../src/features/socrates-builder/invenio-source'

export function verifyWorkbookHash(bytes: Uint8Array) {
  if (createHash('sha256').update(bytes).digest('hex') !== WORKBOOK_SHA)
    throw new Error('Workbook SHA-256 mismatch.')
}
export function inspectWorkbook(workbook: string, root: string, python = 'python3'): Inspection {
  verifyWorkbookHash(readFileSync(workbook))
  const workspace = mkdtempSync(path.join(tmpdir(), 'socrates-bootstrap-'))
  chmodSync(workspace, 0o700)
  try {
    const output = path.join(workspace, 'inspection.json')
    execFileSync(
      python,
      [path.join(root, 'scripts/socrates/inspect_workbook.py'), workbook, '--output', output],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    )
    return JSON.parse(readFileSync(output, 'utf8'))
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
}
/** Same exclusive, owner-readable output policy as workbook-import; resolves symlink parents. */
export function privateDestination(filename: string) {
  const parent = realpathSync(path.dirname(path.resolve(filename)))
  const ancestors = parent
    .split(path.sep)
    .map((_, i, parts) => parts.slice(0, i + 1).join(path.sep) || path.sep)
  if (
    parent.split(path.sep).includes('public') ||
    ancestors.some((p) => existsSync(path.join(p, '.git')))
  )
    throw new Error('Private outputs must be outside checkouts and public assets.')
  return path.join(parent, path.basename(filename))
}
export function privateOutput(filename: string, value: unknown) {
  writeFileSync(privateDestination(filename), JSON.stringify(value, null, 2) + '\n', {
    flag: 'wx',
    mode: 0o600,
  })
}
/** Fixed origin, bounded reads, no credentials or redirects. No database client exists here. */
export async function readProvider(url: string): Promise<string> {
  const isCatalog = url === `${INVENIO_DEMO_ORIGIN}/generated/catalog.json`
  const pair = getInvenioPair(url)
  if (!isCatalog && (!pair || ![pair.tissueUrl, pair.annotatedUrl].includes(url)))
    throw new Error('Unapproved provider URL.')
  const response = await fetch(url, {
    credentials: 'omit',
    redirect: 'error',
    signal: AbortSignal.timeout(20000),
  })
  if (
    !response.ok ||
    !(isCatalog ? /application\/json/i : /(?:application|text)\/xml/i).test(
      response.headers.get('content-type') ?? '',
    )
  )
    throw new Error('Provider response unavailable or unexpected content type.')
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Provider response has no body.')
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.length
      if (size > (isCatalog ? 2_000_000 : 64_000))
        throw new Error('Provider response exceeds bound.')
      chunks.push(value)
    }
  } finally {
    await reader.cancel()
  }
  return Buffer.concat(chunks).toString('utf8')
}
