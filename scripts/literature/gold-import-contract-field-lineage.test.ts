import { createHash } from 'node:crypto'

import { canonicalJson } from '../../src/features/literature/gold-set/import-compensation'
import {
  FIELD_LINEAGE_MAPPING_CLASSIFICATIONS,
  buildGoldImportFieldLineageReport,
  buildGoldImportForwardRepairRequirements,
  goldImportFieldLineageSha256,
  goldImportForwardRepairRequirementsSha256,
  renderGoldImportFieldLineageMarkdown,
} from './gold-import-contract-field-lineage'

describe('gold import contract field lineage', () => {
  it('emits the exact deterministic 13-field analysis and canonical digest', () => {
    const first = buildGoldImportFieldLineageReport()
    const second = buildGoldImportFieldLineageReport()

    expect(first).toEqual(second)
    expect(first.scope.fieldCount).toBe(13)
    expect(first.fields.map((record) => record.field)).toEqual([
      'finalized V3 is_blinded',
      'literature_gold_set_reviews.is_blinded',
      'literature_gold_set_items.automated_signals_revealed_at',
      'finalized V3 full_text_used',
      'literature_gold_set_reviews.categorization_from_full_text',
      'literature_gold_set_reviews.used_supplemental_metadata',
      'literature_gold_set_items.supplemental_metadata_revealed_at',
      'finalized V3 technology_tag_status',
      'finalized V3 disease_tag_status',
      'persisted technology_tag_status',
      'persisted disease_tag_status',
      'finalized V3 physician_notes',
      'persisted review notes',
    ])
    expect(
      first.fields.every((record) =>
        record.mappingClassifications.every((classification) =>
          FIELD_LINEAGE_MAPPING_CLASSIFICATIONS.includes(classification),
        ),
      ),
    ).toBe(true)
    expect(first.conclusions).toEqual({
      categorizationFromFullTextIndependentFromFullTextUsed: true,
      excludedBlankStatusesAreSourceAuthoritativeNull: true,
      fullTextUsedEqualsUsedSupplementalMetadata: false,
      localRevealTimestampsMayBeSynthesized: false,
      sourceBlindingEqualsLocalAutomatedRevealHistory: false,
      statusPhysicianDecisionRequired: false,
    })
    expect(goldImportFieldLineageSha256(first)).toBe(
      createHash('sha256').update(canonicalJson(first)).digest('hex'),
    )
    expect(renderGoldImportFieldLineageMarkdown(first)).toContain(
      `Canonical JSON SHA-256: \`${goldImportFieldLineageSha256(first)}\``,
    )
  })

  it('keeps full-text provenance separate from both clinical categorization and local supplemental metadata', () => {
    const report = buildGoldImportFieldLineageReport()
    const fullText = report.fields.find((record) => record.field === 'finalized V3 full_text_used')
    const categorization = report.fields.find(
      (record) => record.field === 'literature_gold_set_reviews.categorization_from_full_text',
    )
    const supplemental = report.fields.find(
      (record) => record.field === 'literature_gold_set_reviews.used_supplemental_metadata',
    )

    expect(fullText).toMatchObject({
      currentV1MappingSafe: false,
      mappingClassifications: ['missing_persistence_target', 'distinct_provenance_concepts'],
    })
    expect(categorization).toMatchObject({
      currentV1MappingSafe: true,
      mappingClassifications: ['exact_same_semantic_field'],
    })
    expect(supplemental).toMatchObject({
      currentV1MappingSafe: false,
      mappingClassifications: ['distinct_provenance_concepts'],
    })
  })

  it('emits the exact forward-repair gates without authorizing a migration or status choice', () => {
    const requirements = buildGoldImportForwardRepairRequirements({
      noteDisposition: 'already_authorized',
      noteDispositionEvidenceSha256: 'a'.repeat(64),
    })

    expect(requirements.requirements).toHaveLength(15)
    expect(requirements).toMatchObject({
      importContractForwardMigrationRequired: true,
      ownerAclForwardMigrationRequired: false,
      physicianStatusDecisionRequired: false,
      sourceArtifactChangeRequired: false,
      noteDisposition: { status: 'already_authorized' },
    })
    expect(goldImportForwardRepairRequirementsSha256(requirements)).toBe(
      createHash('sha256').update(canonicalJson(requirements)).digest('hex'),
    )
  })
})
