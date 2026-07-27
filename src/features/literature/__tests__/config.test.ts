import manifestExample from '../../../../config/literature/import-manifest.example.json'
import {
  flattenLiteratureTaxonomy,
  literatureQueryRegistry,
  literatureTaxonomy,
  literatureTopicRules,
  validateLiteratureConfigRelations,
} from '@/features/literature/config'
import {
  literatureImportManifestSchema,
  literatureQueryRegistrySchema,
  literatureTaxonomySchema,
  literatureTopicRulesSchema,
} from '@/features/literature/schemas/config'
import { assertCurrentQueryRegistry } from '../../../../scripts/literature/lib/config'

describe('literature configuration', () => {
  it('validates the committed registry, taxonomy, rules, and example manifest', () => {
    expect(() => literatureQueryRegistrySchema.parse(literatureQueryRegistry)).not.toThrow()
    expect(() => literatureTaxonomySchema.parse(literatureTaxonomy)).not.toThrow()
    expect(() => literatureTopicRulesSchema.parse(literatureTopicRules)).not.toThrow()
    expect(() => literatureImportManifestSchema.parse(manifestExample)).not.toThrow()
  })

  it('validates cross-file topic and query IDs', () => {
    expect(validateLiteratureConfigRelations()).toEqual({
      queryCount: 17,
      ruleCount: 20,
      topicCount: 77,
    })
    expect(flattenLiteratureTaxonomy()).toHaveLength(77)
  })

  it('rejects a needs-mapping entry that claims known provenance', () => {
    const invalid = JSON.parse(JSON.stringify(manifestExample)) as typeof manifestExample
    invalid.files[2].source_id = 'chest'

    expect(() => literatureImportManifestSchema.parse(invalid)).toThrow(
      /cannot claim a source or query ID/u,
    )
  })

  it('rejects a manifest for a registry version that is not loaded', () => {
    const stale = literatureImportManifestSchema.parse({
      ...manifestExample,
      query_registry_version: '0.9.0',
    })

    expect(() => assertCurrentQueryRegistry(stale)).toThrow(/does not match loaded registry/u)
  })
})
