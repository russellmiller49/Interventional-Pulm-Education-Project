# IP Literature Explorer Starter Pack

This pack contains implementation instructions and configuration files for beginning the literature-search module in `russellmiller49/Interventional-Pulm-Education-Project`.

## Files

- `AI_Coding_Assistant_IP_Literature_Module_Phase_1.md` — paste this into the coding assistant first.
- `AI_Coding_Assistant_IP_Literature_Module_Phase_2.md` — use only after Phase 1 works.
- `IP_PubMed_Query_Pack_v1.md` — human-readable source-query documentation.
- `ip_pubmed_query_registry_v1.json` — machine-readable journals and discovery-query registry.
- `literature_taxonomy_v1.json` — proposed multi-label topic taxonomy.
- `literature_import_manifest_template_v1.json` — example mapping of NBIB files to their source queries.

## Before starting the coding assistant

Place the `.nbib` files in a local folder. The implementation prompt directs the assistant to use:

```text
local-data/literature/nbib/
```

The raw exports should remain Git-ignored. Keep a copy of the original files outside the repository as the source archive.

The filenames do not reliably encode the source query. Complete a local `import-manifest.json` mapping every file to the journal or discovery query that produced it. Uncertain mappings should be marked `unmapped` rather than guessed.
