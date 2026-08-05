import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  flattenLiteratureTaxonomy,
  literatureGoldSetLabels,
  literatureTaxonomy,
  loadLiteratureEnrichmentLabels,
  loadLiteratureEnrichmentTaxonomyAdoption,
  loadLiteratureTaxonomy,
  lookupLiteratureEnrichmentLabel,
} from '@/features/literature/config'
import {
  adaptLiteratureEnrichmentRecordV1,
  literatureEnrichmentArtifactV2Schema,
  resolveLiteratureEnrichmentAlias,
  serializeLiteratureEnrichmentArtifactV2,
} from '@/features/literature/schemas/enrichment'
import {
  literatureEnrichmentLabelsV2Schema,
  literatureEnrichmentTaxonomyAdoptionV2Schema,
} from '@/features/literature/schemas/config'
import { literatureGoldCompleteReviewSchema } from '@/features/literature/schemas/gold-set'

const labelsV2 = loadLiteratureEnrichmentLabels('2.0.0')
const taxonomyV2 = loadLiteratureTaxonomy('2.0.0')

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function term(field: keyof typeof labelsV2.fields, id: string) {
  const value = labelsV2.fields[field].find((candidate) => candidate.id === id)
  expect(value).toBeDefined()
  return value!
}

const baseRecord = {
  master_row_id: '1',
  pmid: '30416813',
  topic_ids: ['ebus-mediastinal-staging'],
  technology_tags: ['convex-ebus'],
  technology_tag_status: 'tagged',
  clinical_purposes: ['diagnosis'],
  disease_tags: ['lung-cancer'],
  disease_tag_status: 'tagged',
  study_design: 'diagnostic-accuracy',
  publication_status: 'full-article',
}

const baseArtifactContract = {
  enrichment_schema_version: '2.0.0' as const,
  taxonomy_version: '2.0.0' as const,
  record_scope: 'physician-included-records' as const,
  source_physician_fields_sha256: '0'.repeat(64),
}

function artifactIssueMessages(input: unknown): string[] {
  const result = literatureEnrichmentArtifactV2Schema.safeParse(input)
  if (result.success) {
    throw new Error('Expected the v2 artifact to be rejected.')
  }
  return result.error.issues.map((issue) => issue.message)
}

describe('literature enrichment taxonomy v2', () => {
  it('keeps the committed v1 assets byte-identical and singleton exports pinned to v1', () => {
    expect(sha256(join(process.cwd(), 'config/literature/taxonomy.v1.json'))).toBe(
      '70bcd7aea6d9a135368a05a34bc10643bef1e42ff153a734361eaf94a86eb441',
    )
    expect(sha256(join(process.cwd(), 'config/literature/gold-set-labels.v1.json'))).toBe(
      '554cf8b0b39d5f9be0f89566939c6336e040605dba05b0ddfa0f41c7badd7ac4',
    )
    expect(literatureTaxonomy.taxonomy_version).toBe('1.1.0')
    expect(literatureGoldSetLabels.label_schema_version).toBe('1.1.0')
    expect(loadLiteratureTaxonomy('1.1.0')).toEqual(literatureTaxonomy)
  })

  it('requires explicit supported versions and preserves distinct v1/v2 identities', () => {
    expect(taxonomyV2.taxonomy_version).toBe('2.0.0')
    expect(labelsV2).toMatchObject({
      label_schema_version: '2.0.0',
      taxonomy_version: '2.0.0',
      default_locale: 'en',
      fallback_locale: 'en',
    })

    expect(() =>
      (loadLiteratureTaxonomy as unknown as (version: string) => unknown)('latest'),
    ).toThrow('Unsupported literature taxonomy version: latest')
    expect(() =>
      (loadLiteratureEnrichmentLabels as unknown as (version: string) => unknown)('1.1.0'),
    ).toThrow('Unsupported literature enrichment label schema version: 1.1.0')
  })

  it('strictly validates new-term evidence and proposal dispositions', () => {
    const missingBoundary = jsonClone(labelsV2)
    const newTerm = missingBoundary.fields.study_design.find(
      (value) => value.id === 'cross-sectional-survey',
    )!
    delete newTerm.inclusion_boundary_en
    expect(() => literatureEnrichmentLabelsV2Schema.parse(missingBoundary)).toThrow(
      'V2 term cross-sectional-survey requires inclusion_boundary_en.',
    )

    const report = loadLiteratureEnrichmentTaxonomyAdoption('2.0.0')
    const missingMapping = jsonClone(report)
    missingMapping.migration_mappings = missingMapping.migration_mappings.filter(
      (mapping) => mapping.source_id !== 'pleurodesis-agent',
    )
    expect(() => literatureEnrichmentTaxonomyAdoptionV2Schema.parse(missingMapping)).toThrow(
      'Proposal technology_tags:pleurodesis-agent requires an explicit migration mapping.',
    )

    const automaticMapping = jsonClone(report)
    Object.assign(automaticMapping.migration_mappings[0], { automatic: true })
    expect(() => literatureEnrichmentTaxonomyAdoptionV2Schema.parse(automaticMapping)).toThrow()
  })

  it('uses unique controlled IDs and restricts artifact topics to broad roots', () => {
    for (const values of Object.values(labelsV2.fields)) {
      const ids = values.map((value) => value.id)
      expect(new Set(ids).size).toBe(ids.length)
      ids.forEach((id) => expect(id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u))
    }

    const rootIds = taxonomyV2.topics.map((topic) => topic.id)
    expect(labelsV2.fields.topic_ids.map((value) => value.id)).toEqual(rootIds)
    expect(new Set(flattenLiteratureTaxonomy(taxonomyV2).map((topic) => topic.id)).size).toBe(
      flattenLiteratureTaxonomy(taxonomyV2).length,
    )

    expect(
      artifactIssueMessages({
        ...baseArtifactContract,
        records: [
          {
            ...baseRecord,
            topic_ids: ['ebus-mediastinal-staging.convex-ebus-tbna'],
          },
        ],
      }),
    ).toContain('Unsupported topic_ids value: "ebus-mediastinal-staging.convex-ebus-tbna"')
  })

  it('does not reuse a v1 ID for any newly introduced concept', () => {
    const v1Ids = {
      topic_ids: new Set(flattenLiteratureTaxonomy(literatureTaxonomy).map((topic) => topic.id)),
      technology_tags: new Set(literatureGoldSetLabels.technology_tags.map((value) => value.id)),
      clinical_purposes: new Set(literatureTaxonomy.facets.clinical_purpose),
      disease_tags: new Set(literatureTaxonomy.facets.disease),
      study_design: new Set(literatureTaxonomy.facets.study_design),
      publication_status: new Set(literatureTaxonomy.facets.publication_class),
    }

    for (const [field, values] of Object.entries(labelsV2.fields) as [
      keyof typeof labelsV2.fields,
      (typeof labelsV2.fields)[keyof typeof labelsV2.fields],
    ][]) {
      values
        .filter((value) => value.introduced_in === '2.0.0')
        .forEach((value) => expect(v1Ids[field].has(value.id)).toBe(false))
    }
  })

  it('includes every required new study design with definitions, boundaries, and examples', () => {
    const required = [
      'cross-sectional-survey',
      'economic-evaluation',
      'animal-preclinical',
      'bench-in-vitro',
      'qualitative-study',
      'case-control',
    ]
    required.forEach((id) => {
      const value = term('study_design', id)
      expect(value.introduced_in).toBe('2.0.0')
      expect(value.description_en).toBeTruthy()
      expect(value.inclusion_boundary_en).toBeTruthy()
      expect(value.exclusion_boundary_en).toBeTruthy()
      expect(value.examples_en?.length).toBeGreaterThan(0)
    })
    expect(term('study_design', 'cross-sectional-survey').exclusion_boundary_en).toMatch(
      /interview|qualitative/u,
    )
    expect(term('study_design', 'case-control').exclusion_boundary_en).toMatch(
      /retrospective cohort/u,
    )
    expect(term('study_design', 'animal-preclinical').exclusion_boundary_en).toMatch(
      /bench|in-vitro/u,
    )
    expect(term('study_design', 'bench-in-vitro').exclusion_boundary_en).toMatch(
      /animal|technical note/u,
    )
    expect(term('study_design', 'economic-evaluation').exclusion_boundary_en).toMatch(
      /health-services/u,
    )
  })

  it('includes the adopted procedural technologies and encodes required distinctions', () => {
    const required = [
      'thoracentesis',
      'chest-tube',
      'pleurodesis',
      'bronchoalveolar-lavage',
      'conventional-tbna',
      'rapid-on-site-evaluation',
      'endobronchial-coils',
      'balloon-bronchoplasty',
      'mediastinal-cryobiopsy',
      'foreign-body-removal',
      'bronchial-artery-embolization',
      'narrow-band-imaging',
      'confocal-laser-endomicroscopy',
      'topical-hemostatic-agent',
      'transbronchial-thermal-ablation',
    ]
    required.forEach((id) => expect(term('technology_tags', id).introduced_in).toBe('2.0.0'))

    expect(term('technology_tags', 'mediastinal-cryobiopsy').exclusion_boundary_en).toMatch(
      /transbronchial lung/u,
    )
    expect(term('technology_tags', 'conventional-tbna').exclusion_boundary_en).toMatch(
      /convex EBUS/u,
    )
    expect(term('technology_tags', 'thoracentesis').exclusion_boundary_en).toMatch(/chest-tube/u)
    expect(term('technology_tags', 'surgical-vats').exclusion_boundary_en).toMatch(
      /medical thoracoscopy/u,
    )
    expect(term('technology_tags', 'balloon-bronchoplasty').exclusion_boundary_en).toMatch(/stent/u)
  })

  it('includes the adopted diseases and separates diseases from procedures', () => {
    const required = [
      'lymphoma-hematologic-malignancy',
      'metastatic-extrathoracic-malignancy',
      'tracheobronchomalacia-edac',
      'asthma',
      'foreign-body-aspiration',
      'hemoptysis',
      'bronchiectasis',
      'pulmonary-alveolar-proteinosis',
      'airway-amyloidosis',
      'congenital-airway-disorder',
    ]
    required.forEach((id) => expect(term('disease_tags', id).introduced_in).toBe('2.0.0'))

    expect(
      term('disease_tags', 'metastatic-extrathoracic-malignancy').exclusion_boundary_en,
    ).toMatch(/primary lung cancer/u)
    expect(term('disease_tags', 'tracheobronchomalacia-edac').exclusion_boundary_en).toMatch(
      /fixed benign airway stenosis/u,
    )
    expect(term('disease_tags', 'foreign-body-aspiration').exclusion_boundary_en).toMatch(
      /removal device/u,
    )
    expect(term('disease_tags', 'hemoptysis').exclusion_boundary_en).toMatch(
      /hemostatic technology/u,
    )
  })

  it('adds the evidence-supported clinical purposes and stable adjacent topic paths', () => {
    ;[
      'cost-effectiveness-health-services',
      'specimen-adequacy',
      'workflow-operations-quality',
    ].forEach((id) => expect(term('clinical_purposes', id).introduced_in).toBe('2.0.0'))
    ;[
      'adjacent-surgical-procedural-analogue',
      'specimen-adequacy-molecular-pathology',
      'health-services-economics',
    ].forEach((id) => expect(term('topic_ids', id).introduced_in).toBe('2.0.0'))
  })

  it('enforces v2 optional-tag completion semantics and rejects legacy status emission', () => {
    expect(
      artifactIssueMessages({
        ...baseArtifactContract,
        records: [{ ...baseRecord, technology_tag_status: 'not_applicable' }],
      }),
    ).toContain('technology_tag_status must be "tagged" when technology_tags is nonempty.')

    expect(
      artifactIssueMessages({
        ...baseArtifactContract,
        records: [{ ...baseRecord, technology_tags: [], technology_tag_status: 'tagged' }],
      }),
    ).toContain(
      'technology_tag_status must be "not_applicable" or "not_assessable" when technology_tags is empty.',
    )

    expect(
      artifactIssueMessages({
        ...baseArtifactContract,
        records: [{ ...baseRecord, disease_tag_status: 'legacy_unspecified' }],
      }).join('\n'),
    ).toMatch(/legacy_unspecified/u)

    expect(
      literatureEnrichmentArtifactV2Schema.parse({
        ...baseArtifactContract,
        records: [
          {
            ...baseRecord,
            technology_tags: [],
            technology_tag_status: 'not_assessable',
            disease_tags: [],
            disease_tag_status: 'not_applicable',
          },
        ],
      }).records,
    ).toHaveLength(1)
  })

  it('rejects unsupported and duplicate controlled values with field and value details', () => {
    expect(
      artifactIssueMessages({
        ...baseArtifactContract,
        records: [{ ...baseRecord, technology_tags: ['not-a-technology'] }],
      }),
    ).toContain('Unsupported technology_tags value: "not-a-technology"')

    expect(
      artifactIssueMessages({
        ...baseArtifactContract,
        records: [{ ...baseRecord, clinical_purposes: ['diagnosis', 'diagnosis'] }],
      }),
    ).toContain('Duplicate clinical_purposes value: "diagnosis"')
  })

  it('serializes v2 artifacts deterministically with canonical arrays and record order', () => {
    const second = {
      ...baseRecord,
      master_row_id: '2',
      pmid: '200',
      topic_ids: ['pleural-interventions', 'basic-bronchoscopy'],
      technology_tags: ['thoracentesis', 'chest-tube'],
      clinical_purposes: ['treatment', 'diagnosis'],
      disease_tags: ['pleural-disease', 'lung-cancer'],
    }
    const tenth = { ...baseRecord, master_row_id: '10', pmid: '1000' }
    const forward = {
      ...baseArtifactContract,
      records: [tenth, second],
    }
    const reverse = {
      ...forward,
      records: [
        {
          ...second,
          topic_ids: [...second.topic_ids].reverse(),
          technology_tags: [...second.technology_tags].reverse(),
          clinical_purposes: [...second.clinical_purposes].reverse(),
          disease_tags: [...second.disease_tags].reverse(),
        },
        tenth,
      ],
    }

    const first = serializeLiteratureEnrichmentArtifactV2(forward)
    const secondPass = serializeLiteratureEnrichmentArtifactV2(reverse)
    expect(secondPass).toBe(first)
    expect(serializeLiteratureEnrichmentArtifactV2(JSON.parse(first))).toBe(first)
    expect(first.endsWith('\n')).toBe(true)
    expect(
      JSON.parse(first).records.map((record: { master_row_id: string }) => record.master_row_id),
    ).toEqual(['2', '10'])
  })

  it('adapts v1 blanks only as legacy unspecified and never infers applicability', () => {
    expect(
      adaptLiteratureEnrichmentRecordV1({
        ...baseRecord,
        technology_tags: [],
        disease_tags: [],
      }),
    ).toMatchObject({
      technology_tag_status: 'legacy_unspecified',
      disease_tag_status: 'legacy_unspecified',
    })
    expect(adaptLiteratureEnrichmentRecordV1(baseRecord)).toMatchObject({
      technology_tag_status: 'tagged',
      disease_tag_status: 'tagged',
    })
  })

  it('accepts aliases only through an explicit adoption-report resolver', () => {
    const adoption = loadLiteratureEnrichmentTaxonomyAdoption('2.0.0')
    const alias = adoption.migration_mappings.find(
      (mapping) =>
        mapping.mapping_type === 'alias' &&
        !labelsV2.fields[mapping.field].some((value) => value.id === mapping.source_id),
    )
    expect(alias).toBeDefined()

    const aliasRecord = {
      ...baseRecord,
      [alias!.field]:
        alias!.field === 'study_design' || alias!.field === 'publication_status'
          ? alias!.source_id
          : [alias!.source_id],
    }
    expect(
      artifactIssueMessages({
        ...baseArtifactContract,
        records: [aliasRecord],
      }).join('\n'),
    ).toMatch(new RegExp(`Unsupported ${alias!.field} value`, 'u'))
    expect(resolveLiteratureEnrichmentAlias(adoption, alias!.field, alias!.source_id)).toEqual(
      alias!.replacement_ids,
    )
  })

  it('uses English fallback for untranslated and unknown locales', () => {
    const english = lookupLiteratureEnrichmentLabel(
      labelsV2,
      'technology_tags',
      'thoracentesis',
      'en',
    )
    expect(english).toMatchObject({
      label: 'Thoracentesis',
      resolvedLocale: 'en',
      usedEnglishFallback: false,
    })

    for (const locale of ['es', 'zh-CN', 'ar', 'ko', 'fr-FR']) {
      expect(
        lookupLiteratureEnrichmentLabel(labelsV2, 'technology_tags', 'thoracentesis', locale),
      ).toMatchObject({
        label: english.label,
        description: english.description,
        resolvedLocale: 'en',
        usedEnglishFallback: true,
      })
    }
  })

  it('keeps the historical v1 review contract readable and pinned to v1 values', () => {
    const historical = {
      relevanceLabel: 'include_core',
      metadataSufficiency: 'adequate_abstract',
      reviewerConfidence: 'high',
      topicIds: ['ebus-mediastinal-staging'],
      technologyTags: ['convex-ebus'],
      clinicalPurposes: ['diagnosis'],
      diseaseTags: ['lung-cancer'],
      studyDesign: 'diagnostic-accuracy',
      publicationStatus: 'full-article',
      categorizationFromFullText: false,
      notes: '',
      usedSupplementalMetadata: false,
      reviewSeconds: 30,
    }
    expect(literatureGoldCompleteReviewSchema.parse(historical)).toMatchObject(historical)
    expect(() =>
      literatureGoldCompleteReviewSchema.parse({
        ...historical,
        technologyTags: ['thoracentesis'],
      }),
    ).toThrow('Unknown controlled label: thoracentesis')
  })
})
