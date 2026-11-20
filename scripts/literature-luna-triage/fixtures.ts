import { sha256 } from '../literature-production-ingest/canonical'
import type { ArtifactTruth, ArtifactTruthRow } from '../literature-reviewed-overlay/artifact'
import {
  OVERLAY_EXPECTED_CLASS_COUNTS,
  OVERLAY_EXPECTED_PROVENANCE_COUNTS,
  type OverlayProvenance,
  type OverlayRelevance,
} from '../literature-reviewed-overlay/constants'
import type { CorpusRecord } from './corpus'

/**
 * Synthetic fixtures for the Luna triage tests.
 *
 * Everything here is fabricated: PMIDs are generated in a reserved synthetic range, the
 * artifact digest is visibly not the production pin (the overlay's own fixture convention),
 * and no real record content appears anywhere. Fixtures are deliberately deterministic so
 * split/id tests can assert exact values.
 */

export const SYNTHETIC_ARTIFACT_SHA256 = sha256('literature-luna-synthetic-artifact-v1')

export function syntheticPmid(index: number): string {
  return String(900_000_000 + index)
}

/** A full, validator-passing source envelope. Journal row omitted (journal_id null). */
export function syntheticEnvelope(
  pmid: string,
  overrides: Partial<{
    title: string
    abstract: string | null
    journal_title: string | null
    journal_abbreviation: string | null
    publication_year: number | null
    publication_types: string[]
    mesh_terms: string[]
    author_keywords: string[]
    languages: string[]
  }> = {},
): unknown {
  const title = overrides.title ?? `Synthetic article ${pmid}`
  return {
    article: {
      pmid,
      doi: null,
      pmcid: null,
      title,
      // The default abstract deliberately never embeds the PMID: leakage tests depend on it.
      abstract: overrides.abstract === undefined ? 'Synthetic abstract text.' : overrides.abstract,
      abstract_display_policy: 'full_allowed',
      journal_id: null,
      journal_title: overrides.journal_title ?? 'Synthetic Journal of Testing',
      journal_abbreviation: overrides.journal_abbreviation ?? 'Synth J Test',
      nlm_journal_id: null,
      issn_values: [],
      publication_date_raw: null,
      publication_year:
        overrides.publication_year === undefined ? 2020 : overrides.publication_year,
      publication_month: null,
      publication_day: null,
      publication_date_precision: 'year',
      publication_types: overrides.publication_types ?? ['Journal Article'],
      mesh_terms: overrides.mesh_terms ?? [],
      author_keywords: overrides.author_keywords ?? [],
      languages: overrides.languages ?? ['eng'],
      authors: [],
      collective_authors: [],
      affiliations: [],
      volume: null,
      issue: null,
      pages: null,
      article_number: null,
      place_of_publication: null,
      citation_source: null,
      conflict_of_interest: null,
      pubmed_status: null,
      pubmed_last_revised_at: null,
      pubmed_created_at: null,
      raw_nbib_tags: {},
      metadata_hash: sha256(`metadata:${pmid}`),
      normalized_title: title.toLowerCase(),
      normalized_title_hash: sha256(title.toLowerCase()),
      is_retracted: false,
      is_correction: false,
      is_conference_abstract: false,
    },
    journal: null,
  }
}

export function syntheticCorpusRecord(
  pmid: string,
  overrides: Partial<Omit<CorpusRecord, 'pmid'>> = {},
): CorpusRecord {
  return {
    pmid,
    title: overrides.title ?? `Synthetic article ${pmid}`,
    abstract: overrides.abstract === undefined ? 'Synthetic abstract text.' : overrides.abstract,
    journalTitle:
      overrides.journalTitle === undefined
        ? 'Synthetic Journal of Testing'
        : overrides.journalTitle,
    journalAbbreviation:
      overrides.journalAbbreviation === undefined ? 'Synth J Test' : overrides.journalAbbreviation,
    publicationYear: overrides.publicationYear === undefined ? 2020 : overrides.publicationYear,
    publicationTypes: overrides.publicationTypes ?? ['Journal Article'],
    meshTerms: overrides.meshTerms ?? [],
    keywords: overrides.keywords ?? [],
    languages: overrides.languages ?? ['eng'],
  }
}

/**
 * Exactly 630 synthetic truth rows matching the published census: 283/75/272 by class and
 * 192/133/305 by provenance. Marginals are independent, so sequential assignment suffices.
 */
export function syntheticTruthRows(): ArtifactTruthRow[] {
  const classes: OverlayRelevance[] = []
  for (const [value, count] of Object.entries(OVERLAY_EXPECTED_CLASS_COUNTS)) {
    for (let index = 0; index < count; index += 1) classes.push(value as OverlayRelevance)
  }
  const provenance: OverlayProvenance[] = []
  for (const [value, count] of Object.entries(OVERLAY_EXPECTED_PROVENANCE_COUNTS)) {
    for (let index = 0; index < count; index += 1) provenance.push(value as OverlayProvenance)
  }
  return classes.map((relevance, index) => ({
    pmid: syntheticPmid(index),
    relevance,
    provenance: provenance[index],
  }))
}

export function syntheticTruth(): ArtifactTruth {
  return { artifactSha256: SYNTHETIC_ARTIFACT_SHA256, rows: syntheticTruthRows() }
}

/** Deterministic presence pattern: roughly one in ten reviewed records has no abstract. */
export function syntheticAbstractPresence(rows: readonly ArtifactTruthRow[]): Map<string, boolean> {
  return new Map(rows.map((row, index) => [row.pmid, index % 10 !== 3]))
}

/** A completed Responses API body carrying one output_text payload. */
export function syntheticResponseBody(outputText: string): string {
  return JSON.stringify({
    id: 'resp_synthetic',
    status: 'completed',
    output: [
      {
        type: 'message',
        role: 'assistant',
        content: [{ type: 'output_text', text: outputText }],
      },
    ],
    usage: { input_tokens: 500, output_tokens: 40, total_tokens: 540 },
  })
}

export function syntheticRefusalBody(): string {
  return JSON.stringify({
    id: 'resp_refusal',
    status: 'completed',
    output: [
      {
        type: 'message',
        role: 'assistant',
        content: [{ type: 'refusal', refusal: 'declined' }],
      },
    ],
  })
}

export function syntheticStageAOutput(
  recordId: string,
  decision: string,
  confidence: string,
  reasonCodes: readonly string[],
): string {
  return JSON.stringify({
    record_id: recordId,
    triage_decision: decision,
    confidence_band: confidence,
    reason_codes: reasonCodes,
  })
}
