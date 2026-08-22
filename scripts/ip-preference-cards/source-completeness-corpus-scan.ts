import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * Layout-aware candidate extraction across the frozen old-source corpus.
 *
 * Every page of every corpus PDF is tokenized for product-identifier-shaped values. There is no
 * minimum identifier count per page, no contiguous-page requirement, and no requirement that an
 * identifier lead its line, so single-page tables, one-product-per-page ordering captures,
 * low-row-count tables, inline references, and continuation pages are all first-class inputs.
 * The scanner additionally reconstructs hyphen-wrapped table cells, joins split numeric+suffix
 * references, and records matrix header/row context so header-inherited dimensions stay
 * attributable. Output is deterministic for a fixed corpus and extraction tool.
 */

export const DETECTION_RULES = [
  'wrapped_cell_join',
  'ordering_pair_row',
  'leading_table_row',
  'matrix_cell',
  'joined_split_reference',
  'numeric_ref_in_order_context',
  'inline_identifier',
] as const

export type DetectionRule = (typeof DETECTION_RULES)[number]

const RULE_PRECEDENCE: Record<DetectionRule, number> = {
  wrapped_cell_join: 0,
  ordering_pair_row: 1,
  leading_table_row: 2,
  matrix_cell: 3,
  joined_split_reference: 4,
  numeric_ref_in_order_context: 5,
  inline_identifier: 6,
}

const HIGH_CONFIDENCE_RULES: ReadonlySet<DetectionRule> = new Set([
  'wrapped_cell_join',
  'ordering_pair_row',
  'leading_table_row',
  'matrix_cell',
  'joined_split_reference',
])

export interface ScanOccurrence {
  page: number
  line: number
  column: number
  raw: string
  rule: DetectionRule
  onPairingPage: boolean
  lineContext: string
  headingContext: string
  columnHeader: string | null
  rowLabel: string | null
  pairedIdentifier: string | null
}

export interface ScannerCandidate {
  sourceFilename: string
  relativePath: string
  sourceSha256: string
  documentPageCount: number
  manufacturer: string | null
  normalizedIdentifier: string
  rawIdentifier: string
  firstPage: number
  pages: number[]
  occurrenceCount: number
  detectionRule: DetectionRule
  confidence: 'high' | 'moderate'
  headingContext: string
  lineContext: string
  columnHeader: string | null
  rowLabel: string | null
  pairedIdentifier: string | null
  onPairingPage: boolean
  column: number
}

export interface DocumentScan {
  sourceFilename: string
  relativePath: string
  sourceSha256: string
  manufacturer: string | null
  pageCount: number
  pagesWithCandidates: number[]
  pageCandidateCounts: Map<number, number>
  orderingHeadingPages: number[]
  matrixPages: number[]
  candidates: ScannerCandidate[]
}

export interface CorpusScan {
  sourceDirectory: string
  pdfsScanned: number
  pagesScanned: number
  documents: DocumentScan[]
}

export function normalizeScannedIdentifier(value: string): string {
  return value
    .normalize('NFKC')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
}

const UNIT_TOKEN =
  /^\d+(?:\.\d+)?(?:MM|CM|ML|FR|F|G|GA|CH|KG|HZ|GHZ|NM|UM|W|V|MA|AH|X|L|S|H|MIN|SEC|PSI|KPA|LPM|D)$/i
const DATE_TOKEN = /^\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4}$/
const LABEL_TOKEN =
  /^(?:ISO|EN|IEC|ASTM|UL|CE|REF|LOT|UDI|GTIN|DI|PN|SN|NO|QTY|VOL|REV|VER|P|PG|PAGE|FIG|TAB)\d*$/i
const ORDINAL_TOKEN = /^\d+(?:ST|ND|RD|TH)$/i
/**
 * An explicit product-ordering label immediately before a token ("Item no: 10350F",
 * "Catalog number 10318D", "Ref. no: 10370H") is decisive identifier context: the token it
 * labels is evaluated through a context-aware path before the generic unit/ordinal suffix
 * rejection. The vocabulary is deliberately conservative and manufacturer-independent —
 * item/catalog/order/reference/ref followed by no/number — so ordinary prose, measurements,
 * dates, citations, and revision codes never gain this context.
 */
const EXPLICIT_ORDERING_LABEL_PREFIX =
  /\b(?:item|catalog(?:ue)?|order|reference|ref\.?)[ \t]*(?:no\.?|number)[ \t]*[:：]?[ \t]*$/i
/**
 * The only shape the explicit-label path admits past the unit/ordinal filters: a digit-leading
 * stem with a short uppercase suffix (10350F, 10350ST). Labeled measurements ("Item no: 10.5mm")
 * and anything letter-leading still go through the generic filters.
 */
const LABELED_ORDERING_IDENTIFIER = /^\d+[A-Z]{1,4}$/
const TOKEN = /[A-Za-z0-9][A-Za-z0-9./_-]{2,30}[A-Za-z0-9]/g
const ORDERING_CONTEXT =
  /\b(?:REF|ORDER(?:ING)?\s+(?:NO|NUMBER|INFORMATION)|CAT\.?\s*NO|ITEM\s*(?:NO|NUMBER)|ARTICLE\s*(?:NO|NUMBER)?|PART\s*(?:NO|NUMBER)|BESTELL|ARTIKEL|REFERENCE\s+PART|MODEL\s*(?:NO|NUMBER)?)\b/i

interface RawToken {
  raw: string
  column: number
  end: number
  kind: 'mixed' | 'numeric' | 'decimal'
}

function classifyToken(raw: string, explicitOrderingLabel = false): RawToken['kind'] | null {
  const value = raw.replace(/^[.,;:]+|[.,;:*†‡]+$/g, '')
  if (value.length < 4 || value.length > 32) return null
  if (!/\d/.test(value)) return null
  if (DATE_TOKEN.test(value)) return null
  // Explicit ordering-label context precedes the generic unit/ordinal suffix rejection.
  if (explicitOrderingLabel && LABELED_ORDERING_IDENTIFIER.test(value)) return 'mixed'
  if (UNIT_TOKEN.test(value)) return null
  if (LABEL_TOKEN.test(value)) return null
  if (ORDINAL_TOKEN.test(value)) return null
  if (/^https?/i.test(value) || value.includes('//')) return null
  if (/\.(?:COM|ORG|NET|FR|DE|PDF|HTML?)$/i.test(value)) return null
  if (!/[A-Za-z]/.test(value)) {
    if (/^\d+$/.test(value)) {
      if (value.length < 5 || value.length > 9) return null
      if (/^(?:19|20)\d{2}$/.test(value)) return null
      return 'numeric'
    }
    if (/^\d+(?:\.\d+)+$/.test(value)) {
      return value.replace(/\D/g, '').length >= 6 ? 'decimal' : null
    }
    return null
  }
  if (/^\d+(?:\.\d+)*$/.test(value)) return null
  return 'mixed'
}

/** Identifier-shaped tokens on one line, with their character columns. */
export function extractIdentifierTokens(line: string): RawToken[] {
  const tokens: RawToken[] = []
  for (const match of line.matchAll(TOKEN)) {
    const column = match.index ?? 0
    const explicitlyLabeled = EXPLICIT_ORDERING_LABEL_PREFIX.test(line.slice(0, column))
    const kind = classifyToken(match[0], explicitlyLabeled)
    if (!kind) continue
    tokens.push({ raw: match[0], column, end: column + match[0].length, kind })
  }
  return tokens
}

function isShortNumeric(raw: string): boolean {
  return /^\d{1,4}$/.test(raw)
}

/** Lines that look like a matrix dimension header: several short numeric column labels. */
function shortNumericColumns(line: string): { raw: string; column: number }[] {
  const labels: { raw: string; column: number }[] = []
  for (const match of line.matchAll(/\b\d{1,4}\b/g)) {
    labels.push({ raw: match[0], column: match.index ?? 0 })
  }
  return labels
}

function nearestHeading(lines: string[], lineIndex: number): string {
  for (let index = lineIndex - 1; index >= Math.max(0, lineIndex - 12); index--) {
    const text = lines[index].trim()
    if (text.length < 4) continue
    if (extractIdentifierTokens(lines[index]).length > 0) continue
    if (/^[\d\s.,/–—-]+$/.test(text)) continue
    return text.slice(0, 100)
  }
  return ''
}

function findColumnHeader(lines: string[], lineIndex: number, column: number): string | null {
  for (let index = lineIndex - 1; index >= Math.max(0, lineIndex - 18); index--) {
    const labels = shortNumericColumns(lines[index])
    if (labels.length < 3) continue
    if (extractIdentifierTokens(lines[index]).length > 0) continue
    let best: { raw: string; column: number } | null = null
    for (const label of labels) {
      if (best === null || Math.abs(label.column - column) < Math.abs(best.column - column)) {
        best = label
      }
    }
    if (best && Math.abs(best.column - column) <= 10) return best.raw
    return null
  }
  return null
}

function findRowLabel(lines: string[], lineIndex: number, column: number): string | null {
  for (let index = lineIndex; index >= Math.max(0, lineIndex - 2); index--) {
    const tokens = shortNumericColumns(lines[index])
    for (const token of tokens) {
      if (token.column < column - 4 && isShortNumeric(token.raw)) return token.raw
    }
  }
  return null
}

interface JoinedToken extends RawToken {
  rule: DetectionRule
}

/**
 * Reconstruct hyphen-wrapped cells: a fragment ending in "-" continues on a nearby following
 * line at approximately the same column. The continuation is consumed so the fragment and its
 * tail never surface as two half identifiers.
 */
function reconstructWrappedTokens(lines: string[]): {
  joined: Map<number, JoinedToken[]>
  consumed: Set<string>
} {
  const joined = new Map<number, JoinedToken[]>()
  const consumed = new Set<string>()
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    for (const match of line.matchAll(TOKEN)) {
      const column = match.index ?? 0
      const end = column + match[0].length
      if (line[end] !== '-') continue
      if (line.slice(end + 1, end + 3).trim() !== '') continue
      let fragment = `${match[0]}-`
      let searchFrom = index + 1
      const consumedParts: string[] = []
      for (let hops = 0; hops < 3; hops++) {
        let continuation: { raw: string; line: number } | null = null
        for (let next = searchFrom; next <= Math.min(lines.length - 1, searchFrom + 2); next++) {
          for (const nextMatch of lines[next].matchAll(/[A-Za-z0-9][A-Za-z0-9./-]*/g)) {
            if (Math.abs((nextMatch.index ?? 0) - column) <= 8) {
              continuation = { raw: nextMatch[0], line: next }
              break
            }
          }
          if (continuation) break
        }
        if (!continuation) break
        consumedParts.push(`${continuation.line}:${continuation.raw}`)
        if (continuation.raw.endsWith('-')) {
          fragment += continuation.raw
          searchFrom = continuation.line + 1
          continue
        }
        fragment += continuation.raw
        break
      }
      if (fragment.endsWith('-')) continue
      if (classifyToken(fragment) === null) continue
      for (const part of consumedParts) consumed.add(part)
      consumed.add(`${index}:${match[0]}`)
      const entry: JoinedToken = {
        raw: fragment,
        column,
        end,
        kind: 'mixed',
        rule: 'wrapped_cell_join',
      }
      joined.set(index, [...(joined.get(index) ?? []), entry])
    }
  }
  return { joined, consumed }
}

/** Scan one page of layout text. Pure and deterministic. */
export function scanPageText(pageText: string, page: number): ScanOccurrence[] {
  const lines = pageText.split(/\r?\n/)
  const orderingContext = ORDERING_CONTEXT.test(pageText)
  const { joined: wrapped, consumed: consumedKeys } = reconstructWrappedTokens(lines)
  const pairingPage = /\bORDER\b/i.test(pageText) && /\bREFERENCE\b|\bREF\b/i.test(pageText)

  const occurrences: ScanOccurrence[] = []
  const perLineTokens: { line: number; token: RawToken; rule: DetectionRule }[] = []

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    const rawTokens = extractIdentifierTokens(line).filter(
      (token) => !consumedKeys.has(`${index}:${token.raw}`),
    )

    const merged: { token: RawToken; rule: DetectionRule | null }[] = (
      wrapped.get(index) ?? []
    ).map((token) => ({ token, rule: token.rule }))

    // Split numeric references such as "26031 AA": a pure-numeric stem immediately followed by a
    // short uppercase suffix token. Only inside ordering-context pages to bound noise.
    const splitSuffix = new Set<number>()
    if (orderingContext) {
      for (const token of rawTokens) {
        if (token.kind !== 'numeric') continue
        const tail = line.slice(token.end)
        const suffix = tail.match(/^ ([A-Z]{1,3})(?=\s|$)/)
        if (suffix) {
          merged.push({
            token: {
              raw: `${token.raw} ${suffix[1]}`,
              column: token.column,
              end: token.end + suffix[0].length,
              kind: 'mixed',
            },
            rule: 'joined_split_reference',
          })
          splitSuffix.add(token.column)
        }
      }
    }

    for (const token of rawTokens) {
      if (splitSuffix.has(token.column)) continue
      if ((token.kind === 'numeric' || token.kind === 'decimal') && !orderingContext) continue
      merged.push({ token, rule: null })
    }

    const identifierCount = merged.length
    for (const { token, rule } of merged) {
      let resolved: DetectionRule
      if (rule) {
        resolved = rule
      } else if (token.kind !== 'mixed') {
        resolved = 'numeric_ref_in_order_context'
      } else {
        const leading = line.slice(0, token.column).trim() === ''
        const trailing = line.slice(token.end)
        const numericColumns = (trailing.match(/(?:^|\s{2,}|\s)(\d+(?:\.\d+)?)(?=\s|$)/g) ?? [])
          .length
        if (leading && numericColumns >= 2) {
          resolved = 'leading_table_row'
        } else if (identifierCount >= 2) {
          resolved = 'matrix_cell'
        } else {
          resolved = 'inline_identifier'
        }
      }
      perLineTokens.push({ line: index, token, rule: resolved })
    }
  }

  for (const { line, token, rule } of perLineTokens) {
    let pairedIdentifier: string | null = null
    let resolvedRule = rule
    if (pairingPage) {
      const band = perLineTokens.filter(
        (other) =>
          Math.abs(other.line - line) <= 2 &&
          !(other.line === line && other.token.column === token.column),
      )
      if (band.length === 1) {
        pairedIdentifier = band[0].token.raw
        resolvedRule =
          RULE_PRECEDENCE[rule] < RULE_PRECEDENCE.ordering_pair_row ? rule : 'ordering_pair_row'
      }
    }
    occurrences.push({
      page,
      line,
      column: token.column,
      raw: token.raw,
      rule: resolvedRule,
      onPairingPage: pairingPage,
      lineContext: lines[line].trim().slice(0, 160),
      headingContext: nearestHeading(lines, line),
      columnHeader: findColumnHeader(lines, line, token.column),
      rowLabel: findRowLabel(lines, line, token.column),
      pairedIdentifier,
    })
  }
  return occurrences
}

export interface DocumentMeta {
  sourceFilename: string
  relativePath: string
  sourceSha256: string
  manufacturer: string | null
  expectedPageCount: number | null
}

/** Scan the layout text of one document and aggregate per normalized identifier. */
export function scanDocumentText(layoutText: string, meta: DocumentMeta): DocumentScan {
  const pages = layoutText.split('\f')
  const effectivePages =
    pages.length > 1 && pages.at(-1)?.trim() === '' ? pages.slice(0, -1) : pages
  const byIdentifier = new Map<string, { occurrences: ScanOccurrence[] }>()
  const pageCandidateCounts = new Map<number, number>()
  const orderingHeadingPages: number[] = []
  const matrixPages: number[] = []

  effectivePages.forEach((pageText, index) => {
    const page = index + 1
    if (ORDERING_CONTEXT.test(pageText)) orderingHeadingPages.push(page)
    const occurrences = scanPageText(pageText, page)
    if (occurrences.some((occurrence) => occurrence.rule === 'matrix_cell')) matrixPages.push(page)
    const pageIdentifiers = new Set<string>()
    for (const occurrence of occurrences) {
      const key = normalizeScannedIdentifier(occurrence.raw)
      if (key.length < 4) continue
      pageIdentifiers.add(key)
      const entry = byIdentifier.get(key) ?? { occurrences: [] }
      entry.occurrences.push(occurrence)
      byIdentifier.set(key, entry)
    }
    if (pageIdentifiers.size > 0) pageCandidateCounts.set(page, pageIdentifiers.size)
  })

  const candidates: ScannerCandidate[] = [...byIdentifier.entries()]
    .map(([normalizedIdentifier, { occurrences }]) => {
      const best = occurrences
        .slice()
        .sort(
          (left, right) =>
            RULE_PRECEDENCE[left.rule] - RULE_PRECEDENCE[right.rule] ||
            left.page - right.page ||
            left.line - right.line,
        )[0]
      const pages = [...new Set(occurrences.map((occurrence) => occurrence.page))].sort(
        (left, right) => left - right,
      )
      return {
        sourceFilename: meta.sourceFilename,
        relativePath: meta.relativePath,
        sourceSha256: meta.sourceSha256,
        documentPageCount: effectivePages.length,
        manufacturer: meta.manufacturer,
        normalizedIdentifier,
        rawIdentifier: best.raw,
        firstPage: pages[0],
        pages,
        occurrenceCount: occurrences.length,
        detectionRule: best.rule,
        confidence: HIGH_CONFIDENCE_RULES.has(best.rule)
          ? ('high' as const)
          : ('moderate' as const),
        headingContext: best.headingContext,
        lineContext: best.lineContext,
        columnHeader: best.columnHeader,
        rowLabel: best.rowLabel,
        pairedIdentifier: best.pairedIdentifier,
        onPairingPage: occurrences.some((occurrence) => occurrence.onPairingPage),
        column: best.column,
      }
    })
    .sort((left, right) => left.normalizedIdentifier.localeCompare(right.normalizedIdentifier))

  return {
    sourceFilename: meta.sourceFilename,
    relativePath: meta.relativePath,
    sourceSha256: meta.sourceSha256,
    manufacturer: meta.manufacturer,
    pageCount: effectivePages.length,
    pagesWithCandidates: [...pageCandidateCounts.keys()].sort((left, right) => left - right),
    pageCandidateCounts,
    orderingHeadingPages,
    matrixPages,
    candidates,
  }
}

interface ManifestSource {
  relative_path?: string | null
  source_filename?: string | null
  page_count?: number | null
  sha256?: string | null
  manufacturer?: string | null
}

export const PRIOR_MANIFEST_PATH =
  'docs/ip-preference-cards/brochure-intake/2026-08-19/source-manifest.json'

/** Run the corpus scan over every PDF in the frozen PR #118 manifest. */
export function scanOldCorpus(
  sourceDirectory: string,
  manifestPath: string = PRIOR_MANIFEST_PATH,
): CorpusScan {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { sources: ManifestSource[] }
  const pdfs = manifest.sources.filter(
    (source) => source.relative_path?.toLowerCase().endsWith('.pdf') ?? false,
  )
  const documents = pdfs.map((source) => {
    const relativePath = String(source.relative_path)
    const absolutePath = path.join(sourceDirectory, relativePath)
    const layoutText = execFileSync('pdftotext', ['-layout', absolutePath, '-'], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      // pdftotext reports recoverable font issues on stderr; they are not scan input.
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    const scan = scanDocumentText(layoutText, {
      sourceFilename: source.source_filename ?? path.basename(relativePath),
      relativePath,
      sourceSha256: String(source.sha256 ?? ''),
      manufacturer: source.manufacturer ?? null,
      expectedPageCount: source.page_count ?? null,
    })
    if (source.page_count != null && scan.pageCount !== source.page_count) {
      throw new Error(
        `Corpus scan of ${relativePath} saw ${scan.pageCount} pages; the frozen manifest records ${source.page_count}.`,
      )
    }
    return scan
  })
  return {
    sourceDirectory,
    pdfsScanned: documents.length,
    pagesScanned: documents.reduce((total, document) => total + document.pageCount, 0),
    documents,
  }
}

if (process.argv[1]?.endsWith('source-completeness-corpus-scan.ts')) {
  const sourceDirectory = process.argv[2]
  if (!sourceDirectory) throw new Error('Pass the corpus source directory.')
  const scan = scanOldCorpus(sourceDirectory)
  const totalCandidates = scan.documents.reduce(
    (total, document) => total + document.candidates.length,
    0,
  )
  console.log(
    JSON.stringify(
      {
        pdfsScanned: scan.pdfsScanned,
        pagesScanned: scan.pagesScanned,
        totalCandidates,
        documents: scan.documents.map((document) => ({
          filename: document.sourceFilename,
          pages: document.pageCount,
          candidates: document.candidates.length,
        })),
      },
      null,
      2,
    ),
  )
}
