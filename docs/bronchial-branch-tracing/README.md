# Bronchial branch tracing preview

Entry: `/en/learn/anatomy/branch-tracing`. Direct URLs are anonymous and noindex. The module has no catalog/search/sitemap entry. This is an unpublished preview; no deployment or merge is implied by this branch.

Eight synthetic lessons use the existing structured lesson stage. Practice and Assess each contain four independent geometric interpretations with delayed feedback. The secondary Practice explorer provides one real resampled CT stack, the corresponding complete airway surface, virtual bronchoscopy, reversible graph traversal and local route export. Clinical case scoring is unavailable pending checkpoint review.

## Review the implementation

- [Module brief and teaching flow](module-brief.md)
- [Asset audit, correspondence and coverage](audit.md)
- [Architecture and progress boundary](architecture-decision.md)
- [QA, H1–H12, exact checks and limitations](qa-report.md)
- [Clinical authoring worksheet](clinical-review.md)
- [Performance measurements](browser-metrics.json)
- [Inspected screenshots](review/)

Start the website with its normal dev command, or `npx --no-install next dev --webpack -p 3110` when the unchanged embedded trainers are already built. Open `http://localhost:3110/en/learn/anatomy/branch-tracing`.

Regenerate preview assets with `python3 scripts/branch-tracing/build-preview.py`. This deterministic script reads only the existing public patient-new preview and surface, writes only `public/branch-tracing/preview-v1`, rejects changed source hashes, omits candidate branch names, and preserves compressed surface coordinates. The full export is about 6.3 MB; images and the 3D viewer load on demand. It does not read a raw DICOM or mutate a Slicer scene.

Progress uses the site's existing local bounded activity envelope. Incomplete lessons restart after reload while first attempts and completion remain. The assessment measures only these synthetic interpretation exercises; it is not certification or validation on a new patient CT.
