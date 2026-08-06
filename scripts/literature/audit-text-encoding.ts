import { chmod, lstat, mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path'

import type { SupabaseClient } from '@supabase/supabase-js'

import {
  buildTextEncodingAudit,
  stableTextEncodingJson,
  type GoldSetDevelopmentTextEncodingScope,
  type TextEncodingArticleRow,
  type TextEncodingAuditReport,
} from './data-quality/text-encoding'
import { assertKnownArguments, hasFlag, parseCliArguments, stringArgument } from './lib/cli'
import { createLiteratureReadClient, executeDatabaseCall } from './lib/database'
import { loadGoldSetV1DevelopmentScope } from './lib/data-quality-scope'

export const TEXT_ENCODING_ARTICLE_SELECT = 'pmid,title,abstract,updated_at'
export const DEFAULT_TEXT_ENCODING_AUDIT_PATH =
  'local-data/literature/data-quality/text-encoding-audit.json'

const PMID_QUERY_CHUNK_SIZE = 100

const HELP = `
Audit title and abstract encoding for the fixed gold-set-v1 development split.

Usage:
  npm run literature:audit-text-encoding -- [--target local] [--output <path>]

Options:
  --target <value>  Must be local (default).
  --output <path>   JSON report under local-data (default ${DEFAULT_TEXT_ENCODING_AUDIT_PATH}).
  --help            Show this help.

This command reads only gold-set-v1 development membership and literature_articles. It never
loads review rows, held-out test membership, or physician decisions and has no commit mode.
`.trim()

interface LiteratureArticleDatabaseRow {
  abstract: unknown
  pmid: unknown
  title: unknown
  updated_at: unknown
}

function chunks<T>(values: readonly T[], size: number) {
  const result: T[][] = []
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size))
  }
  return result
}

function articleRow(value: LiteratureArticleDatabaseRow): TextEncodingArticleRow {
  const pmid = String(value.pmid ?? '').trim()
  if (!/^\d{1,12}$/u.test(pmid)) throw new Error(`Article query returned invalid PMID "${pmid}".`)
  if (typeof value.title !== 'string' || !value.title.trim()) {
    throw new Error(`Article query returned an invalid title for PMID ${pmid}.`)
  }
  if (value.abstract !== null && typeof value.abstract !== 'string') {
    throw new Error(`Article query returned an invalid abstract for PMID ${pmid}.`)
  }
  if (typeof value.updated_at !== 'string' || !value.updated_at) {
    throw new Error(`Article query returned an invalid updated_at for PMID ${pmid}.`)
  }

  const abstract = value.abstract
  const title = value.title
  const updatedAt = value.updated_at
  return {
    abstract,
    pmid,
    title,
    updated_at: updatedAt,
  }
}

export function assertLocalTextEncodingTarget(target: string) {
  if (target !== 'local') {
    throw new Error('Text encoding data-quality commands are local-only; --target must be local.')
  }
}

export async function fetchDevelopmentTextEncodingArticles(
  client: SupabaseClient,
  pmids: readonly string[],
) {
  const rows: TextEncodingArticleRow[] = []
  for (const pmidChunk of chunks(pmids, PMID_QUERY_CHUNK_SIZE)) {
    const page = await executeDatabaseCall<LiteratureArticleDatabaseRow[]>(
      'Development article encoding page',
      () =>
        client
          .from('literature_articles')
          .select(TEXT_ENCODING_ARTICLE_SELECT)
          .in('pmid', pmidChunk)
          .order('pmid', { ascending: true }),
    )
    rows.push(...(page ?? []).map(articleRow))
  }
  return rows
}

export interface DevelopmentTextEncodingAudit {
  report: TextEncodingAuditReport
  rows: TextEncodingArticleRow[]
  scope: GoldSetDevelopmentTextEncodingScope
}

export async function auditGoldSetV1DevelopmentTextEncoding(
  client: SupabaseClient,
): Promise<DevelopmentTextEncodingAudit> {
  const loadedScope = await loadGoldSetV1DevelopmentScope(client)
  const scope: GoldSetDevelopmentTextEncodingScope = loadedScope
  const rows = await fetchDevelopmentTextEncodingArticles(client, scope.pmids)
  return { report: buildTextEncodingAudit(rows, scope), rows, scope }
}

function isWithinDirectory(root: string, candidate: string) {
  const fromRoot = relative(root, candidate)
  return (
    fromRoot === '' ||
    (!isAbsolute(fromRoot) && fromRoot !== '..' && !fromRoot.startsWith(`..${sep}`))
  )
}

async function lstatIfPresent(path: string) {
  try {
    return await lstat(path)
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

export async function resolveSafeTextEncodingLocalDataPath(
  requestedPath: string,
  options: { workspaceRoot?: string } = {},
) {
  const workspaceRoot = resolve(options.workspaceRoot ?? process.cwd())
  const localDataRoot = resolve(workspaceRoot, 'local-data')
  const selected = isAbsolute(requestedPath)
    ? resolve(requestedPath)
    : resolve(workspaceRoot, requestedPath)
  const selectedRelativePath = relative(localDataRoot, selected)
  if (!isWithinDirectory(localDataRoot, selected) || selected === localDataRoot) {
    throw new Error('Text encoding artifacts must be files under the repository local-data tree.')
  }
  if (selectedRelativePath.split(sep)[0]?.toLocaleLowerCase('en-US') === 'inputs') {
    throw new Error(
      'Text encoding artifacts must not be written under read-only local-data/inputs.',
    )
  }

  const localData = await lstatIfPresent(localDataRoot)
  if (!localData?.isDirectory() || localData.isSymbolicLink()) {
    throw new Error('The repository local-data directory must be a non-symlink directory.')
  }

  let current = localDataRoot
  for (const segment of selectedRelativePath.split(sep).slice(0, -1)) {
    if (!segment) continue
    current = resolve(current, segment)
    const metadata = await lstatIfPresent(current)
    if (!metadata) break
    if (metadata.isSymbolicLink()) {
      throw new Error(`Text encoding artifact path must not traverse a symlink: ${current}`)
    }
    if (!metadata.isDirectory()) {
      throw new Error(`Text encoding artifact parent is not a directory: ${current}`)
    }
  }

  const existing = await lstatIfPresent(selected)
  if (existing?.isSymbolicLink()) {
    throw new Error(`Text encoding artifact must not be a symlink: ${selected}`)
  }
  if (existing && !existing.isFile()) {
    throw new Error(`Text encoding artifact must be a regular file: ${selected}`)
  }
  return selected
}

export async function writeTextEncodingAuditReport(
  report: TextEncodingAuditReport,
  outputPath: string,
  options: { workspaceRoot?: string } = {},
) {
  if (extname(outputPath).toLocaleLowerCase('en-US') !== '.json') {
    throw new Error('Text encoding audit reports must use a .json filename.')
  }
  const path = await resolveSafeTextEncodingLocalDataPath(outputPath, options)
  await mkdir(dirname(path), { recursive: true })
  const verifiedPath = await resolveSafeTextEncodingLocalDataPath(path, options)
  await writeFile(verifiedPath, `${stableTextEncodingJson(report)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
    mode: 0o600,
  })
  await chmod(verifiedPath, 0o600)
  return verifiedPath
}

async function main() {
  const arguments_ = parseCliArguments(process.argv.slice(2))
  assertKnownArguments(arguments_, ['help', 'output', 'target'])
  if (hasFlag(arguments_, 'help')) {
    console.log(HELP)
    return
  }

  const target = stringArgument(arguments_, 'target', 'local')
  assertLocalTextEncodingTarget(target)
  const client = createLiteratureReadClient(arguments_)
  const { report } = await auditGoldSetV1DevelopmentTextEncoding(client)
  const output = await writeTextEncodingAuditReport(
    report,
    stringArgument(arguments_, 'output', DEFAULT_TEXT_ENCODING_AUDIT_PATH),
  )

  console.log(`Rows scanned: ${report.counts.rowsScanned}`)
  console.log(`Candidate rows: ${report.counts.candidateRows}`)
  console.log(`Candidate cells: ${report.counts.candidateCells}`)
  console.log(`Replacement spans: ${report.counts.replacementSpans}`)
  console.log(`Refused spans: ${report.counts.refusedSpans}`)
  console.log(`Source SHA-256: ${report.sourceSha256}`)
  console.log(`Candidate SHA-256: ${report.candidateSha256}`)
  console.log(`Audit report: ${output}`)

  if (report.counts.refusedSpans > 0) {
    throw new Error(
      `Refusing text encoding repair: audit found ${report.counts.refusedSpans} ambiguous or non-reversible span(s).`,
    )
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
