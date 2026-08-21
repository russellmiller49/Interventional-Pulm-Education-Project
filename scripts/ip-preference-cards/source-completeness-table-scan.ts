import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { SOURCE_COMPLETENESS_REVIEW } from './source-completeness-intake'

interface ManifestSource {
  relative_path?: string | null
  source_filename?: string | null
  page_count?: number | null
  document_type?: string | null
}

interface Manifest {
  sources: ManifestSource[]
}

export interface TablePage {
  page: number
  rowIdentifiers: string[]
}

export interface MultiPageTableSection {
  startPage: number
  endPage: number
  rowIdentifiers: string[]
}

const TABLE_ROW = /^\s*([A-Z0-9][A-Z0-9./_-]{2,31})\b(?=(?:[^\r\n\d]*\d+(?:\.\d+)?){2})/iu

/**
 * Extract page-leading table identifiers from every page, then retain contiguous multi-page
 * sections. A continuation page does not need to repeat a heading, which is the failure mode that
 * previously hid the Shiley R-series rows.
 */
export function extractMultiPageTableSections(layoutText: string): MultiPageTableSection[] {
  const pages: TablePage[] = layoutText.split('\f').map((pageText, index) => ({
    page: index + 1,
    rowIdentifiers: pageText
      .split(/\r?\n/u)
      .map((line) => line.match(TABLE_ROW)?.[1]?.replace(/[*†‡]+$/gu, '') ?? '')
      .filter((identifier) => /[a-z]/iu.test(identifier) && /\d/u.test(identifier)),
  }))

  const tablePages = pages.filter((page) => page.rowIdentifiers.length >= 3)
  const sections: MultiPageTableSection[] = []
  let current: TablePage[] = []
  for (const page of tablePages) {
    const previous = current.at(-1)
    if (previous && page.page === previous.page + 1) {
      current.push(page)
      continue
    }
    if (current.length >= 2) sections.push(combine(current))
    current = [page]
  }
  if (current.length >= 2) sections.push(combine(current))
  return sections
}

function combine(pages: TablePage[]): MultiPageTableSection {
  return {
    startPage: pages[0].page,
    endPage: pages.at(-1)?.page ?? pages[0].page,
    rowIdentifiers: [...new Set(pages.flatMap((page) => page.rowIdentifiers))],
  }
}

export function scanOldCorpusMultiPageTables(sourceDirectory: string): {
  pdfsScanned: number
  pagesScanned: number
  documents: {
    filename: string
    relativePath: string
    sections: MultiPageTableSection[]
  }[]
} {
  const manifest = JSON.parse(
    readFileSync(
      'docs/ip-preference-cards/brochure-intake/2026-08-19/source-manifest.json',
      'utf8',
    ),
  ) as Manifest
  const pdfs = manifest.sources.filter(
    (source) => source.relative_path?.toLowerCase().endsWith('.pdf') ?? false,
  )
  const documents = pdfs.flatMap((source) => {
    const relativePath = String(source.relative_path)
    const absolutePath = path.join(sourceDirectory, relativePath)
    const layoutText = execFileSync('pdftotext', ['-layout', absolutePath, '-'], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    })
    const sections = extractMultiPageTableSections(layoutText)
    return sections.length > 0
      ? [
          {
            filename: source.source_filename ?? path.basename(relativePath),
            relativePath,
            sections,
          },
        ]
      : []
  })
  return {
    pdfsScanned: pdfs.length,
    pagesScanned: pdfs.reduce((total, source) => total + Number(source.page_count ?? 0), 0),
    documents,
  }
}

if (process.argv[1]?.endsWith('source-completeness-table-scan.ts')) {
  const sourceDirectory =
    process.argv[2] ?? String(SOURCE_COMPLETENESS_REVIEW.corpus_audit.source_directory)
  console.log(JSON.stringify(scanOldCorpusMultiPageTables(sourceDirectory), null, 2))
}
