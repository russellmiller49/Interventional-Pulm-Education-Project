import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

import {
  SOURCE_COMPLETENESS_REVIEW,
  sourceCompletenessCount,
  type EvidenceManifestEntry,
} from './source-completeness-intake'

export interface EvidenceFileFact {
  sha256: string
  pageCount: number
}

export function inspectPdfEvidenceFile(filePath: string): EvidenceFileFact {
  const bytes = readFileSync(filePath)
  const info = execFileSync('pdfinfo', [filePath], { encoding: 'utf8' })
  const pageMatch = info.match(/^Pages:\s+(\d+)$/mu)
  if (!pageMatch) throw new Error(`Could not read a PDF page count from ${filePath}.`)
  return {
    sha256: createHash('sha256').update(bytes).digest('hex'),
    pageCount: Number(pageMatch[1]),
  }
}

export function assertReviewedEvidenceFileFact(
  evidence: Pick<EvidenceManifestEntry, 'evidenceId' | 'sha256' | 'pageCount'>,
  actual: EvidenceFileFact,
): void {
  if (actual.sha256 !== evidence.sha256) {
    throw new Error(
      `Evidence ${evidence.evidenceId} SHA-256 mismatch: reviewed ${evidence.sha256}, actual ${actual.sha256}.`,
    )
  }
  if (actual.pageCount !== evidence.pageCount) {
    throw new Error(
      `Evidence ${evidence.evidenceId} page-count mismatch: reviewed ${evidence.pageCount}, actual ${actual.pageCount}.`,
    )
  }
}

export function verifyReviewedPdfEvidenceFiles(searchDirectories: string[]): EvidenceFileFact[] {
  const pdfEvidence = SOURCE_COMPLETENESS_REVIEW.evidence_manifest.filter((evidence) =>
    evidence.sourceType.includes('PDF'),
  )
  if (pdfEvidence.length !== sourceCompletenessCount('new_pdf_evidence_files')) {
    throw new Error('Reviewed PDF evidence count is out of sync with the count contract.')
  }
  return pdfEvidence.map((evidence) => {
    if (!evidence.filename) throw new Error(`Evidence ${evidence.evidenceId} has no filename.`)
    const filePath = searchDirectories
      .map((directory) => path.join(directory, evidence.filename as string))
      .find((candidate) => existsSync(candidate))
    if (!filePath) {
      throw new Error(
        `Evidence ${evidence.evidenceId} file ${evidence.filename} was not found in the supplied directories.`,
      )
    }
    const actual = inspectPdfEvidenceFile(filePath)
    assertReviewedEvidenceFileFact(evidence, actual)
    return actual
  })
}

if (process.argv[1]?.endsWith('verify-source-completeness-evidence.ts')) {
  const directories = process.argv.slice(2)
  if (directories.length === 0) {
    throw new Error('Pass one or more directories containing the reviewed PDF evidence files.')
  }
  const facts = verifyReviewedPdfEvidenceFiles(directories)
  console.log(
    `Verified ${facts.length} reviewed PDF evidence files (${facts.reduce((total, fact) => total + fact.pageCount, 0)} pages).`,
  )
}
