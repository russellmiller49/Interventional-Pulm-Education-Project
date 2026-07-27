import { resolve } from 'node:path'

import { inferLiteratureManifestEntry } from '../../../../scripts/literature/lib/manifest'

describe('literature manifest corpus provenance', () => {
  const root = resolve('/tmp/ip-literature-corpus')

  it.each([
    ['Full Journals/example.nbib', 'core_journal', 'core-journal-corpus'],
    ['Expanded-journal/example.nbib', 'expanded_journal', 'expanded-journal-corpus'],
    ['All-PubMed discovery/example.nbib', 'all_pubmed_discovery', 'all-pubmed-discovery-corpus'],
  ] as const)('maps the supplied corpus folder %s', (relativePath, sourceKind, sourceId) => {
    const entry = inferLiteratureManifestEntry(resolve(root, relativePath), root)

    expect(entry.status).toBe('mapped')
    expect(entry.source_kind).toBe(sourceKind)
    expect(entry.source_id).toBe(sourceId)
  })

  it('does not infer arbitrary unmatched directories', () => {
    const entry = inferLiteratureManifestEntry(resolve(root, 'Other/example.nbib'), root)

    expect(entry.status).toBe('needs_mapping')
    expect(entry.source_kind).toBe('unmapped')
  })
})
