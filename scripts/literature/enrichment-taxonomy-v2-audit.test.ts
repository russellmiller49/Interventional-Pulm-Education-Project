/** @jest-environment node */

import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { EXTERNAL_QA_COLUMNS, V2_SOURCE_COLUMNS } from './data-quality/external-qa'
import { parseTaxonomyV2AuditCliOptions } from './audit-enrichment-taxonomy-v2'
import {
  TAXONOMY_V2_CANONICAL_SOURCE_COLUMNS,
  assertTaxonomyV2AuditOutputPath,
  assertTaxonomyV2DevelopmentOnlyInputPath,
  assertTaxonomyV2QaWorkbookHashesBeforeParse,
  buildTaxonomyV2Audit,
  canonicalPhysicianFieldSha256,
  parseQaExampleMasterRowIds,
  serializeTaxonomyV2Json,
  type BuildTaxonomyV2AuditOptions,
  type CanonicalRow,
  type QaVocabularyEvidence,
  type TaxonomyV2AdoptionConfig,
  type TaxonomyV2ExpectedProvenance,
} from './enrichment-taxonomy-v2-audit'

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function csv(columns: readonly string[], rows: ReadonlyArray<Record<string, string | number>>) {
  const cell = (value: string) => `"${value.replaceAll('"', '""')}"`
  return `${[columns, ...rows.map((row) => columns.map((column) => row[column] ?? ''))]
    .map((values) => values.map((value) => cell(String(value))).join(','))
    .join('\r\n')}\r\n`
}

function canonicalRow(index: number, pmid: string): CanonicalRow {
  const row = Object.fromEntries(
    TAXONOMY_V2_CANONICAL_SOURCE_COLUMNS.map((column) => [column, '']),
  ) as Record<(typeof TAXONOMY_V2_CANONICAL_SOURCE_COLUMNS)[number], string>
  return {
    ...row,
    batch_id: 'fff41ba3-811d-4d28-ba73-9302db3a942a',
    batch_name: 'gold-set-v1',
    dataset_split: 'development',
    gold_set_item_id: `item-${index}`,
    display_order: String(index),
    master_row_id: String(index),
    screening_batch: 'batch-1',
    source_row_id: String(index),
    pmid,
    title:
      index === 1
        ? 'Cross-sectional survey of procedural practice'
        : `Development article ${index}`,
    abstract: index === 1 ? 'A questionnaire was distributed.' : 'Adequate development metadata.',
    authors_json: '[]',
    publication_types_json: '["Journal Article"]',
    mesh_terms_json: '[]',
    author_keywords_json: '[]',
    languages_json: '["eng"]',
    no_abstract: 'False',
    physician_final_label: 'include_core',
    physician_final_confidence: 'high',
    physician_accept_or_modify: 'accept',
    physician_notes: '',
    physician_reviewed: 'True',
    decision_provenance: 'human_ai_assisted',
    is_blinded: 'False',
    relevance_review_complete: 'True',
    enrichment_status: 'complete',
    database_import_ready: 'True',
    csvRecordNumber: index + 1,
  }
}

function priorRow(row: CanonicalRow) {
  const prior = Object.fromEntries(V2_SOURCE_COLUMNS.map((column) => [column, ''])) as Record<
    (typeof V2_SOURCE_COLUMNS)[number],
    string
  >
  return {
    ...prior,
    batch_row_id: row.master_row_id,
    master_row_id: row.master_row_id,
    screening_batch: row.screening_batch,
    source_row_id: row.source_row_id,
    pmid: row.pmid,
    title: row.title,
    abstract: row.abstract,
    no_abstract: 'False',
    physician_final_label: row.physician_final_label,
    physician_final_confidence: row.physician_final_confidence,
    metadata_sufficiency: row.master_row_id === '1' ? 'limited_abstract' : 'adequate',
    topic_ids:
      row.master_row_id === '1' ? 'bronchoscopic-lung-volume-reduction' : 'basic-bronchoscopy',
    study_design:
      row.master_row_id === '1' ? 'not-assessable-from-available-metadata' : 'retrospective-cohort',
    publication_status: 'full-article',
    full_text_used: 'False',
  }
}

function findingRow(row: CanonicalRow) {
  return {
    source_review: 'QA_review_2',
    severity: 'High',
    category: 'Tagging error',
    master_row_id: row.master_row_id,
    pmid: row.pmid,
    field: 'topic_ids',
    issue: 'Surgical LVRS classified under a bronchoscopic topic',
    current_value_in_external_review: 'bronchoscopic-lung-volume-reduction',
    suggested_action:
      row.master_row_id === '1'
        ? 'Candidate deferred-alias and cross-sectional-survey require adjudication'
        : 'Correct the broad topic after physician adjudication',
    title: row.title,
    status_against_v2: 'still_open',
    review_tier: 'direct_targeted',
  }
}

function proposal(
  proposalId: string,
  decision: 'adopt' | 'defer' | 'map_to_existing' | 'merge_with_another_proposal',
  proposedId: string,
  replacementIds: string[],
  source: QaVocabularyEvidence,
) {
  return {
    proposal_id: proposalId,
    sources: [
      {
        artifact: source.artifact,
        location: 'Vocabulary_Gaps',
        source_term: source.sourceTerm,
      },
    ],
    field: source.field,
    proposed_id: proposedId,
    label: proposalId,
    count: source.indicativeCount,
    example_pmids: [],
    example_master_row_ids: source.exampleMasterRowIds,
    exact_equivalents: [],
    near_equivalents: [],
    decision,
    rationale: 'Synthetic deterministic disposition.',
    replacement_ids: replacementIds,
    definition: 'Synthetic proposal definition.',
    inclusion_boundary: 'Include explicit evidence only.',
    exclusion_boundary: 'Exclude implicit inference.',
    examples: ['Synthetic example.'],
  }
}

function fixture(rowCount = 2) {
  const rows = Array.from({ length: rowCount }, (_, index) => {
    const pmid = index === 0 ? '18453348' : index === 1 ? '41229759' : String(50_000_000 + index)
    return canonicalRow(index + 1, pmid)
  })
  const canonicalSourceCsv = csv(TAXONOMY_V2_CANONICAL_SOURCE_COLUMNS, rows)
  const priorEnrichmentCsv = csv(V2_SOURCE_COLUMNS, rows.map(priorRow))
  const findingsCsv = csv(EXTERNAL_QA_COLUMNS, rows.slice(0, 2).map(findingRow))
  const qaReview1Evidence: QaVocabularyEvidence[] = [
    {
      artifact: 'QA_review_1',
      field: 'technology_tags',
      sourceTerm: 'review-one-concept',
      indicativeCount: 2,
      titleCount: 1,
      exampleMasterRowIds: [],
    },
  ]
  const qaReview2Evidence: QaVocabularyEvidence[] = [
    {
      artifact: 'QA_review_2',
      field: 'study_design',
      sourceTerm: 'review-two-concept',
      indicativeCount: 3,
      titleCount: null,
      exampleMasterRowIds: ['1'],
    },
  ]
  const qaReview1Sha256 = sha256('synthetic qa review 1')
  const qaReview2Sha256 = sha256('synthetic qa review 2')
  const findingsSha256 = sha256(findingsCsv)
  const config: TaxonomyV2AdoptionConfig = {
    report_version: '2.0.0',
    taxonomy_version: '2.0.0',
    label_schema_version: '2.0.0',
    source_artifacts: [
      { artifact: 'QA_review_1', location: 'synthetic', sha256: qaReview1Sha256 },
      { artifact: 'QA_review_2', location: 'synthetic', sha256: qaReview2Sha256 },
      { artifact: 'external_QA_findings', location: 'synthetic', sha256: findingsSha256 },
    ],
    proposals: [
      proposal('adopt-design', 'adopt', 'cross-sectional-survey', [], qaReview2Evidence[0]),
      proposal(
        'map-alias',
        'map_to_existing',
        'map-alias-source',
        ['convex-ebus'],
        qaReview1Evidence[0],
      ),
      proposal(
        'merge-alias',
        'merge_with_another_proposal',
        'merge-alias-source',
        ['radial-ebus'],
        qaReview1Evidence[0],
      ),
      proposal('deferred', 'defer', 'deferred-alias', [], qaReview2Evidence[0]),
    ],
    migration_mappings: [
      {
        field: 'technology_tags',
        source_id: 'map-alias-source',
        replacement_ids: ['convex-ebus'],
        mapping_type: 'alias',
        automatic: false,
        rationale: 'Adjudication required.',
      },
      {
        field: 'technology_tags',
        source_id: 'merge-alias-source',
        replacement_ids: ['radial-ebus'],
        mapping_type: 'merge',
        automatic: false,
        rationale: 'Adjudication required.',
      },
      {
        field: 'study_design',
        source_id: 'deferred-alias',
        replacement_ids: [],
        mapping_type: 'deferred',
        automatic: false,
        rationale: 'Deferred.',
      },
    ],
  }
  const qaVocabularyJson = JSON.stringify(config)
  const canonicalSourceSha256 = sha256(canonicalSourceCsv)
  const canonicalReceiptJson = JSON.stringify({
    batch: { name: 'gold-set-v1', datasetSplit: 'development', rows: rowCount },
    output: {
      rows: rowCount,
      sha256: canonicalSourceSha256,
      columns: TAXONOMY_V2_CANONICAL_SOURCE_COLUMNS,
    },
    safety: {
      developmentOnly: true,
      heldOutTestAccessed: false,
      physicianDecisionsChanged: false,
    },
  })
  const expectedProvenance: TaxonomyV2ExpectedProvenance = {
    canonicalReceiptSha256: sha256(canonicalReceiptJson),
    canonicalRows: rowCount,
    canonicalSourceSha256,
    findingsSha256,
    physicianFieldSha256: canonicalPhysicianFieldSha256(rows),
    priorEnrichmentSha256: sha256(priorEnrichmentCsv),
    qaReview1Sha256,
    qaReview1ProposalCount: 1,
    qaReview2Sha256,
    qaReview2ProposalCount: 1,
  }
  const options: BuildTaxonomyV2AuditOptions = {
    canonicalReceiptJson,
    canonicalSourceCsv,
    expectedProvenance,
    findingsCsv,
    priorEnrichmentCsv,
    qaReview1Evidence,
    qaReview1Sha256,
    qaReview2Evidence,
    qaReview2Sha256,
    qaVocabularyJson,
  }
  return { options, rows }
}

describe('deterministic taxonomy V2 audit', () => {
  it('rejects a checksum mismatch before interpreting altered input', () => {
    const { options } = fixture()
    expect(() =>
      buildTaxonomyV2Audit({ ...options, canonicalSourceCsv: `${options.canonicalSourceCsv}\n` }),
    ).toThrow(/canonicalSource checksum mismatch/iu)
    expect(() =>
      assertTaxonomyV2QaWorkbookHashesBeforeParse(Buffer.from('qa1'), Buffer.from('qa2'), {
        qaReview1Sha256: sha256('wrong qa1'),
        qaReview2Sha256: sha256('qa2'),
      }),
    ).toThrow(/checksum mismatch before workbook parsing/iu)
  })

  it('proves exactly 630 unique development members and rejects membership drift', () => {
    const { options } = fixture(630)
    const result = buildTaxonomyV2Audit(options)
    expect(result.report.canonicalDevelopment).toMatchObject({
      rows: 630,
      uniqueMasterRowIds: 630,
      uniquePmids: 630,
      datasetSplit: 'development',
    })

    const alteredPrior = options.priorEnrichmentCsv.replace('"18453348"', '"99999999"')
    expect(() =>
      buildTaxonomyV2Audit({
        ...options,
        priorEnrichmentCsv: alteredPrior,
        expectedProvenance: {
          ...options.expectedProvenance,
          priorEnrichmentSha256: sha256(alteredPrior),
        },
      }),
    ).toThrow(/membership mismatch/iu)
  })

  it('rejects held-out paths and split options before required-input processing', () => {
    expect(() =>
      assertTaxonomyV2DevelopmentOnlyInputPath('/tmp/held-out/source.csv', '--source', ['.csv']),
    ).toThrow(/held-out/iu)
    expect(() => parseTaxonomyV2AuditCliOptions(['--test'])).toThrow(
      /split options are forbidden/iu,
    )
    expect(() => parseTaxonomyV2AuditCliOptions(['--commit'])).toThrow(
      /commit options are forbidden/iu,
    )
  })

  it('preserves physician identity and checksum and rejects prior label drift', () => {
    const { options } = fixture()
    const result = buildTaxonomyV2Audit(options)
    expect(result.report.physicianFieldIntegrity).toEqual({
      expectedSha256: options.expectedProvenance.physicianFieldSha256,
      sha256Before: options.expectedProvenance.physicianFieldSha256,
      sha256After: options.expectedProvenance.physicianFieldSha256,
      unchanged: true,
    })
    const alteredPrior = options.priorEnrichmentCsv.replace('"include_core"', '"exclude"')
    expect(() =>
      buildTaxonomyV2Audit({
        ...options,
        priorEnrichmentCsv: alteredPrior,
        expectedProvenance: {
          ...options.expectedProvenance,
          priorEnrichmentSha256: sha256(alteredPrior),
        },
      }),
    ).toThrow(/changed physician label\/confidence/iu)
  })

  it('serializes byte-identically and contains no timestamp or output path', () => {
    const { options } = fixture()
    const first = buildTaxonomyV2Audit(options)
    const second = buildTaxonomyV2Audit(options)
    expect(serializeTaxonomyV2Json(first.report)).toBe(serializeTaxonomyV2Json(second.report))
    expect(serializeTaxonomyV2Json(first.upgradePlan)).toBe(
      serializeTaxonomyV2Json(second.upgradePlan),
    )
    expect(serializeTaxonomyV2Json(first.report)).not.toMatch(/generatedAt|outputPath/u)
  })

  it('handles exactly the two LVRS findings as topic-scope candidates only', () => {
    const { options } = fixture()
    const { report, upgradePlan } = buildTaxonomyV2Audit(options)
    expect(report.lvrsTopicScopeFindings.map((finding) => finding.pmid)).toEqual([
      '18453348',
      '41229759',
    ])
    expect(
      report.lvrsTopicScopeFindings.every((finding) =>
        finding.handling.includes('no_technology_inference'),
      ),
    ).toBe(true)
    expect(
      report.lvrsTopicScopeFindings.every(
        (finding) => finding.candidateV2Topic === 'adjacent-surgical-procedural-analogue',
      ),
    ).toBe(true)
    for (const row of upgradePlan.rows.filter((item) =>
      ['18453348', '41229759'].includes(item.pmid),
    )) {
      expect(row.candidateFieldVocabularyAdditions).toEqual([
        {
          detection: 'checksum_bound_lvrs_scope_finding',
          field: 'topic_ids',
          vocabularyId: 'adjacent-surgical-procedural-analogue',
        },
      ])
    }
  })

  it('reports every adoption disposition and substantive migration completeness', () => {
    const { options } = fixture()
    const { report } = buildTaxonomyV2Audit(options)
    expect(report.migrationCompleteness.decisions).toEqual({
      adopt: 1,
      defer: 1,
      map_to_existing: 1,
      merge_with_another_proposal: 1,
    })
    expect(report.migrationCompleteness.missingMappings).toBe(0)
    expect(report.migrationCompleteness.automaticMappings).toBe(0)
    expect(report.v1ControlledValueCounts.publication_status).toMatchObject({
      'conference-abstract': 0,
      correction: 0,
      retraction: 0,
    })
    expect(report.contracts).toEqual({
      existingTaxonomyVersion: '1.1.0',
      proposedEnrichmentSchemaVersion: '2.0.0',
      proposedTaxonomyVersion: '2.0.0',
    })
    expect(
      report.notAssessableStudyDesign.candidateResolvableRows +
        report.notAssessableStudyDesign.unresolvedRows,
    ).toBe(report.notAssessableStudyDesign.total)
  })

  it('records candidate fields but never promotes QA free text into vocabulary values', () => {
    const { options, rows } = fixture(3)
    const extraFindings = [
      findingRow(rows[0]),
      findingRow(rows[1]),
      {
        ...findingRow(rows[2]),
        category: 'Cross-field consistency',
        field: 'topic_ids',
        issue: 'Existing topic basic-bronchoscopy is already present',
        suggested_action: 'Add basic-bronchoscopy',
      },
      {
        ...findingRow(rows[2]),
        category: 'Cross-field consistency',
        field: 'topic_ids/study_design',
        issue: 'Survey design candidate',
        suggested_action: 'Consider cross-sectional-survey',
      },
    ]
    const findingsCsv = csv(EXTERNAL_QA_COLUMNS, extraFindings)
    const findingsSha256 = sha256(findingsCsv)
    const config = JSON.parse(options.qaVocabularyJson) as TaxonomyV2AdoptionConfig
    config.source_artifacts.find((source) => source.artifact.includes('findings'))!.sha256 =
      findingsSha256
    const result = buildTaxonomyV2Audit({
      ...options,
      findingsCsv,
      qaVocabularyJson: JSON.stringify(config),
      expectedProvenance: {
        ...options.expectedProvenance,
        findingsSha256,
      },
    })
    const row = result.upgradePlan.rows.find((item) => item.pmid === rows[2].pmid)!
    expect(row.candidateFields).toEqual(['study_design', 'topic_ids'])
    expect(row.candidateFieldVocabularyAdditions).toEqual([])
  })

  it('rejects missing evidence coverage, incorrect source binding, and automatic mappings', () => {
    const { options } = fixture()
    expect(() => buildTaxonomyV2Audit({ ...options, qaReview1Evidence: [] })).toThrow(
      /exactly 1 extracted proposals/iu,
    )

    const wrongSource = JSON.parse(options.qaVocabularyJson) as TaxonomyV2AdoptionConfig
    wrongSource.source_artifacts[0].sha256 = 'a'.repeat(64)
    expect(() =>
      buildTaxonomyV2Audit({ ...options, qaVocabularyJson: JSON.stringify(wrongSource) }),
    ).toThrow(/does not bind the qaReview1 checksum/iu)

    const duplicateSource = JSON.parse(options.qaVocabularyJson) as TaxonomyV2AdoptionConfig
    duplicateSource.source_artifacts.push({ ...duplicateSource.source_artifacts[0] })
    expect(() =>
      buildTaxonomyV2Audit({ ...options, qaVocabularyJson: JSON.stringify(duplicateSource) }),
    ).toThrow(/does not bind the qaReview1 checksum/iu)

    const automatic = JSON.parse(options.qaVocabularyJson) as TaxonomyV2AdoptionConfig
    automatic.migration_mappings[0].automatic = true
    expect(() =>
      buildTaxonomyV2Audit({ ...options, qaVocabularyJson: JSON.stringify(automatic) }),
    ).toThrow(/automatic=true is forbidden/iu)

    const missingDeferred = JSON.parse(options.qaVocabularyJson) as TaxonomyV2AdoptionConfig
    missingDeferred.migration_mappings = missingDeferred.migration_mappings.filter(
      (mapping) => mapping.mapping_type !== 'deferred',
    )
    expect(() =>
      buildTaxonomyV2Audit({ ...options, qaVocabularyJson: JSON.stringify(missingDeferred) }),
    ).toThrow(/lack explicit migration mappings/iu)

    const incompatibleMapping = JSON.parse(options.qaVocabularyJson) as TaxonomyV2AdoptionConfig
    incompatibleMapping.migration_mappings.find(
      (mapping) => mapping.source_id === 'map-alias-source',
    )!.mapping_type = 'split'
    expect(() =>
      buildTaxonomyV2Audit({
        ...options,
        qaVocabularyJson: JSON.stringify(incompatibleMapping),
      }),
    ).toThrow(/lack explicit migration mappings/iu)

    const unsupportedAdopt = JSON.parse(options.qaVocabularyJson) as TaxonomyV2AdoptionConfig
    unsupportedAdopt.proposals.find((item) => item.decision === 'adopt')!.proposed_id =
      'unsupported-design'
    expect(() =>
      buildTaxonomyV2Audit({ ...options, qaVocabularyJson: JSON.stringify(unsupportedAdopt) }),
    ).toThrow(/absent from the V2 label catalog/iu)

    const unsupportedReplacement = JSON.parse(options.qaVocabularyJson) as TaxonomyV2AdoptionConfig
    unsupportedReplacement.proposals.find(
      (item) => item.decision === 'map_to_existing',
    )!.replacement_ids = ['unsupported-technology']
    expect(() =>
      buildTaxonomyV2Audit({
        ...options,
        qaVocabularyJson: JSON.stringify(unsupportedReplacement),
      }),
    ).toThrow(/unsupported V2 replacement IDs/iu)
  })

  it('rejects observed V1 values outside the checksum-frozen V1 catalogs', () => {
    const { options } = fixture()
    const alteredPrior = options.priorEnrichmentCsv.replace(
      '"full-article"',
      '"unsupported-publication-class"',
    )
    expect(() =>
      buildTaxonomyV2Audit({
        ...options,
        priorEnrichmentCsv: alteredPrior,
        expectedProvenance: {
          ...options.expectedProvenance,
          priorEnrichmentSha256: sha256(alteredPrior),
        },
      }),
    ).toThrow(/unsupported V1 publication_status values/iu)
  })

  it('rejects non-development proposal examples and parses workbook count phrases safely', () => {
    expect(parseQaExampleMasterRowIds('35 articles')).toEqual([])
    expect(parseQaExampleMasterRowIds('12 articles')).toEqual([])
    expect(parseQaExampleMasterRowIds('589 and related')).toEqual(['589'])
    expect(parseQaExampleMasterRowIds('122, 180, 477, 525')).toEqual(['122', '180', '477', '525'])

    const { options } = fixture()
    const config = JSON.parse(options.qaVocabularyJson) as TaxonomyV2AdoptionConfig
    config.proposals[0].example_master_row_ids = ['999999']
    expect(() =>
      buildTaxonomyV2Audit({ ...options, qaVocabularyJson: JSON.stringify(config) }),
    ).toThrow(/not a development member/iu)
  })

  it('keeps the upgrade plan candidate-only and excludes deferred source IDs', () => {
    const { options } = fixture()
    const { report, upgradePlan } = buildTaxonomyV2Audit(options)
    const serialized = serializeTaxonomyV2Json(upgradePlan)
    expect(upgradePlan.safety).toEqual({
      containsFinalChangedValues: false,
      databaseOperations: [],
      developmentOnly: true,
      importOperations: [],
      relevanceModification: false,
      testIdentitiesIncluded: false,
    })
    expect(
      upgradePlan.rows.every((row) => !row.finalChangeDeterministic && row.physicianAdjudication),
    ).toBe(true)
    expect(serialized).not.toMatch(/"(?:proposedValue|finalValue|changedValue)"/u)
    expect(
      upgradePlan.rows.flatMap((row) =>
        row.candidateFieldVocabularyAdditions.map((candidate) => candidate.vocabularyId),
      ),
    ).not.toContain('deferred-alias')
    expect(report.optionalBlankTags.technology_tags).toMatchObject({
      notApplicable: 0,
      notAssessable: 1,
      unresolved: 1,
    })
  })

  it('imports no database or network runtime from the audit or CLI', async () => {
    const files = await Promise.all([
      readFile(resolve('scripts/literature/enrichment-taxonomy-v2-audit.ts'), 'utf8'),
      readFile(resolve('scripts/literature/audit-enrichment-taxonomy-v2.ts'), 'utf8'),
    ])
    expect(files.join('\n')).not.toMatch(/lib\/database|supabase|\bfetch\s*\(|https?:\/\//iu)
  })

  it('guards outputs to non-input local-data paths outside local-data/inputs', async () => {
    const root = await mkdtemp(join(tmpdir(), 'taxonomy-v2-audit-'))
    try {
      await mkdir(join(root, 'local-data', 'inputs'), { recursive: true })
      await expect(
        assertTaxonomyV2AuditOutputPath(join(root, 'outside.json'), root, [], '--output'),
      ).rejects.toThrow(/local-data tree/iu)
      await expect(
        assertTaxonomyV2AuditOutputPath(
          join(root, 'local-data', 'inputs', 'audit.json'),
          root,
          [],
          '--output',
        ),
      ).rejects.toThrow(/local-data\/inputs/iu)
      await expect(
        assertTaxonomyV2AuditOutputPath(
          join(root, 'local-data', 'audit.json'),
          root,
          [join(root, 'local-data', 'audit.json')],
          '--output',
        ),
      ).rejects.toThrow(/collide/iu)
      await expect(
        assertTaxonomyV2AuditOutputPath(
          join(root, 'local-data', 'reports', 'audit.json'),
          root,
          [],
          '--output',
        ),
      ).resolves.toBe(join(root, 'local-data', 'reports', 'audit.json'))
    } finally {
      await rm(root, { force: true, recursive: true })
    }
  })
})
